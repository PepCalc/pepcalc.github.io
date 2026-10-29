import { findPeptide } from '@/data'
import type { DrawRow, VialRow } from '@/db/database'
import { groupLevelsByPeptide, type LevelVial } from '@/domain/levels'
import type { ReportPeriod } from '@/domain/report'
import type { ReportSource } from '@/services/report/collectReport'

const DAY = 86_400_000
export const NOW = Date.parse('2026-10-29T12:00:00.000Z')

function vial(
  id: string,
  peptideId: string | null,
  name: string,
  extra: Partial<VialRow> = {},
): VialRow {
  return {
    id,
    peptideId,
    name,
    kind: 'single',
    unit: 'mg',
    amount: 5,
    diluentMl: 2,
    components: null,
    typicalDose: null,
    pkOverride: null,
    reconstitutedAt: null,
    status: 'active',
    notes: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...extra,
  }
}

let seq = 0
function draw(
  vialId: string,
  at: number,
  value: number,
  unit: 'mg' | 'mcg' | 'iu',
  notes = '',
): DrawRow {
  const iso = new Date(at).toISOString()
  return {
    id: `d${seq++}`,
    vialId,
    takenAt: iso,
    dose: { value, unit },
    volumeMl: 0.1,
    syringeId: 'u100-1ml',
    notes,
    createdAt: iso,
  }
}

/** A plausible shelf: weekly semaglutide with a step-up, daily BPC-157, and a custom vial. */
export function sampleShelf() {
  const vials = [
    vial('sema', 'semaglutide', 'Semaglutide'),
    vial('bpc', 'bpc-157', 'BPC-157'),
    vial('custom', null, 'Lab peptide (batch 7) x) Tj /F1 99 Tf (y', {
      pkOverride: { halfLifeHours: 30, tmaxHours: 3 },
    }),
  ]
  const draws: DrawRow[] = []
  for (let w = 0; w < 12; w++) {
    draws.push(
      draw(
        'sema',
        NOW - (80 - w * 7) * DAY,
        w < 4 ? 0.25 : 0.5,
        'mg',
        w === 4 ? 'Stepped up to 0.5 mg' : '',
      ),
    )
  }
  for (let d = 0; d < 20; d++) draws.push(draw('bpc', NOW - (20 - d) * DAY + 3600_000, 250, 'mcg'))
  draws.push(draw('custom', NOW - 2 * DAY, 2, 'mg', 'Left thigh; note with émoji 💉 and ≥ sign'))
  return { vials, draws }
}

export function sampleSource(period: ReportPeriod = '90d', locale = 'en-GB'): ReportSource {
  const { vials, draws } = sampleShelf()
  const levelVials: LevelVial[] = vials.map((v) => ({
    id: v.id,
    peptideId: v.peptideId,
    label: findPeptide(v.peptideId)?.name ?? v.name,
    pk: v.pkOverride
      ? { params: v.pkOverride, userSupplied: true }
      : findPeptide(v.peptideId)?.pk
        ? { params: findPeptide(v.peptideId)!.pk!, userSupplied: false }
        : null,
  }))
  const groups = groupLevelsByPeptide(
    levelVials,
    draws.map((d) => ({ vialId: d.vialId, at: Date.parse(d.takenAt), dose: d.dose })),
  )
  return { vials, draws, groups, vialName: (v) => v.name, period, now: NOW, locale }
}
