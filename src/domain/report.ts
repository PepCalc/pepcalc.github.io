import {
  chartWindow,
  lookbackHoursFor,
  type DoseEvent,
  type PkParameters,
  type SimulationWindow,
} from './pk'
import { areCompatible, convert, type Quantity } from './units'

/** How far back a report reaches. */
export type ReportPeriod = '30d' | '90d' | 'all'

const MS_PER_DAY = 86_400_000

/** First instant a report covers, or -Infinity for everything. */
export function periodStart(period: ReportPeriod, now: number): number {
  if (period === 'all') return -Infinity
  return now - (period === '30d' ? 30 : 90) * MS_PER_DAY
}

export interface ReportWindow extends SimulationWindow {
  /** True when a short-acting peptide's chart shows only the days up to its latest dose. */
  trimmed: boolean
}

/**
 * The span a report's level chart shows: from shortly before the first dose in the period to
 * the same forward horizon as the in-app chart (five half-lives, or longer for slow absorption).
 * Short-acting peptides follow the in-app lookback (`lookbackHoursFor`), counted back from their
 * latest dose so a report made days later still shows the pattern. Doses before the window
 * still count towards the curve; the window just starts later.
 */
export function reportWindow(
  doses: readonly DoseEvent[],
  params: PkParameters,
  now: number,
  since: number,
): ReportWindow {
  const { end } = chartWindow(doses, params, now)
  const first = doses.find((d) => d.at >= since)?.at ?? now
  const lead = Math.max(params.tmaxHours * 3_600_000 * 0.25, 30 * 60_000)
  const start = first - lead
  const lookback = lookbackHoursFor(params)
  const latest = doses.reduce((max, d) => Math.max(max, d.at), -Infinity)
  if (lookback === undefined || !Number.isFinite(latest)) return { start, end, trimmed: false }
  const recent = latest - lookback * 3_600_000
  return recent > start ? { start: recent, end, trimmed: true } : { start, end, trimmed: false }
}

/**
 * Total drawn per unit family. Mass doses are summed in the first mass unit seen (mcg and mg
 * convert); IU is summed on its own and never added to mass.
 */
export function totalsByUnit(doses: readonly Quantity[]): Quantity[] {
  const totals: Quantity[] = []
  for (const dose of doses) {
    const bucket = totals.find((t) => areCompatible(t.unit, dose.unit))
    if (bucket) bucket.value += convert(dose, bucket.unit).value
    else totals.push({ value: dose.value, unit: dose.unit })
  }
  return totals
}

/**
 * Round axis ticks from 0 to at least `max`: steps of 1, 2, 2.5 or 5 times a power of ten,
 * about `target` intervals. Returns at least [0, 1] for a zero or negative max.
 */
export function niceTicks(max: number, target = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const raw = max / target
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw)!
  const ticks: number[] = []
  for (let v = 0; v < max + step * 1e-9; v += step) ticks.push(Number(v.toPrecision(12)))
  if (ticks[ticks.length - 1]! < max) ticks.push(Number((ticks.length * step).toPrecision(12)))
  return ticks
}
