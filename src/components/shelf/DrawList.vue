<script setup lang="ts">
import type { DrawRow } from '@/db/database'
import { findSyringe } from '@/data'
import { readSyringe } from '@/domain/syringe'
import { roundTo, unitLabel } from '@/domain/units'
import { formatDateTime } from '@/services/time'
import { mdiDeleteOutline } from '@/plugins/icons'

defineProps<{
  draws: DrawRow[]
  /** Vial names by id, shown when the list mixes vials. */
  vialNames?: Map<string, string>
}>()
const emit = defineEmits<{ delete: [draw: DrawRow] }>()

function readingText(d: DrawRow): string {
  const r = readSyringe(d.volumeMl, findSyringe(d.syringeId))
  return r.scaleUnit === 'units'
    ? `${roundTo(r.scaleValue, 2)} units`
    : `${roundTo(r.scaleValue, 3)} mL`
}
</script>

<template>
  <v-list lines="two" bg-color="transparent" class="draw-list">
    <v-list-item v-for="d in draws" :key="d.id" class="px-0">
      <v-list-item-title class="pc-num">
        <strong>{{ roundTo(d.dose.value, 4) }} {{ unitLabel(d.dose.unit) }}</strong>
        <span v-if="vialNames"> · {{ vialNames.get(d.vialId) ?? 'Deleted vial' }}</span>
      </v-list-item-title>
      <v-list-item-subtitle class="pc-num">
        {{ formatDateTime(d.takenAt) }} · {{ readingText(d) }} ({{ roundTo(d.volumeMl, 3) }} mL)
        <template v-if="d.notes"> · {{ d.notes }}</template>
      </v-list-item-subtitle>
      <template #append>
        <v-btn
          :icon="mdiDeleteOutline"
          variant="text"
          size="small"
          :aria-label="`Delete draw from ${formatDateTime(d.takenAt)}`"
          @click="emit('delete', d)"
        />
      </template>
    </v-list-item>
  </v-list>
</template>
