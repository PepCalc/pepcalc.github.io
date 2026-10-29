import { describe, expect, it } from 'vitest'
import { catalog } from '@/data'
import { collectReport } from '@/services/report/collectReport'
import { renderLevelsReport } from '@/services/report/levelsReport'
import { toWinAnsi } from '@/services/pdf/text'
import { readPdf, withoutStrings } from '../pdf/pdfParse'
import { sampleSource } from './fixtures'

const render = (period: '30d' | '90d' | 'all' = '90d') =>
  renderLevelsReport(collectReport(sampleSource(period)))

describe('renderLevelsReport', () => {
  it('produces a valid, multi-page PDF numbered "page n of m"', () => {
    const pdf = readPdf(render())
    const pages = pdf.streams.length
    expect(pages).toBeGreaterThan(1)
    pdf.streams.forEach((s, i) => expect(s).toContain(`(Page ${i + 1} of ${pages})`))
  })

  it('is deterministic for the same data', () => {
    expect(render()).toEqual(render())
  })

  it('prints each peptide, its source and the model caveat', () => {
    const all = readPdf(render()).streams.join('\n')
    for (const text of [
      '(Semaglutide)',
      '(BPC-157)',
      '(Prescribing label)',
      '(User-supplied values)',
      '(Draw log)',
    ]) {
      expect(all).toContain(text)
    }
    expect(all).toContain('not blood levels')
  })

  it('repeats the draw-log header on continuation pages', () => {
    const { streams } = readPdf(render('all'))
    const withHeader = streams.filter((s) => s.includes('(Peptide or vial)'))
    expect(withHeader.length).toBe(streams.filter((s) => s.includes('(Draw log')).length)
  })

  it('cannot be steered by a hostile vial name or note', () => {
    for (const stream of readPdf(render()).streams) {
      const ops = withoutStrings(stream)
      expect(ops).not.toContain('/F1 99')
      expect(ops.match(/\bTf\b/g)?.length).toBe(ops.match(/\bTj\b/g)?.length)
    }
  })

  it('has no blank pages', () => {
    for (const stream of readPdf(render('all')).streams) {
      expect(withoutStrings(stream).match(/\bTj\b/g)!.length).toBeGreaterThan(3)
    }
  })
})

describe('catalog text in reports', () => {
  /** Strings from the catalog that a report can print. */
  function printable(): string[] {
    const out: string[] = []
    for (const p of catalog.peptides) {
      out.push(p.name, p.pkUnavailableReason ?? '')
      if (p.pk) out.push(p.pk.notes, ...p.pk.sources.flatMap((s) => [s.citation, s.url ?? '']))
    }
    return out.filter(Boolean)
  }

  it('encodes losslessly in the PDF fonts, so nothing prints as "?"', () => {
    const decoder = new TextDecoder('windows-1252')
    for (const text of printable()) {
      const bytes = Uint8Array.from(toWinAnsi(text), (c) => c.charCodeAt(0))
      expect(decoder.decode(bytes)).toBe(text)
    }
  })
})
