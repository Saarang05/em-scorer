import JSZip from 'jszip';
import { AppError } from './errors.js';

export const MAX_BYTES = 5 * 1024 * 1024;
const UNREADABLE = "We couldn't read text from this file. Upload a text PDF or DOCX.";
const unreadable = (detail) => new AppError(422, 'unreadable', UNREADABLE, detail);

let pdfjsPromise;
function loadPdfjs() {
  pdfjsPromise ??= (async () => {
    // pdf.js expects these browser objects. Text extraction never draws, so stubs are enough.
    globalThis.DOMMatrix ??= class DOMMatrix {};
    globalThis.ImageData ??= class ImageData {};
    globalThis.Path2D ??= class Path2D {};
    // Importing the worker explicitly makes sure Vercel bundles it.
    globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    return import('pdfjs-dist/legacy/build/pdf.mjs');
  })();
  return pdfjsPromise;
}

async function parsePdf(buffer) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0, isEvalSupported: false, useSystemFonts: false });
  try {
    const doc = await task.promise;
    const pages = doc.numPages;
    let text = '';
    for (let n = 1; n <= Math.min(pages, 10); n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      text += content.items.map((i) => (i.str ?? '') + (i.hasEOL ? '\n' : '')).join('') + '\n';
    }
    let hasPhoto = false;
    try {
      const page = await doc.getPage(1);
      const ops = await page.getOperatorList();
      hasPhoto = ops.fnArray.some((fn, i) => {
        if (fn !== pdfjs.OPS.paintImageXObject) return false;
        const [, w, h] = ops.argsArray[i];
        return w >= 90 && h >= 90 && w / h > 0.55 && w / h < 1.35; // portrait-shaped picture
      });
    } catch { /* photo detection is best-effort */ }
    return { text, pages, hasPhoto };
  } catch (e) {
    throw unreadable(e?.name);
  } finally {
    await task.destroy().catch(() => {});
  }
}

const decodeXml = (s) =>
  s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e];
  });

const xmlToText = (xml) =>
  xml
    .split(/<\/w:p>/)
    .map((p) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(?:tab|br)\b[^>]*\/>/g)]
      .map((m) => (m[1] === undefined ? ' ' : decodeXml(m[1]))).join(''))
    .join('\n');

async function parseDocx(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file('word/document.xml')) throw unreadable('not-docx');
    const read = async (name) => {
      const f = zip.file(name);
      if (!f) return '';
      if ((f._data?.uncompressedSize ?? 0) > 20 * 1024 * 1024) throw unreadable('too-big-inside');
      return f.async('string');
    };
    const parts = Object.keys(zip.files).filter((n) => /^word\/(header\d*|document|footer\d*)\.xml$/.test(n));
    parts.sort((a, b) => (a.includes('header') ? -1 : b.includes('header') ? 1 : 0));
    let text = '';
    for (const name of parts) text += xmlToText(await read(name)) + '\n';
    const saved = Number((await read('docProps/app.xml')).match(/<Pages>(\d+)<\/Pages>/)?.[1] ?? 0);
    const estimated = Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 550));
    const media = Object.values(zip.files).filter((f) => /^word\/media\/.+\.(jpe?g|png)$/i.test(f.name));
    const hasPhoto = media.some((f) => (f._data?.uncompressedSize ?? 0) > 8000);
    return { text, pages: Math.max(saved, estimated), hasPhoto };
  } catch (e) {
    throw e instanceof AppError ? e : unreadable(e?.name);
  }
}

export async function parseResume(buffer) {
  if (!buffer.length) throw new AppError(400, 'empty', 'The file is empty. Choose a PDF or DOCX resume.');
  if (buffer.length > MAX_BYTES) throw new AppError(413, 'too_large', 'File is larger than 5 MB. Upload a smaller PDF or DOCX.');
  const isPdf = buffer.subarray(0, 1024).includes('%PDF-');
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (!isPdf && !isZip) throw new AppError(415, 'bad_type', 'Only PDF or DOCX files are accepted.');
  const result = isPdf ? await parsePdf(buffer) : await parseDocx(buffer);
  result.text = result.text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  const letters = result.text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 150) throw unreadable('no-text');
  result.hasDob = /\b(date of birth|d\.\s?o\.\s?b\.?|dob)\b/i.test(result.text);
  return result;
}
