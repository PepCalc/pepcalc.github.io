import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, type PepcalcDb } from '@/db/database'
import { createRepository, type NewVial } from '@/db/repository'
import { exportBackup, parseBackup, restoreBackup, BackupFormatError } from '@/db/backup'

const fixedClock = () => new Date('2026-10-25T12:00:00.000Z')

const vialInput: NewVial = {
  peptideId: 'semaglutide',
  name: 'Semaglutide',
  kind: 'single',
  unit: 'mg',
  amount: 5,
  diluentMl: 2,
  components: null,
  typicalDose: { value: 0.25, unit: 'mg' },
  pkOverride: null,
  reconstitutedAt: '2026-10-20T08:00:00.000Z',
  status: 'active',
  notes: '',
}

let db: PepcalcDb
let counter = 0

beforeEach(async () => {
  db = createDatabase(`test-${++counter}`)
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

describe('repository', () => {
  it('adds vials with ids and UTC timestamps', async () => {
    const repo = createRepository(db, fixedClock)
    const vial = await repo.addVial(vialInput)
    expect(vial.id).toMatch(/[0-9a-f-]{36}/)
    expect(vial.createdAt).toBe('2026-10-25T12:00:00.000Z')
    expect(await repo.listVials()).toHaveLength(1)
  })

  it('lists draws for one vial newest first and cascades on delete', async () => {
    const repo = createRepository(db, fixedClock)
    const a = await repo.addVial(vialInput)
    const b = await repo.addVial({ ...vialInput, name: 'Other' })
    const base = {
      dose: { value: 0.25, unit: 'mg' as const },
      volumeMl: 0.1,
      syringeId: 'u100-1ml',
      notes: '',
    }
    await repo.addDraw({ ...base, vialId: a.id, takenAt: '2026-10-21T08:00:00.000Z' })
    await repo.addDraw({ ...base, vialId: a.id, takenAt: '2026-10-24T08:00:00.000Z' })
    await repo.addDraw({ ...base, vialId: b.id, takenAt: '2026-10-22T08:00:00.000Z' })
    const draws = await repo.listDrawsForVial(a.id)
    expect(draws.map((d) => d.takenAt)).toEqual([
      '2026-10-24T08:00:00.000Z',
      '2026-10-21T08:00:00.000Z',
    ])
    await repo.deleteVial(a.id)
    expect(await repo.listDraws()).toHaveLength(1)
  })

  it('stores settings', async () => {
    const repo = createRepository(db, fixedClock)
    await repo.setSetting('defaultSyringeId', 'u100-0.5ml')
    expect(await repo.getSetting('defaultSyringeId')).toBe('u100-0.5ml')
  })
})

describe('backup', () => {
  it('round-trips through JSON and replaces existing data', async () => {
    const repo = createRepository(db, fixedClock)
    const vial = await repo.addVial(vialInput)
    await repo.addDraw({
      vialId: vial.id,
      takenAt: '2026-10-21T08:00:00.000Z',
      dose: { value: 0.25, unit: 'mg' },
      volumeMl: 0.1,
      syringeId: 'u100-1ml',
      notes: 'first',
    })
    const text = JSON.stringify(await exportBackup(db, fixedClock))

    const other = createDatabase(`restore-${counter}`)
    await other.open()
    const otherRepo = createRepository(other, fixedClock)
    await otherRepo.addVial({ ...vialInput, name: 'Will be replaced' })
    await restoreBackup(other, parseBackup(text))
    const vials = await otherRepo.listVials()
    expect(vials.map((v) => v.name)).toEqual(['Semaglutide'])
    expect((await otherRepo.listDraws())[0]?.notes).toBe('first')
    await other.delete()
  })

  it('rejects files that are not PepCalc backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupFormatError)
    expect(() => parseBackup('{"format":"other"}')).toThrow(BackupFormatError)
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: 'pepcalc-backup',
          version: 99,
          vials: [],
          draws: [],
          settings: [],
        }),
      ),
    ).toThrow(/newer version/)
  })

  it('rejects draws that point at a missing vial', () => {
    const bad = {
      format: 'pepcalc-backup',
      version: 1,
      vials: [],
      draws: [
        {
          id: 'd',
          vialId: 'nope',
          takenAt: '2026-10-21T08:00:00.000Z',
          dose: { value: 1, unit: 'mg' },
          volumeMl: 0.1,
        },
      ],
      settings: [],
    }
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(BackupFormatError)
  })

  it('rejects a draw whose unit cannot apply to its vial', () => {
    const backup = {
      format: 'pepcalc-backup',
      version: 1,
      vials: [
        {
          ...vialInput,
          unit: 'iu',
          id: 'v1',
          createdAt: '2026-10-20T08:00:00.000Z',
          typicalDose: null,
        },
      ],
      draws: [
        {
          id: 'd1',
          vialId: 'v1',
          takenAt: '2026-10-21T08:00:00.000Z',
          dose: { value: 1, unit: 'mg' },
          volumeMl: 0.1,
        },
      ],
      settings: [],
    }
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(BackupFormatError)
  })

  it('rejects a non-positive user half-life', () => {
    const backup = {
      format: 'pepcalc-backup',
      version: 1,
      vials: [
        {
          ...vialInput,
          id: 'v1',
          createdAt: '2026-10-20T08:00:00.000Z',
          pkOverride: { halfLifeHours: 0, tmaxHours: 1 },
        },
      ],
      draws: [],
      settings: [],
    }
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(BackupFormatError)
  })

  it('restores version 1 blend components as unlinked', () => {
    const backup = {
      format: 'pepcalc-backup',
      version: 1,
      vials: [
        {
          ...vialInput,
          id: 'v1',
          kind: 'blend',
          createdAt: '2026-10-20T08:00:00.000Z',
          components: [{ name: 'GHK-Cu', amountMg: 50 }],
        },
      ],
      draws: [],
      settings: [],
    }
    expect(parseBackup(JSON.stringify(backup)).vials[0]!.components).toEqual([
      { name: 'GHK-Cu', amountMg: 50, peptideId: null },
    ])
  })

  it('rejects blend components without a catalog id field', () => {
    const blendVial = (components: unknown) => ({
      format: 'pepcalc-backup',
      version: 2,
      vials: [
        {
          ...vialInput,
          id: 'v1',
          kind: 'blend',
          createdAt: '2026-10-20T08:00:00.000Z',
          components,
        },
      ],
      draws: [],
      settings: [],
    })
    const ghk = { name: 'GHK-Cu', amountMg: 50 }
    expect(() => parseBackup(JSON.stringify(blendVial([ghk])))).toThrow(BackupFormatError)
    expect(
      parseBackup(JSON.stringify(blendVial([{ ...ghk, peptideId: 'ghk-cu' }]))).vials,
    ).toHaveLength(1)
  })
})
