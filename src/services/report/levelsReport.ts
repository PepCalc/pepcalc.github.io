import type { DoseEvent, PkPoint, SimulationWindow } from '@/domain/pk'
import { niceTicks } from '@/domain/report'
import { roundTo } from '@/domain/units'
import { buildPdf, PdfPage, type Point, type Rgb } from '@/services/pdf/document'
import type { PageSize } from '@/services/pdf/pageSize'
import { ellipsise, measure, wrap, type PdfFont } from '@/services/pdf/text'
import { ink, MARK_COLOURS, rgb, tint } from './printPalette'

/** A logged-dose level curve, already simulated; the report draws but never computes it. */
interface ReportCurve {
  window: SimulationWindow
  points: readonly PkPoint[]
  /** Doses inside the window, for the markers on the baseline. */
  doses: readonly DoseEvent[]
  now: number
  /** Printed under the chart, such as why it shows fewer days than the period. */
  note: string | null
}

/** Where a curve's half-life and time to peak came from. */
interface ReportPk {
  halfLife: string
  peak: string
  /** "Prescribing label", "Clinical trial" or "User-supplied values". */
  sourceLabel: string
  userSupplied: boolean
  /** Ranges or caveats from the source. */
  notes: string
  citations: readonly string[]
}

export interface ReportPeptide {
  name: string
  unitLabel: string
  /** Pre-formatted headline figures, such as ["Draws", "6"] or ["Estimated now", "0.31 mg"]. */
  stats: readonly (readonly [string, string])[]
  pk: ReportPk | null
  curve: ReportCurve | null
  /** Why there is no curve, shown in its place. */
  noCurveReason: string | null
}

export interface ReportDraw {
  when: string
  name: string
  dose: string
  volume: string
  notes: string
}

/** Everything the report prints, already formatted for the reader's locale. */
export interface ReportData {
  pageSize: PageSize
  generated: string
  periodLabel: string
  summary: string
  peptides: readonly ReportPeptide[]
  /** Newest first, as History lists them. */
  draws: readonly ReportDraw[]
  /** Axis label for an instant; `spanMs` lets it drop the date or the time. */
  formatTick: (epochMs: number, spanMs: number) => string
}

const MARGIN = 48
const TOP = 48
const BOTTOM = 56

const CAVEAT =
  'Estimated amount left in the body from logged doses, not blood levels. Based on a simple ' +
  'model from the half-life and time to peak.'

const ABOUT = [
  'PepCalc does arithmetic and shows sourced references. It never recommends a dose and is ' +
    'not medical advice.',
  'Draws are those logged in PepCalc on this device. IU doses are never converted to mass. ' +
    'Level curves include every logged draw of a peptide, across all its vials.',
  'Built-in half-lives and peak times come only from human data (a label or a clinical ' +
    'trial). Values marked user-supplied were entered by the person who made this report.',
]

/**
 * Lays content down the page, starting a new page when the next block will not fit. Footers
 * are added once every page exists, so each can say "page n of m".
 */
class Layout {
  readonly pages: PdfPage[] = []
  page!: PdfPage
  y = TOP
  readonly width: number

  constructor(readonly size: PageSize) {
    this.width = size.width - MARGIN * 2
    this.newPage()
  }

  newPage() {
    this.page = new PdfPage(this.size)
    this.pages.push(this.page)
    this.y = TOP
  }

  /** Start a new page unless `height` points still fit above the footer. */
  ensure(height: number) {
    if (this.y + height > this.size.height - BOTTOM) this.newPage()
  }

  /** Wrapped paragraph at the cursor; returns nothing, moves the cursor below it. */
  paragraph(text: string, font: PdfFont, size: number, color: Rgb, leading = size * 1.35) {
    for (const line of wrap(text, font, size, this.width)) {
      this.ensure(leading)
      this.y += leading
      this.page.text(MARGIN, this.y - (leading - size) / 2, line, { font, size, color })
    }
  }

  heading(text: string, size = 14) {
    this.ensure(size + 8)
    this.y += size + 4
    this.page.text(MARGIN, this.y, text, { font: 'bold', size, color: ink['text-1'] })
    this.y += 6
  }

  gap(points: number) {
    this.y += points
  }
}

