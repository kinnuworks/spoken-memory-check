import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import bench from '../data/benchmark.json'
import own from '../data/own-voice-summary.json'

// The plain-text page readers see without JavaScript must state the same figures as the app.
describe('plain text in index.html', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const row = bench.rows.find((r) => r.world === 'As assumed' && r.rule === 'ours')!
  const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`

  it('quotes the measured and simulated figures as they now stand', () => {
    expect(html).toContain(`heard ${pct(own.union.rate)} of ${own.union.n} single Arabic words from ${own.speakers} speakers`)
    expect(html).toContain(`${pct(row.falseAlarmYear, 1)} false alarms a year`)
    expect(html).toContain(`${pct(row.detected['2'])} of people losing 2 points a check flagged within the year, ${pct(row.detected['1'])} at 1 point`)
  })

  it('loads no fonts or scripts from another site', () => {
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
  })
})

// The two form boxes have hard limits on the submission form.
describe('submission form text', () => {
  const md = readFileSync(new URL('../../docs/SUBMISSION_TEXT.md', import.meta.url), 'utf8')
  const box = (name: string) => md.split(`<!-- ${name}:start -->`)[1].split(`<!-- ${name}:end -->`)[0].trim()

  it('fits the 2,000 and 1,500 character boxes', () => {
    expect(box('summary').length).toBeLessThanOrEqual(2000)
    expect(box('built').length).toBeLessThanOrEqual(1500)
  })
})
