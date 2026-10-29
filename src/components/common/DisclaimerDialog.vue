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
    notify.show("Couldn't save. Try again.", 'error')
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
          PepCalc converts a vial amount, water volume and dose into a syringe reading. It doesn't
          recommend doses and isn't medical advice.
        </p>
        <p>
          Some peptides listed are investigational or not approved for human use. Community-reported
          amounts aren't clinically established, and level charts are estimates.
        </p>
        <p>Always check results against your vial label and syringe markings.</p>
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
