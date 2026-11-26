import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreProfile, countMonths } from '../lib/score.js';
import { topGaps, matchProgrammes } from '../lib/report.js';
import { ProfileSchema } from '../lib/schema.js';
import { FIELD_IDS } from '../config/fields.js';

const today = new Date('2026-11-26');
const file = { pages: 1, hasPhoto: false, hasDob: false };
const empty = ProfileSchema.parse({});
const strong = ProfileSchema.parse({
  degreeField: 'cs',
  jobs: [{ title: 'Engineer', start: '2025-01', end: '2026-06', fields: ['cs', 'data-ai'] }],
  publications: [{ title: 'Paper', type: 'conference' }],
  quality: { datedEntries: true, quantifiedResults: true, standardSections: true },
});
const answers = { cgpa: 9.1, scale: '10', englishTest: 'ielts', englishScore: 7.5, targetField: 'data-ai', intakeYear: 2027 };

test('strong profile is 80+ and Strong', () => {
  const r = scoreProfile(strong, answers, file, today);
  assert.ok(r.total >= 80, String(r.total));
  assert.equal(r.band, 'Strong');
});
test('weak profile is under 40 and flags English', () => {
  const r = scoreProfile({ ...empty, degreeField: 'cs' }, { ...answers, cgpa: 6, englishTest: 'none' }, file, today);
  assert.ok(r.total < 40, String(r.total));
  assert.equal(r.hardGaps.length, 1);
});
test('typed CGPA wins over resume CGPA', () => {
  const r = scoreProfile({ ...strong, cgpa: { value: 9.9, scale: '10' } }, { ...answers, cgpa: 6 }, file, today);
  assert.equal(r.categories[0].points, 8);
});
test('academic tiers, scales and backlog penalty', () => {
  const points = (cgpa, scale, backlogs = false) =>
    scoreProfile({ ...empty, backlogs }, { ...answers, cgpa, scale }, file, today).categories[0].points;
  assert.deepEqual([points(85, 'percent'), points(84.99, 'percent'), points(3, '4'), points(5.5, '10'), points(5, '10'), points(9, '10', true), points(5, '10', true)],
    [30, 24, 24, 8, 2, 26, 0]);
});
test('months: overlaps counted once, unrelated half', () => {
  const j = (start, end, fields) => ({ start, end, fields, durationMonths: null });
  assert.equal(countMonths([j('2025-01', '2025-06', ['cs']), j('2025-01', '2025-06', ['cs'])], 'cs', today), 6);
  assert.equal(countMonths([j('2025-01', '2025-12', [])], 'cs', today), 6);
  assert.equal(countMonths([j('2026-11', 'present', ['cs'])], 'cs', today), 1);
});
test('three gaps with filled templates', () => {
  const a = { ...answers, cgpa: 6, englishTest: 'none' };
  const gaps = topGaps(scoreProfile(empty, a, file, today), a);
  assert.equal(gaps.length, 3);
  for (const g of gaps) assert.doesNotMatch(g.fix, /\{|undefined/);
});
test('every field gets 3 programmes that include it', () => {
  for (const id of FIELD_IDS) {
    const list = matchProgrammes(empty, id);
    assert.equal(list.length, 3);
    assert.ok(list.every((p) => p.why.startsWith('Matches')), id);
  }
});
