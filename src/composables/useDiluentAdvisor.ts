import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'
import { comfortCaps, injectionSiteConcerns } from '@/data'
import type { BlendComponent } from '@/domain/blend'
import type { CatalogPeptide } from '@/domain/catalog'
import { adviseDiluent, shortlist, type DiluentAdvice } from '@/domain/diluent'
import { InvalidInputError } from '@/domain/reconstitution'
import type { SyringeSpec } from '@/domain/syringe'
import {
  areCompatible,
  convert,
  doseUnitsFor,
  IncompatibleUnitsError,
  roundTo,
  type AmountUnit,
  type Quantity,
} from '@/domain/units'

/** Most lyophilised research peptides ship in 3 mL vials. */
const DEFAULT_VIAL_CAPACITY_ML = 3

/** What is being mixed. The calculator owns it; the advisor only reads it. */
export interface MixContext {
  peptide: CatalogPeptide | undefined
  components: readonly BlendComponent[]
  vial: Quantity | null
  syringe: SyringeSpec
}

export interface AdvisorInput {
  lowDose: number | null
  /** Empty means a fixed dose equal to `lowDose`. */
  highDose: number | null
  doseUnit: AmountUnit
  vialCapacityMl: number | null
  /** The option the user tapped; null follows the recommendation. */
  selectedWaterMl: number | null
}

/**
 * Advice on how much bacteriostatic water to add to the vial in `context`, for the doses the
 * user plans to draw. Doses are the user's own input: the advisor never proposes one. Call
 * `actions.reset` each time the advisor opens so it starts from the calculator's dose.
 */
export function useDiluentAdvisor(context: MaybeRefOrGetter<MixContext>) {
  const state = reactive<AdvisorInput>({
    lowDose: null,
    highDose: null,
    doseUnit: 'mg',
    vialCapacityMl: DEFAULT_VIAL_CAPACITY_ML,
    selectedWaterMl: null,
  })

  const doseUnits = computed(() => doseUnitsFor(toValue(context).vial?.unit ?? 'mg'))

  function reset(dose: Quantity | null) {
    state.lowDose = dose?.value ?? null
    state.highDose = null
    state.doseUnit = dose?.unit ?? doseUnits.value[0]!
    state.selectedWaterMl = null
  }

  /** Switching mg and mcg converts both ends of the range so the doses themselves never change. */
  function setDoseUnit(to: AmountUnit) {
    const from = state.doseUnit
    if (from !== to && areCompatible(from, to)) {
      const conv = (v: number | null) =>
        v === null ? null : roundTo(convert({ value: v, unit: from }, to).value, 6)
      state.lowDose = conv(state.lowDose)
      state.highDose = conv(state.highDose)
    }
    state.doseUnit = to
  }

  function select(waterMl: number) {
    state.selectedWaterMl = waterMl
  }

  const concerns = computed(() => {
    const { peptide, components, vial } = toValue(context)
    return injectionSiteConcerns(peptide, components, vial)
  })

  const result = computed<{ advice: DiluentAdvice } | { error: string } | null>(() => {
    const { vial, syringe } = toValue(context)
    const a = state.lowDose
    const b = state.highDose ?? a
    if (!vial || !a || !b || !state.vialCapacityMl) return null
    const dose = (value: number): Quantity => ({ value, unit: state.doseUnit })
    try {
      return {
        advice: adviseDiluent({
          vial,
          // Accept the range in either order; users type the dose they think of first.
          lowDose: dose(Math.min(a, b)),
          highDose: dose(Math.max(a, b)),
          syringe,
          vialCapacityMl: state.vialCapacityMl,
          caps: comfortCaps(concerns.value),
        }),
      }
    } catch (e) {
      if (e instanceof InvalidInputError || e instanceof IncompatibleUnitsError) {
        return { error: e.message }
      }
      throw e
    }
  })

  const advice = computed(() =>
    result.value && 'advice' in result.value ? result.value.advice : null,
  )
  const error = computed(() =>
    result.value && 'error' in result.value ? result.value.error : null,
  )
  const best = computed(() => advice.value?.ranked[0] ?? null)
  const options = computed(() => (advice.value ? shortlist(advice.value) : []))
  const selected = computed(
    () => options.value.find((o) => o.waterMl === state.selectedWaterMl) ?? best.value,
  )

  return {
    state,
    doseUnits,
    concerns,
    advice,
    error,
    best,
    options,
    selected,
    actions: { reset, setDoseUnit, select },
  }
}
