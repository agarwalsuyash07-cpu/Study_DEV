import { describe, expect, it } from 'vitest'
import { searchCatalog, type SearchDoc } from './search'

const docs: SearchDoc[] = [
  { kind: 'track', id: 'cn', title: 'Computer Networks', trackId: 'cn', context: '' },
  { kind: 'module', id: 'cn-m1', title: 'Transport layer', trackId: 'cn', context: 'Computer Networks' },
  { kind: 'topic', id: 't1', title: 'TCP congestion control', trackId: 'cn', context: 'Transport layer' },
  { kind: 'topic', id: 't2', title: 'Flow control in TCP', trackId: 'cn', context: 'Transport layer' },
  { kind: 'topic', id: 't3', title: 'Normalisation', trackId: 'dbms', context: 'Design' },
]

const ids = (q: string) => searchCatalog(docs, q).map((d) => d.id)

describe('searchCatalog', () => {
  it('is case-insensitive and needs every word to match title or context', () => {
    expect(ids('TCP')).toEqual(['t1', 't2'])
    expect(ids('tcp normal')).toEqual([])
  })

  it('ranks title prefix over word prefix over context, then alphabetically', () => {
    // module title starts with "trans"; topics only match through their module context
    expect(ids('trans')).toEqual(['cn-m1', 't2', 't1'])
    // both topics: word prefix "control" + context "transport"
    expect(ids('control transport')).toEqual(['t2', 't1'])
  })

  it('returns nothing for a blank query and caps results', () => {
    expect(ids('   ')).toEqual([])
    expect(searchCatalog(docs, 'o', 2)).toHaveLength(2)
  })
})
