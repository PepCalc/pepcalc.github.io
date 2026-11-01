// The site's gate. It shares an origin with the app at /app/, so it must stay script-free:
// any script here could read the app's IndexedDB, and a service worker here would control /app/.
// The one exception is site/sw.js, which retires the worker the app registered when it lived at
// the root: it must unregister itself, never handle fetches, and never be registered by a page.
// Also checks links, anchors, image alt text, the markdown em-dash rule, and the tags search
// engines and link previews read: every indexable page has a description, a canonical URL on
// the site's origin matching its path, Open Graph and Twitter card tags, and a sitemap entry.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { ORIGIN } from './origin.mjs'

const root = new URL('..', import.meta.url).pathname
const site = join(root, 'site')
const EM = '—'
/** External hosts the site may link to; it never loads anything from them. */
const ALLOWED_HOSTS = new Set(['github.com', 'docs.github.com', 'gliplog.com'])
/** Paths served by the app repository, not this one. */
const APP_PATHS = /^(\/app\/|app\/)/
const SEO_PROPERTIES = ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']

/** The public URL path of a page file: index.html is its directory. */
function urlPathOf(file) {
  const rel = '/' + relative(site, file).split('\\').join('/')
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel
}

const sitemapXml = existsSync(join(site, 'sitemap.xml'))
  ? readFileSync(join(site, 'sitemap.xml'), 'utf8')
  : ''
const sitemapPaths = new Set(
  [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(ORIGIN, '')),
)
const indexable = new Set()

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) yield* walk(full)
    else yield full
  }
}

const failures = []
const fail = (file, message) => failures.push(`${relative(root, file)}: ${message}`)

for (const file of walk(root)) {
  if (!/\.(md|html|css|txt)$/.test(file)) continue
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes(EM) && !line.includes('em-dash-ok')) fail(file, `em-dash on line ${i + 1}`)
    })
}

for (const file of walk(site)) {
  if (!/\.(m?js)$/.test(file)) continue
  if (relative(site, file) !== 'sw.js') {
    fail(file, 'is a script; the only script allowed is site/sw.js')
    continue
  }
  const sw = readFileSync(file, 'utf8')
  if (!sw.includes('self.registration.unregister()')) fail(file, 'must unregister itself')
  if (/addEventListener\(\s*['"]fetch/.test(sw)) fail(file, 'must not handle fetches')
  if (/importScripts|indexedDB/.test(sw)) fail(file, 'must not import scripts or touch IndexedDB')
}

const pages = [...walk(site)].filter((f) => f.endsWith('.html'))
for (const page of pages) {
  const html = readFileSync(page, 'utf8')
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] ?? ''
  if (!csp.includes("script-src 'none'")) fail(page, "missing a CSP with script-src 'none'")
  if (/<script\b/i.test(html)) fail(page, 'contains a <script>')
  if (/\son[a-z]+=/i.test(html)) fail(page, 'contains an inline event handler')
  if (/\sstyle="/i.test(html)) fail(page, 'contains a style attribute (blocked by the CSP)')
  if (/serviceWorker/.test(html)) fail(page, 'mentions serviceWorker')
  if (!/<html lang="/.test(html)) fail(page, 'html has no lang')
  if (!/<title>[^<]+<\/title>/.test(html)) fail(page, 'has no title')

  const path = urlPathOf(page)
  const meta = (attr, name) =>
    new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]+)"`).exec(html)?.[1]
  if (/<meta\s+name="robots"\s+content="[^"]*noindex/.test(html)) {
    if (sitemapPaths.has(path)) fail(page, 'is noindex but listed in sitemap.xml')
  } else {
    indexable.add(path)
    const canonical = /<link\s+rel="canonical"\s+href="([^"]+)"/.exec(html)?.[1]
    if (canonical !== ORIGIN + path) fail(page, `canonical should be ${ORIGIN + path}`)
    if (!meta('name', 'description')) fail(page, 'has no meta description')
    for (const property of SEO_PROPERTIES) {
      if (!meta('property', property)) fail(page, `has no ${property}`)
    }
    if (meta('property', 'og:url') !== canonical) fail(page, 'og:url differs from the canonical')
    if (!meta('name', 'twitter:card')) fail(page, 'has no twitter:card')
    if (!sitemapPaths.has(path)) fail(page, 'is missing from sitemap.xml')
  }

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt="/.test(m[0])) fail(page, `image without alt: ${m[0].slice(0, 60)}`)
  }

  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
  const urls = [
    ...[...html.matchAll(/\s(?:href|src|srcset)="([^"]+)"/g)].map((m) => m[1]),
    meta('property', 'og:image'),
  ].filter(Boolean)
  for (const raw of urls) {
    // The site's own absolute URLs (canonical, og:image) must resolve to files here.
    const url = raw.startsWith(ORIGIN + '/') ? raw.slice(ORIGIN.length) : raw
    if (url.startsWith('#')) {
      if (!ids.has(url.slice(1))) fail(page, `anchor ${url} has no target`)
      continue
    }
    if (/^https?:/.test(url)) {
      const host = new URL(url).hostname
      if (url.startsWith('http:')) fail(page, `insecure link ${url}`)
      else if (!ALLOWED_HOSTS.has(host)) fail(page, `link to unlisted host ${host}`)
      continue
    }
    if (APP_PATHS.test(url)) continue
    if (/^(mailto|data|javascript):/.test(url)) {
      fail(page, `disallowed URL scheme in ${url}`)
      continue
    }
    const path = url.split('#')[0].split('?')[0]
    const target = path.startsWith('/') ? join(site, path) : join(dirname(page), path)
    const resolved = path === '' || path.endsWith('/') ? join(target, 'index.html') : target
    if (!existsSync(resolved)) fail(page, `broken link ${url}`)
  }
}

for (const path of sitemapPaths) {
  if (!indexable.has(path)) fail(join(site, 'sitemap.xml'), `lists ${path}, which is not a page`)
}

if (failures.length) {
  for (const f of failures) console.error(f)
  process.exit(1)
}
console.log(
  `site: ${pages.length} pages script-free, sw.js only retires, links and anchors resolve, no em-dashes`,
)