/** The PepCalc mark drawn from the same geometry as public/favicon.svg (512 unit grid). */
function drawMark(page: PdfPage, x: number, y: number, size: number) {
  const k = size / 512
  const p = (gx: number, gy: number): Point => [x + (gx - 6) * k, y + (gy - 10) * k]
  const glyph = rgb(MARK_COLOURS.glyph)
  const tile = rgb(MARK_COLOURS.tile)
  page.rect(x, y, size, size, { fill: tile }, 112 * k)
  const [sx, sy] = p(144, 100)
  page.rect(sx, sy, 56 * k, 268 * k, { fill: glyph }, 18 * k)
  for (const ty of [264, 300, 336])
    page.line(p(144, ty), p(170, ty), { color: tile, width: 10 * k })
  page.polygon([p(152, 368), p(192, 368), p(180, 390), p(164, 390)], { fill: glyph })
  page.line(p(172, 390), p(172, 430), { color: glyph, width: 8 * k })
  const [cx, cy] = p(276, 204)
  page.circle(cx, cy, 80 * k, { stroke: { color: glyph, width: 48 * k } })
  // The liquid: the part of a 44-unit circle below a meniscus 12 units above its centre.
  const start = Math.asin(-12 / 44)
  const arc: Point[] = Array.from({ length: 25 }, (_, i) => {
    const a = start + ((Math.PI - 2 * start) * i) / 24
    return [cx + 44 * k * Math.cos(a), cy + 44 * k * Math.sin(a)]
  })
  page.polygon(arc, { fill: rgb(MARK_COLOURS.fluid) })
}

function drawHeader(layout: Layout, data: ReportData) {
  const { page } = layout
  drawMark(page, MARGIN, TOP - 6, 26)
  const word = page.text(MARGIN + 34, TOP + 13, 'Pep', {
    font: 'bold',
    size: 15,
    color: ink['text-1'],
  })
  page.text(MARGIN + 34 + word, TOP + 13, 'Calc', { font: 'bold', size: 15, color: ink.brand })
  page.text(layout.size.width - MARGIN, TOP + 12, `Generated ${data.generated}`, {
    size: 8.5,
    color: ink['text-3'],
    align: 'right',
  })

  layout.y = TOP + 52
  page.text(MARGIN, layout.y, 'REPORT', { font: 'bold', size: 8, color: ink.accent })
  layout.y += 24
  page.text(MARGIN, layout.y, 'Draws and estimated levels', {
    font: 'bold',
    size: 22,
    color: ink['text-1'],
  })
  layout.y += 18
  page.text(MARGIN, layout.y, `${data.periodLabel} · ${data.summary}`, {
    size: 10.5,
    color: ink['text-2'],
  })

  layout.y += 14
  page.rect(MARGIN, layout.y, layout.width, 30, { fill: ink['surface-2'] }, 6)
  page.text(MARGIN + 12, layout.y + 18.5, 'Made with PepCalc on this device.', {
    size: 8.5,
    color: ink['text-2'],
  })
  layout.y += 30 + 18
}

/** A rounded label like the app's badges; returns its width. */
function pill(page: PdfPage, x: number, baseline: number, text: string, fg: Rgb, bg: Rgb) {
  const size = 8.5
  const width = measure(text, 'bold', size) + 14
  page.rect(x, baseline - 10.5, width, 15, { fill: bg }, 7.5)
  page.text(x + 7, baseline, text, { font: 'bold', size, color: fg })
  return width
}

