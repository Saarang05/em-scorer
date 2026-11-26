import { RUBRIC, BANDS } from '../config/rubric.js';
import { FIELDS } from '../config/fields.js';

const tier = (value, tiers, fallback = 0) => tiers.find(([min]) => value >= min)?.[1] ?? fallback;
const monthIndex = (s, now) => {
  if (!s) return null;
  if (/present|current|now|ongoing/i.test(s)) return now;
  const m = String(s).match(/^(\d{4})(?:-(\d{1,2}))?/);
  if (!m) return null;
  return Number(m[1]) * 12 + Math.min(Math.max(Number(m[2] ?? 1), 1), 12) - 1;
};

export function countMonths(entries, targetField, today = new Date()) {
  const now = today.getUTCFullYear() * 12 + today.getUTCMonth();
  const wanted = FIELDS[targetField].direct.concat(targetField);
  const relevant = new Set(), other = new Set();
  let looseRelevant = 0, looseOther = 0;
  for (const job of entries) {
    const isRelevant = job.fields.some((f) => wanted.includes(f));
    const start = monthIndex(job.start, now), end = monthIndex(job.end, now);
    if (start !== null && end !== null) {
      for (let m = start; m <= Math.min(end, now); m++) (isRelevant ? relevant : other).add(m);
    } else if (job.durationMonths) {
      if (isRelevant) looseRelevant += job.durationMonths; else looseOther += job.durationMonths;
    }
  }
  const otherOnly = [...other].filter((m) => !relevant.has(m)).length;
  return relevant.size + looseRelevant + RUBRIC.work.unrelatedWeight * (otherOnly + looseOther);
}

export function bandFor(total) {
  return BANDS.find((b) => total >= b.min);
}

/** Pure and deterministic: same profile + answers + date gives the same score. */
export function scoreProfile(profile, answers, file, today = new Date()) {
  const R = RUBRIC, target = FIELDS[answers.targetField];

  const percent = Math.round(answers.cgpa * R.academics.toPercent[answers.scale] * 100) / 100;
  const academics = Math.max(0, tier(percent, R.academics.tiers) - (profile.backlogs ? R.academics.backlogPenalty : 0));

  const fit = target.direct.includes(profile.degreeField) ? 'direct'
    : target.related.includes(profile.degreeField) ? 'related' : 'unrelated';

  const months = countMonths([...profile.jobs, ...profile.internships], answers.targetField, today);
  const work = tier(months, R.work.tiers, months > 0 ? R.work.anyWork : R.work.none);

  const research = profile.publications.length ? R.research.publication
    : profile.researchProjects.length ? R.research.project : 0;

  const wanted = target.direct.concat(answers.targetField);
  const relevantProjects = profile.projects.filter((p) => p.substantial && p.fields.some((f) => wanted.includes(f))).length;
  const projects = Math.min(R.projects.max, relevantProjects * R.projects.perProject);

  const english = answers.englishTest === 'none' ? 0 : tier(answers.englishScore, R.english[answers.englishTest]);

  const lp = R.leadership.points;
  const languages = new Set(profile.languages.map((l) => l.toLowerCase().replace(/\(.*?\)|[-:–].*$/g, '').trim())
    .filter((l) => l && !l.startsWith('english')));
  const leadership = Math.min(R.leadership.max,
    profile.leadership.reduce((sum, item) => sum + lp[item.type], 0) + languages.size * lp.language);

  const checks = {
    shortEnough: file.pages <= R.quality.maxPages,
    datedEntries: profile.quality.datedEntries,
    quantifiedResults: profile.quality.quantifiedResults,
    noClutter: !file.hasPhoto && !file.hasDob,
    standardSections: profile.quality.standardSections,
  };
  const quality = Math.min(R.quality.max, Object.values(checks).filter(Boolean).length * R.quality.perCheck);

  const points = { academics, degreeFit: R.degreeFit[fit], work, research, projects, english, leadership, quality };
  const categories = Object.entries(points).map(([id, p]) => ({ id, label: R[id].label, points: p, max: R[id].max }));
  const total = categories.reduce((s, c) => s + c.points, 0);
  const band = bandFor(total);
  const hardGaps = answers.englishTest === 'none' || english === 0
    ? [answers.englishTest === 'none'
      ? 'English: no IELTS/TOEFL score. This is a hard gap.'
      : 'English: your score is below the minimum (IELTS 6.0 / TOEFL 80). This is a hard gap.']
    : [];

  return {
    total, band: band.name, message: band.message, priority: band.priority, categories, hardGaps,
    facts: { percent, backlogs: profile.backlogs, fit, months, relevantProjects, checks },
  };
}
