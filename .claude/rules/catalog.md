---
paths: ['src/data/**']
---

# Peptide and syringe catalog

- Every number shown to users carries a source (`label`, `trial`, `standard`, `preclinical`,
  `community`, `model`). Never backfill a PK value from a vendor page; use `null` plus
  `pkUnavailableReason`.
- Built-in PK curves require human data: the schema demands a `label` or `trial` source on `pk`.
- Edit the JSON, then run `npx vitest run tests/data`: the schema and consistency tests are the
  gate. Detail: the `peptide-catalog` skill.
