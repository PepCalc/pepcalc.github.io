<script setup lang="ts">
import { computed } from 'vue'
import type { CatalogPeptide } from '@/domain/catalog'
import type { DoseEvent, PkParameters } from '@/domain/pk'
import { formatHours } from '@/services/time'
import SourceBadge from '@/components/common/SourceBadge.vue'
import PkChart from './PkChart.vue'

const props = defineProps<{
  peptide: CatalogPeptide | undefined
  /** User-supplied parameters from a shelf vial; take precedence over the catalog. */
  override: PkParameters | null
  doses: DoseEvent[]
  preview: DoseEvent | null
  unitLabel: string
  now: number
}>()

const params = computed<PkParameters | null>(() => props.override ?? props.peptide?.pk ?? null)
const userSupplied = computed(() => props.override !== null)

/** Short-lived peptides show three days of history; long-acting ones all doses still in effect. */
const lookbackHours = computed(() =>
  params.value && params.value.halfLifeHours < 24 ? 72 : undefined,
)
</script>

<template>
  <v-card>
    <v-card-item>
      <p class="pc-eyebrow">Estimated levels</p>
      <v-card-title class="text-wrap">Amount in the body over time</v-card-title>
    </v-card-item>
    <v-card-text>
      <template v-if="params">
        <div class="d-flex flex-wrap ga-2 mb-3 align-center">
          <span class="pc-badge pc-badge--brand pc-num"
            >t½ {{ formatHours(params.halfLifeHours) }}</span
          >
          <span class="pc-badge pc-badge--brand pc-num"
            >peak {{ formatHours(params.tmaxHours) }}</span
          >
          <span v-if="userSupplied" class="pc-badge pc-badge--notice">
            <span class="pc-badge__dot" />User-supplied values
          </span>
        </div>
        <PkChart
          :params="params"
          :doses="doses"
          :preview="preview"
          :unit-label="unitLabel"
          :now="now"
          :lookback-hours="lookbackHours"
        />
        <p class="text-body-small pc-muted mt-3">
          One-compartment model (first-order absorption and elimination) fitted to the half-life and
          time to peak, assuming no further doses. It estimates drug remaining in the body, not
          blood concentration, and ignores bioavailability and individual variation.
        </p>
        <div v-if="!userSupplied && peptide?.pk" class="mt-3">
          <p class="text-body-small pc-muted">{{ peptide.pk.notes }}</p>
          <ul class="pk-sources mt-2">
            <li v-for="source in peptide.pk.sources" :key="source.citation" class="text-body-small">
              <SourceBadge :kind="source.kind" />
              <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{
                source.citation
              }}</a>
              <span v-else>{{ source.citation }}</span>
            </li>
          </ul>
        </div>
      </template>
      <template v-else>
        <v-alert type="info" variant="tonal" density="comfortable">
          {{
            peptide?.pkUnavailableReason ??
            'No pharmacokinetic data for a custom peptide. Save it to your shelf and enter a half-life to see a curve.'
          }}
        </v-alert>
      </template>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.pk-sources {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

.pk-sources li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
</style>
