// Builds site/sitemap.xml from every page except the 404. The output is committed, because
// Pages publishes site/ as it is; with --check it builds in memory and fails if the committed
// file differs, so the sitemap can't drift from the pages.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ORIGIN } from './origin.mjs'

const root = new URL('..', import.meta.url).pathname
const site = join(root, 'site')
const check = process.argv.includes('--check')

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* htmlFiles(full)
    else if (name.endsWith('.html')) yield full
  }
}

/** The public URL of a page file: index.html is its directory. */
function urlPathOf(file) {
  const rel = '/' + relative(site, file).split('\\').join('/')
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel
}

const urls = [...htmlFiles(site)]
  .filter((f) => !f.endsWith('404.html'))
  .map(urlPathOf)
  .sort()
  .map((p) => `  <url><loc>${ORIGIN}${p}</loc></url>`)
  .join('\n')
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`

const file = join(site, 'sitemap.xml')
let current = null
try {
  current = readFileSync(file, 'utf8')
} catch {
  // A missing file is stale.
}
if (current !== sitemap) {
  if (check) {
    console.error('site/sitemap.xml: out of date; run npm run build')
    process.exit(1)
  }
  writeFileSync(file, sitemap)
}
console.log(check ? 'pages: sitemap.xml is up to date' : 'pages: wrote site/sitemap.xml')
