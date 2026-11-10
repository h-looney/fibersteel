/** A tiny static server for browser tests: serves a build folder under a base path (e.g. /fibersteel), like GitHub Pages. */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

export function serve(dir: string, base: string, port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith(`${base}/`) && url.pathname !== base) {
      res.writeHead(404).end('Not under the base path');
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(base.length)) || '/';
    let file = normalize(join(dir, rel));
    if (!file.startsWith(normalize(dir))) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!rel.endsWith('/')) {
        res.writeHead(301, { location: `${base}${rel}/${url.search}` }).end();
        return;
      }
      file = join(file, 'index.html');
    }
    if (!existsSync(file)) {
      rel = '/404.html';
      file = join(dir, '404.html');
      res.statusCode = 404;
    }
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
