// End-to-end API test with a fake AI service (no real key or network needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

Object.assign(process.env, { LLM_API_KEY: 'test-key', LLM_PROVIDER: 'openai', LLM_MODEL: 'fake', APP_SECRET: 'x'.repeat(32), RATE_LIMIT_PER_HOUR: '5' });
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.KV_REST_API_URL;

let llmCalls = 0, fail = false;
globalThis.fetch = async () => {
  llmCalls++;
  if (fail) return new Response('down', { status: 503 });
  const content = JSON.stringify({ education: [], degreeField: 'cs', quality: {} });
  return Response.json({ choices: [{ message: { content } }] });
};
const { POST: score } = await import('../api/score.js');
const { POST: report } = await import('../api/report.js');
const sample = (name) => readFile(new URL(`../test-resumes/${name}`, import.meta.url));
const answers = { cgpa: 9.1, scale: '10', englishTest: 'ielts', englishScore: 7.5, targetField: 'cs', intakeYear: 2027 };

const send = (body, ip, extra = {}) => score(new Request('http://x/api/score', {
  method: 'POST', body, headers: { 'x-answers': encodeURIComponent(JSON.stringify(answers)), 'x-real-ip': ip, ...extra },
}));
const gate = (body) => report(new Request('http://x/api/report', { method: 'POST', body: JSON.stringify(body) }));
const lead = { name: 'Asha Rao', email: 'asha@example.com', phone: '+91 98765 43210', consent: true };

test('AI failure gives a human message and does not use up the limit', async () => {
  fail = true;
  const pdf = await sample('weak.docx');
  for (let i = 0; i < 7; i++) assert.equal((await send(pdf, '5')).status, 502);
  fail = false;
  assert.equal((await send(pdf, '5')).status, 200);
});
test('PDF: same score 3 times, one AI call, teaser hides report', async () => {
  const pdf = await sample('strong.pdf');
  const results = [];
  const before = llmCalls;
  for (let i = 0; i < 3; i++) results.push(await (await send(pdf, '1')).json());
  assert.equal(new Set(results.map((r) => r.score)).size, 1);
  assert.equal(llmCalls - before, 1);
  assert.deepEqual(Object.keys(results[0]).sort(), ['band', 'hardGaps', 'message', 'score', 'token']);

  assert.equal((await gate({ token: results[0].token })).status, 400);
  assert.equal((await gate({ token: results[0].token, lead: { ...lead, consent: false } })).status, 400);
  assert.equal((await gate({ lead })).status, 401);
  assert.equal((await gate({ token: results[0].token.slice(0, -4) + 'AAAA', lead })).status, 401);
  const full = await (await gate({ token: results[0].token, lead })).json();
  assert.equal(full.report.categories.length, 8);
  assert.equal(full.report.programmes.length, 3);
});
test('DOCX and gzipped upload work', async () => {
  assert.equal((await send(await sample('strong.docx'), '2')).status, 200);
  assert.equal((await send(gzipSync(await sample('weak.pdf')), '2', { 'x-file-gzip': '1' })).status, 200);
});
test('scanned PDF, wrong type and huge file are refused without a score', async () => {
  for (const [body, status] of [[await sample('scanned.pdf'), 422], [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 415], [Buffer.alloc(12e6), 413], [Buffer.from('%PDF-1.7 broken'), 422]]) {
    const res = await send(body, '3');
    assert.equal(res.status, status);
    assert.equal((await res.json()).score, undefined);
  }
});
test('6th scoring in an hour is refused', async () => {
  const pdf = await sample('strong.pdf');
  for (let i = 0; i < 5; i++) assert.equal((await send(pdf, '4')).status, 200);
  assert.equal((await send(pdf, '4')).status, 429);
});
