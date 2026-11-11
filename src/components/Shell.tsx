import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Mic } from './Icons'

import { ICON } from './brand'

export function Nav() {
  return (
    <header className="nav">
      <div className="nav__bar">
        <Link to="/" className="nav__brand"><img className="app-icon" src={ICON} alt="" />Spoken memory check</Link>
        <nav className="nav__links" aria-label="Main">
          <NavLink to="/year">A year of checks</NavLink>
          <NavLink to="/clinician">Physician's view</NavLink>
          <NavLink to="/benchmark">Evidence</NavLink>
          <NavLink to="/how">How it works</NavLink>
        </nav>
        <Link to="/try" className="btn btn-ink btn-sm"><Mic />Try it</Link>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <span className="brand"><img className="app-icon" src={ICON} alt="" />Spoken memory check</span>
        <nav aria-label="More">
          <Link to="/check">Full four-minute check</Link>
          <Link to="/me/decline">What the person sees</Link>
          <Link to="/programme">Programme view</Link>
          <Link to="/how">What is real</Link>
        </nav>
        <span>Prototype for Statement 8, Protecting Brain Health Earlier. People shown are synthetic. It does not diagnose.</span>
      </div>
    </footer>
  )
}

/** Each new screen starts at the top. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
