import type { PepcalcDb, DrawRow, VialRow } from './database'
import { nowIso, systemClock, type Clock } from '@/services/time'

export type NewVial = Omit<VialRow, 'id' | 'createdAt' | 'updatedAt'>
export type NewDraw = Omit<DrawRow, 'id' | 'createdAt'>

/**
 * All reads and writes of user data. Views and stores call this, never Dexie tables directly,
 * so storage rules (ids, timestamps, cascade deletes) live in one place.
 */
export function createRepository(db: PepcalcDb, clock: Clock = systemClock) {
  return {
    async listVials(): Promise<VialRow[]> {
      return db.vials.orderBy('createdAt').reverse().toArray()
    },

    async getVial(id: string): Promise<VialRow | undefined> {
      return db.vials.get(id)
    },

    async addVial(input: NewVial): Promise<VialRow> {
      const now = nowIso(clock)
      const row: VialRow = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      await db.vials.add(row)
      return row
    },

    async updateVial(id: string, changes: Partial<NewVial>): Promise<void> {
      await db.vials.update(id, { ...changes, updatedAt: nowIso(clock) })
    },

    /** Deletes the vial and its draw history in one transaction. */
    async deleteVial(id: string): Promise<void> {
      await db.transaction('rw', db.vials, db.draws, async () => {
        await db.draws.where('vialId').equals(id).delete()
        await db.vials.delete(id)
      })
    },

    async listDraws(): Promise<DrawRow[]> {
      return db.draws.orderBy('takenAt').reverse().toArray()
    },

    async listDrawsForVial(vialId: string): Promise<DrawRow[]> {
      return db.draws
        .where('[vialId+takenAt]')
        .between([vialId, ''], [vialId, '￿'])
        .reverse()
        .toArray()
    },

    async addDraw(input: NewDraw): Promise<DrawRow> {
      const row: DrawRow = { ...input, id: crypto.randomUUID(), createdAt: nowIso(clock) }
      await db.draws.add(row)
      return row
    },

    async deleteDraw(id: string): Promise<void> {
      await db.draws.delete(id)
    },

    async getSetting<T>(key: string): Promise<T | undefined> {
      const row = await db.settings.get(key)
      return row?.value as T | undefined
    },

    async setSetting(key: string, value: unknown): Promise<void> {
      await db.settings.put({ key, value })
    },
  }
}
