import { describe, expect, it } from 'vitest'
import { vialBalance } from '@/domain/inventory'
import { splitBlendDose, blendTotalMg } from '@/domain/blend'

describe('vial balance', () => {
  const vial = { amount: 10, unit: 'mg' as const, diluentMl: 2 }

  it('subtracts draws in mixed mass units', () => {
    const b = vialBalance(
      vial,
      [
        { dose: { value: 2.5, unit: 'mg' }, volumeMl: 0.5 },
        { dose: { value: 2500, unit: 'mcg' }, volumeMl: 0.5 },
      ],
      { value: 2.5, unit: 'mg' },
    )
    expect(b.remainingAmount).toBeCloseTo(5, 9)
    expect(b.remainingMl).toBeCloseTo(1, 9)
    expect(b.usedFraction).toBeCloseTo(0.5, 9)
    expect(b.dosesLeft).toBe(2)
    expect(b.overdrawn).toBe(false)
  })

  it('never goes below zero and flags overdraw', () => {
    const b = vialBalance(vial, [{ dose: { value: 12, unit: 'mg' }, volumeMl: 2.4 }])
    expect(b.remainingAmount).toBe(0)
    expect(b.remainingMl).toBe(0)
    expect(b.overdrawn).toBe(true)
    expect(b.dosesLeft).toBeNull()
  })
})

describe('blends', () => {
  const klow = [
    { name: 'GHK-Cu', amountMg: 50 },
    { name: 'BPC-157', amountMg: 10 },
    { name: 'TB-500', amountMg: 10 },
    { name: 'KPV', amountMg: 10 },
  ]

  it('totals the components', () => {
    expect(blendTotalMg(klow)).toBe(80)
  })

  it('splits a dose in the vial ratio', () => {
    const split = splitBlendDose({ value: 8, unit: 'mg' }, klow, 'mcg')
    expect(split.map((s) => s.dose.value)).toEqual([5000, 1000, 1000, 1000])
    expect(split.every((s) => s.dose.unit === 'mcg')).toBe(true)
  })
})
