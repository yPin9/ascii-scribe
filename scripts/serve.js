// Tiny static server for the demo: npm run demo → http://localhost:8080/demo/
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.gif': 'image/gif', '.md': 'text/plain' };
const port = Number(process.env.PORT || 8080);

createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path.endsWith('/') || path.endsWith('\\')) path += 'index.html';
  const file = join(root, path);
  if (!file.startsWith(join(root))) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, () => console.log(`demo: http://localhost:${port}/demo/`));
