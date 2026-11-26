import { FIELDS } from '../config/fields.js';
import { json } from '../lib/errors.js';

export function GET() {
  const year = new Date().getUTCFullYear();
  return json({
    fields: Object.entries(FIELDS).map(([id, f]) => ({ id, label: f.label })),
    intakeYears: [year + 1, year + 2, year + 3],
  });
}
