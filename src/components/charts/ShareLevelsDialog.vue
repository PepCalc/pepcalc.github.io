<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import { useChartColors } from '@/composables/useChartColors'
import { useNotifyStore } from '@/stores/notify'
import { saveFile } from '@/services/fileTransfer'
import { fileDate, formatDateTime, nowIso, systemClock } from '@/services/time'
import { mdiShareVariantOutline } from '@/plugins/icons'
import type { LevelsInput } from '@/domain/levels'
import { renderLevelsCard, type ShareCardContent } from './levelsShareCard'

/**
 * Preview and share the estimated-levels card as an image. The image is drawn on the device and
 * only leaves it through the share sheet or a download the user starts. The user can leave the
 * peptide name and the amounts off; the half-life, peak time and source stay, because every
 * figure carries its source, so the curve can still hint at which peptide it is.
 */
const props = defineProps<{
  input: LevelsInput
  /** Peptide name, shown unless the user hides it. */
  name: string
  halfLife: string
  peakTime: string
  source: ShareCardContent['source']
}>()

const open = defineModel<boolean>({ required: true })
const notify = useNotifyStore()
const { colors } = useChartColors()

const showName = ref(true)
const showAmounts = ref(true)
const image = ref<Blob | null>(null)
const previewUrl = ref<string | null>(null)
const busy = ref(false)
const titleId = useId()

function setPreview(blob: Blob | null) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  image.value = blob
  previewUrl.value = blob ? URL.createObjectURL(blob) : null
}

async function render() {
  busy.value = true
  try {
    setPreview(
      await renderLevelsCard(
        {
          input: props.input,
          title: showName.value ? props.name : 'Estimated levels',
          halfLife: props.halfLife,
          peakTime: props.peakTime,
          source: props.source,
          hideAmounts: !showAmounts.value,
          madeAt: formatDateTime(nowIso()),
        },
        colors.value,
      ),
    )
  } catch {
    notify.show('Could not draw the image on this device.', 'error')
    open.value = false
  } finally {
    busy.value = false
  }
}

watch([open, showName, showAmounts], () => {
  if (open.value) void render()
  else setPreview(null)
})
onBeforeUnmount(() => setPreview(null))

async function share() {
  if (!image.value) return
  const slug = showName.value ? props.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'levels'
  const result = await saveFile(
    `pepcalc-${slug}-${fileDate(systemClock().getTime())}.png`,
    image.value,
  )
  if (result === 'downloaded') notify.show('Image saved to your downloads.', 'success')
  if (result !== 'cancelled') open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" scrollable :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="pc-eyebrow">Share</p>
        <v-card-title :id="titleId">Estimated levels as an image</v-card-title>
      </v-card-item>
      <v-card-text class="pc-stack">
        <div class="share-preview">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="Preview of the image to share"
            class="share-preview__img"
          />
          <v-progress-circular v-else indeterminate color="primary" />
        </div>
        <div class="pc-stack pc-stack--tight">
          <v-switch v-model="showName" label="Show the peptide name" hide-details />
          <v-switch v-model="showAmounts" label="Show amounts" hide-details />
        </div>
        <p class="text-body-small pc-muted">
          Made on this device. Nothing is uploaded; the image goes only where you send it, and
          carries no data beyond what you see. Without the name, the half-life and curve may still
          suggest which peptide it is.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          variant="flat"
          color="primary"
          :prepend-icon="mdiShareVariantOutline"
          :disabled="!image"
          :loading="busy"
          @click="share"
        >
          Share image
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.share-preview {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 5;
  max-height: 52vh;
  margin-inline: auto;
}

.share-preview__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--pc-radius-md);
  box-shadow: var(--pc-glass-shadow);
}
</style>
