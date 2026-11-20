import { describe, expect, it } from 'vitest'
import { checkPromises, PROMISES, randomHistory } from './safety'

describe('the rule keeps its safety promises on random histories', () => {
  it('breaks none of them on 20,000 histories', () => {
    const rep = checkPromises(20000, 7)
    for (const p of PROMISES) expect([p.id, rep.violations[p.id]]).toEqual([p.id, 0])
  })
  it('makes histories with every kind of check in them', () => {
    let r = 1
    const next = () => { r = (r * 16807) % 2147483647; return r / 2147483647 }
    const hs = Array.from({ length: 3000 }, () => randomHistory(next)).flat()
    expect(hs.some((c) => c.low === null && !c.hearingLimited)).toBe(true)
    expect(hs.some((c) => c.hearingLimited)).toBe(true)
    expect(hs.some((c) => c.offDay)).toBe(true)
    expect(hs.some((c) => c.functionChange && c.low === null)).toBe(true)
    expect(hs.some((c) => c.low !== null && (c.high as number) > c.low)).toBe(true)
  })
})
