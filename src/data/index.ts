import type { Catalog, CatalogPeptide, SyringeCatalog } from '@/domain/catalog'
import type { SyringeSpec } from '@/domain/syringe'
import peptidesJson from './peptides.json'
import syringesJson from './syringes.json'

/*
 * The JSON files are bundled (and therefore precached for offline use). Their shape is
 * enforced by the JSON Schemas beside them in tests/data/catalog.spec.ts, so the casts here
 * are checked at build time rather than trusted.
 */
export const catalog = peptidesJson as unknown as Catalog
export const syringeCatalog = syringesJson as unknown as SyringeCatalog

export function findPeptide(id: string | null | undefined): CatalogPeptide | undefined {
  return id ? catalog.peptides.find((p) => p.id === id) : undefined
}

export function findSyringe(id: string | null | undefined): SyringeSpec {
  const match = syringeCatalog.syringes.find((s) => s.id === id)
  return match ?? defaultSyringe()
}

function defaultSyringe(): SyringeSpec {
  const fallback = syringeCatalog.syringes.find((s) => s.id === syringeCatalog.defaultSyringeId)
  if (!fallback) throw new Error('syringes.json: defaultSyringeId does not match a syringe')
  return fallback
}
