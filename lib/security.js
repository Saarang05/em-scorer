import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { AppError } from './errors.js';
import { redis } from './store.js';

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) throw new AppError(500, 'config', 'The scorer is not configured yet.', 'APP_SECRET missing or too short');
  return createHash('sha256').update(s).digest();
}
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// The full report travels to the browser encrypted. Only the server can open it.
export function seal(data) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secret(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data)), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}
export function unseal(tokenText) {
  const key = secret();
  try {
    const raw = Buffer.from(String(tokenText), 'base64url');
    const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12), { authTagLength: 16 });
    d.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString());
    if (Date.now() > data.expires) throw new Error('expired');
    return data;
  } catch {
    throw new AppError(401, 'bad_token', 'This report link has expired. Please score your resume again.');
  }
}

/** Sliding one-hour window per IP. Returns a function that gives the slot back if scoring fails. */
export async function rateLimit(request) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const key = `em:rl:${sha256(secret().toString('hex') + ip)}`;
  const limit = Number(process.env.RATE_LIMIT_PER_HOUR) || 5;
  const member = randomUUID(), now = Date.now();
  await redis('ZREMRANGEBYSCORE', key, 0, now - 3600_000);
  await redis('ZADD', key, now, member);
  await redis('EXPIRE', key, 3600);
  const release = () => redis('ZREM', key, member).catch(() => {});
  if ((await redis('ZCARD', key)) > limit) {
    await release();
    throw new AppError(429, 'rate_limited', `You've reached the limit of ${limit} scorings per hour. Please try again a little later.`);
  }
  return release;
}
