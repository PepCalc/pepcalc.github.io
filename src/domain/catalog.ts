import type { AmountUnit } from './units'
import type { BlendComponent } from './blend'
import type { PkParameters } from './pk'
import type { SyringeSpec } from './syringe'

/**
 * Where a number came from. `label` is a regulator-approved prescribing label, `trial` a
 * published clinical trial or review of trials, `preclinical` animal or in-vitro work,
 * `community` vendor listings or user forums (shown with a caution), `model` an assumption made
 * by pepcalc where sources give only a range.
 */
export type SourceKind = 'label' | 'trial' | 'preclinical' | 'community' | 'model'

interface SourceRef {
  kind: SourceKind
  citation: string
  url?: string
}

interface PresetList {
  values: number[]
  unit: AmountUnit
  source: SourceRef
}

interface CatalogPk extends PkParameters {
  /** Ranges or caveats from the source, shown beside the chart. */
  notes: string
  sources: SourceRef[]
}

/** How injections of a peptide are reported to feel, and the strength users find tolerable. */
export interface InjectionSiteNote {
  note: string
  /** Concentration at or below which users report injections as tolerable; mass vials only. */
  maxMgPerMl?: number
  sources: SourceRef[]
}

export interface CatalogPeptide {
  id: string
  name: string
  aliases: string[]
  kind: 'single' | 'blend'
  summary: string
  /** Unit the vial's contents are labelled in. */
  vialUnit: AmountUnit
  /** Unit a dose is usually written in; must be compatible with vialUnit. */
  defaultDoseUnit: AmountUnit
  vialSizes: PresetList
  diluentMl: { values: number[]; source: SourceRef }
  doses: PresetList | null
  /** Blend contents per vial; required when kind is 'blend'. */
  components?: BlendComponent[]
  injectionSite?: InjectionSiteNote
  /** Human pharmacokinetics, or null when no reliable human data exists. */
  pk: CatalogPk | null
  /** Shown when pk is null: what is (and is not) known. */
  pkUnavailableReason?: string
}

export interface Catalog {
  version: number
  peptides: CatalogPeptide[]
}

export interface SyringeCatalog {
  version: number
  defaultSyringeId: string
  syringes: SyringeSpec[]
}
