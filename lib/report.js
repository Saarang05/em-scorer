import { RUBRIC } from '../config/rubric.js';
import { FIELDS } from '../config/fields.js';
import { FIXES, QUALITY_FIXES } from '../config/gaps.js';
import { PROGRAMMES, CATALOGUE_URL } from '../config/programmes.js';

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);

export function topGaps(result, answers, count = 3) {
  const f = result.facts;
  return result.categories
    .map((c, order) => ({ ...c, shortfall: c.max - c.points, order }))
    .filter((c) => c.shortfall > 0)
    .sort((a, b) => b.shortfall - a.shortfall || a.order - b.order)
    .slice(0, count)
    .map((c) => {
      let template = FIXES[c.id];
      if (typeof template !== 'string') template = template[c.points ? 'some' : 'none'];
      const nextTier = [...RUBRIC.academics.tiers].reverse().find(([min]) => min > f.percent)?.[0];
      const nextMonths = [...RUBRIC.work.tiers].reverse().find(([min]) => min > f.months)?.[0];
      let fix = fill(template, {
        field: FIELDS[answers.targetField].label, points: c.points, max: c.max,
        percent: f.percent, nextTier, months: f.months, nextMonths,
        backlogNote: f.backlogs ? ` and clear your backlogs (−${RUBRIC.academics.backlogPenalty} points)` : '',
        needed: Math.ceil(c.shortfall / RUBRIC.projects.perProject),
        failed: Object.entries(f.checks).filter(([, ok]) => !ok).map(([k]) => QUALITY_FIXES[k]).join('; '),
      });
      // Top academic tier reached but backlogs cost points.
      if (c.id === 'academics' && !nextTier) fix = `Clear your backlogs and document it; they cost ${RUBRIC.academics.backlogPenalty} points.`;
      return { id: c.id, label: c.label, shortfall: c.shortfall, fix };
    });
}

export function matchProgrammes(profile, targetField, count = 3) {
  const target = FIELDS[targetField];
  const degree = profile.degreeField;
  return PROGRAMMES.map((p, order) => {
    let rank = 0;
    if (p.fields[0] === targetField) rank += 100;
    else if (p.fields.includes(targetField)) rank += 60;
    if (p.fields.some((f) => target.direct.includes(f))) rank += 20;
    if (degree && p.fields.includes(degree)) rank += 10;
    if (p.fields.some((f) => target.related.includes(f))) rank += 1;
    return { p, rank, order };
  })
    .sort((a, b) => b.rank - a.rank || a.order - b.order)
    .slice(0, count)
    .map(({ p }) => ({
      name: p.name, url: p.url, catalogue: CATALOGUE_URL,
      why: p.fields.includes(targetField)
        ? `Matches your target field (${target.label})${degree && p.fields.includes(degree) ? ' and your degree background' : ''}.`
        : `Closely related to ${target.label}.`,
    }));
}
