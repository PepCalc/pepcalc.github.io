import { describe, expect, it } from 'vitest'
import { concentrationOf, drawVolumeMl, planDraw, InvalidInputError } from '@/domain/reconstitution'
import { IncompatibleUnitsError, convert, roundTo, doseUnitsFor } from '@/domain/units'

describe('units', () => {
  it('converts between mg and mcg', () => {
    expect(convert({ value: 0.25, unit: 'mg' }, 'mcg')).toEqual({ value: 250, unit: 'mcg' })
    expect(convert({ value: 500, unit: 'mcg' }, 'mg')).toEqual({ value: 0.5, unit: 'mg' })
  })

  it('refuses to convert IU to mass or back', () => {
    expect(() => convert({ value: 10, unit: 'iu' }, 'mg')).toThrow(IncompatibleUnitsError)
    expect(() => convert({ value: 1, unit: 'mg' }, 'iu')).toThrow(IncompatibleUnitsError)
  })

  it('offers only compatible dose units', () => {
    expect(doseUnitsFor('mg')).toEqual(['mg', 'mcg'])
    expect(doseUnitsFor('iu')).toEqual(['iu'])
  })

  it('rounds away float noise', () => {
    expect(roundTo(0.1 + 0.2, 3)).toBe(0.3)
  })
})

describe('reconstitution', () => {
  it('reproduces the standard check: 5 mg in 2 mL, 250 mcg is 0.1 mL', () => {
    const c = concentrationOf({ value: 5, unit: 'mg' }, 2)
    expect(c).toEqual({ perMl: 2.5, unit: 'mg' })
    expect(drawVolumeMl({ value: 250, unit: 'mcg' }, c)).toBeCloseTo(0.1, 12)
  })

  it('handles semaglutide 5 mg / 2 mL at 0.25 mg', () => {
    const plan = planDraw({ value: 5, unit: 'mg' }, 2, { value: 0.25, unit: 'mg' })
    expect(plan.volumeMl).toBeCloseTo(0.1, 12)
    expect(plan.dosesPerVial).toBe(20)
  })

  it('works for IU vials with IU doses', () => {
    const plan = planDraw({ value: 100, unit: 'iu' }, 1, { value: 10, unit: 'iu' })
    expect(plan.volumeMl).toBeCloseTo(0.1, 12)
  })

  it('rejects zero or negative inputs', () => {
    expect(() => concentrationOf({ value: 0, unit: 'mg' }, 2)).toThrow(InvalidInputError)
    expect(() => concentrationOf({ value: 5, unit: 'mg' }, -1)).toThrow(InvalidInputError)
    expect(() => planDraw({ value: 5, unit: 'mg' }, 2, { value: Number.NaN, unit: 'mg' })).toThrow(
      InvalidInputError,
    )
  })

  it('rejects an IU dose from a mass vial', () => {
    expect(() => planDraw({ value: 5, unit: 'mg' }, 2, { value: 10, unit: 'iu' })).toThrow(
      IncompatibleUnitsError,
    )
  })
})
