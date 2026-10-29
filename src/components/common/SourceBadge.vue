<script setup lang="ts">
import { computed } from 'vue'
import { SOURCE_KIND_LABELS, type SourceKind } from '@/domain/catalog'

const props = defineProps<{ kind: SourceKind }>()

const TONES: Record<SourceKind, string> = {
  label: 'good',
  trial: 'info',
  standard: 'info',
  preclinical: 'notice',
  community: 'notice',
  model: 'brand',
}

const badge = computed(() => ({ text: SOURCE_KIND_LABELS[props.kind], tone: TONES[props.kind] }))
</script>

<template>
  <span :class="['pc-badge', `pc-badge--${badge.tone}`]">
    <span class="pc-badge__dot" />{{ badge.text }}
  </span>
</template>
