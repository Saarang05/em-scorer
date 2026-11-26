const $ = (id) => document.getElementById(id);
const MAX_BYTES = 5 * 1024 * 1024;
const WIRE_LIMIT = 4.4 * 1024 * 1024; // Vercel rejects request bodies above 4.5 MB
let file = null, token = null, busy = false;

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function show(view) {
  for (const v of ['form', 'loading', 'result']) $(`view-${v}`).hidden = v !== view;
  window.scrollTo(0, 0);
}

function showError(box, message, canRetry = false) {
  box.querySelector('p').textContent = message;
  const retry = box.querySelector('button');
  if (retry) retry.hidden = !canRetry;
  box.hidden = false;
  box.scrollIntoView({ block: 'center' });
}

async function api(path, options, timeout = 45000) {
  let response, data;
  try {
    response = await fetch(path, { ...options, signal: AbortSignal.timeout(timeout) });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'This is taking too long. Please retry.' : 'Network problem. Check your connection and retry.');
  }
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok || !data) {
    const error = new Error(data?.error?.message || (response.status === 413 ? 'That file is too large to upload.' : 'Something went wrong. Please retry.'));
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

// ---------- file selection ----------
function fileProblem(f) {
  if (!/\.(pdf|docx)$/i.test(f.name)) return 'Only PDF or DOCX files are accepted.';
  if (f.size > MAX_BYTES) return 'File is larger than 5 MB. Upload a smaller PDF or DOCX.';
  if (!f.size) return 'That file is empty. Choose another one.';
  return null;
}
function choose(f) {
  if (!f) return;
  const problem = fileProblem(f);
  file = problem ? null : f;
  $('file-name').textContent = file ? file.name : 'Tap to upload your resume';
  if (problem) { $('file').value = ''; showError($('form-error'), problem); }
  else $('form-error').hidden = true;
}
$('file').addEventListener('change', (e) => choose(e.target.files[0]));
for (const type of ['dragover', 'dragleave', 'drop']) {
  $('drop').addEventListener(type, (e) => {
    e.preventDefault();
    $('drop').classList.toggle('over', type === 'dragover');
    if (type === 'drop') choose(e.dataTransfer.files[0]);
  });
}

$('englishTest').addEventListener('change', (e) => {
  const test = e.target.value, input = $('englishScore');
  input.hidden = !test || test === 'none';
  input.value = '';
  input.step = test === 'ielts' ? '0.5' : '1';
  input.placeholder = test === 'ielts' ? 'Band, e.g. 7' : 'Score, e.g. 95';
});

// ---------- scoring ----------
function readAnswers() {
  const cgpa = $('cgpa').value, scale = $('scale').value, englishTest = $('englishTest').value;
  const score = $('englishScore').value;
  const max = { 10: 10, 4: 4, percent: 100 }[scale];
  if (!cgpa || Number(cgpa) <= 0 || Number(cgpa) > max) return { problem: `Enter your CGPA (up to ${max}).` };
  if (!englishTest) return { problem: 'Choose your English test, or "None yet".' };
  if (englishTest !== 'none' && (score === '' || Number(score) < 0 || Number(score) > (englishTest === 'ielts' ? 9 : 120))) {
    return { problem: `Enter your ${englishTest.toUpperCase()} score.` };
  }
  if (!$('targetField').value) return { problem: 'Choose your target field.' };
  return { answers: {
    cgpa: Number(cgpa), scale, englishTest,
    englishScore: englishTest === 'none' ? null : Number(score),
    targetField: $('targetField').value, intakeYear: Number($('intakeYear').value),
  } };
}

async function payload(f) {
  if (f.size <= WIRE_LIMIT) return { body: f, headers: {} };
  if (window.CompressionStream) {
    const body = await new Response(f.stream().pipeThrough(new CompressionStream('gzip'))).blob();
    if (body.size <= WIRE_LIMIT) return { body, headers: { 'x-file-gzip': '1' } };
  }
  throw new Error('This file is too large to send. Please export it below 4.4 MB (remove large images) and try again.');
}

function animateSteps() {
  const steps = [...$('steps').children];
  const mark = (n) => steps.forEach((li, i) => { li.className = i < n ? 'done' : i === n ? 'active' : ''; });
  mark(0);
  const timers = [1200, 3000, 9000].map((ms, i) => setTimeout(() => mark(i + 1), ms));
  return () => timers.forEach(clearTimeout);
}

async function submitScore() {
  if (busy) return;
  const box = $('form-error');
  if (!file) return showError(box, 'Upload your resume first (PDF or DOCX).');
  const { answers, problem } = readAnswers();
  if (problem) return showError(box, problem);
  busy = true;
  box.hidden = true;
  show('loading');
  const stop = animateSteps();
  try {
    const { body, headers } = await payload(file);
    const result = await api('/api/score', {
      method: 'POST', body,
      headers: { ...headers, 'content-type': 'application/octet-stream', 'x-answers': encodeURIComponent(JSON.stringify(answers)) },
    });
    renderTeaser(result);
    show('result');
  } catch (e) {
    show('form');
    // The file stays selected, so Retry needs no re-upload.
    const noRetry = ['unreadable', 'bad_type', 'too_large', 'empty', 'rate_limited'].includes(e.code);
    showError(box, e.message, !noRetry);
  } finally {
    stop();
    busy = false;
  }
}
$('score-form').addEventListener('submit', (e) => { e.preventDefault(); submitScore(); });
$('retry').addEventListener('click', submitScore);

function renderTeaser(r) {
  token = r.token;
  $('score').textContent = r.score;
  $('band').textContent = r.band;
  $('message').textContent = r.message;
  $('hard-gaps').replaceChildren(...r.hardGaps.map((g) => el('p', `⚠️ ${g}`, 'card error')));
  $('report').hidden = true;
  $('lead-form').hidden = false;
  $('lead-error').hidden = true;
}

// ---------- lead gate ----------
$('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const button = e.target.querySelector('button');
  const lead = { name: $('name').value, email: $('email').value, phone: $('phone').value, consent: $('consent').checked };
  button.disabled = true;
  $('lead-error').hidden = true;
  try {
    const { report } = await api('/api/report', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, lead }),
    }, 15000);
    renderReport(report);
  } catch (err) {
    showError($('lead-error'), err.message);
  } finally {
    button.disabled = false;
  }
});

