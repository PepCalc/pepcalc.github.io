<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { catalog } from '@/data'
import { CUSTOM_PEPTIDE, useCalculator } from '@/composables/useCalculator'
import { useNow } from '@/composables/useNow'
import { useSettingsStore } from '@/stores/settings'
import { useShelfStore } from '@/stores/shelf'
import { useNotifyStore } from '@/stores/notify'
import { roundTo, unitLabel } from '@/domain/units'
import type { DoseEvent } from '@/domain/pk'
import { nowIso } from '@/services/time'
import PresetPicker from '@/components/common/PresetPicker.vue'
import SourceBadge from '@/components/common/SourceBadge.vue'
import DrawResult from '@/components/calculator/DrawResult.vue'
import PkPanel from '@/components/charts/PkPanel.vue'
import { mdiBookshelf, mdiNeedle } from '@/plugins/icons'

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()
const shelf = useShelfStore()
const notify = useNotifyStore()
const now = useNow()

const calc = useCalculator({ syringeId: settings.defaultSyringeId })
const { state } = calc

const peptideItems = [
  ...catalog.peptides.map((p) => ({
    title: p.name,
    value: p.id,
    subtitle: p.kind === 'blend' ? 'Blend' : p.aliases.slice(0, 2).join(', '),
  })),
  { title: 'Custom peptide', value: CUSTOM_PEPTIDE, subtitle: 'Enter your own values' },
]

/** A shelf vial selected with ?vial=<id>; its amount and water are fixed. */
const shelfVial = computed(() => {
  const id = route.query.vial
  return typeof id === 'string' ? shelf.vialById(id) : undefined
})

watch(
  shelfVial,
  (vial) => {
    if (!vial) return
    calc.actions.selectPeptide(vial.peptideId ?? CUSTOM_PEPTIDE)
    Object.assign(state, {
      customName: vial.peptideId ? '' : vial.name,
      vialAmount: vial.amount,
      vialUnit: vial.unit,
      diluentMl: vial.diluentMl,
      components: vial.components?.map((c) => ({ ...c })) ?? [],
      doseValue: vial.typicalDose?.value ?? state.doseValue,
      doseUnit: vial.typicalDose?.unit ?? state.doseUnit,
    })
  },
  { immediate: true },
)

watch(
  () => settings.defaultSyringeId,
  (id) => {
    state.syringeId = id
  },
)

const doseHint = computed(() => {
  const doses = calc.peptide.value?.doses
  if (!doses) return 'No established dose for this peptide: enter your own.'
  return undefined
})

const balance = computed(() => (shelfVial.value ? shelf.balanceOf(shelfVial.value) : null))

/** Logged doses of this peptide from every vial, in the dose unit being entered. */
const pooled = computed(() =>
  shelfVial.value
    ? shelf.pooledDosesFor(shelfVial.value, state.doseUnit)
    : { doses: [], vialCount: 0 },
)
const pooledCaption = computed(() =>
  pooled.value.vialCount > 1
    ? `Includes doses from ${pooled.value.vialCount} vials of this peptide.`
    : undefined,
)

const previewDose = computed<DoseEvent | null>(() =>
  calc.dose.value ? { at: now.value, amount: calc.dose.value.value } : null,
)

async function saveToShelf() {
  if (!calc.vial.value || !state.diluentMl) return
  const p = calc.peptide.value
  const vial = await shelf.addVial({
    peptideId: p?.id ?? null,
    name: p?.name ?? (state.customName.trim() || 'Custom peptide'),
    kind: calc.isBlend.value ? 'blend' : 'single',
    unit: state.vialUnit,
    amount: calc.vial.value.value,
    diluentMl: state.diluentMl,
    components: calc.isBlend.value ? state.components.map((c) => ({ ...c })) : null,
    typicalDose: calc.dose.value,
    pkOverride: null,
    reconstitutedAt: nowIso(),
    status: 'active',
    notes: '',
  })
  notify.show(`${vial.name} added to your shelf`, 'success')
  await router.replace({ name: 'calculator', query: { vial: vial.id } })
}

