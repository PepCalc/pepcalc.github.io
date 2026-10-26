# Adding a peptide

PepCalc's peptides live in `src/data/peptides.json`, validated by
`src/data/peptides.schema.json`. Adding one is a data change; no code is needed.

## 1. Gather sources

| Field                     | Preferred source                              | Acceptable fallback                   |
| ------------------------- | --------------------------------------------- | ------------------------------------- |
| Half-life, time to peak   | Prescribing label section 12.3; phase 1 trial | Systematic review of trials           |
| Doses                     | Label dosing section; trial dose arms         | Community amounts, tagged `community` |
| Vial sizes, water volumes | Vendor listings, tagged `community`           |                                       |

If there is no human pharmacokinetic data, do not use animal or vendor figures for `pk`.

## 2. Add the entry

```json
{
  "id": "example-peptide",
  "name": "Example Peptide",
  "aliases": ["EP"],
  "kind": "single",
  "summary": "One sentence on what it is and its approval status.",
  "vialUnit": "mg",
  "defaultDoseUnit": "mcg",
  "vialSizes": {
    "values": [5, 10],
    "unit": "mg",
    "source": { "kind": "community", "citation": "Common research-vendor vial sizes" }
  },
  "diluentMl": {
    "values": [1, 2, 3],
    "source": { "kind": "community", "citation": "Common reconstitution volumes" }
  },
  "doses": null,
  "pk": null,
  "pkUnavailableReason": "No published human pharmacokinetic data."
}
```

With human data, replace `pk` with:

```json
{
  "halfLifeHours": 120,
  "tmaxHours": 24,
  "notes": "What the source says, including ranges, and which value the model uses.",
  "sources": [
    {
      "kind": "label",
      "citation": "Product US prescribing information, 12.3",
      "url": "https://..."
    }
  ]
}
```

## 3. Check

```bash
npx vitest run tests/data   # schema and consistency
make check                  # full fast gate
```

Then open the calculator, choose the peptide, and confirm the presets, source badges, and
level chart look right.

## Adding a syringe

Add an entry to `src/data/syringes.json`: `unitsPerMl` (100, 40, or `null` for mL syringes),
`capacityMl`, `tickMl` (volume between marks), and `labelEveryTicks`. Capacity must be a whole
number of ticks; the catalog test checks it.
