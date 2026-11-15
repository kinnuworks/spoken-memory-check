import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluate } from './change'
import { loadConsent, saveConsent, NO_CONSENT } from './consent'
import { apoeObservation, familyHistory } from './fhir'
import { PERSONAS, type ScreeningRecord } from './histories'
import { contextRows } from './packet'

const base = PERSONAS.find((p) => p.id === 'decline')!.record
const rec = (patch: Partial<ScreeningRecord>): ScreeningRecord => ({ ...base, ...patch })

describe('family and genetic context in the packet', () => {
  it('shows nothing the person did not agree to share', () => {
    const rows = contextRows(base, { familyHistory: false, genome: false })
    expect(rows.every((r) => !r.shared && r.value.startsWith('Not shared'))).toBe(true)
    expect(rows.map((r) => r.value).join(' ')).not.toMatch(/mother|APOE/)
  })

  it('shows each part only with its own consent', () => {
    const [fam, gen] = contextRows(base, { familyHistory: true, genome: false })
    expect(fam.value).toBe('Mother diagnosed with dementia at 74, as recorded at the screening visit.')
    expect(gen.value).toMatch(/^Not shared/)
    const [, gen2] = contextRows(base, { familyHistory: false, genome: true })
    expect(gen2.value).toBe('APOE e4: one copy, from the Emirati Genome Programme result.')
  })

  it('says plainly when there is nothing on file', () => {
    const both = { familyHistory: true, genome: true }
    expect(contextRows(rec({ familyDementia: { relative: 'none' } }), both)[0].value).toMatch(/^No parent or sibling/)
    expect(contextRows(rec({ familyDementia: { relative: 'unknown' } }), both)[0].value).toBe('Not known.')
    expect(contextRows(rec({ apoeE4Copies: null }), both)[1].value).toMatch(/^No genome programme result/)
    expect(contextRows(rec({ apoeE4Copies: 2 }), both)[1].value).toMatch(/two copies/)
  })

  it('never feeds the rule: every persona keeps the same flag whatever its context says', () => {
    for (const p of PERSONAS) {
      const before = evaluate(p.checks).results.map((r) => r.status)
      const changed = { ...p, record: rec({ familyDementia: { relative: 'mother', ageAtDiagnosis: 60 }, apoeE4Copies: 2 }) }
      expect(evaluate(changed.checks).results.map((r) => r.status)).toEqual(before)
    }
  })
})

describe('context as FHIR resources', () => {
  it('sends a coded family history only when a relative had dementia', () => {
    const f = familyHistory('Patient/x', base)!
    expect(f.resourceType).toBe('FamilyMemberHistory')
    expect(f.relationship.coding[0].code).toBe('MTH')
    expect(f.condition[0].code.coding[0]).toMatchObject({ system: 'http://snomed.info/sct', code: '52448006' })
    expect(f.condition[0].onsetAge?.value).toBe(74)
    expect(familyHistory('Patient/x', rec({ familyDementia: { relative: 'none' } }))).toBeNull()
    expect(familyHistory('Patient/x', rec({ familyDementia: { relative: 'unknown' } }))).toBeNull()
  })

  it('sends the APOE result as a count, or nothing when there is no result', () => {
    expect(apoeObservation('Patient/x', base)).toMatchObject({ resourceType: 'Observation', status: 'final', valueInteger: 1 })
    expect(apoeObservation('Patient/x', rec({ apoeE4Copies: null }))).toBeNull()
  })
})

describe('context consent', () => {
  const mem = new Map<string, string>()
  afterEach(() => { mem.clear(); vi.unstubAllGlobals() })

  it('is off by default and cannot be on without sharing with the physician', () => {
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) })
    expect(loadConsent()).toMatchObject({ shareFamilyHistory: false, shareGenome: false })
    const off = saveConsent({ ...NO_CONSENT, shareFamilyHistory: true, shareGenome: true })
    expect(off).toMatchObject({ shareFamilyHistory: false, shareGenome: false })
    const on = saveConsent({ ...NO_CONSENT, sharePhysician: true, shareFamilyHistory: true, shareGenome: true })
    expect(on).toMatchObject({ shareFamilyHistory: true, shareGenome: true })
    expect(loadConsent()).toMatchObject({ shareFamilyHistory: true, shareGenome: true })
  })
})
