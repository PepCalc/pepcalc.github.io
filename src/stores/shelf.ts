import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { repository } from '@/db'
import type { DrawRow, VialRow } from '@/db/database'
import type { NewDraw, NewVial } from '@/db/repository'
import { vialBalance, type VialBalance } from '@/domain/inventory'
import { findPeptide } from '@/data'
import type { PkParameters } from '@/domain/pk'

/**
 * The shelf (vials) and the draw log. The whole dataset is small enough to hold in memory,
 * so the store loads everything once and reloads after each write.
 */
export const useShelfStore = defineStore('shelf', () => {
  const vials = ref<VialRow[]>([])
  const draws = ref<DrawRow[]>([])
  const loaded = ref(false)

  async function load() {
    const [v, d] = await Promise.all([repository.listVials(), repository.listDraws()])
    vials.value = v
    draws.value = d
    loaded.value = true
  }

  const activeVials = computed(() => vials.value.filter((v) => v.status === 'active'))
  const archivedVials = computed(() => vials.value.filter((v) => v.status === 'archived'))

  /** Draws newest first, grouped by vial id. */
  const drawsByVial = computed(() => {
    const map = new Map<string, DrawRow[]>()
    for (const d of draws.value) {
      const list = map.get(d.vialId) ?? []
      list.push(d)
      map.set(d.vialId, list)
    }
    return map
  })

  function vialById(id: string): VialRow | undefined {
    return vials.value.find((v) => v.id === id)
  }

  function drawsFor(vialId: string): DrawRow[] {
    return drawsByVial.value.get(vialId) ?? []
  }

  function balanceOf(vial: VialRow): VialBalance {
    return vialBalance(vial, drawsFor(vial.id), vial.typicalDose ?? undefined)
  }

  /** PK parameters for a vial: the user's override wins, then the catalog's human data. */
  function pkFor(vial: VialRow): { params: PkParameters; userSupplied: boolean } | null {
    if (vial.pkOverride) return { params: vial.pkOverride, userSupplied: true }
    const pk = findPeptide(vial.peptideId)?.pk
    return pk ? { params: pk, userSupplied: false } : null
  }

  async function addVial(input: NewVial): Promise<VialRow> {
    const row = await repository.addVial(input)
    await load()
    return row
  }

  async function updateVial(id: string, changes: Partial<NewVial>) {
    await repository.updateVial(id, changes)
    await load()
  }

  async function deleteVial(id: string) {
    await repository.deleteVial(id)
    await load()
  }

  async function addDraw(input: NewDraw): Promise<DrawRow> {
    const row = await repository.addDraw(input)
    await load()
    return row
  }

  async function deleteDraw(id: string) {
    await repository.deleteDraw(id)
    await load()
  }

  return {
    vials,
    draws,
    loaded,
    activeVials,
    archivedVials,
    load,
    vialById,
    drawsFor,
    balanceOf,
    pkFor,
    addVial,
    updateVial,
    deleteVial,
    addDraw,
    deleteDraw,
  }
})
