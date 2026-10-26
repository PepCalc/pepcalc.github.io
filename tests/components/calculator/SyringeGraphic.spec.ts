import { describe, expect, it } from 'vitest'
import SyringeGraphic from '@/components/calculator/SyringeGraphic.vue'
import { findSyringe } from '@/data'
import { mountWithVuetify } from '../../helpers'

describe('SyringeGraphic', () => {
  it('describes the reading for screen readers', () => {
    const wrapper = mountWithVuetify(SyringeGraphic, {
      props: { syringe: findSyringe('u100-1ml'), volumeMl: 0.1 },
    })
    expect(wrapper.find('svg').attributes('aria-label')).toBe(
      'U-100 insulin, 1 mL (100 units), filled to 10 units of 100 units',
    )
  })

  it('draws one tick per graduation and numbers every major mark', () => {
    const wrapper = mountWithVuetify(SyringeGraphic, {
      props: { syringe: findSyringe('u100-0.3ml'), volumeMl: 0.1 },
    })
    expect(wrapper.findAll('.syringe__ticks line')).toHaveLength(31)
    expect(wrapper.findAll('.syringe__labels text').map((t) => t.text())).toEqual([
      '0',
      '5',
      '10',
      '15',
      '20',
      '25',
      '30',
    ])
  })

  it('says when the draw exceeds capacity', () => {
    const wrapper = mountWithVuetify(SyringeGraphic, {
      props: { syringe: findSyringe('u100-0.3ml'), volumeMl: 0.5 },
    })
    expect(wrapper.find('svg').attributes('aria-label')).toContain('exceeds')
    expect(wrapper.find('.syringe__reading').text()).toBe('exceeds 30 units')
  })
})
