# PepCalc

A private, offline peptide reconstitution and draw calculator for researchers. Install it
from the browser to your phone or tablet's home screen; it then works with no connection.
Everything you enter stays on your device.

> PepCalc does arithmetic and shows sourced reference values. It does not recommend doses and
> is not medical advice. Several listed peptides are investigational or not approved for human
> use.

## Features

- **Draw calculator.** Pick a peptide (or enter a custom one), the amount in the vial, and the
  bacteriostatic water added; choose a dose in mg, mcg, or IU. PepCalc shows the volume to draw
  and the reading on your syringe, with a drawing of the barrel. U-100 (1, 0.5, 0.3 mL,
  half-unit), U-40, and mL syringes are supported, with warnings for draws over capacity,
  below one mark, or between marks.
- **Presets with sources.** Common vial sizes, water volumes, and doses for each peptide. Each
  preset shows whether it comes from a prescribing label, a clinical trial, or community
  reports.
- **Blends.** KLOW and GLOW (and any custom composition) split each dose into its components.
- **Shelf.** Save reconstituted vials so concentrations are never re-entered; log draws and see
  what is left, in amount, volume, and doses.
- **Level charts.** For peptides with human pharmacokinetic data (semaglutide, tirzepatide,
  retatrutide, cagrilintide, tesamorelin), an estimate of the amount in the body over time from
  your logged doses plus the draw you are calculating, projected forward with no further doses.
  For other peptides you may enter your own half-life, and the chart is labelled as such.
- **Private and offline.** No account, no server, no analytics, no third-party requests. Back up
  to a JSON file you keep, and restore from it.
- **Phones and tablets, light and dark.** Follows the device theme.

## Launch peptides

Semaglutide, Tirzepatide, Retatrutide, Cagrilintide, Tesamorelin, BPC-157, TB-500, GHK-Cu, KPV,
GLOW, and KLOW. Adding more is a data change: see [docs/adding-a-peptide.md](docs/adding-a-peptide.md).

## How the numbers work

- Concentration = amount in vial / water added.
- Volume to draw = dose / concentration.
- Syringe reading = volume x units per mL (100 for U-100, 40 for U-40), or mL directly.
- Level chart: a one-compartment model with first-order absorption and elimination, fitted to
  the published half-life and time to peak and summed over doses. It estimates drug remaining
  in the body, not blood concentration.

## Installing on a device

| Device                  | Steps                                                  |
| ----------------------- | ------------------------------------------------------ |
| Android, Chrome or Edge | Open the site, then tap Install (or menu, Install app) |
| Android, Firefox        | Menu, Install (or Add to Home screen)                  |
| iPhone or iPad          | Share button, Add to Home Screen                       |

On iPhone and iPad, Safari and the installed app keep separate data; use a backup to move it.
Make regular backups (Settings): browsers can clear site data under storage pressure.

## Development

Requires Node 24 (see `.nvmrc`).

```bash
nvm use
make install
make dev          # http://localhost:5173/pepcalc/
make check        # fast gate
make check-all    # full gate, including offline e2e tests
```

Project conventions for contributors and coding agents are in [CLAUDE.md](CLAUDE.md) and
`.claude/skills/`.

## Deploying to GitHub Pages

1. Push the repository to GitHub.
2. In the repository settings, under Pages, set the source to **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` runs the gate, builds with the repository
   name as the base path (`https://<owner>.github.io/<repo>/`), and publishes.

For a custom domain or a user site served from the root, set the repository variable
`PEPCALC_BASE` to `/`. Locally, `PEPCALC_BASE=/ npm run build` does the same.