function drawChart(
  page: PdfPage,
  box: { x: number; y: number; width: number; height: number },
  curve: ReportCurve,
  unitLabel: string,
  formatTick: ReportData['formatTick'],
) {
  const { window, points, doses, now } = curve
  const peak = points.reduce((m, p) => Math.max(m, p.amount), 0)
  const ticks = niceTicks(peak)
  const top = ticks[ticks.length - 1]!
  const label = (v: number) => `${roundTo(v, 3)} ${unitLabel}`
  const gutter = Math.max(...ticks.map((t) => measure(label(t), 'regular', 7.5))) + 8
  const plot = {
    x: box.x + gutter,
    y: box.y + 8,
    width: box.width - gutter - 6,
    height: box.height - 8 - 18,
  }
  const span = window.end - window.start
  const px = (at: number) => plot.x + ((at - window.start) / span) * plot.width
  const py = (amount: number) => plot.y + plot.height - (amount / top) * plot.height
  const baseline = plot.y + plot.height

  for (const t of ticks) {
    page.line([plot.x, py(t)], [plot.x + plot.width, py(t)], {
      color: ink['chart-grid'],
      width: 0.5,
    })
    page.text(plot.x - 6, py(t) + 2.6, label(t), {
      size: 7.5,
      color: ink['chart-axis'],
      align: 'right',
    })
  }
  for (let i = 0; i <= 4; i++) {
    const at = window.start + (span * i) / 4
    const align = i === 0 ? 'left' : i === 4 ? 'right' : 'center'
    page.text(px(at), baseline + 12, formatTick(at, span), {
      size: 7.5,
      color: ink['chart-axis'],
      align,
    })
  }

  const line: Point[] = points.map((p) => [px(p.at), py(p.amount)])
  if (line.length > 1) {
    page.polygon([[line[0]![0], baseline], ...line, [line[line.length - 1]![0], baseline]], {
      fill: tint(ink['chart-logged'], 0.12),
    })
    page.polyline(line, { color: ink['chart-logged'], width: 1.25 })
  }
  page.line([plot.x, baseline], [plot.x + plot.width, baseline], {
    color: ink['divider-strong'],
    width: 0.75,
  })
  for (const d of doses) {
    const x = px(d.at)
    page.polygon(
      [
        [x, baseline - 5],
        [x - 3.5, baseline + 1],
        [x + 3.5, baseline + 1],
      ],
      { fill: ink['chart-axis'] },
    )
  }
  if (now >= window.start && now <= window.end) {
    page.line([px(now), plot.y], [px(now), baseline], {
      color: ink['chart-now'],
      width: 0.75,
      dash: [2, 2],
    })
    page.text(px(now) + 3, plot.y + 6, 'Now', { size: 7, color: ink['chart-axis'] })
  }
}

function drawPeptide(layout: Layout, data: ReportData, peptide: ReportPeptide) {
  // Keep a peptide's name, figures and chart together on one page.
  layout.ensure(peptide.curve ? 300 : 110)
  layout.heading(peptide.name)
  const { page } = layout

  if (peptide.pk) {
    layout.y += 14
    let x = MARGIN
    x += pill(page, x, layout.y, `t½ ${peptide.pk.halfLife}`, ink.brand, tint(ink.brand, 0.14)) + 6
    x += pill(page, x, layout.y, `peak ${peptide.pk.peak}`, ink.brand, tint(ink.brand, 0.14)) + 6
    const [fg, bg] = peptide.pk.userSupplied
      ? [ink['notice-fg'], ink['notice-bg']]
      : [ink['good-fg'], ink['good-bg']]
    pill(page, x, layout.y, peptide.pk.sourceLabel, fg, bg)
    layout.y += 8
  }

  if (peptide.stats.length) {
    layout.y += 14
    const column = layout.width / peptide.stats.length
    peptide.stats.forEach(([label, value], i) => {
      const x = MARGIN + i * column
      page.text(x, layout.y, label, { size: 8, color: ink['text-3'] })
      page.text(x, layout.y + 14, ellipsise(value, 'bold', 11, column - 8), {
        font: 'bold',
        size: 11,
        color: ink['text-1'],
      })
    })
    layout.y += 22
  }

  if (peptide.curve) {
    layout.y += 6
    drawChart(
      page,
      { x: MARGIN, y: layout.y, width: layout.width, height: 180 },
      peptide.curve,
      peptide.unitLabel,
      data.formatTick,
    )
    layout.y += 182
    if (peptide.curve.note) layout.paragraph(peptide.curve.note, 'regular', 8, ink['text-2'])
    layout.paragraph(CAVEAT, 'regular', 8, ink['text-3'])
  } else if (peptide.noCurveReason) {
    layout.gap(4)
    layout.paragraph(peptide.noCurveReason, 'regular', 9, ink['text-2'])
  }

  if (peptide.pk && !peptide.pk.userSupplied) {
    layout.gap(4)
    if (peptide.pk.notes) layout.paragraph(peptide.pk.notes, 'regular', 8, ink['text-2'])
    for (const citation of peptide.pk.citations) {
      layout.paragraph(`Source: ${citation}`, 'regular', 8, ink['text-3'])
    }
  }
  layout.gap(10)
  layout.ensure(1)
  layout.page.line([MARGIN, layout.y], [MARGIN + layout.width, layout.y], {
    color: ink.divider,
    width: 0.75,
  })
  layout.gap(10)
}

