<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { LineChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption, ScatterSeriesOption } from 'echarts/charts'
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import VChart from 'vue-echarts'
import {
  amountAt,
  chartWindow,
  rateConstants,
  simulate,
  type DoseEvent,
  type PkParameters,
} from '@/domain/pk'
import { roundTo } from '@/domain/units'
import { useChartColors } from '@/composables/useChartColors'
import { formatShort } from '@/services/time'

type EChartsOption = ComposeOption<
  | LineSeriesOption
  | ScatterSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
>

use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  DataZoomComponent,
  CanvasRenderer,
])

const props = defineProps<{
  params: PkParameters
  /** Logged doses, already converted to `unitLabel`. */
  doses: DoseEvent[]
  /** The draw being calculated, shown as a dashed projection; null when only history is shown. */
  preview: DoseEvent | null
  unitLabel: string
  now: number
  /** Limits history for frequently dosed peptides. */
  lookbackHours?: number
}>()

const { colors } = useChartColors()
const showTable = ref(false)

const LOGGED = 'Logged doses'
const PREVIEW = 'With this dose'

const allDoses = computed(() => (props.preview ? [...props.doses, props.preview] : props.doses))
const window = computed(() =>
  chartWindow(allDoses.value, props.params, props.now, props.lookbackHours),
)
const hasHistory = computed(() => props.doses.length > 0)

const loggedPoints = computed(() =>
  hasHistory.value ? simulate(props.doses, props.params, window.value) : [],
)
const previewPoints = computed(() =>
  props.preview ? simulate(allDoses.value, props.params, window.value) : [],
)

const primaryPoints = computed(() => (props.preview ? previewPoints.value : loggedPoints.value))

const k = computed(() => rateConstants(props.params))
const nowAmount = computed(() => amountAt(props.now, allDoses.value, k.value))
const peak = computed(() =>
  primaryPoints.value.reduce((best, p) => (p.amount > best.amount ? p : best), {
    at: 0,
    amount: 0,
  }),
)
const clearsAt = computed(() => {
  const threshold = peak.value.amount * 0.1
  return primaryPoints.value.find((p) => p.at > peak.value.at && p.amount < threshold)?.at ?? null
})

const fmt = (v: number) => `${roundTo(v, v < 1 ? 3 : 2)} ${props.unitLabel}`

const option = computed<EChartsOption>(() => {
  const c = colors.value
  const series: (LineSeriesOption | ScatterSeriesOption)[] = []
  if (hasHistory.value) {
    series.push({
      name: LOGGED,
      type: 'line',
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 2, color: c.logged, cap: 'round', join: 'round' },
      itemStyle: { color: c.logged },
      areaStyle: { color: c.logged, opacity: 0.1 },
      data: loggedPoints.value.map((p) => [p.at, p.amount]),
      markLine: {
        silent: true,
        symbol: 'none',
        label: { formatter: 'Now', color: c.axis, fontFamily: c.font },
        lineStyle: { color: c.now, type: 'solid', width: 1 },
        data: [{ xAxis: props.now }],
      },
    })
  }
  if (props.preview) {
    series.push({
      name: PREVIEW,
      type: 'line',
      showSymbol: false,
      lineStyle: { width: 2, color: c.preview, type: 'dashed' },
      itemStyle: { color: c.preview },
      areaStyle: hasHistory.value ? undefined : { color: c.preview, opacity: 0.1 },
      data: previewPoints.value.map((p) => [p.at, p.amount]),
      markLine: hasHistory.value
        ? undefined
        : {
            silent: true,
            symbol: 'none',
            label: { formatter: 'Now', color: c.axis, fontFamily: c.font },
            lineStyle: { color: c.now, width: 1 },
            data: [{ xAxis: props.now }],
          },
    })
  }
  series.push({
    name: 'Doses',
    type: 'scatter',
    symbol: 'triangle',
    symbolSize: 10,
    itemStyle: { color: c.axis, borderColor: c.surface, borderWidth: 2 },
    tooltip: { show: false },
    data: allDoses.value
      .filter((d) => d.at >= window.value.start && d.at <= window.value.end)
      .map((d) => [d.at, 0]),
    z: 3,
  })

  return {
    animation: false,
    textStyle: { fontFamily: c.font, color: c.text },
    grid: {
      left: 8,
      right: 16,
      top: hasHistory.value && props.preview ? 40 : 16,
      bottom: 8,
      containLabel: true,
    },
    legend:
      hasHistory.value && props.preview
        ? {
            data: [LOGGED, PREVIEW],
            top: 0,
            left: 0,
            textStyle: { color: c.text, fontFamily: c.font },
            itemWidth: 18,
            itemHeight: 8,
          }
        : undefined,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: c.axis } },
      backgroundColor: c.surface,
      borderColor: c.grid,
      textStyle: { color: c.text, fontFamily: c.font },
      valueFormatter: (v) => fmt(Number(v)),
    },
    xAxis: {
      type: 'time',
      min: window.value.start,
      max: window.value.end,
      axisLine: { lineStyle: { color: c.grid } },
      axisLabel: {
        color: c.axis,
        hideOverlap: true,
        formatter: {
          year: '{yyyy}',
          month: '{MMM} {d}',
          day: '{MMM} {d}',
          hour: '{HH}:{mm}',
          minute: '{HH}:{mm}',
        },
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        color: c.axis,
        formatter: (v: number): string => `${roundTo(v, 3)} ${props.unitLabel}`,
      },
      splitLine: { lineStyle: { color: c.grid, type: 'solid', width: 1 } },
    },
    dataZoom: [{ type: 'inside', filterMode: 'none' }],
    series,
  }
})

