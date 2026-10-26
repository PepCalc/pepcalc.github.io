<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useShelfStore } from '@/stores/shelf'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import { useConfirmStore } from '@/stores/confirm'
import { useNow } from '@/composables/useNow'
import { findPeptide } from '@/data'
import type { DrawRow } from '@/db/database'
import type { NewDraw, NewVial } from '@/db/repository'
import { concentrationOf } from '@/domain/reconstitution'
import { roundTo, unitLabel } from '@/domain/units'
import { daysBetween, formatDateTime, formatRelativeDays, systemClock } from '@/services/time'
import PkPanel from '@/components/charts/PkPanel.vue'
import DrawList from '@/components/shelf/DrawList.vue'
import VialFormDialog from '@/components/shelf/VialFormDialog.vue'
import LogDrawDialog from '@/components/shelf/LogDrawDialog.vue'
import {
  mdiArchiveArrowDownOutline,
  mdiArchiveArrowUpOutline,
  mdiCalculatorVariantOutline,
  mdiDeleteOutline,
  mdiNeedle,
  mdiPencilOutline,
} from '@/plugins/icons'

const props = defineProps<{ id: string }>()
const router = useRouter()
const shelf = useShelfStore()
const settings = useSettingsStore()
const notify = useNotifyStore()
const confirm = useConfirmStore()
const now = useNow()

const editing = ref(false)
const logging = ref(false)

const vial = computed(() => shelf.vialById(props.id))
const peptide = computed(() => findPeptide(vial.value?.peptideId))
const draws = computed(() => (vial.value ? shelf.drawsFor(vial.value.id) : []))
const balance = computed(() => (vial.value ? shelf.balanceOf(vial.value) : null))

/** Chart unit: the usual dose unit, else the unit of the latest draw, else the vial's unit. */
const chartUnit = computed(
  () => vial.value?.typicalDose?.unit ?? draws.value[0]?.dose.unit ?? vial.value?.unit ?? 'mg',
)
/** Doses of this peptide from every vial, so the curve matches History. */
const pooled = computed(() =>
  vial.value ? shelf.pooledDosesFor(vial.value, chartUnit.value) : { doses: [], vialCount: 0 },
)
const pooledCaption = computed(() =>
  pooled.value.vialCount > 1
    ? `Includes doses from ${pooled.value.vialCount} vials of this peptide.`
    : undefined,
)

const concentrationText = computed(() => {
  if (!vial.value) return ''
  const c = concentrationOf(
    { value: vial.value.amount, unit: vial.value.unit },
    vial.value.diluentMl,
  )
  return `${roundTo(c.perMl, 4)} ${unitLabel(c.unit)}/mL`
})

async function saveVial(changes: Partial<NewVial>) {
  if (!vial.value) return
  await shelf.updateVial(vial.value.id, changes)
  notify.show('Vial updated', 'success')
}

async function saveDraw(draw: NewDraw) {
  await shelf.addDraw(draw)
  notify.show('Draw logged', 'success')
}

async function deleteDraw(draw: DrawRow) {
  const ok = await confirm.ask({
    title: 'Delete this draw?',
    text: `${roundTo(draw.dose.value, 4)} ${unitLabel(draw.dose.unit)} on ${formatDateTime(draw.takenAt)} will be removed and the vial balance restored.`,
    confirmText: 'Delete',
    destructive: true,
  })
  if (!ok) return
  await shelf.deleteDraw(draw.id)
  notify.show('Draw deleted')
}

async function toggleArchive() {
  if (!vial.value) return
  const archived = vial.value.status === 'archived'
  await shelf.updateVial(vial.value.id, { status: archived ? 'active' : 'archived' })
  notify.show(archived ? 'Vial restored to shelf' : 'Vial archived')
}

async function deleteVial() {
  if (!vial.value) return
  const ok = await confirm.ask({
    title: `Delete ${vial.value.name}?`,
    text: `The vial and its ${draws.value.length} logged draws will be permanently removed from this device. Archive it instead to keep the history.`,
    confirmText: 'Delete vial',
    destructive: true,
  })
  if (!ok) return
  await shelf.deleteVial(vial.value.id)
  notify.show('Vial deleted')
  await router.replace({ name: 'shelf' })
}
</script>

