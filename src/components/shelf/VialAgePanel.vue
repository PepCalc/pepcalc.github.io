<script setup lang="ts">
import { computed } from 'vue'
import { catalog, inUseLimitFor } from '@/data'
import type { VialRow } from '@/db/database'
import { useVialAge } from '@/composables/useVialAge'
import { formatDate } from '@/services/time'
import SourceList from '@/components/common/SourceList.vue'
import VialAgeBadge from './VialAgeBadge.vue'

const props = defineProps<{ vial: VialRow; now: number }>()
defineEmits<{ edit: [] }>()

const { age } = useVialAge(
  () => props.vial,
  () => props.now,
)

/*
 * A peptide whose own label sets the window also sets how to store it (the EGRIFTA WR label
 * says room temperature, not the refrigerator), so its note replaces the general advice.
 */
const applied = computed(() => inUseLimitFor(props.vial.peptideId, props.vial.components))
const limit = computed(() => applied.value.limit)
const peptideRule = computed(() => applied.value.setBy !== null)
const sources = computed(() =>
  peptideRule.value
    ? limit.value.sources
    : [...limit.value.sources, ...catalog.storage.adviceSources],
)
</script>

<template>
  <v-card>
    <v-card-item>
      <p class="pc-eyebrow">Age and storage</p>
      <v-card-title v-if="vial.reconstitutedAt" class="pc-num">
        Mixed {{ formatDate(vial.reconstitutedAt) }}
      </v-card-title>
      <v-card-title v-else>No mixing date</v-card-title>
    </v-card-item>
    <v-card-text class="pc-stack">
      <div v-if="age" class="pc-stack pc-stack--tight">
        <div><VialAgeBadge :age="age" /></div>
        <p v-if="age.custom" class="text-body-small pc-muted pc-num">
          Your thresholds from Settings: use soon from day {{ age.limits.nearingDays }}, past from
          day {{ age.limits.pastDays }}.
        </p>
      </div>
      <div v-else>
        <v-btn variant="tonal" density="comfortable" @click="$emit('edit')">Add mixing date</v-btn>
      </div>

      <div class="pc-stack pc-stack--tight">
        <p class="pc-label">{{ limit.days }}-day limit</p>
        <p class="text-body-medium">{{ limit.note }}</p>
      </div>

      <div v-if="!peptideRule" class="pc-stack pc-stack--tight">
        <p class="pc-label">Storage</p>
        <p class="text-body-medium">{{ catalog.storage.advice }}</p>
      </div>

      <SourceList :sources="sources" />
    </v-card-text>
  </v-card>
</template>
