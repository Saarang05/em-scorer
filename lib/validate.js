import { z } from 'zod';
import { FIELD_IDS } from '../config/fields.js';
import { AppError } from './errors.js';

export const Answers = z.object({
  cgpa: z.number().positive(),
  scale: z.enum(['10', '4', 'percent']),
  englishTest: z.enum(['ielts', 'toefl', 'none']),
  englishScore: z.number().nullable().optional(),
  targetField: z.enum(FIELD_IDS),
  intakeYear: z.number().int().min(2026).max(2035),
}).superRefine((a, ctx) => {
  const bad = (message) => ctx.addIssue({ code: 'custom', message });
  if (a.cgpa > { 10: 10, 4: 4, percent: 100 }[a.scale]) bad('CGPA is higher than the scale you chose.');
  if (a.englishTest !== 'none') {
    const max = a.englishTest === 'ielts' ? 9 : 120;
    if (a.englishScore == null || a.englishScore < 0 || a.englishScore > max) bad(`Enter a valid English score (0–${max}).`);
  }
});

export const Lead = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  email: z.string().trim().email('Enter a valid email.').max(120),
  phone: z.string().trim().transform((s) => s.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(/^\+?\d{10,15}$/, 'Enter a valid phone number (10 digits or more).')),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please tick the consent box.' }) }),
});

export function check(schema, value) {
  const r = schema.safeParse(value);
  if (!r.success) {
    const message = r.error.issues[0].message;
    throw new AppError(400, 'invalid', /^(Required|Invalid|Expected|Number)/.test(message) ? 'Please check your answers and try again.' : message);
  }
  return r.data;
}
