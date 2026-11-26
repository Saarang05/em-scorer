import { AppError } from './errors.js';

const url = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const hasRedis = () => Boolean(url() && token());

// In-memory fallback for local development only.
const memory = new Map();
function local([cmd, key, ...args]) {
  if (cmd === 'GET') return memory.get(key) ?? null;
  if (cmd === 'SET') {
    if (args.includes('NX') && memory.has(key)) return null;
    memory.set(key, args[0]); return 'OK';
  }
  if (cmd === 'RPUSH') { memory.set(key, [...(memory.get(key) ?? []), args[0]]); return 1; }
  const set = memory.get(key) ?? new Map();
  memory.set(key, set);
  if (cmd === 'ZADD') { set.set(args[1], Number(args[0])); return 1; }
  if (cmd === 'ZREM') return Number(set.delete(args[0]));
  if (cmd === 'ZCARD') return set.size;
  if (cmd === 'ZREMRANGEBYSCORE') { for (const [m, s] of set) if (s <= Number(args[1])) set.delete(m); return 0; }
  if (cmd === 'EXPIRE') return 1;
  throw new Error(`unsupported ${cmd}`);
}

export async function redis(...command) {
  if (!hasRedis()) {
    if (process.env.VERCEL) throw new AppError(500, 'config', 'The scorer is not configured yet.', 'Redis env vars missing');
    return local(command);
  }
  try {
    const res = await fetch(url(), {
      method: 'POST', signal: AbortSignal.timeout(4000),
      headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
      body: JSON.stringify(command.map(String)),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(`redis ${res.status}`);
    return data.result;
  } catch (e) {
    throw new AppError(503, 'storage', 'We had a temporary problem. Please retry.', e.message);
  }
}
