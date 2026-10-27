import { describe, expect, it } from 'vitest'
import { ageTier, areValidLimits, limitsForWindow } from '@/domain/vialAge'

describe('limitsForWindow', () => {
  it('gives a week of notice on the 28-day multiple-dose limit', () => {
    expect(limitsForWindow(28)).toEqual({ nearingDays: 21, pastDays: 28 })
  })

  it('still gives notice on a short window: days 5 and 6 of a 7-day window', () => {
    expect(ageTier(5, limitsForWindow(7))).toBe('nearing')
    expect(ageTier(6, limitsForWindow(7))).toBe('nearing')
    expect(ageTier(7, limitsForWindow(7))).toBe('past')
    expect(limitsForWindow(7)).toEqual({ nearingDays: 5, pastDays: 7 })
    expect(limitsForWindow(1)).toEqual({ nearingDays: 1, pastDays: 1 })
  })

  it('rejects an empty window', () => {
    expect(() => limitsForWindow(0)).toThrow(RangeError)
  })
})

describe('ageTier', () => {
  const limits = { nearingDays: 21, pastDays: 28 }

  it.each([
    [0, 'fresh'],
    [20, 'fresh'],
    [21, 'nearing'],
    [27, 'nearing'],
    [28, 'past'],
  ] as const)('day %i is %s', (days, tier) => {
    expect(ageTier(days, limits)).toBe(tier)
  })

  it('applies custom thresholds such as 45 and 90 days', () => {
    const custom = { nearingDays: 45, pastDays: 90 }
    expect(ageTier(44, custom)).toBe('fresh')
    expect(ageTier(89, custom)).toBe('nearing')
    expect(ageTier(90, custom)).toBe('past')
  })
})

describe('areValidLimits', () => {
  it('accepts whole days with nearing before past', () => {
    expect(areValidLimits({ nearingDays: 45, pastDays: 90 })).toBe(true)
  })

  it.each([
    { nearingDays: 90, pastDays: 45 },
    { nearingDays: 30, pastDays: 30 },
    { nearingDays: 1.5, pastDays: 30 },
    { nearingDays: -1, pastDays: 30 },
    { nearingDays: Number.NaN, pastDays: 30 },
  ])('rejects %o', (limits) => {
    expect(areValidLimits(limits)).toBe(false)
  })
})
