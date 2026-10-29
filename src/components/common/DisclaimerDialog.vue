<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNotifyStore } from '@/stores/notify'
import { nowIso } from '@/services/time'

const settings = useSettingsStore()
const notify = useNotifyStore()
const open = computed(() => settings.loaded && settings.disclaimerAcceptedAt === null)
const saving = ref(false)
const titleId = useId()

async function accept() {
  saving.value = true
  try {
    await settings.acceptDisclaimer(nowIso())
  } catch {
    notify.show('Could not save that on this device. Please try again.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog :model-value="open" max-width="520" persistent :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <p class="pc-eyebrow">Before you start</p>
        <v-card-title :id="titleId" class="text-wrap">For research and education only</v-card-title>
      </v-card-item>
      <v-card-text class="disclaimer">
        <p>
          PepCalc does arithmetic: it converts a vial amount, a water volume and a dose into a
          volume and syringe reading. It does not recommend doses and is not medical advice.
        </p>
        <p>
          Several peptides listed here are investigational or not approved for human use. Preset
          amounts are labelled with their source; community-reported values are not clinically
          established. Level charts are model estimates.
        </p>
        <p>Always check a calculation against your vial's label and your syringe's markings.</p>
        <p class="pc-muted">
          Everything you enter stays on this device. There is no account, no server, and no
          tracking.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" variant="flat" :loading="saving" @click="accept">
          I understand
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.disclaimer p + p {
  margin-top: 12px;
}
</style>