const COLUMNS = [
  { title: 'When', width: 0.22, align: 'left' },
  { title: 'Peptide or vial', width: 0.26, align: 'left' },
  { title: 'Dose', width: 0.12, align: 'right' },
  { title: 'Volume', width: 0.11, align: 'right' },
  { title: 'Notes', width: 0.29, align: 'left' },
] as const

const ROW = 15

function drawLogHeader(layout: Layout) {
  const { page } = layout
  layout.y += 12
  let x = MARGIN
  for (const c of COLUMNS) {
    const w = c.width * layout.width
    const right = c.align === 'right'
    page.text(right ? x + w - 4 : x + 4, layout.y, c.title, {
      font: 'bold',
      size: 8.5,
      color: ink['text-2'],
      align: c.align,
    })
    x += w
  }
  layout.y += 5
  page.line([MARGIN, layout.y], [MARGIN + layout.width, layout.y], {
    color: ink['divider-strong'],
    width: 0.75,
  })
}

function drawDrawLog(layout: Layout, draws: readonly ReportDraw[]) {
  layout.ensure(80)
  layout.heading('Draw log')
  if (!draws.length) {
    layout.paragraph('No draws were logged in this period.', 'regular', 9, ink['text-2'])
    return
  }
  drawLogHeader(layout)
  draws.forEach((draw, i) => {
    if (layout.y + ROW > layout.size.height - BOTTOM) {
      layout.newPage()
      layout.heading('Draw log (continued)', 11)
      drawLogHeader(layout)
    }
    const { page } = layout
    if (i % 2 === 1) page.rect(MARGIN, layout.y, layout.width, ROW, { fill: ink['surface-2'] })
    const cells = [draw.when, draw.name, draw.dose, draw.volume, draw.notes]
    let x = MARGIN
    COLUMNS.forEach((c, j) => {
      const w = c.width * layout.width
      const text = ellipsise(cells[j]!, 'regular', 8.5, w - 8)
      page.text(c.align === 'right' ? x + w - 4 : x + 4, layout.y + 10.5, text, {
        size: 8.5,
        color: j === 4 ? ink['text-2'] : ink['text-1'],
        align: c.align,
      })
      x += w
    })
    layout.y += ROW
  })
  layout.gap(10)
}

function drawFooters(layout: Layout) {
  const { pages, size } = layout
  pages.forEach((page, i) => {
    const y = size.height - 34
    page.line([MARGIN, y - 10], [size.width - MARGIN, y - 10], { color: ink.divider, width: 0.5 })
    page.text(
      MARGIN,
      y,
      'PepCalc · Arithmetic and sourced references only; never a dose recommendation.',
      {
        size: 7.5,
        color: ink['text-3'],
      },
    )
    page.text(size.width - MARGIN, y, `Page ${i + 1} of ${pages.length}`, {
      size: 7.5,
      color: ink['text-3'],
      align: 'right',
    })
  })
}

/**
 * Lay out the draws-and-levels report and serialise it to PDF bytes. Pure: the same data gives
 * the same file, so it is tested without a browser. Callers format every date and number for
 * the reader's locale before passing them in.
 */
export function renderLevelsReport(data: ReportData): Uint8Array<ArrayBuffer> {
  const layout = new Layout(data.pageSize)
  drawHeader(layout, data)
  for (const peptide of data.peptides) drawPeptide(layout, data, peptide)
  drawDrawLog(layout, data.draws)
  layout.ensure(90)
  layout.heading('About these numbers', 12)
  for (const paragraph of ABOUT) {
    layout.paragraph(paragraph, 'regular', 9, ink['text-2'])
    layout.gap(4)
  }
  drawFooters(layout)
  return buildPdf(layout.pages, 'PepCalc report: draws and estimated levels')
}
