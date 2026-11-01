# pepcalc.github.io

The website for [PepCalc](https://pepcalc.github.io/), a free, private, and offline peptide
reconstitution and draw calculator. The app itself lives in
[PepCalc/app](https://github.com/PepCalc/app) and is served at
[pepcalc.github.io/app](https://pepcalc.github.io/app/).

## What is here

| Path                | Holds                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `site/`             | The published files: pages, `styles.css`, fonts, images, `robots.txt`, `llms.txt`, `sw.js` |
| `scripts/`          | `check-site.mjs` (the gate), `build-pages.mjs` (sitemap), `serve.mjs` (local preview)      |
| `.github/workflows` | `deploy.yml`: runs the gate and publishes `site/` to Pages                                 |

## Rules

The site shares the `pepcalc.github.io` origin with the app, so:

- **No scripts.** Every page carries a CSP with `script-src 'none'`. A script here could read
  the app's on-device data.
- **No service worker, except the retirement one.** PepCalc used to be served from the root,
  and its service worker (scope `/`) is still installed in returning browsers. `site/sw.js`
  replaces it on the browser's next update check, deletes the root scope's caches, unregisters
  itself, and sends open app windows to `/app/`. It never touches IndexedDB, so data carries
  over: the app is on the same origin. Keep it published for as long as old installs may
  return.
- **No third-party requests.** Fonts and images are self-hosted; links to GitHub are plain
  links, never loaded resources.

`npm run check` enforces all three, plus working internal links and anchors, image alt text,
formatting, the sitemap, and the no-em-dash rule.

## Development

Requires Node 24 (see `.nvmrc`).

```bash
nvm use
make install
make serve        # http://localhost:4174/ (links to /app/ need the app repo deployed)
make check
```

## Deploying

This repository must be named `pepcalc.github.io` in the `PepCalc` organisation. In its
settings, under Pages, set the source to **GitHub Actions**, then push to `main`.

## A custom domain later

1. Change `ORIGIN` in `scripts/origin.mjs`, replace `https://pepcalc.github.io` across `site/`,
   and run `make build`.
2. Add the domain under Pages in this repository's settings. The app repository follows: Pages
   serves it at `/app/` on the same domain. Set its `PEPCALC_SITE_URL` variable to the new root.
3. A new domain is a new origin, so data saved at `pepcalc.github.io/app/` does not move with
   it. Keep `pepcalc.github.io` answering, and tell users to save a backup there and restore it
   on the new domain.

## License

AGPL-3.0. See [LICENSE](LICENSE).
