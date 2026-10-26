import Dexie, { type EntityTable } from 'dexie'
import type { BlendComponent } from '@/domain/blend'
import type { PkParameters } from '@/domain/pk'
import type { AmountUnit, Quantity } from '@/domain/units'

/** A reconstituted (or still dry) vial on the user's shelf. Timestamps are UTC ISO-8601. */
export interface VialRow {
  id: string
  /** Catalog id, or null for a custom peptide. */
  peptideId: string | null
  name: string
  kind: 'single' | 'blend'
  unit: AmountUnit
  amount: number
  diluentMl: number
  components: BlendComponent[] | null
  typicalDose: Quantity | null
  /** User-supplied PK parameters; overrides the catalog and enables a curve without catalog PK. */
  pkOverride: PkParameters | null
  reconstitutedAt: string | null
  status: 'active' | 'archived'
  notes: string
  createdAt: string
  updatedAt: string
}

export interface DrawRow {
  id: string
  vialId: string
  takenAt: string
  dose: Quantity
  volumeMl: number
  syringeId: string
  notes: string
  createdAt: string
}

export interface SettingRow {
  key: string
  value: unknown
}

export type PepcalcDb = Dexie & {
  vials: EntityTable<VialRow, 'id'>
  draws: EntityTable<DrawRow, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}

const DB_NAME = 'pepcalc'

/*
 * Schema history. Never edit a released version: add a new `db.version(n + 1)` with an
 * `.upgrade()` that migrates existing rows, because users' only copy of their data is here.
 * Indexes list only fields that are queried; other fields are stored but not indexed.
 */
export function createDatabase(name = DB_NAME): PepcalcDb {
  const db = new Dexie(name) as PepcalcDb
  db.version(1).stores({
    vials: 'id, status, peptideId, createdAt',
    draws: 'id, vialId, takenAt, [vialId+takenAt]',
    settings: 'key',
  })
  return db
}

export const db = createDatabase()