function renderReport(report) {
  $('categories').replaceChildren(...report.categories.map((c) => {
    const row = el('div', undefined, 'category'), head = el('div'), bar = el('progress');
    head.append(el('span', c.label), el('strong', `${c.points}/${c.max}`));
    bar.max = c.max; bar.value = c.points; bar.setAttribute('aria-label', c.label);
    row.append(head, bar);
    return row;
  }));
  $('gaps').replaceChildren(...(report.gaps.length ? report.gaps.map((g) => {
    const li = el('li');
    li.append(el('strong', `${g.label} (−${g.shortfall})`), el('div', g.fix));
    return li;
  }) : [el('li', 'No gaps: you have full points in every category.')]));
  $('programmes').replaceChildren(...report.programmes.map((p) => {
    const a = el('a', undefined, 'programme');
    a.href = p.url; a.target = '_blank'; a.rel = 'noopener';
    a.append(el('strong', p.name), el('span', p.why));
    return a;
  }));
  $('catalogue').href = report.programmes[0]?.catalogue ?? '';
  $('lead-form').hidden = true;
  $('report').hidden = false;
  $('report').scrollIntoView();
}

$('again').addEventListener('click', () => show('form'));

// ---------- dropdowns ----------
async function loadConfig() {
  try {
    const { fields, intakeYears } = await api('/api/config', {}, 10000);
    $('targetField').replaceChildren(new Option('Select', ''), ...fields.map((f) => new Option(f.label, f.id)));
    $('intakeYear').replaceChildren(...intakeYears.map((y) => new Option(y, y)));
  } catch {
    showError($('form-error'), 'Could not load the form. Check your connection and refresh the page.');
  }
}
loadConfig();
