import { convert, type AmountUnit, type Quantity } from './units'

export interface VialContents {
  amount: number
  unit: AmountUnit
  diluentMl: number
}

export interface DrawRecord {
  dose: Quantity
  volumeMl: number
}

export interface VialBalance {
  /** Peptide left, in the vial's unit; never below zero. */
  remainingAmount: number
  remainingMl: number
  usedFraction: number
  /** Whole doses left at `typicalDose`, or null when no dose is known. */
  dosesLeft: number | null
  overdrawn: boolean
}

/**
 * Remaining peptide and liquid after the logged draws. Volume is tracked from the recorded
 * draw volumes rather than recomputed, so a later edit of the vial's water volume does not
 * silently rewrite history.
 */
export function vialBalance(
  vial: VialContents,
  draws: readonly DrawRecord[],
  typicalDose?: Quantity,
): VialBalance {
  const used = draws.reduce((sum, d) => sum + convert(d.dose, vial.unit).value, 0)
  const usedMl = draws.reduce((sum, d) => sum + d.volumeMl, 0)
  const remainingAmount = Math.max(0, vial.amount - used)
  const remainingMl = Math.max(0, vial.diluentMl - usedMl)
  const typical = typicalDose ? convert(typicalDose, vial.unit).value : 0
  return {
    remainingAmount,
    remainingMl,
    usedFraction: vial.amount > 0 ? Math.min(1, used / vial.amount) : 0,
    dosesLeft: typical > 0 ? Math.floor(remainingAmount / typical + 1e-9) : null,
    overdrawn: used > vial.amount + 1e-9,
  }
}
