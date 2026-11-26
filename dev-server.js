// Local development server (Vercel does this job in production).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const root = join(import.meta.dirname, 'public');
const routes = { '/api/score': './api/score.js', '/api/report': './api/report.js', '/api/config': './api/config.js' };
const port = process.env.PORT || 3000;

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (routes[pathname]) {
      const handler = (await import(routes[pathname]))[req.method];
      if (!handler) return res.writeHead(405).end();
      const chunks = [];
      let size = 0;
      for await (const c of req) if ((size += c.length) <= 6 * 1024 * 1024) chunks.push(c);
      if (size > 6 * 1024 * 1024) return res.writeHead(413).end();
      const headers = { ...req.headers, 'x-real-ip': req.socket.remoteAddress };
      const response = await handler(new Request(`http://localhost${req.url}`, {
        method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined,
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    const file = join(root, normalize(pathname === '/' ? 'index.html' : pathname));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(data);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500).end('Error');
  }
}).listen(port, () => console.log(`Open http://localhost:${port}`));