async function logDraw() {
  const vial = shelfVial.value
  if (!vial || !calc.plan.value || !calc.dose.value) return
  await shelf.addDraw({
    vialId: vial.id,
    takenAt: nowIso(),
    dose: calc.dose.value,
    volumeMl: calc.plan.value.volumeMl,
    syringeId: state.syringeId,
    notes: '',
  })
  notify.show(
    `Logged ${roundTo(calc.dose.value.value, 4)} ${unitLabel(calc.dose.value.unit)} of ${vial.name}`,
    'success',
  )
}

function clearShelfVial() {
  void router.replace({ name: 'calculator' })
}
</script>

<template>
  <div class="pc-page">
    <header class="mb-4">
      <p class="pc-eyebrow">Peptide calculator</p>
      <h1 class="pc-display text-headline-large">How much to draw</h1>
    </header>

    <div class="calc-layout">
      <section class="calc-inputs" aria-label="Inputs">
        <v-card v-if="shelfVial" class="pc-card-soft">
          <v-card-item>
            <p class="pc-eyebrow">From your shelf</p>
            <v-card-title>{{ shelfVial.name }}</v-card-title>
            <v-card-subtitle class="pc-num">
              {{ shelfVial.amount }} {{ unitLabel(shelfVial.unit) }} in {{ shelfVial.diluentMl }} mL
              <template v-if="balance">
                · {{ roundTo(balance.remainingAmount, 3) }} {{ unitLabel(shelfVial.unit) }} left
              </template>
            </v-card-subtitle>
          </v-card-item>
          <v-card-actions>
            <v-btn :to="{ name: 'vial', params: { id: shelfVial.id } }" variant="text"
              >Open vial</v-btn
            >
            <v-btn variant="text" @click="clearShelfVial">Use a different peptide</v-btn>
          </v-card-actions>
        </v-card>

        <v-card v-else>
          <v-card-item>
            <p class="pc-eyebrow">1 · Peptide</p>
          </v-card-item>
          <v-card-text>
            <v-select
              :model-value="state.peptideId"
              :items="peptideItems"
              item-title="title"
              item-value="value"
              label="Peptide"
              @update:model-value="calc.actions.selectPeptide($event as string)"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps" :subtitle="item.subtitle" />
              </template>
            </v-select>
            <v-text-field
              v-if="state.peptideId === CUSTOM_PEPTIDE"
              v-model="state.customName"
              label="Name"
              placeholder="e.g. Ipamorelin"
            />
            <p v-if="calc.peptide.value" class="text-body-medium pc-muted">
              {{ calc.peptide.value.summary }}
            </p>
          </v-card-text>
        </v-card>

        <v-card v-if="!shelfVial">
          <v-card-item>
            <p class="pc-eyebrow">2 · Vial</p>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-4">
            <template v-if="calc.isBlend.value">
              <div>
                <p class="text-label-large mb-2">Composition per vial</p>
                <div
                  v-for="(c, i) in state.components"
                  :key="c.name"
                  class="d-flex ga-3 align-center"
                >
                  <v-text-field
                    v-model.number="state.components[i]!.amountMg"
                    :label="`${c.name} amount`"
                    suffix="mg"
                    type="number"
                    inputmode="decimal"
                    hide-details
                    class="calc-component-amount"
                  />
                </div>
                <p class="text-body-small pc-faint mt-2">
                  Vendor compositions differ. Match these to your vial's label. Total:
                  <strong class="pc-num">{{ state.vialAmount }} mg</strong>
                </p>
              </div>
            </template>
            <template v-else>
              <PresetPicker
                v-model="state.vialAmount"
                input-id="vial-amount"
                label="Peptide in vial"
                :presets="calc.peptide.value?.vialSizes.values ?? []"
                :unit-label="unitLabel(state.vialUnit)"
                :hint="
                  calc.peptide.value
                    ? 'Common vial sizes. Use the amount printed on your vial.'
                    : undefined
                "
              />
              <v-btn-toggle
                v-if="state.peptideId === CUSTOM_PEPTIDE"
                v-model="state.vialUnit"
                mandatory
                density="comfortable"
                aria-label="Vial unit"
              >
                <v-btn value="mg">mg</v-btn>
                <v-btn value="iu">IU</v-btn>
              </v-btn-toggle>
            </template>

            <PresetPicker
              v-model="state.diluentMl"
              input-id="diluent"
              label="Bacteriostatic water added"
              :presets="calc.peptide.value?.diluentMl.values ?? [1, 2, 3, 5]"
              unit-label="mL"
              hint="More water makes small doses easier to measure, but each dose is a larger volume."
            />
          </v-card-text>
          <v-card-actions class="calc-save">
            <v-btn
              color="primary"
              variant="tonal"
              :prepend-icon="mdiBookshelf"
              :disabled="!calc.vial.value || !state.diluentMl"
              @click="saveToShelf"
            >
              Save vial to shelf
            </v-btn>
            <span class="text-body-small pc-faint">Remembers this vial so you can log draws.</span>
          </v-card-actions>
        </v-card>

        <v-card>
          <v-card-item>
            <p class="pc-eyebrow">{{ shelfVial ? 'Dose' : '3 · Dose' }}</p>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-3">
            <v-btn-toggle
              v-if="calc.doseUnits.value.length > 1"
              :model-value="state.doseUnit"
              mandatory
              density="comfortable"
              aria-label="Dose unit"
              @update:model-value="calc.actions.setDoseUnit($event)"
            >
              <v-btn v-for="u in calc.doseUnits.value" :key="u" :value="u">{{
                unitLabel(u)
              }}</v-btn>
            </v-btn-toggle>
            <PresetPicker
              v-model="state.doseValue"
              input-id="dose"
              label="Dose"
              :presets="
                calc.peptide.value?.doses && calc.peptide.value.doses.unit === state.doseUnit
                  ? calc.peptide.value.doses.values
                  : []
              "
              :unit-label="unitLabel(state.doseUnit)"
              :hint="doseHint"
            />
            <div
              v-if="calc.peptide.value?.doses && calc.peptide.value.doses.unit === state.doseUnit"
              class="d-flex flex-wrap ga-2 align-center"
            >
              <SourceBadge :kind="calc.peptide.value.doses.source.kind" />
              <a
                v-if="calc.peptide.value.doses.source.url"
                :href="calc.peptide.value.doses.source.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-body-small"
                >{{ calc.peptide.value.doses.source.citation }}</a
              >
              <span v-else class="text-body-small pc-muted">{{
                calc.peptide.value.doses.source.citation
              }}</span>
            </div>
          </v-card-text>
        </v-card>
      </section>

      <section class="calc-output" aria-label="Result">
        <DrawResult
          v-if="calc.plan.value && calc.reading.value && calc.dose.value"
          v-model:syringe-id="state.syringeId"
          :plan="calc.plan.value"
          :reading="calc.reading.value"
          :all-readings="calc.allReadings.value"
          :warnings="calc.warnings.value"
          :component-doses="calc.componentDoses.value"
          :better-syringe="calc.betterSyringe.value"
          :dose="calc.dose.value"
        />
        <v-card v-else variant="tonal">
          <v-card-text class="pc-muted">
            <template v-if="calc.error.value">{{ calc.error.value }}</template>
            <template v-else
              >Choose the vial amount, water and dose to see how much to draw.</template
            >
          </v-card-text>
        </v-card>

        <div v-if="calc.plan.value && shelfVial" class="d-flex flex-wrap ga-2">
          <v-btn
            color="primary"
            variant="flat"
            size="large"
            :prepend-icon="mdiNeedle"
            @click="logDraw"
          >
            Log this draw now
          </v-btn>
        </div>

        <PkPanel
          v-if="calc.dose.value"
          :peptide="calc.peptide.value"
          :override="shelfVial?.pkOverride ?? null"
          :doses="pooled.doses"
          :preview="previewDose"
          :unit-label="unitLabel(state.doseUnit)"
          :now="now"
          :caption="pooledCaption"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.calc-layout {
  display: grid;
  gap: 16px;
}

.calc-inputs,
.calc-output {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* Tablets and up: inputs on the left, the answer beside them. */
@media (min-width: 840px) {
  .calc-layout {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    align-items: start;
  }
}

.calc-save {
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 0 16px 16px;
}

.calc-component-amount {
  max-width: 180px;
}
</style>
