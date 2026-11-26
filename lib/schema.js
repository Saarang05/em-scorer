import { z } from 'zod';
import { FIELD_IDS } from '../config/fields.js';

export const SCHEMA_VERSION = '1';

const str = z.string().catch('').transform((s) => s.slice(0, 200));
const optStr = z.string().nullable().catch(null);
const bool = z.preprocess((v) => v === true || v === 'true', z.boolean());
const list = (item) =>
  z.preprocess((v) => (Array.isArray(v) ? v.slice(0, 40) : []),
    z.array(item.nullable().catch(null)).transform((a) => a.filter((x) => x !== null)));
const fieldList = list(z.enum(FIELD_IDS));
const job = z.object({
  title: str, organisation: str, start: optStr, end: optStr,
  durationMonths: z.coerce.number().min(0).max(600).nullable().catch(null),
  fields: fieldList,
});

export const ProfileSchema = z.object({
  education: list(z.object({ degree: str, subject: str, level: str, institution: str, start: optStr, end: optStr })),
  degreeSubject: optStr,
  degreeField: z.enum(FIELD_IDS).nullable().catch(null),
  cgpa: z.object({ value: z.coerce.number(), scale: z.coerce.string() }).nullable().catch(null),
  backlogs: bool,
  jobs: list(job),
  internships: list(job),
  publications: list(z.object({ title: str, type: str })),
  researchProjects: list(z.object({ title: str })),
  projects: list(z.object({ title: str, substantial: bool, fields: fieldList })),
  skills: list(z.string()),
  leadership: list(z.object({ description: str, type: z.enum(['leadership', 'volunteering', 'exchange']) })),
  languages: list(z.string()),
  quality: z.object({ datedEntries: bool, quantifiedResults: bool, standardSections: bool })
    .catch({ datedEntries: false, quantifiedResults: false, standardSections: false }),
});
