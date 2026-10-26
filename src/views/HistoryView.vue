<script setup lang="ts">
import { computed } from 'vue'
import { useShelfStore } from '@/stores/shelf'
import { useConfirmStore } from '@/stores/confirm'
import { useNotifyStore } from '@/stores/notify'
import type { DrawRow } from '@/db/database'
import { roundTo, unitLabel } from '@/domain/units'
import { formatDate, formatDateTime } from '@/services/time'
import DrawList from '@/components/shelf/DrawList.vue'

const shelf = useShelfStore()
const confirm = useConfirmStore()
const notify = useNotifyStore()

const vialNames = computed(() => new Map(shelf.vials.map((v) => [v.id, v.name])))

/** Draws grouped by local calendar day, newest first. */
const groups = computed(() => {
  const map = new Map<string, DrawRow[]>()
  for (const d of shelf.draws) {
    const day = formatDate(d.takenAt)
    const list = map.get(day) ?? []
    list.push(d)
    map.set(day, list)
  }
  return [...map.entries()].map(([day, draws]) => ({ day, draws }))
})

async function deleteDraw(draw: DrawRow) {
  const ok = await confirm.ask({
    title: 'Delete this draw?',
    text: `${roundTo(draw.dose.value, 4)} ${unitLabel(draw.dose.unit)} on ${formatDateTime(draw.takenAt)} will be removed.`,
    confirmText: 'Delete',
    destructive: true,
  })
  if (!ok) return
  await shelf.deleteDraw(draw.id)
  notify.show('Draw deleted')
}
</script>

<template>
  <div class="pc-page history">
    <header class="mb-4">
      <p class="pc-eyebrow">Log</p>
      <h1 class="pc-display text-headline-large">History</h1>
    </header>

    <v-card v-if="shelf.loaded && !shelf.draws.length" variant="tonal">
      <v-card-text class="pc-muted">
        Draws you log from a shelf vial appear here, newest first.
      </v-card-text>
    </v-card>

    <v-card v-for="group in groups" :key="group.day" class="mb-4">
      <v-card-item>
        <v-card-title class="text-title-large">{{ group.day }}</v-card-title>
      </v-card-item>
      <v-card-text>
        <DrawList :draws="group.draws" :vial-names="vialNames" @delete="deleteDraw" />
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.history {
  max-width: 760px;
}
</style>
