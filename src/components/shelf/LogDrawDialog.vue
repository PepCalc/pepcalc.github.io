<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { VialRow } from '@/db/database'
import type { NewDraw } from '@/db/repository'
import { findSyringe, syringeCatalog } from '@/data'
import { concentrationOf, drawVolumeMl } from '@/domain/reconstitution'
import { readSyringe } from '@/domain/syringe'
import { doseUnitsFor, roundTo, unitLabel, type AmountUnit } from '@/domain/units'
import { fromLocalInputValue, nowIso, toLocalInputValue } from '@/services/time'

const props = defineProps<{ vial: VialRow; defaultSyringeId: string }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ save: [draw: NewDraw] }>()

const form = reactive({
  dose: '',
  unit: 'mg' as AmountUnit,
  syringeId: '',
  takenAt: '',
  notes: '',
})

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    const typical = props.vial.typicalDose
    Object.assign(form, {
      dose: typical ? String(typical.value) : '',
      unit: typical?.unit ?? doseUnitsFor(props.vial.unit)[0],
      syringeId: props.defaultSyringeId,
      takenAt: toLocalInputValue(nowIso()),
      notes: '',
    })
  },
  { immediate: true },
)

const doseValue = computed(() => Number.parseFloat(form.dose))
const volumeMl = computed(() => {
  if (!(doseValue.value > 0)) return null
  const c = concentrationOf(
    { value: props.vial.amount, unit: props.vial.unit },
    props.vial.diluentMl,
  )
  return drawVolumeMl({ value: doseValue.value, unit: form.unit }, c)
})
const reading = computed(() =>
  volumeMl.value === null ? null : readSyringe(volumeMl.value, findSyringe(form.syringeId)),
)

function save() {
  if (volumeMl.value === null || !form.takenAt) return
  emit('save', {
    vialId: props.vial.id,
    takenAt: fromLocalInputValue(form.takenAt),
    dose: { value: doseValue.value, unit: form.unit },
    volumeMl: volumeMl.value,
    syringeId: form.syringeId,
    notes: form.notes.trim(),
  })
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" scrollable>
    <v-card>
      <v-card-item>
        <v-card-title>Log a draw</v-card-title>
        <v-card-subtitle>{{ vial.name }}</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-form @submit.prevent="save">
          <div class="d-flex ga-3 align-center">
            <v-text-field
              v-model="form.dose"
              label="Dose"
              type="number"
              inputmode="decimal"
              autofocus
            />
            <v-select
              v-model="form.unit"
              :items="doseUnitsFor(vial.unit).map((u) => ({ title: unitLabel(u), value: u }))"
              label="Unit"
              class="log-draw__unit"
            />
          </div>
          <v-select
            v-model="form.syringeId"
            :items="syringeCatalog.syringes.map((s) => ({ title: s.label, value: s.id }))"
            label="Syringe"
          />
          <v-text-field v-model="form.takenAt" label="Taken at" type="datetime-local" />
          <v-textarea v-model="form.notes" label="Notes (site, observations)" />
          <div v-if="reading" class="pc-inset pa-3 pc-num" data-testid="log-draw-reading">
            Draw <strong>{{ roundTo(reading.scaleValue, 2) }} {{ reading.scaleUnit }}</strong> ({{
              roundTo(reading.volumeMl, 3)
            }}
            mL)
          </div>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" variant="flat" :disabled="volumeMl === null" @click="save">
          Log draw
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.log-draw__unit {
  max-width: 120px;
}
</style>
