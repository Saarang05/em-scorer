import { gunzipSync } from 'node:zlib';
import { AppError, json, errorResponse } from '../lib/errors.js';
import { parseResume, MAX_BYTES } from '../lib/parse.js';
import { extractProfile, llmConfig } from '../lib/llm.js';
import { SCHEMA_VERSION, ProfileSchema } from '../lib/schema.js';
import { scoreProfile } from '../lib/score.js';
import { topGaps, matchProgrammes } from '../lib/report.js';
import { redis } from '../lib/store.js';
import { rateLimit, seal, sha256 } from '../lib/security.js';
import { Answers, check } from '../lib/validate.js';

const CACHE_SECONDS = 30 * 24 * 3600;

/** Same text -> same extracted fields -> same score. Only extracted fields are stored, never the text. */
async function getProfile(text) {
  const key = `em:profile:${SCHEMA_VERSION}:${sha256(text)}`;
  const hit = await redis('GET', key);
  if (hit) return ProfileSchema.parse(JSON.parse(hit));
  const { profile } = await extractProfile(text);
  // NX: if two identical uploads race, both use whichever was saved first.
  await redis('SET', key, JSON.stringify(profile), 'EX', CACHE_SECONDS, 'NX');
  return ProfileSchema.parse(JSON.parse(await redis('GET', key)));
}

async function readFile(request) {
  if (Number(request.headers.get('content-length')) > MAX_BYTES) {
    throw new AppError(413, 'too_large', 'File is larger than 5 MB. Upload a smaller PDF or DOCX.');
  }
  const body = Buffer.from(await request.arrayBuffer());
  if (request.headers.get('x-file-gzip') !== '1') return body;
  try {
    return gunzipSync(body, { maxOutputLength: MAX_BYTES });
  } catch {
    throw new AppError(413, 'too_large', 'We could not accept this file. Upload a PDF or DOCX under 5 MB.');
  }
}

export async function POST(request) {
  let release;
  try {
    llmConfig();
    let raw;
    try { raw = JSON.parse(decodeURIComponent(request.headers.get('x-answers') ?? '')); }
    catch { throw new AppError(400, 'invalid', 'Please answer the four questions.'); }
    const answers = check(Answers, raw);

    release = await rateLimit(request);
    const file = await parseResume(await readFile(request));
    const profile = await getProfile(file.text);
    const result = scoreProfile(profile, answers, file);

    const report = {
      categories: result.categories,
      gaps: topGaps(result, answers),
      programmes: matchProgrammes(profile, answers.targetField),
    };
    const teaser = { score: result.total, band: result.band, message: result.message, hardGaps: result.hardGaps };
    const token = seal({
      expires: Date.now() + 24 * 3600_000,
      teaser, report,
      record: { answers, priority: result.priority, profile },
    });
    return json({ ...teaser, token });
  } catch (e) {
    await release?.();
    return errorResponse(e);
  }
}