const ariaSummary = computed(() => {
  const parts = [`Estimated amount in the body now: ${fmt(nowAmount.value)}.`]
  if (peak.value.amount > 0)
    parts.push(`Peak ${fmt(peak.value.amount)} around ${formatShort(peak.value.at)}.`)
  if (clearsAt.value) parts.push(`Below 10% of peak by ${formatShort(clearsAt.value)}.`)
  return parts.join(' ')
})

/** A dozen evenly spaced readings for the table view. */
const tableRows = computed(() => {
  const { start, end } = window.value
  return Array.from({ length: 13 }, (_, i) => {
    const at = start + ((end - start) * i) / 12
    return { at, amount: amountAt(at, allDoses.value, k.value) }
  })
})
</script>

<template>
  <div class="pk-chart">
    <dl class="pk-chart__stats">
      <div>
        <dt class="pc-faint">Now</dt>
        <dd class="pc-num">{{ fmt(nowAmount) }}</dd>
      </div>
      <div v-if="peak.amount > 0">
        <dt class="pc-faint">{{ preview ? 'Peak with this dose' : 'Peak' }}</dt>
        <dd class="pc-num">
          {{ fmt(peak.amount) }} <span class="pc-faint">· {{ formatShort(peak.at) }}</span>
        </dd>
      </div>
      <div v-if="clearsAt">
        <dt class="pc-faint">Below 10% of peak</dt>
        <dd class="pc-num">{{ formatShort(clearsAt) }}</dd>
      </div>
    </dl>
    <v-chart
      class="pk-chart__canvas"
      :option="option"
      autoresize
      role="img"
      :aria-label="ariaSummary"
    />
    <v-btn variant="text" size="small" class="mt-1" @click="showTable = !showTable">
      {{ showTable ? 'Hide table' : 'Show as table' }}
    </v-btn>
    <v-expand-transition>
      <v-table v-if="showTable" density="compact" class="pk-chart__table">
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col" class="text-end">Estimated amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tableRows" :key="row.at">
            <td>{{ formatShort(row.at) }}</td>
            <td class="text-end pc-num">{{ fmt(row.amount) }}</td>
          </tr>
        </tbody>
      </v-table>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.pk-chart__canvas {
  width: 100%;
  height: 280px;
}

@media (min-width: 840px) {
  .pk-chart__canvas {
    height: 340px;
  }
}

.pk-chart__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin: 0 0 8px;
}

.pk-chart__stats dt {
  font-size: 0.75rem;
  font-weight: 600;
}

.pk-chart__stats dd {
  margin: 0;
  font-weight: 600;
}

.pk-chart__table {
  background: transparent;
}
</style>
