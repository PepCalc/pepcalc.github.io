import type { BlendComponent } from '@/domain/blend'
import type {
  Catalog,
  CatalogPeptide,
  InjectionSiteNote,
  InUseLimit,
  SyringeCatalog,
} from '@/domain/catalog'
import type { ComfortCap } from '@/domain/diluent'
import type { SyringeSpec } from '@/domain/syringe'
import { areCompatible, convert, type Quantity } from '@/domain/units'
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

/** An injection-site note that applies to a vial, with how much of that ingredient it holds. */
export interface InjectionSiteConcern {
  name: string
  /** Null when the amount is not in mass (an IU vial), so a mg/mL cap cannot apply. */
  amountMg: number | null
  note: InjectionSiteNote
}

/**
 * Injection-site notes for a vial: the peptide's own, or for a blend those of its components,
 * since a blend stings when one of its ingredients does (GHK-Cu in KLOW and GLOW).
 */
export function injectionSiteConcerns(
  peptide: CatalogPeptide | undefined,
  components: readonly BlendComponent[],
  vial: Quantity | null,
): InjectionSiteConcern[] {
  if (components.length > 1) {
    return components.flatMap((c) => {
      const note = findPeptide(c.peptideId)?.injectionSite
      return note ? [{ name: c.name, amountMg: c.amountMg, note }] : []
    })
  }
  const note = peptide?.injectionSite
  if (!note) return []
  const amountMg = vial && areCompatible(vial.unit, 'mg') ? convert(vial, 'mg').value : null
  return [{ name: peptide.name, amountMg, note }]
}

/** The concerns that carry a concentration cap the mixing advice can act on. */
export function comfortCaps(concerns: readonly InjectionSiteConcern[]): ComfortCap[] {
  return concerns.flatMap(({ name, amountMg, note }) =>
    amountMg !== null && amountMg > 0 && note.maxMgPerMl
      ? [{ name, amountMg, maxMgPerMl: note.maxMgPerMl }]
      : [],
  )
}

/** The use window that applies to a vial, and the peptide whose label set it (null for the default). */
export interface AppliedInUseLimit {
  limit: InUseLimit
  setBy: string | null
}

/**
 * The shortest use window among the catalog default (the 28-day multiple-dose limit), the
 * vial's peptide, and for a blend each linked component: a blend is only as durable as its
 * least stable ingredient.
 */
export function inUseLimitFor(
  peptideId: string | null,
  components: readonly BlendComponent[] | null,
): AppliedInUseLimit {
  let applied: AppliedInUseLimit = { limit: catalog.storage.inUse, setBy: null }
  const ids = components?.length ? components.map((c) => c.peptideId) : [peptideId]
  for (const id of ids) {
    const p = findPeptide(id)
    if (p?.inUse && p.inUse.days < applied.limit.days) applied = { limit: p.inUse, setBy: p.name }
  }
  return applied
}
