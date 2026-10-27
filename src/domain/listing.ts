/** Ordering, numbering and paging of the shelf and draw lists. */

export const PAGE_SIZE = 10

export type SortDirection = 'desc' | 'asc'

export interface Page<T> {
  items: T[]
  /** 1-based, clamped to the pages that exist so a delete on the last page never strands it. */
  page: number
  pageCount: number
  total: number
  /** 1-based position of the first item shown, or 0 when there are none. */
  first: number
  last: number
}

/** One page of `items`; `page` outside the range is clamped. */
export function paginate<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount)
  const start = (current - 1) * pageSize
  const slice = items.slice(start, start + pageSize)
  return {
    items: slice,
    page: current,
    pageCount,
    total: items.length,
    first: slice.length ? start + 1 : 0,
    last: start + slice.length,
  }
}

/** A copy of `items` ordered by `at` (epoch ms), newest first for `desc`; ties keep their order. */
export function sortByTime<T>(
  items: readonly T[],
  at: (item: T) => number,
  direction: SortDirection,
): T[] {
  const sign = direction === 'desc' ? -1 : 1
  return [...items].sort((a, b) => sign * (at(a) - at(b)))
}

export interface NumberableVial {
  id: string
  peptideId: string | null
  name: string
  /** Epoch ms the vial was added; the order vials are numbered in. */
  createdAt: number
}

/** Vials of the same peptide share a key: the catalog id, else the name as the user typed it. */
export function sameProductKey(vial: { peptideId: string | null; name: string }): string {
  return vial.peptideId ?? `name:${vial.name.trim().toLowerCase()}`
}

/**
 * A number for each vial that shares its peptide with another vial: 1 for the first one added,
 * 2 for the next. Archived vials count, so archiving one never renumbers the rest. Vials with
 * no twin are left out, since a lone "#1" is noise.
 */
export function vialNumbers(vials: readonly NumberableVial[]): Map<string, number> {
  const groups = new Map<string, NumberableVial[]>()
  for (const v of vials) {
    const key = sameProductKey(v)
    groups.set(key, [...(groups.get(key) ?? []), v])
  }
  const numbers = new Map<string, number>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    sortByTime(group, (v) => v.createdAt, 'asc').forEach((v, i) => numbers.set(v.id, i + 1))
  }
  return numbers
}
