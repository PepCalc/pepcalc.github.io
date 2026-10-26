import type { DrawRow, PepcalcDb, SettingRow, VialRow } from './database'
import { AMOUNT_UNITS, areCompatible, type AmountUnit } from '@/domain/units'
import { nowIso, systemClock, type Clock } from '@/services/time'

/**
 * Backups are the only protection against the browser evicting site data (iOS in
 * particular), since nothing is stored off the device. The file is plain JSON so a user can
 * inspect exactly what it contains.
 */
const BACKUP_FORMAT = 'pepcalc-backup'
const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  vials: VialRow[]
  draws: DrawRow[]
  settings: SettingRow[]
}

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupFormatError'
  }
}

export async function exportBackup(db: PepcalcDb, clock: Clock = systemClock): Promise<BackupFile> {
  const [vials, draws, settings] = await Promise.all([
    db.vials.toArray(),
    db.draws.toArray(),
    db.settings.toArray(),
  ])
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: nowIso(clock),
    vials,
    draws,
    settings,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIso(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isQuantity(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    AMOUNT_UNITS.includes(value.unit as never)
  )
}

function isPositive(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isCompatibleQuantity(value: unknown, vialUnit: AmountUnit): boolean {
  return isQuantity(value) && areCompatible((value as { unit: AmountUnit }).unit, vialUnit)
}

function isPkOverride(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) && isPositive(value.halfLifeHours) && isPositive(value.tmaxHours))
  )
}

/*
 * Restore must never write rows the app cannot compute with: a draw in mg against an IU vial,
 * or a non-positive half-life, would throw while rendering the shelf or the chart.
 */
function checkVial(v: unknown, i: number): asserts v is VialRow {
  const ok =
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    (v.kind === 'single' || v.kind === 'blend') &&
    AMOUNT_UNITS.includes(v.unit as never) &&
    isPositive(v.amount) &&
    isPositive(v.diluentMl) &&
    (v.status === 'active' || v.status === 'archived') &&
    isIso(v.createdAt) &&
    (v.typicalDose == null || isCompatibleQuantity(v.typicalDose, v.unit as AmountUnit)) &&
    isPkOverride(v.pkOverride ?? null)
  if (!ok)
    throw new BackupFormatError(`Vial ${i + 1} is missing required fields or has invalid values.`)
}

function checkDraw(
  d: unknown,
  i: number,
  vialUnits: Map<string, AmountUnit>,
): asserts d is DrawRow {
  const vialUnit = isRecord(d) && typeof d.vialId === 'string' ? vialUnits.get(d.vialId) : undefined
  const ok =
    isRecord(d) &&
    typeof d.id === 'string' &&
    vialUnit !== undefined &&
    isIso(d.takenAt) &&
    isCompatibleQuantity(d.dose, vialUnit) &&
    isPositive((d.dose as { value: number }).value) &&
    typeof d.volumeMl === 'number' &&
    d.volumeMl >= 0
  if (!ok) throw new BackupFormatError(`Draw ${i + 1} is invalid or refers to a missing vial.`)
}

/** Validate untrusted JSON before anything touches the database. */
export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupFormatError('This file is not valid JSON.')
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT) {
    throw new BackupFormatError('This is not a PepCalc backup file.')
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new BackupFormatError(
      'This backup was made by a newer version of PepCalc. Update the app first.',
    )
  }
  const { vials, draws, settings } = data
  if (!Array.isArray(vials) || !Array.isArray(draws) || !Array.isArray(settings)) {
    throw new BackupFormatError('The backup is incomplete.')
  }
  vials.forEach(checkVial)
  const vialUnits = new Map((vials as VialRow[]).map((v) => [v.id, v.unit]))
  draws.forEach((d, i) => checkDraw(d, i, vialUnits))
  const validSettings = settings.filter(
    (s): s is SettingRow => isRecord(s) && typeof s.key === 'string',
  )
  return {
    format: BACKUP_FORMAT,
    version: data.version,
    exportedAt: isIso(data.exportedAt) ? (data.exportedAt as string) : '',
    vials: vials as VialRow[],
    draws: draws as DrawRow[],
    settings: validSettings,
  }
}

/** Replace everything on this device with the backup's contents, atomically. */
export async function restoreBackup(db: PepcalcDb, backup: BackupFile): Promise<void> {
  await db.transaction('rw', db.vials, db.draws, db.settings, async () => {
    await Promise.all([db.vials.clear(), db.draws.clear(), db.settings.clear()])
    await db.vials.bulkAdd(backup.vials)
    await db.draws.bulkAdd(backup.draws)
    await db.settings.bulkPut(backup.settings)
  })
}

export function backupFileName(exportedAt: string): string {
  return `pepcalc-backup-${exportedAt.slice(0, 10)}.json`
}
