// Serves site/ at http://localhost:4174/ for a local look, with the same no-script CSP the
// pages carry. No dependencies; development only.
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const site = new URL('../site', import.meta.url).pathname
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.js': 'text/javascript',
}

createServer((req, res) => {
  let path = normalize(join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!path.startsWith(site)) path = join(site, '404.html')
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
  const found = existsSync(path)
  const file = found ? path : join(site, '404.html')
  res.writeHead(found ? 200 : 404, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  })
  res.end(readFileSync(file))
}).listen(4174, () => console.log('http://localhost:4174/'))
