<script setup lang="ts">
import type { SourceRef } from '@/domain/catalog'
import SourceBadge from './SourceBadge.vue'

defineProps<{ sources: readonly SourceRef[] }>()
</script>

<template>
  <ul class="source-list">
    <li v-for="source in sources" :key="source.citation" class="text-body-small">
      <SourceBadge :kind="source.kind" />
      <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{
        source.citation
      }}</a>
      <span v-else>{{ source.citation }}</span>
    </li>
  </ul>
</template>

<style scoped>
.source-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.source-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
