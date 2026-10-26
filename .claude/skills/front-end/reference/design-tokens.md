# Design tokens

Part of the `front-end` skill.

The palette is adapted from the Cognitive Companion design system: warm paper surfaces, sage
green primary, terracotta accent, warm ink text, soft daylight shadows, calm motion. PepCalc
adds a warm-dark variant.

## Files

| File                     | Holds                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `public/layers.css`      | Cascade layer order, linked before any bundled CSS                                                     |
| `src/styles/tokens.css`  | Primitives (`--stone-*`, `--sage-*`, `--terra-*`), fonts, radii, motion; semantic tokens per theme     |
| `src/styles/theme.css`   | Global element styles and Vuetify overrides (`pc-theme` layer); utility classes (`pc-utilities` layer) |
| `src/plugins/vuetify.ts` | Vuetify `light` and `dark` theme colours mirroring the tokens                                          |

## Semantic tokens (both themes)

| Group        | Tokens                                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces     | `--pc-bg`, `--pc-surface`, `--pc-surface-2`, `--pc-surface-sunk`                                                                 |
| Text         | `--pc-text-1` (primary), `--pc-text-2` (secondary), `--pc-text-3` (tertiary)                                                     |
| Brand        | `--pc-brand`, `--pc-brand-strong`, `--pc-brand-soft`, `--pc-brand-softer`, `--pc-accent`, `--pc-accent-soft`, `--pc-accent-line` |
| Lines        | `--pc-divider`, `--pc-divider-strong`                                                                                            |
| Status pairs | `--pc-{good,notice,alert,info}-{fg,bg}`                                                                                          |
| Shadows      | `--pc-shadow-{sm,md,lg,inset}`                                                                                                   |
| Syringe      | `--pc-syringe-{barrel,ink,fill,fill-deep,glint,plunger}`                                                                         |
| Chart        | `--pc-chart-{logged,preview,grid,axis,now}`                                                                                      |

Theme-independent: `--pc-font`, `--pc-font-display`, `--pc-font-mono`, `--pc-radius-*`,
`--pc-dur-*`, `--pc-focus-ring`, `--pc-shadow-focus`, `--pc-touch`.

## Utility classes

| Class                                                   | Use                                          |
| ------------------------------------------------------- | -------------------------------------------- |
| `pc-page`                                               | Page container with responsive gutters       |
| `pc-eyebrow`                                            | Small tracked terracotta label above a title |
| `pc-display`                                            | Newsreader heading face                      |
| `pc-muted`, `pc-faint`                                  | Secondary and tertiary text                  |
| `pc-num`, `pc-mono`                                     | Tabular figures                              |
| `pc-inset`                                              | Grouped panel inside a card                  |
| `pc-card-soft`, `pc-card-accent`                        | Sage or terracotta tinted card               |
| `pc-badge` + `pc-badge--{brand,good,notice,alert,info}` | Calm status pill; add `pc-badge__dot`        |

## Adding a colour

1. Add the token to both `.v-theme--light` and `.v-theme--dark` in `tokens.css`.
2. If it is text, add the pair to `scripts/check-contrast.mjs`.
3. If it is a chart series, validate the palette with the dataviz palette checker against both
   surfaces (lightness band, chroma, colour-blind separation) before use.
