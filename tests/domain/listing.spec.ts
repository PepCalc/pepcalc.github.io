import { describe, expect, it } from 'vitest'
import { paginate, sameProductKey, sortByTime, vialNumbers } from '@/domain/listing'

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('paginate', () => {
  it('slices ten to a page and reports the range shown', () => {
    const p = paginate(range(23), 2)
    expect(p.items).toEqual(range(10).map((n) => n + 10))
    expect(p).toMatchObject({ page: 2, pageCount: 3, total: 23, first: 11, last: 20 })
    expect(paginate(range(23), 3).items).toEqual([21, 22, 23])
  })

  it('clamps a page past the end, as after deleting the last item of the last page', () => {
    const p = paginate(range(20), 3)
    expect(p.page).toBe(2)
    expect(p.items).toEqual(range(10).map((n) => n + 10))
  })

  it('treats an empty list as one empty page', () => {
    expect(paginate([], 4)).toMatchObject({ items: [], page: 1, pageCount: 1, first: 0, last: 0 })
  })

  it('clamps nonsense pages to the first', () => {
    expect(paginate(range(5), 0).page).toBe(1)
    expect(paginate(range(5), Number.NaN).page).toBe(1)
  })
})

describe('sortByTime', () => {
  const items = [
    { id: 'b', at: 2 },
    { id: 'a', at: 1 },
    { id: 'c', at: 3 },
  ]

  it('orders newest first or oldest first without mutating the input', () => {
    expect(sortByTime(items, (i) => i.at, 'desc').map((i) => i.id)).toEqual(['c', 'b', 'a'])
    expect(sortByTime(items, (i) => i.at, 'asc').map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(items[0]!.id).toBe('b')
  })
})

describe('vialNumbers', () => {
  const vial = (id: string, peptideId: string | null, name: string, createdAt: number) => ({
    id,
    peptideId,
    name,
    createdAt,
  })

  it('numbers vials of the same peptide in the order they were added', () => {
    const n = vialNumbers([
      vial('new', 'bpc-157', 'BPC-157', 300),
      vial('old', 'bpc-157', 'BPC-157', 100),
      vial('sema', 'semaglutide', 'Semaglutide', 200),
    ])
    expect(n.get('old')).toBe(1)
    expect(n.get('new')).toBe(2)
    expect(n.has('sema')).toBe(false)
  })

  it('groups custom peptides by name regardless of case and spacing', () => {
    const n = vialNumbers([vial('a', null, 'MOTS-c', 1), vial('b', null, ' mots-c ', 2)])
    expect([n.get('a'), n.get('b')]).toEqual([1, 2])
  })

  it('never groups a custom peptide with a catalog one of the same name', () => {
    expect(sameProductKey({ peptideId: null, name: 'bpc-157' })).not.toBe(
      sameProductKey({ peptideId: 'bpc-157', name: 'BPC-157' }),
    )
  })
})
