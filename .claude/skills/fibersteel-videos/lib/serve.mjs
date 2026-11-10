#!/usr/bin/env node
// Serve a build folder under a base path, like GitHub Pages: node serve.mjs <dist> <base> <port>
// e.g. node serve.mjs dist /fibersteel 4398  →  http://127.0.0.1:4398/fibersteel/
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const [dirArg = 'dist', base = '/fibersteel', portArg = '4398'] = process.argv.slice(2);
const dir = resolve(dirArg);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(`${base}/`) && url.pathname !== base) return void res.writeHead(404).end('Not under the base path');
  let rel = decodeURIComponent(url.pathname.slice(base.length)) || '/';
  let file = normalize(join(dir, rel));
  if (!file.startsWith(dir)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!rel.endsWith('/')) return void res.writeHead(301, { location: `${base}${rel}/${url.search}` }).end();
    file = join(file, 'index.html');
  }
  if (!existsSync(file)) {
    file = join(dir, '404.html');
    res.statusCode = 404;
  }
  res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
  res.setHeader('cache-control', 'no-store');
  createReadStream(file).pipe(res);
}).listen(Number(portArg), '127.0.0.1', () => console.log(`serving ${dir} at http://127.0.0.1:${portArg}${base}/`));
