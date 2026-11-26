import { AppError, json, errorResponse } from '../lib/errors.js';
import { unseal, sha256 } from '../lib/security.js';
import { redis } from '../lib/store.js';
import { Lead, check } from '../lib/validate.js';

// The lead gate: the report is released only with a valid token AND valid contact details.
export async function POST(request) {
  try {
    let body;
    try { body = await request.json(); } catch { throw new AppError(400, 'invalid', 'Please fill in the form.'); }
    if (!body?.token) throw new AppError(401, 'bad_token', 'Please score your resume first.');
    const lead = check(Lead, body.lead ?? {});
    const { teaser, report, record } = unseal(body.token);

    const entry = {
      ...lead, ...record,
      score: teaser.score, band: teaser.band,
      breakdown: Object.fromEntries(report.categories.map((c) => [c.id, c.points])),
      createdAt: new Date().toISOString(),
    };
    const once = `em:lead:${sha256(body.token + lead.email)}`;
    if (await redis('SET', once, '1', 'EX', 86400, 'NX')) await redis('RPUSH', 'em:leads', JSON.stringify(entry));

    return json({ report });
  } catch (e) {
    return errorResponse(e);
  }
}
