export class AppError extends Error {
  constructor(status, code, message, detail) {
    super(message);
    Object.assign(this, { status, code, detail });
  }
}
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export function errorResponse(e) {
  if (e instanceof AppError) {
    if (e.status >= 500) console.error('[error]', e.code, e.detail ?? '');
    return json({ error: { code: e.code, message: e.message } }, e.status);
  }
  // Log the type only: error text could contain resume content.
  console.error('[error] unexpected', e?.name, e?.stack?.split('\n').slice(1, 4).join(' | '));
  return json({ error: { code: 'server', message: 'Something went wrong on our side. Please retry.' } }, 500);
}
