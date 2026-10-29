import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MARK_COLOURS, PRINT_TOKENS } from '@/services/report/printPalette'

const tokens = readFileSync(resolve('src/styles/tokens.css'), 'utf8')
const light = tokens.slice(tokens.indexOf('.v-theme--light {'), tokens.indexOf('.v-theme--dark {'))

describe('print palette', () => {
  it('matches the light theme tokens', () => {
    for (const [name, hex] of Object.entries(PRINT_TOKENS)) {
      const m = new RegExp(`--pc-${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(light)
      expect(m?.[1]?.toLowerCase(), `--pc-${name}`).toBe(hex)
    }
  })

  it('draws the mark in the favicon colours', () => {
    const favicon = readFileSync(resolve('public/favicon.svg'), 'utf8')
    for (const hex of Object.values(MARK_COLOURS)) expect(favicon).toContain(hex)
  })
})
