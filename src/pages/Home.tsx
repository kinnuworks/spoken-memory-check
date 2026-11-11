import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <>
      <h1>A memory check you speak, tracked against yourself.</h1>
      <p>Four minutes at home, by voice, in Gulf Arabic or English. Nothing to read or type. It fills the time between clinic memory tests and tells a physician only when a change lasts.</p>
      <div className="stack">
        <Link className="btn primary" to="/try">Try it with your voice (30 seconds)</Link>
        <Link className="btn" to="/recorded">Play a recorded check (no microphone)</Link>
        <Link className="btn" to="/clinician">Go to the physician's view</Link>
      </div>
      <p><Link to="/check">Take the full four-minute check</Link> · <Link to="/year">A year of checks</Link> · <Link to="/me/decline">What the person sees</Link> · <Link to="/benchmark">How the flag was tested</Link> · <Link to="/programme">Programme view</Link> · <Link to="/how">How it works, and what is real</Link></p>
      <p className="muted">No sign-up. The histories and patients shown are synthetic and labelled. This prototype does not diagnose.</p>
    </>
  )
}
