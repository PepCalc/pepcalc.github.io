# pepcalc.github.io

The static, script-free website for PepCalc, published from `site/` to
`https://pepcalc.github.io/`. The app is the separate `PepCalc/app` repository at `/app/` on
the same origin; its CLAUDE.md and front-end skill hold the design system this site mirrors.

## Commands

| Command        | Purpose                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `make install` | `npm ci`                                                               |
| `make serve`   | Serve `site/` at `http://localhost:4174/`                              |
| `make build`   | Rebuild `site/sitemap.xml` from the pages                              |
| `make check`   | Prettier, sitemap up to date, then `scripts/check-site.mjs` (the gate) |

Format with `make format` and run `make check` before calling a change done; CI runs the same
gate on every push and pull request.

## Non-negotiables

- No `<script>`, inline handlers, `style` attributes or service worker: the app shares this
  origin, and every page's CSP is `script-src 'none'`. The one exception is `site/sw.js`, which
  retires the worker the app registered when it lived at the root; it only unregisters itself,
  and no page may register it.
- No third-party requests: fonts and images live in `site/`; external links go only to hosts
  listed in `scripts/check-site.mjs`.
- Colours mirror the app's tokens (`site/styles.css` `:root`), light and dark from the device.
- Copy follows the app's voice: warm, plain, inclusive, never recommending a dose, and clear
  that several listed peptides are investigational or not approved for human use.
- Headlines and marketing copy follow the copy rule: bold, short, no AI slop. Fragments are fine:
  "Always free. No paywalls. No subscriptions." No trailing ", so X" clauses, no filler subheads.
  Punchy never overrides accuracy: every claim must be true of the app, and safety wording stays.
- Markdown and HTML contain no em-dashes (U+2014).
- Every indexable page has a description, a canonical URL on the origin in
  `scripts/origin.mjs` matching its path, Open Graph and Twitter card tags, and a `sitemap.xml`
  entry (`make build`); the 404 page is noindex.
- `robots.txt`, `sitemap.xml` and `llms.txt` live here, not in the app: crawlers read them only
  at the origin root.
