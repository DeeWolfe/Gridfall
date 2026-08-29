#!/usr/bin/env node
// Dev server. Serves the repo root so index.html can load src/ as real ES
// modules — no build step in the loop, just reload the page.
//
//   npm run dev            http://localhost:8080
//   PORT=3000 npm run dev
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join, normalize, extname} from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
  const path = join(ROOT, rel);

  // Never serve outside the repo, however the path was spelled.
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path)] || 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(body);
  } catch {
    res.writeHead(404, {'content-type': 'text/plain'}).end('not found: ' + rel);
  }
}).listen(PORT, () => {
  console.log(`gridfall dev server — http://localhost:${PORT}`);
  console.log('serving ES modules straight from src/; ctrl-c to stop');
});
