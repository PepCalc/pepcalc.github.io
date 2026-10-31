import type { SourceRef } from './catalog'

/**
 * Side effects a user can log, in plain words. The list is the adverse reactions printed in the
 * clinical-trial tables (section 6.1) of the US labels for the catalog's approved peptides:
 * semaglutide and tirzepatide (stomach and gut, the most reported), and tesamorelin (joints,
 * muscles, swelling and tingling). Most research peptides have no label, so "Something else"
 * covers the rest. PepCalc records what the user felt; it never says whether a peptide caused it.
 */
const WEGOVY: SourceRef = {
  kind: 'label',
  citation: 'WEGOVY (semaglutide) US prescribing information, section 6.1, Table 3',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ee06186f-2aa3-4990-a760-757579d8f77b',
}
const ZEPBOUND: SourceRef = {
  kind: 'label',
  citation: 'ZEPBOUND (tirzepatide) US prescribing information, section 6.1, Table 1',
  url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b',
}
const EGRIFTA: SourceRef = {
  kind: 'label',
  citation: 'EGRIFTA WR (tesamorelin) US prescribing information, section 6.1',
  url: 'https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/022505s020lbl.pdf',
}

export const SYMPTOM_SOURCES: SourceRef[] = [WEGOVY, ZEPBOUND, EGRIFTA]

export const SYMPTOMS = [
  'nausea',
  'vomiting',
  'diarrhea',
  'constipation',
  'stomach-pain',
  'headache',
  'tiredness',
  'indigestion',
  'decreased-appetite',
  'dizziness',
  'bloating',
  'burping',
  'gas',
  'reflux',
  'hair-loss',
  'injection-site',
  'low-blood-sugar',
  'skin-sensitivity',
  'numbness',
  'joint-pain',
  'muscle-pain',
  'swelling',
  'rash',
  'other',
] as const

export type Symptom = (typeof SYMPTOMS)[number]

/** Plain words, in place of the labels' clinical terms (arthralgia, myalgia, peripheral edema). */
export const SYMPTOM_LABELS: Record<Symptom, string> = {
  nausea: 'Nausea',
  vomiting: 'Vomiting',
  diarrhea: 'Diarrhea',
  constipation: 'Constipation',
  'stomach-pain': 'Stomach pain',
  headache: 'Headache',
  tiredness: 'Tiredness',
  indigestion: 'Indigestion',
  'decreased-appetite': 'Less appetite',
  dizziness: 'Dizziness',
  bloating: 'Bloating',
  burping: 'Burping',
  gas: 'Gas',
  reflux: 'Heartburn or reflux',
  'hair-loss': 'Hair loss',
  'injection-site': 'Injection site reaction',
  'low-blood-sugar': 'Low blood sugar',
  'skin-sensitivity': 'Skin sensitivity or tingling',
  numbness: 'Numbness or pins and needles',
  'joint-pain': 'Joint pain',
  'muscle-pain': 'Muscle pain',
  swelling: 'Swelling in hands or feet',
  rash: 'Rash',
  other: 'Something else',
}

export const SEVERITIES = ['mild', 'moderate', 'severe'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_LABELS: Record<Severity, string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
}

/** What each level means, so entries stay comparable over months. */
export const SEVERITY_HINTS: Record<Severity, string> = {
  mild: 'Noticeable, but didn’t get in the way',
  moderate: 'Got in the way of some things',
  severe: 'Stopped me from doing things',
}

/**
 * The labels' warning about pancreatitis, shown when severe stomach pain is logged. It quotes
 * the label; it is not a diagnosis.
 */
export const PANCREATITIS_NOTE = {
  text: 'The prescribing labels describe severe stomach pain that may reach through to the back, with or without nausea or vomiting, as a possible sign of pancreatitis, and ask people to contact their healthcare provider promptly if they suspect it.',
  source: {
    kind: 'label',
    citation: 'ZEPBOUND (tirzepatide) US prescribing information, section 17 (acute pancreatitis)',
    url: ZEPBOUND.url,
  } satisfies SourceRef,
}

export interface SymptomEntry {
  symptom: Symptom
  /** The user's words for "Something else"; empty otherwise. */
  otherText: string
  severity: Severity
  /** Epoch milliseconds. */
  at: number
}

export interface SymptomSummary {
  /** The symptom key, or `other:<text>` so each "something else" is counted on its own. */
  key: string
  symptom: Symptom
  name: string
  count: number
  bySeverity: Record<Severity, number>
  lastAt: number
  /** Median days from the draw before each entry to the entry, or null with no draw before. */
  medianDaysAfterDose: number | null
}

const DAY_MS = 86_400_000

/** Display name of an entry: the user's own words for "Something else". */
export function symptomName(e: Pick<SymptomEntry, 'symptom' | 'otherText'>): string {
  return e.symptom === 'other' && e.otherText.trim()
    ? e.otherText.trim()
    : SYMPTOM_LABELS[e.symptom]
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Each symptom logged since `since`: how often, how strong, when last, and how long after a draw
 * of any peptide it tends to come. Most frequent first.
 */
export function summarizeSymptoms(
  entries: readonly SymptomEntry[],
  doseTimes: readonly number[],
  since: number,
): SymptomSummary[] {
  const doses = [...doseTimes].sort((a, b) => a - b)
  const groups = new Map<string, { entries: SymptomEntry[] }>()
  for (const e of entries) {
    if (e.at < since) continue
    const key = e.symptom === 'other' ? `other:${symptomName(e).toLowerCase()}` : e.symptom
    const g = groups.get(key) ?? { entries: [] }
    g.entries.push(e)
    groups.set(key, g)
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const bySeverity: Record<Severity, number> = { mild: 0, moderate: 0, severe: 0 }
      const gaps: number[] = []
      for (const e of g.entries) {
        bySeverity[e.severity]++
        const before = doses.filter((d) => d <= e.at)
        const last = before[before.length - 1]
        if (last !== undefined) gaps.push((e.at - last) / DAY_MS)
      }
      const first = g.entries[0]!
      return {
        key,
        symptom: first.symptom,
        name: symptomName(first),
        count: g.entries.length,
        bySeverity,
        lastAt: Math.max(...g.entries.map((e) => e.at)),
        medianDaysAfterDose: median(gaps),
      }
    })
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
}
