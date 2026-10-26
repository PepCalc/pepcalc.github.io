# Architecture

Part of the `engineering-standards` skill.

## Layout

```
src/
  domain/        pure logic: units, reconstitution, syringe, pk, inventory, blend, catalog types
  data/          peptides.json, syringes.json, their JSON Schemas, typed loader (index.ts)
  db/            Dexie database (schema history), repository, backup export/restore
  stores/        Pinia: shelf (vials + draws), settings, notify, confirm
  composables/   useCalculator, useChartColors, useInstallPrompt, useStoragePersistence, useNow
  services/      time.ts (the only clock and date formatter), fileTransfer.ts (share/download)
  components/    calculator/, charts/, shelf/, common/
  views/         one per route: Calculator, Shelf, Vial, History, Settings
  plugins/       vuetify.ts (themes, defaults), icons.ts (inline SVG icons), fonts.ts
  styles/        tokens.css (design tokens), theme.css (global and Vuetify overrides)
public/          icons, favicon, layers.css (cascade layer order, linked before bundles)
tests/           Vitest, mirrors src/
e2e/             Playwright against `vite preview` of the production build
scripts/         gate scripts (contrast, tokens, markdown)
```

## Data flow

A view reads from a store or a composable; a store reads and writes through `repository`;
the repository is the only code that touches Dexie. Arithmetic is always a call into
`domain/`. The calculator keeps its inputs in `useCalculator` (not a store) because they are
per-visit; anything that must survive a reload goes into the database.

## Storage

- IndexedDB via Dexie, database `pepcalc`. Tables: `vials`, `draws`, `settings` (key/value).
- Ids are `crypto.randomUUID()`; timestamps are UTC ISO strings.
- Deleting a vial deletes its draws in the same transaction. Archiving keeps both.
- `navigator.storage.persist()` is requested on launch (Settings shows the result). Safari may
  still evict data; a backup file (Settings, Save a backup) is the only guarantee. Safari tabs
  and Home Screen apps on iOS keep separate storage.
- Backups are versioned JSON (`format: "pepcalc-backup"`). `parseBackup` validates untrusted
  input fully before `restoreBackup` replaces data atomically.

## PK model

`domain/pk.ts` implements a one-compartment model with first-order absorption and elimination
(the Bateman function), superposed over doses. `ka` is solved from the published half-life and
time to peak by bisection, which handles flip-flop kinetics. The output is an amount in the body
in dose units, not a concentration: volume of distribution and bioavailability are unknown for
most of these peptides. Sampling is adaptive so short peaks (tesamorelin, about 9 minutes) are
not missed by a coarse grid.

## PWA and hosting

- `vite-plugin-pwa` (generateSW) precaches every built asset, including the ECharts chunk and
  fonts. `registerType: 'prompt'`: an update waits until the user reloads (`UpdatePrompt.vue`).
- Base path comes from `PEPCALC_BASE` (default `/pepcalc/`). The router uses hash history so
  every URL resolves to `index.html` on GitHub Pages and offline.
- A production-only meta CSP (`default-src 'self'`) is injected by `vite.config.ts`, because
  GitHub Pages cannot set headers. Styles need `'unsafe-inline'` for Vuetify's theme tag.
