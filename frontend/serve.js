// Dependency-free static server for local development: `npm start`, then open http://localhost:8080/
// It serves the repo root (so the page can import ../simulation/src) but only frontend/ and simulation/src/.
import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const allowed = [join(root, 'frontend') + sep, join(root, 'simulation', 'src') + sep];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const port = Number(process.env.PORT) || 8080;
const backend = new URL(process.env.BACKEND_URL || 'http://127.0.0.1:8000'); // the Django server (manage.py runserver)

// Forward /api/ to Django so the page and the API share one origin (session cookie and CSRF just work).
function proxy(req, res) {
  // The Host header is passed through unchanged, since Django's CSRF check compares it with the page's Origin.
  const upstream = request(backend, { path: req.url, method: req.method, headers: req.headers }, (reply) => {
    res.writeHead(reply.statusCode, reply.headers);
    reply.pipe(res);
  });
  upstream.on('error', () => res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error": "Backend is not running."}'));
  req.pipe(upstream);
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname.startsWith('/api/')) return proxy(req, res);
    if (pathname === '/') return res.writeHead(302, { Location: '/frontend/' }).end();
    const file = normalize(join(root, decodeURIComponent(pathname.endsWith('/') ? `${pathname}index.html` : pathname)));
    if (!allowed.some((dir) => file.startsWith(dir))) return res.writeHead(403).end('Forbidden');
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Destruction Simulator: http://localhost:${port}/`));
