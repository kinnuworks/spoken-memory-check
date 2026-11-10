import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <>
      <h1>A memory check you speak, tracked against yourself.</h1>
      <p>Four minutes at home, by voice, in Gulf Arabic or English. Nothing to read or type. It fills the time between clinic memory tests and tells a physician only when a change lasts.</p>
      <div className="stack">
        <Link className="btn primary" to="/try">Try it with your voice (30 seconds)</Link>
        <Link className="btn" to="/year">See a year of checks (no microphone)</Link>
        <Link className="btn" to="/clinician">Go to the physician's view</Link>
      </div>
      <p className="muted">No sign-up. The histories and patients shown are synthetic and labelled. This prototype does not diagnose.</p>
    </>
  )
}
