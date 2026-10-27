<script setup lang="ts">
import { computed } from 'vue'
import { syringeCatalog } from '@/data'
import type { ComponentDose } from '@/domain/blend'
import type { DrawPlan } from '@/domain/reconstitution'
import { scaleLabel, type SyringeReading, type SyringeSpec } from '@/domain/syringe'
import { roundTo, unitLabel, type Quantity } from '@/domain/units'
import type { CalculatorWarning } from '@/composables/useCalculator'
import SyringeGraphic from './SyringeGraphic.vue'

const props = defineProps<{
  plan: DrawPlan
  reading: SyringeReading
  allReadings: SyringeReading[]
  warnings: CalculatorWarning[]
  componentDoses: ComponentDose[]
  betterSyringe: SyringeSpec | null
  dose: Quantity
}>()

const syringeId = defineModel<string>('syringeId', { required: true })

const headline = computed(() => {
  const r = props.reading
  return r.scaleUnit === 'units'
    ? { value: roundTo(r.scaleValue, 2), unit: 'units' }
    : { value: roundTo(r.scaleValue, 3), unit: 'mL' }
})

const concentrationText = computed(() => {
  const c = props.plan.concentration
  if (c.unit === 'iu') return `${roundTo(c.perMl, 3)} IU/mL`
  const perMl = c.unit === 'mg' ? c.perMl : c.perMl / 1000
  return `${roundTo(perMl, 4)} mg/mL (${roundTo(perMl * 1000, 1)} mcg/mL)`
})

const syringeItems = syringeCatalog.syringes.map((s) => ({ title: s.label, value: s.id }))
</script>

<template>
  <v-card class="draw-result" aria-live="polite">
    <v-card-item>
      <p class="pc-eyebrow">Draw</p>
      <div class="draw-result__headline">
        <span class="draw-result__value pc-num" data-testid="draw-headline">{{
          headline.value
        }}</span>
        <span class="draw-result__unit">{{ headline.unit }}</span>
      </div>
      <p class="pc-muted pc-num">
        <strong>{{ roundTo(plan.volumeMl, 3) }} mL</strong> for {{ roundTo(dose.value, 4) }}
        {{ unitLabel(dose.unit) }} on a {{ reading.syringe.label }}
      </p>
    </v-card-item>

    <v-card-text>
      <SyringeGraphic :syringe="reading.syringe" :volume-ml="plan.volumeMl" />

      <v-alert
        v-for="w in warnings"
        :key="w.text"
        :type="w.tone === 'alert' ? 'error' : 'warning'"
        variant="tonal"
        density="compact"
        class="mt-3"
      >
        {{ w.text }}
      </v-alert>

      <v-alert v-if="betterSyringe" type="info" variant="tonal" density="compact" class="mt-3">
        A {{ betterSyringe.label }} has finer marks for this draw.
        <template #append>
          <v-btn size="small" variant="text" @click="syringeId = betterSyringe.id">Use it</v-btn>
        </template>
      </v-alert>

      <v-select
        v-model="syringeId"
        :items="syringeItems"
        label="Syringe"
        class="mt-4"
        hide-details
      />

      <dl class="draw-result__facts mt-6">
        <div>
          <dt class="pc-faint">Concentration</dt>
          <dd class="pc-num">{{ concentrationText }}</dd>
        </div>
        <div>
          <dt class="pc-faint">Doses per vial</dt>
          <dd class="pc-num">{{ plan.dosesPerVial }}</dd>
        </div>
        <div v-if="reading.fits && reading.tickRoundingError > 0.001">
          <dt class="pc-faint">Nearest mark</dt>
          <dd class="pc-num">
            {{ reading.nearestTickValue }} {{ reading.scaleUnit }}
            <span class="pc-faint">({{ Math.round(reading.tickRoundingError * 100) }}% off)</span>
          </dd>
        </div>
      </dl>

      <div v-if="componentDoses.length" class="pc-inset pa-3 mt-4">
        <p class="text-label-large mb-1">This draw contains</p>
        <ul class="draw-result__components">
          <li v-for="c in componentDoses" :key="c.name" class="pc-num">
            <span>{{ c.name }}</span>
            <span>{{ roundTo(c.dose.value, 1) }} mcg</span>
          </li>
        </ul>
      </div>

      <details class="mt-4">
        <summary class="text-label-large">On every syringe</summary>
        <v-table density="compact" class="draw-result__table">
          <tbody>
            <tr v-for="r in allReadings" :key="r.syringe.id">
              <td>{{ r.syringe.label }}</td>
              <td class="text-end pc-num">
                <template v-if="!r.fits">over capacity</template>
                <template v-else-if="r.belowResolution">below one mark</template>
                <template v-else>{{ scaleLabel(r) }}</template>
              </td>
            </tr>
          </tbody>
        </v-table>
      </details>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.draw-result__headline {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 0;
}

.draw-result__value {
  font-family: var(--pc-font);
  font-size: clamp(3rem, 12vw, 4.5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
}

.draw-result__unit {
  font-size: 1.25rem;
  font-weight: 600;
}

.draw-result__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 0;
}

.draw-result__facts dt {
  font-size: 0.75rem;
  font-weight: 600;
}

.draw-result__facts dd {
  margin: 0;
  font-weight: 600;
}

.draw-result__components {
  list-style: none;
  padding: 0;
  margin: 0;
}

.draw-result__components li {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

.draw-result__table {
  background: transparent;
}

summary {
  cursor: pointer;
  min-height: 32px;
}
</style>
