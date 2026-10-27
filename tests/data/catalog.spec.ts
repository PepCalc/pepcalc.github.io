import { describe, expect, it } from 'vitest'
import Ajv2020 from 'ajv/dist/2020'
import peptideSchema from '@/data/peptides.schema.json'
import syringeSchema from '@/data/syringes.schema.json'
import peptidesJson from '@/data/peptides.json'
import syringesJson from '@/data/syringes.json'
import { catalog, findPeptide, inUseLimitFor, syringeCatalog } from '@/data'
import { areCompatible } from '@/domain/units'
import { blendTotalMg } from '@/domain/blend'
import { rateConstants } from '@/domain/pk'

// strictRequired is off because if/then branches legitimately require properties declared above.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false })

describe('peptides.json', () => {
  it('matches its JSON Schema', () => {
    const validate = ajv.compile(peptideSchema)
    expect(validate(peptidesJson), JSON.stringify(validate.errors, null, 2)).toBe(true)
  })

  it('has unique ids', () => {
    const ids = catalog.peptides.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(catalog.peptides.map((p) => [p.id, p] as const))(
    '%s is internally consistent',
    (_, p) => {
      expect(areCompatible(p.vialUnit, p.defaultDoseUnit)).toBe(true)
      expect(areCompatible(p.vialUnit, p.vialSizes.unit)).toBe(true)
      if (p.doses) expect(areCompatible(p.vialUnit, p.doses.unit)).toBe(true)
      if (p.kind === 'blend') {
        expect(p.vialSizes.values).toContain(blendTotalMg(p.components ?? []))
      }
      if (p.pk) expect(() => rateConstants(p.pk!)).not.toThrow()
      for (const c of p.components ?? []) {
        expect(findPeptide(c.peptideId)?.kind, `${p.id}: ${c.name}`).toBe('single')
      }
      // The 28-day multiple-dose limit caps every vial mixed with bacteriostatic water.
      if (p.inUse) expect(p.inUse.days).toBeLessThan(catalog.storage.inUse.days)
      // A blend's comfort comes from its components; a mg/mL cap needs a mass vial.
      if (p.injectionSite?.maxMgPerMl) {
        expect(p.kind).toBe('single')
        expect(areCompatible(p.vialUnit, 'mg')).toBe(true)
      }
    },
  )

  it('ships every launch peptide', () => {
    const names = catalog.peptides.map((p) => p.name)
    for (const name of [
      'Semaglutide',
      'Tirzepatide',
      'Retatrutide',
      'Cagrilintide',
      'GHK-Cu',
      'Tesamorelin',
      'KLOW',
      'BPC-157',
      'TB-500',
      'KPV',
      'GLOW',
    ]) {
      expect(names).toContain(name)
    }
  })
})

describe('inUseLimitFor', () => {
  it('uses the 28-day multiple-dose limit by default and for custom peptides', () => {
    expect(inUseLimitFor('bpc-157', null)).toMatchObject({ limit: { days: 28 }, setBy: null })
    expect(inUseLimitFor(null, null).limit.days).toBe(28)
  })

  it("uses a peptide's shorter label limit", () => {
    expect(inUseLimitFor('tesamorelin', null)).toMatchObject({
      limit: { days: 7 },
      setBy: 'Tesamorelin',
    })
  })

  it('takes the shortest limit among blend components', () => {
    const components = [
      { name: 'BPC-157', amountMg: 5, peptideId: 'bpc-157' },
      { name: 'Tesamorelin', amountMg: 5, peptideId: 'tesamorelin' },
    ]
    expect(inUseLimitFor(null, components).limit.days).toBe(7)
  })
})

describe('syringes.json', () => {
  it('matches its JSON Schema', () => {
    const validate = ajv.compile(syringeSchema)
    expect(validate(syringesJson), JSON.stringify(validate.errors, null, 2)).toBe(true)
  })

  it('names an existing default syringe, a U-100', () => {
    const def = syringeCatalog.syringes.find((s) => s.id === syringeCatalog.defaultSyringeId)
    expect(def?.unitsPerMl).toBe(100)
  })

  it('has ticks that divide capacity evenly', () => {
    for (const s of syringeCatalog.syringes) {
      const ticks = s.capacityMl / s.tickMl
      expect(Math.abs(ticks - Math.round(ticks))).toBeLessThan(1e-9)
    }
  })
})
