<script setup lang="ts">
import { computed } from 'vue'
import { useShelfStore } from '@/stores/shelf'
import { useConfirmStore } from '@/stores/confirm'
import { useNotifyStore } from '@/stores/notify'
import { useNow } from '@/composables/useNow'
import { findPeptide } from '@/data'
import type { DrawRow } from '@/db/database'
import type { PeptideLevels } from '@/domain/levels'
import { anyDoseInEffect } from '@/domain/pk'
import { roundTo, unitLabel } from '@/domain/units'
import { formatDate, formatDateTime } from '@/services/time'
import DrawList from '@/components/shelf/DrawList.vue'
import PkPanel from '@/components/charts/PkPanel.vue'

const shelf = useShelfStore()
const confirm = useConfirmStore()
const notify = useNotifyStore()
const now = useNow()

const vialNames = computed(() => new Map(shelf.vials.map((v) => [v.id, v.name])))

const levelGroups = computed(() => shelf.levelGroups)

const inEffect = (g: PeptideLevels) =>
  g.pk !== null && anyDoseInEffect(g.doses, g.pk.params, now.value)

/** One chart per peptide: amounts and half-lives differ too much to share an axis. */
const charted = computed(() => levelGroups.value.filter(inEffect))
const withoutPk = computed(() => levelGroups.value.filter((g) => !g.pk).map((g) => g.label))
const cleared = computed(() =>
  levelGroups.value.filter((g) => g.pk && !inEffect(g)).map((g) => g.label),
)

function captionFor(g: PeptideLevels): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  let text = `Sum of ${plural(g.doses.length, 'logged dose')} from ${plural(g.vialCount, 'vial')}.`
  if (g.excluded) {
    text += ` ${plural(g.excluded, 'draw')} in a unit that cannot be converted to ${unitLabel(g.unit)} left out.`
  }
  return text
}

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

    <section v-if="levelGroups.length" class="mb-6" aria-label="Estimated levels">
      <div class="history-levels">
        <PkPanel
          v-for="g in charted"
          :key="g.key"
          :peptide="findPeptide(g.peptideId)"
          :override="g.pk?.userSupplied ? g.pk.params : null"
          :doses="g.doses"
          :preview="null"
          :unit-label="unitLabel(g.unit)"
          :now="now"
          :title="g.label"
          :caption="captionFor(g)"
        />
        <v-card v-if="withoutPk.length || cleared.length" variant="tonal">
          <v-card-text class="text-body-medium">
            <p v-if="withoutPk.length">
              <strong>No curve for {{ withoutPk.join(', ') }}:</strong> no reliable human
              pharmacokinetic data. Enter your own half-life and time to peak on the vial to see
              one.
            </p>
            <p v-if="cleared.length" :class="{ 'mt-2': withoutPk.length }">
              <strong>Cleared:</strong> {{ cleared.join(', ') }}. Logged doses are estimated to have
              left the body.
            </p>
          </v-card-text>
        </v-card>
      </div>
    </section>

    <h2 v-if="groups.length" class="pc-display text-title-large mb-3">Draws</h2>
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

.history-levels {
  display: grid;
  gap: 16px;
}
</style>
