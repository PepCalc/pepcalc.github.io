# PepCalc

A private, offline peptide reconstitution and draw calculator for researchers. Install it
from the browser to your phone or tablet's home screen; it then works with no connection.
Everything you enter stays on your device.

<p align="center">
  <img src=".github/feature-peptide-calculator.png" alt="The draw calculator: a peptide, vial size and water volume chosen from sourced presets" width="300">
  &nbsp;&nbsp;
  <img src=".github/feature-estimated-level-over-time.png" alt="The level chart: estimated amount in the body over time from logged doses" width="300">
</p>

Pick a peptide, the amount in your vial and the water you added, and PepCalc tells you how far
to draw the syringe, with a drawing of the barrel to check against. Save vials to a shelf, log
each draw, and for peptides with published human data see an estimate of how much remains in
the body over time. It runs entirely on your device: no account, no server, no tracking.

> PepCalc does arithmetic and shows sourced reference values. It does not recommend doses and
> is not medical advice. Several listed peptides are investigational or not approved for human
> use.

## Features

- **Draw calculator.** Pick a peptide (or enter a custom one), the amount in the vial, and the
  bacteriostatic water added; choose a dose in mg, mcg, or IU. PepCalc shows the volume to draw
  and the reading on your syringe, with a drawing of the barrel. U-100 (1, 0.5, 0.3 mL,
  half-unit), U-40, and mL syringes are supported, with warnings for draws over capacity,
  below one mark, or between marks.
- **Mixing advisor.** Not sure how much water to add? Enter the doses you plan to draw (a
  range if you titrate) and the size of your vial, and PepCalc ranks water volumes so every
  dose fits one syringe and lands on a mark. Peptides users report as stinging (GHK-Cu, and
  blends that contain it) are diluted as far as the vial allows. When the vial is too small for
  a gentle mix, PepCalc says how far to top up the syringe with water after drawing each dose,
  both in the advisor and on every draw.
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
- Mixing advisor: tries water in 0.5 mL steps up to 10 mL, keeps volumes where the largest
  dose fits one syringe and the smallest is at least one mark, then ranks by fitting the vial,
  meeting any comfort cap (mg/mL), landing on marks, and most water.
- Level chart: a one-compartment model with first-order absorption and elimination, fitted to
  the published half-life and time to peak and summed over doses. It estimates drug remaining
  in the body, not blood concentration.

## Installing on a device

Settings shows the steps for the browser you are using, with a screenshot.

| Device                  | Steps                                                     |
| ----------------------- | --------------------------------------------------------- |
| Android, Chrome or Edge | Menu, Install and create shortcut (or Add to Home screen) |
| Android, Firefox        | Menu, Add app to Home screen                              |
| iPhone or iPad, Safari  | Share, Add to Home Screen                                 |
| iPhone or iPad, Chrome  | Share (in the address bar), Add to Home Screen            |

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

## Android app

The Android app is a [Capacitor](https://capacitorjs.com) shell around the same web build,
bundled into the APK so it works offline from first launch. It requests no network permission;
CI fails if the merged manifest ever asks for one. Cloud backup is off, so data leaves the
device only as a backup file the user exports.

```bash
make android      # build dist-android/ and sync it into android/
cd android && ./gradlew assembleDebug    # needs JDK 21 and the Android SDK
```

`.github/workflows/android.yml` builds a debug APK on every push and uploads it as a workflow
artifact. A release build is signed when `PEPCALC_KEYSTORE`, `PEPCALC_KEYSTORE_PASSWORD`,
`PEPCALC_KEY_ALIAS` and `PEPCALC_KEY_PASSWORD` are set; keep the keystore out of the
repository and backed up, because a lost key means the app can never be updated. The version
comes from `package.json` (`versionCode` is `major * 10000 + minor * 100 + patch`).

The app id `io.github.pepcalc`, and the WebView origin `https://localhost` that holds the
app's IndexedDB, must never change after release. Data in the browser-installed PWA does not
carry over to the Android app (and vice versa); move it with a backup file.

`npm run icons:android` regenerates the launcher icons from `public/favicon.svg`.
