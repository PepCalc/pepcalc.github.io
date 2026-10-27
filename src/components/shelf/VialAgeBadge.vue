<script setup lang="ts">
import { computed } from 'vue'
import type { VialAge } from '@/composables/useVialAge'
import type { AgeTier } from '@/domain/vialAge'

const props = defineProps<{ age: VialAge }>()

const TONES: Record<AgeTier, string> = { fresh: 'good', nearing: 'notice', past: 'alert' }

/** The text carries the state, so the colour is never the only signal. */
const text = computed(() => {
  const { days, tier, limits } = props.age
  const day = `Day ${days}`
  if (tier === 'past') return `${day} · ${limits.pastDays}-day limit reached`
  if (tier === 'nearing') return `${day} of ${limits.pastDays} · use soon`
  return `${day} of ${limits.pastDays}`
})
</script>

<template>
  <span :class="['pc-badge', `pc-badge--${TONES[age.tier]}`, 'pc-num']">
    <span class="pc-badge__dot" />{{ text }}
  </span>
</template>
