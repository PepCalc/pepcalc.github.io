import type { DoseEvent, PkParameters } from './pk'
import { areCompatible, convert, type AmountUnit, type Quantity } from './units'

/** A vial as the level grouping needs it; the caller resolves its PK parameters. */
export interface LevelVial {
  id: string
  /** Catalog id, or null for a custom peptide. */
  peptideId: string | null
  /** Display name for the group: the catalog name, or the vial name for a custom peptide. */
  label: string
  pk: { params: PkParameters; userSupplied: boolean } | null
}

export interface LevelDraw {
  vialId: string
  /** Epoch milliseconds. */
  at: number
  dose: Quantity
}

export interface PeptideLevels {
  key: string
  peptideId: string | null
  label: string
  /** Parameters of the most recently drawn vial in the group, or null when none are known. */
  pk: { params: PkParameters; userSupplied: boolean } | null
  /** Unit of the most recent draw; every dose is expressed in it. */
  unit: AmountUnit
  /** Oldest first. */
  doses: DoseEvent[]
  /** Draws left out because their unit cannot be expressed in `unit` (IU and mass). */
  excluded: number
  vialCount: number
  latestAt: number
}

/** The pooling key: a catalog peptide shares one; a custom peptide is its own vial. */
export function levelKey(vial: { id: string; peptideId: string | null }): string {
  return vial.peptideId ?? `vial:${vial.id}`
}

/**
 * Doses in `unit` from every vial sharing `key`, oldest first. Draws that cannot be expressed in
 * `unit` (IU and mass) are left out rather than converted.
 */
export function pooledDoses(
  vials: readonly LevelVial[],
  draws: readonly LevelDraw[],
  key: string,
  unit: AmountUnit,
): { doses: DoseEvent[]; vialCount: number } {
  const ids = new Set(vials.filter((v) => levelKey(v) === key).map((v) => v.id))
  const matching = draws
    .filter((d) => ids.has(d.vialId) && areCompatible(d.dose.unit, unit))
    .sort((a, b) => a.at - b.at)
  return {
    doses: matching.map((d) => ({ at: d.at, amount: convert(d.dose, unit).value })),
    vialCount: new Set(matching.map((d) => d.vialId)).size,
  }
}

/**
 * Pool every draw of the same peptide, across all of its vials, so the estimated level reflects
 * everything still in the body rather than one vial's share. Catalog peptides group by catalog
 * id; a custom peptide has no shared identity, so each custom vial is its own group. A blend is
 * its own catalog entry and stays one group: its doses are total-blend amounts. Draws whose vial
 * no longer exists are skipped because their peptide is unknown. Groups come newest first.
 */
export function groupLevelsByPeptide(
  vials: readonly LevelVial[],
  draws: readonly LevelDraw[],
): PeptideLevels[] {
  const vialsById = new Map(vials.map((v) => [v.id, v]))
  const byKey = new Map<string, { vial: LevelVial; draw: LevelDraw }[]>()
  for (const draw of draws) {
    const vial = vialsById.get(draw.vialId)
    if (!vial) continue
    const key = levelKey(vial)
    const list = byKey.get(key) ?? []
    list.push({ vial, draw })
    byKey.set(key, list)
  }

  const groups: PeptideLevels[] = []
  for (const [key, entries] of byKey) {
    entries.sort((a, b) => a.draw.at - b.draw.at)
    const latest = entries[entries.length - 1]!
    const unit = latest.draw.dose.unit
    const compatible = entries.filter((e) => areCompatible(e.draw.dose.unit, unit))
    groups.push({
      key,
      peptideId: latest.vial.peptideId,
      label: latest.vial.label,
      pk: latest.vial.pk,
      unit,
      doses: compatible.map((e) => ({ at: e.draw.at, amount: convert(e.draw.dose, unit).value })),
      excluded: entries.length - compatible.length,
      vialCount: new Set(entries.map((e) => e.vial.id)).size,
      latestAt: latest.draw.at,
    })
  }
  return groups.sort((a, b) => b.latestAt - a.latestAt)
}
