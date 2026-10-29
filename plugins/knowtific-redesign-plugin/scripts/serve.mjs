#!/usr/bin/env node
// Zero-dependency static server for the preview folder.
// Usage: node serve.mjs redesign/preview [--port 4321] [--host 127.0.0.1]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from './lib.mjs';

const args = parseArgs();
const ROOT = path.resolve(args._[0] || 'redesign/preview');
const PORT = parseInt(args.port || process.env.PORT || '4321', 10);
const HOST = args.host || '127.0.0.1';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};
if (!fs.existsSync(ROOT)) { console.error(`Folder not found: ${ROOT}`); process.exit(1); }

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch {}
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found: ' + p); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, HOST, () => console.log(`Serving ${ROOT}\n  -> http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
