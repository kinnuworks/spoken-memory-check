// Our own analysis of NHANES 2011 to 2014 (US CDC, public domain), adults 60 and over.
export default function SurveyChart() {
  const rows = [
    { label: 'Under 9 years of school', pct: 48, n: 265 },
    { label: 'College graduates', pct: 16, n: 569 },
  ]
  return (
    <div className="card">
      <h3>Why one score is unfair</h3>
      <p>Share of adults with no memory complaint who fall below a common cutoff of 14 animals in a minute:</p>
      {rows.map((r) => (
        <div className="barrow" key={r.label}>
          <span>{r.label}</span>
          <div><div className="bar" style={{ width: `${r.pct}%` }} /></div>
          <strong>{r.pct}%</strong>
        </div>
      ))}
      <p className="muted">Our analysis of a public US health survey (NHANES 2011 to 2014), adults 60 and over who reported no worsening memory and no difficulty managing money: 265 with under 9 years of school, 569 graduates. US data, not Gulf. Adjusting the cutoff for schooling evens this out but misses more real cases, so this check compares each person with their own earlier scores.</p>
    </div>
  )
}
