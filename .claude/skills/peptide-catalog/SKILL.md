---
name: peptide-catalog
description: 'Use when adding or editing a peptide, blend, preset, PK value, or syringe in src/data/peptides.json or src/data/syringes.json.'
---

# Peptide catalog

The catalog is data: adding a peptide needs no code. The step-by-step guide is
`docs/adding-a-peptide.md`; these are the rules.

1. Research first, from primary sources: prescribing labels (DailyMed, FDA, EMA), then
   peer-reviewed trials or reviews. Vendor pages are acceptable only for vial sizes and
   compositions, tagged `community`.
2. Every preset list and every PK block carries a `source` with `kind`, `citation`, and an
   `https://` `url` when one exists.
3. `pk` requires human data and at least one `label` or `trial` source (the schema enforces it).
   When a source gives only a range (for example time to peak 8 to 72 h), pick a value inside it,
   add a `model` source, and say so in `notes`.
4. No human PK: `pk: null` with a `pkUnavailableReason` that states what is known. Users can
   still enter their own values per vial.
5. Doses: label or trial doses where they exist; otherwise community amounts tagged `community`,
   or `doses: null` when nothing defensible exists (as for the blends).
6. Blends: `kind: "blend"`, `vialUnit: "mg"`, `components` in mg per vial, and a vial size equal
   to the component total.
7. Injection site: `injectionSite` holds a `note` and `sources`; add `maxMgPerMl` (the
   strength users report as tolerable) only with a `community` source, only on mass vials, and
   never on a blend. Blends inherit it through each component's `peptideId`.
8. Units: `vialUnit`, `defaultDoseUnit`, and preset units must be compatible (mass with mass, IU
   with IU).
9. Gate: `npx vitest run tests/data`, then `make check`.