<template>
  <div class="pc-page">
    <template v-if="vial && balance">
      <header class="d-flex align-start flex-wrap ga-3 mb-4">
        <div class="flex-grow-1">
          <p class="pc-eyebrow">{{ vial.status === 'archived' ? 'Archived vial' : 'Vial' }}</p>
          <h1 class="pc-display text-headline-large">{{ vial.name }}</h1>
          <p class="pc-muted pc-num">
            {{ vial.amount }} {{ unitLabel(vial.unit) }} in {{ vial.diluentMl }} mL ·
            {{ concentrationText }}
            <template v-if="vial.reconstitutedAt">
              · mixed {{ formatRelativeDays(daysBetween(vial.reconstitutedAt, systemClock())) }}
            </template>
          </p>
        </div>
        <v-btn :prepend-icon="mdiPencilOutline" variant="outlined" @click="editing = true"
          >Edit</v-btn
        >
      </header>

      <div class="vial-layout">
        <div class="d-flex flex-column ga-4">
          <v-card>
            <v-card-item>
              <p class="pc-eyebrow">Remaining</p>
            </v-card-item>
            <v-card-text>
              <p class="vial-remaining pc-num">
                {{ roundTo(balance.remainingAmount, 3) }}
                <span class="text-title-large">{{ unitLabel(vial.unit) }}</span>
              </p>
              <p class="pc-muted pc-num">
                {{ roundTo(balance.remainingMl, 2) }} mL of liquid
                <template v-if="balance.dosesLeft !== null">
                  · about {{ balance.dosesLeft }} doses of {{ vial.typicalDose?.value }}
                  {{ unitLabel(vial.typicalDose?.unit ?? vial.unit) }}
                </template>
              </p>
              <v-progress-linear
                :model-value="(1 - balance.usedFraction) * 100"
                color="primary"
                bg-color="surface-variant"
                bg-opacity="1"
                height="10"
                rounded
                class="mt-3"
                aria-label="Share of vial remaining"
              />
              <v-alert
                v-if="balance.overdrawn"
                type="warning"
                variant="tonal"
                density="compact"
                class="mt-3"
              >
                Logged draws add up to more than the vial held. Check the vial amount or delete a
                mistaken entry.
              </v-alert>
              <p v-if="vial.components" class="text-body-small pc-muted mt-3">
                Blend: {{ vial.components.map((c) => `${c.name} ${c.amountMg} mg`).join(', ') }}
              </p>
              <p v-if="vial.notes" class="text-body-medium mt-3">{{ vial.notes }}</p>
            </v-card-text>
            <v-card-actions class="flex-wrap">
              <v-btn
                color="primary"
                variant="flat"
                :prepend-icon="mdiNeedle"
                @click="logging = true"
              >
                Log a draw
              </v-btn>
              <v-btn
                :to="{ name: 'calculator', query: { vial: vial.id } }"
                variant="text"
                :prepend-icon="mdiCalculatorVariantOutline"
              >
                Calculator
              </v-btn>
            </v-card-actions>
          </v-card>

          <v-card>
            <v-card-item>
              <p class="pc-eyebrow">History</p>
              <v-card-title
                >{{ draws.length }} draw{{ draws.length === 1 ? '' : 's' }}</v-card-title
              >
            </v-card-item>
            <v-card-text>
              <p v-if="!draws.length" class="pc-muted">No draws logged yet.</p>
              <DrawList v-else :draws="draws" @delete="deleteDraw" />
            </v-card-text>
          </v-card>

          <div class="d-flex flex-wrap ga-2">
            <v-btn
              variant="text"
              :prepend-icon="
                vial.status === 'archived' ? mdiArchiveArrowUpOutline : mdiArchiveArrowDownOutline
              "
              @click="toggleArchive"
            >
              {{ vial.status === 'archived' ? 'Restore to shelf' : 'Archive' }}
            </v-btn>
            <v-btn
              variant="text"
              color="error"
              :prepend-icon="mdiDeleteOutline"
              @click="deleteVial"
            >
              Delete
            </v-btn>
          </div>
        </div>

        <PkPanel
          :peptide="peptide"
          :override="vial.pkOverride"
          :doses="pooled.doses"
          :preview="null"
          :unit-label="unitLabel(chartUnit)"
          :now="now"
          :caption="pooledCaption"
        />
      </div>

      <VialFormDialog v-model="editing" :vial="vial" @save="saveVial" />
      <LogDrawDialog
        v-model="logging"
        :vial="vial"
        :default-syringe-id="settings.defaultSyringeId"
        @save="saveDraw"
      />
    </template>

    <v-card v-else-if="shelf.loaded" variant="tonal">
      <v-card-text>
        This vial is not on this device.
        <v-btn :to="{ name: 'shelf' }" variant="text">Back to shelf</v-btn>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.vial-layout {
  display: grid;
  gap: 16px;
}

@media (min-width: 840px) {
  .vial-layout {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    align-items: start;
  }
}

.vial-remaining {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
}
</style>
