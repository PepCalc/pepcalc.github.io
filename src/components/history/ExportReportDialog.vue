<script setup lang="ts">
import { ref, useId } from 'vue'
import type { ReportPeriod } from '@/domain/report'
import { useReportExport } from '@/composables/useReportExport'
import { mdiFilePdfBox } from '@/plugins/icons'

/** Choose a period and export the draws-and-levels report as a PDF. */
const open = defineModel<boolean>({ required: true })
const period = ref<ReportPeriod>('90d')
const report = useReportExport()
const titleId = useId()

const PERIODS: { value: ReportPeriod; title: string }[] = [
  { value: '30d', title: '30 days' },
  { value: '90d', title: '90 days' },
  { value: 'all', title: 'All' },
]

async function exportReport() {
  if (await report.actions.exportReport(period.value)) open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="520" :aria-labelledby="titleId">
    <v-card>
      <v-card-item>
        <v-card-title :id="titleId" class="text-wrap">Export report</v-card-title>
      </v-card-item>
      <v-card-text class="pc-stack">
        <div>
          <span id="report-period" class="pc-label">Period</span>
          <v-btn-toggle v-model="period" mandatory role="group" aria-labelledby="report-period">
            <v-btn v-for="p in PERIODS" :key="p.value" :value="p.value">{{ p.title }}</v-btn>
          </v-btn-toggle>
        </div>
        <p class="text-body-medium">
          Draws, totals and estimated levels for each peptide, plus your full draw log with notes.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="open = false">Cancel</v-btn>
        <v-btn
          variant="flat"
          color="primary"
          :prepend-icon="mdiFilePdfBox"
          :loading="report.state.busy"
          @click="exportReport"
        >
          Export PDF
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
