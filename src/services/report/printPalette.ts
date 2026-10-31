import type { Rgb } from '@/services/pdf/document'

/*
 * The report prints in the light theme whatever the device is set to: paper is light. Each
 * value mirrors the `.v-theme--light` token of the same name in src/styles/tokens.css, which
 * tests/services/report/printPalette.spec.ts checks, so the PDF and the app stay one palette.
 * The brand mark's colours mirror public/favicon.svg.
 */
export const PRINT_TOKENS = {
  'text-1': '#1d1a14',
  'text-2': '#5f5544',
  'text-3': '#7a6c54',
  brand: '#3f6b52',
  accent: '#9a4f33',
  'surface-2': '#f4ede2',
  divider: '#e8ddcc',
  'divider-strong': '#d6c7af',
  'good-fg': '#1f6b41',
  'good-bg': '#e2f0e7',
  'notice-fg': '#8a5c12',
  'notice-bg': '#fbefd7',
  'chart-logged': '#1a7046',
  'chart-preview': '#d4824f',
  'chart-grid': '#e8ddcc',
  'chart-axis': '#7a6c54',
  'chart-now': '#877960',
} as const

export const MARK_COLOURS = {
  tile: '#3f6b52',
  glyph: '#fbf8f3',
  fluid: '#dc8d6b',
} as const

export function rgb(hex: string): Rgb {
  const v = parseInt(hex.slice(1), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

/** `colour` blended toward white, for tints (PDF fills here are opaque). */
export function tint(colour: Rgb, amount: number): Rgb {
  return colour.map((c) => 1 - (1 - c) * amount) as unknown as Rgb
}

type TokenName = keyof typeof PRINT_TOKENS
export const ink = Object.fromEntries(
  Object.entries(PRINT_TOKENS).map(([k, v]) => [k, rgb(v)]),
) as Record<TokenName, Rgb>
