import { convert, type MassUnit, type Quantity } from './units'

/** One peptide inside a blend vial; amounts are mg per vial. */
export interface BlendComponent {
  name: string
  amountMg: number
  /** Catalog id of the component, so its own catalog facts (such as injection-site notes) apply. */
  peptideId: string | null
}

export function blendTotalMg(components: readonly BlendComponent[]): number {
  // Inputs can be briefly empty while a user edits; count those as zero rather than concatenate.
  return components.reduce(
    (sum, c) => sum + (Number.isFinite(Number(c.amountMg)) ? Number(c.amountMg) : 0),
    0,
  )
}

export interface ComponentDose {
  name: string
  dose: Quantity
}

/**
 * Split a dose of the whole blend into each component's share. Components are co-lyophilised,
 * so every draw carries them in the vial's fixed ratio.
 */
export function splitBlendDose(
  dose: Quantity,
  components: readonly BlendComponent[],
  outputUnit: MassUnit = 'mg',
): ComponentDose[] {
  const total = blendTotalMg(components)
  if (!(total > 0)) return []
  const doseMg = convert(dose, 'mg').value
  return components.map((c) => ({
    name: c.name,
    dose: convert({ value: (doseMg * c.amountMg) / total, unit: 'mg' }, outputUnit),
  }))
}
