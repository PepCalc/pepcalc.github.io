import { describe, expect, it } from 'vitest'
import { readSyringe, suggestSyringe } from '@/domain/syringe'
import { findSyringe, syringeCatalog } from '@/data'

describe('syringe readings', () => {
  const u100 = findSyringe('u100-1ml')

  it('reads 0.1 mL as 10 units on a U-100 syringe', () => {
    const r = readSyringe(0.1, u100)
    expect(r.scaleValue).toBeCloseTo(10, 9)
    expect(r.scaleUnit).toBe('units')
    expect(r.nearestTickValue).toBe(10)
    expect(r.fits).toBe(true)
    expect(r.belowResolution).toBe(false)
  })

  it('reads the same volume as 4 units on a U-40 syringe', () => {
    expect(readSyringe(0.1, findSyringe('u40-1ml')).scaleValue).toBeCloseTo(4, 9)
  })

  it('reads mL directly on a luer syringe', () => {
    const r = readSyringe(0.35, findSyringe('luer-1ml'))
    expect(r.scaleUnit).toBe('mL')
    expect(r.scaleValue).toBeCloseTo(0.35, 9)
  })

  it('rounds to the nearest 2-unit mark on a 1 mL U-100 syringe and reports the error', () => {
    const r = readSyringe(0.125, u100)
    expect(r.nearestTickValue).toBe(12)
    expect(r.tickRoundingError).toBeCloseTo(0.04, 6)
  })

  it('flags volumes over capacity and counts fills', () => {
    const r = readSyringe(1.5, u100)
    expect(r.fits).toBe(false)
    expect(r.fillsNeeded).toBe(2)
  })

  it('flags volumes smaller than one mark', () => {
    expect(readSyringe(0.01, u100).belowResolution).toBe(true)
  })

  it('suggests the smallest barrel that fits', () => {
    const insulin = syringeCatalog.syringes.filter((s) => s.unitsPerMl === 100)
    expect(suggestSyringe(0.1, insulin)?.id).toBe('u100-0.3ml')
    expect(suggestSyringe(0.45, insulin)?.id).toBe('u100-0.5ml')
    expect(suggestSyringe(2, insulin)).toBeNull()
  })
})
