# Testing, gates, toolchain, deployment

Part of the `engineering-standards` skill.

## Gates

| Command          | What it runs                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `make check`     | lint, format check, typecheck, token check, contrast check, markdown check, knip, Vitest, build |
| `make check-all` | `make check`, Playwright e2e (phone and tablet), `npm audit --audit-level=high`                 |

CI (`.github/workflows/ci.yml`) runs the full gate on pull requests. Deployment
(`.github/workflows/deploy.yml`) runs `npm run check` and publishes `dist/` to GitHub Pages on
every push to `main`.

## Tests

- Domain logic: exhaustive unit tests, including the reference check (5 mg in 2 mL, 250 mcg is
  0.1 mL, 10 units on U-100) and published PK parameters round-tripping through the solver.
- Catalog: `tests/data/catalog.spec.ts` validates both JSON files against their schemas and
  checks unit compatibility, blend totals, and that every launch peptide exists.
- Storage: `fake-indexeddb` gives each test its own database; tests delete it afterwards.
- Components: mount with a real Vuetify (`tests/helpers.ts`); assert what a user or screen
  reader perceives (pressed state, aria-label), not internals. The suite must be warning-free.
- E2E: runs against the production build under the Pages base path, because the service worker
  only exists there. It covers the calculator, the shelf workflow, an offline reload with
  stored data, manifest and service-worker scope, and the absence of third-party requests.
- E2E projects: `phone` (Pixel 7, Chromium), `tablet` (iPad landscape, Chromium), and `iphone`
  (iPhone 15, WebKit). `iphone` runs in CI, or locally with `PEPCALC_E2E_WEBKIT=1` after
  `sudo npx playwright install-deps webkit`. The service-worker specs skip on WebKit because
  Playwright does not drive WebKit service workers reliably; check installs on a real iPhone.
- Inject time through `Clock`; never sleep in a test.

## Toolchain

| Tool       | Version line        | Note                                                                              |
| ---------- | ------------------- | --------------------------------------------------------------------------------- |
| Node       | 24 LTS via `.nvmrc` | `package.json` engines match; CI reads `.nvmrc`                                   |
| Vite       | 8                   | `vite-plugin-pwa` 2 (Workbox 7)                                                   |
| Vue        | 3.5                 | Router 5 (classic API, hash history), Pinia 4 (needs `@vue/devtools-api`)         |
| Vuetify    | 4                   | cascade layers; MD3 typography classes (`text-headline-large`, `text-body-small`) |
| TypeScript | 6.0                 | held below 7 until typescript-eslint supports it                                  |
| Vitest     | 5                   | happy-dom environment                                                             |

Run `npm audit --audit-level=high` before every change set. Use `npm ci` in CI.
