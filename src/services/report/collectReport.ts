import { findPeptide } from '@/data'
import type { DrawRow, VialRow } from '@/db/database'
import { SOURCE_KIND_LABELS } from '@/domain/catalog'
import { levelKey, type PeptideLevels } from '@/domain/levels'
import { amountAt, rateConstants, simulate, summarizeLevels } from '@/domain/pk'
import { periodStart, reportWindow, totalsByUnit, type ReportPeriod } from '@/domain/report'
import { formatAmount, roundTo, unitLabel, type Quantity } from '@/domain/units'
import { A4, LETTER, type PageSize } from '@/services/pdf/pageSize'
import {
  formatAxisTick,
  formatDateRange,
  formatDateTime,
  formatHours,
  toEpochMs,
} from '@/services/time'
import type { ReportData, ReportDraw, ReportPeptide } from './levelsReport'

export interface ReportSource {
  vials: readonly VialRow[]
  draws: readonly DrawRow[]
  /** Every draw pooled per peptide (the shelf store's `levelGroups`). */
  groups: readonly PeptideLevels[]
  /** How the app names a vial ("BPC-157 #2"). */
  vialName: (vial: VialRow) => string
  period: ReportPeriod
  now: number
  /** BCP 47 locale, which picks the paper size. */
  locale: string
}

/** Regions that use US Letter paper; everywhere else uses A4. */
const LETTER_REGIONS = new Set(['US', 'CA', 'MX', 'PH', 'CL', 'CO', 'VE', 'PR'])

export function pageSizeFor(locale: string): PageSize {
  try {
    const region = new Intl.Locale(locale).maximize().region
    return region && LETTER_REGIONS.has(region) ? LETTER : A4
  } catch {
    return A4
  }
}

const formatQuantity = (q: Quantity) => `${roundTo(q.value, 4)} ${unitLabel(q.unit)}`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function describePeptide(
  group: PeptideLevels,
  draws: readonly DrawRow[],
  since: number,
  now: number,
): ReportPeptide {
  const unit = unitLabel(group.unit)
  const stats: [string, string][] = [
    ['Draws', String(draws.length)],
    [
      'Total drawn',
      totalsByUnit(draws.map((d) => d.dose))
        .map(formatQuantity)
        .join(' + '),
    ],
  ]
  const peptide = findPeptide(group.peptideId)
  const base = { name: group.label, unitLabel: unit, stats }

  if (!group.pk) {
    return {
      ...base,
      pk: null,
      curve: null,
      noCurveReason:
        peptide?.pkUnavailableReason ??
        'No level curve: custom peptides have no published data. Enter a half-life and time ' +
          'to peak on the vial to see one.',
    }
  }

  const { params, userSupplied } = group.pk
  const { trimmed, ...window } = reportWindow(group.doses, params, now, since)
  const points = simulate(group.doses, params, window)
  const summary = summarizeLevels(points, group.doses, params, now)
  stats.push([
    'Estimated now',
    formatAmount(amountAt(now, group.doses, rateConstants(params)), unit),
  ])
  if (summary.peak) stats.push(['Highest on chart', formatAmount(summary.peak.amount, unit)])
  const leftOut = draws.length - group.doses.filter((d) => d.at >= since).length
  if (leftOut > 0) stats.push(['Not in curve', `${plural(leftOut, 'draw')} in another unit`])

  const catalogPk = userSupplied ? null : peptide?.pk
  const best = catalogPk?.sources.some((s) => s.kind === 'label') ? 'label' : 'trial'
  return {
    ...base,
    pk: {
      halfLife: formatHours(params.halfLifeHours),
      peak: formatHours(params.tmaxHours),
      sourceLabel: userSupplied ? 'User-supplied values' : SOURCE_KIND_LABELS[best],
      userSupplied,
      notes: catalogPk?.notes ?? '',
      citations: (catalogPk?.sources ?? []).map(
        (s) => `${SOURCE_KIND_LABELS[s.kind]}: ${s.citation}${s.url ? ` (${s.url})` : ''}`,
      ),
    },
    curve: {
      window,
      points,
      doses: group.doses.filter((d) => d.at >= window.start && d.at <= window.end),
      now,
      note: trimmed
        ? 'Short-acting: the chart shows the 3 days up to the latest dose. Every draw in the ' +
          'period is in the totals and the draw log.'
        : null,
    },
    noCurveReason: null,
  }
}

/**
 * Gather what the draws-and-levels report prints for `period`: each peptide with draws in the
 * period (its figures, its sourced PK parameters and its logged-dose curve) and the draw log,
 * newest first. Curves count every logged dose, including those before the period, because
 * earlier doses are still in the body; the chart starts at the period. Every value is formatted
 * here for the device's locale, so the layout only places text.
 */
export function collectReport(source: ReportSource): ReportData {
  const { vials, draws, groups, vialName, period, now } = source
  const since = periodStart(period, now)
  const vialsById = new Map(vials.map((v) => [v.id, v]))
  const inPeriod = draws
    .filter((d) => toEpochMs(d.takenAt) >= since && vialsById.has(d.vialId))
    .sort((a, b) => toEpochMs(b.takenAt) - toEpochMs(a.takenAt))

  const peptides = groups
    .map((group) => {
      const own = inPeriod.filter((d) => levelKey(vialsById.get(d.vialId)!) === group.key)
      return own.length ? describePeptide(group, own, since, now) : null
    })
    .filter((p): p is ReportPeptide => p !== null)

  const rows: ReportDraw[] = inPeriod.map((d) => ({
    when: formatDateTime(d.takenAt),
    name: vialName(vialsById.get(d.vialId)!),
    dose: formatQuantity(d.dose),
    volume: `${roundTo(d.volumeMl, 3)} mL`,
    notes: d.notes,
  }))

  const oldest = inPeriod.length ? toEpochMs(inPeriod[inPeriod.length - 1]!.takenAt) : now
  const periodLabel =
    period === 'all'
      ? `All logged draws (${formatDateRange(oldest, now)})`
      : `Last ${period === '30d' ? 30 : 90} days (${formatDateRange(since, now)})`

  return {
    pageSize: pageSizeFor(source.locale),
    generated: formatDateTime(now),
    periodLabel,
    summary: `${plural(inPeriod.length, 'draw')} · ${plural(peptides.length, 'peptide')}`,
    peptides,
    draws: rows,
    formatTick: formatAxisTick,
  }
}
