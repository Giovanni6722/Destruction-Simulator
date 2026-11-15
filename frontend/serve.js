// Dependency-free frontend server with a Django API proxy.
// Start Django on port 8000, then run `npm start` and open http://localhost:8080/

import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const allowed = [
  join(root, 'frontend') + sep,
  join(root, 'simulation', 'src') + sep,
];

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
};

const port = Number(process.env.PORT) || 8080;
const djangoPort = 8000;

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    // Forward API requests to Django.
    if (pathname.startsWith('/api/')) {
      const proxy = httpRequest(
        {
          hostname: '127.0.0.1',
          port: djangoPort,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            host: `127.0.0.1:${djangoPort}`,
          },
        },
        (djangoRes) => {
          res.writeHead(
            djangoRes.statusCode ?? 502,
            djangoRes.headers
          );
          djangoRes.pipe(res);
        }
      );

      proxy.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: 'Django backend unavailable.' }));
      });

      req.pipe(proxy);
      return;
    }

    // Serve frontend files.
    if (pathname === '/') {
      return res.writeHead(302, { Location: '/frontend/' }).end();
    }

    const file = normalize(
      join(
        root,
        decodeURIComponent(
          pathname.endsWith('/') ? `${pathname}index.html` : pathname
        )
      )
    );

    if (!allowed.some((dir) => file.startsWith(dir)) || file === root) {
      return res.writeHead(403).end('Forbidden');
    }

    res
      .writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      })
      .end(await readFile(file));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Destruction Simulator: http://localhost:${port}/`);
});