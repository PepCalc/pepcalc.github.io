<script setup lang="ts">
import { computed } from 'vue'
import type { SourceKind } from '@/domain/catalog'

const props = defineProps<{ kind: SourceKind }>()

const LABELS: Record<SourceKind, { text: string; tone: string }> = {
  label: { text: 'Prescribing label', tone: 'good' },
  trial: { text: 'Clinical trial', tone: 'info' },
  preclinical: { text: 'Animal data', tone: 'notice' },
  community: { text: 'Community-reported', tone: 'notice' },
  model: { text: 'Modelling choice', tone: 'brand' },
}

const badge = computed(() => LABELS[props.kind])
</script>

<template>
  <span :class="['pc-badge', `pc-badge--${badge.tone}`]">
    <span class="pc-badge__dot" />{{ badge.text }}
  </span>
</template>
