import { describe, expect, it } from 'vitest'
import { findPeptide } from '@/data'
import { groupLevelsByPeptide } from '@/domain/levels'
import { A4, LETTER } from '@/services/pdf/pageSize'
import { collectReport, pageSizeFor } from '@/services/report/collectReport'
import { NOW, sampleSource } from './fixtures'

const DAY = 86_400_000
const byName = (period: '30d' | '90d' | 'all') =>
  new Map(collectReport(sampleSource(period)).peptides.map((p) => [p.name, p]))

describe('collectReport', () => {
  it('lists only draws in the period, newest first', () => {
    const recent = collectReport(sampleSource('30d'))
    const all = collectReport(sampleSource('all'))
    expect(recent.draws.length).toBeLessThan(all.draws.length)
    expect(all.draws).toHaveLength(33)
    expect(recent.summary).toBe(`${recent.draws.length} draws · 3 peptides`)
    expect(recent.draws[0]!.name).toBe('BPC-157')
  })

  it('totals each peptide without mixing units, in the unit drawn', () => {
    expect(byName('all').get('BPC-157')!.stats).toContainEqual(['Total drawn', '5000 mcg'])
    expect(byName('all').get('Semaglutide')!.stats).toContainEqual(['Total drawn', '5 mg'])
  })

  it('gives a catalog curve its label source and every citation', () => {
    const sema = byName('90d').get('Semaglutide')!
    expect(sema.pk!.sourceLabel).toBe('Prescribing label')
    expect(sema.pk!.userSupplied).toBe(false)
    expect(sema.pk!.citations.length).toBeGreaterThan(0)
    expect(sema.pk!.citations[0]).toMatch(/^Prescribing label: /)
  })

  it('marks a vial override as user-supplied, with no catalog citations', () => {
    const custom = [...byName('90d').values()].find((p) => p.pk?.userSupplied)!
    expect(custom.pk!.sourceLabel).toBe('User-supplied values')
    expect(custom.pk!.citations).toEqual([])
    expect(custom.curve).not.toBeNull()
  })

  it('explains why a peptide without human PK data has no curve', () => {
    const bpc = byName('90d').get('BPC-157')!
    expect(bpc.curve).toBeNull()
    expect(bpc.noCurveReason).toMatch(/pharmacokinetic/i)
  })

  it('starts the curve at the period but counts the doses before it', () => {
    const sema = byName('30d').get('Semaglutide')!
    expect(sema.curve!.window.start).toBeGreaterThan(NOW - 31 * DAY)
    expect(sema.curve!.points[0]!.amount).toBeGreaterThan(0)
    for (const d of sema.curve!.doses) {
      expect(d.at).toBeGreaterThanOrEqual(sema.curve!.window.start)
    }
  })

  it('omits peptides with no draws in the period', () => {
    const names = [...byName('30d').keys()]
    expect(names).toHaveLength(3)
    const old = collectReport({ ...sampleSource('30d'), now: NOW + 200 * DAY })
    expect(old.peptides).toEqual([])
    expect(old.draws).toEqual([])
  })
})

describe('pageSizeFor', () => {
  it('uses Letter where it is the paper standard and A4 elsewhere', () => {
    expect(pageSizeFor('en-US')).toBe(LETTER)
    expect(pageSizeFor('es-MX')).toBe(LETTER)
    expect(pageSizeFor('en-GB')).toBe(A4)
    expect(pageSizeFor('de')).toBe(A4)
    expect(pageSizeFor('not a locale')).toBe(A4)
  })
})

describe('collectReport for a short-acting peptide', () => {
  it('trims the chart to recent days and says so, keeping every draw in the log', () => {
    const base = sampleSource('90d')
    const vial = { ...base.vials[0]!, id: 'tesa', peptideId: 'tesamorelin', name: 'Tesamorelin' }
    const draws = Array.from({ length: 60 }, (_, i) => ({
      ...base.draws[0]!,
      id: `t${i}`,
      vialId: 'tesa',
      takenAt: new Date(NOW - (60 - i) * DAY).toISOString(),
      dose: { value: 2, unit: 'mg' as const },
    }))
    const tesa = findPeptide('tesamorelin')!
    const groups = groupLevelsByPeptide(
      [
        {
          id: 'tesa',
          peptideId: 'tesamorelin',
          label: 'Tesamorelin',
          pk: { params: tesa.pk!, userSupplied: false },
        },
      ],
      draws.map((d) => ({ vialId: 'tesa', at: Date.parse(d.takenAt), dose: d.dose })),
    )
    const report = collectReport({ ...base, vials: [vial], draws, groups })
    const curve = report.peptides[0]!.curve!
    expect(curve.note).toMatch(/3 days/)
    expect(curve.window.end - curve.window.start).toBeLessThan(5 * DAY)
    expect(report.draws).toHaveLength(60)
  })
})
