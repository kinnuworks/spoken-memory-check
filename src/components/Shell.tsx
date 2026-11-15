import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Waves } from './Icons'

const LINKS: [string, string][] = [['/story', 'One case'], ['/year', 'A year of checks'], ['/benchmark', 'Evidence'], ['/how', 'How it works']]

export function Nav() {
  const { pathname } = useLocation()
  return (
    <header className={`dnav${pathname === '/' ? ' dnav--home' : ''}`}>
      <div className="dnav__in">
        <Link to="/" className="dnav__brand"><span className="d-mark" aria-hidden="true"><Waves /></span>Spoken memory check</Link>
        <nav className="dnav__links" aria-label="Main">{LINKS.map(([to, l]) => <NavLink key={to} to={to}>{l}</NavLink>)}</nav>
        <div className="dnav__end">
          <Link to="/clinician" className="dnav__signin">Physician's view</Link>
          <Link to="/recorded" className="dnav__btn"><span className="dnav__wide">Play a recorded check</span><span className="dnav__narrow">Recorded check</span></Link>
        </div>
      </div>
    </header>
  )
}

const FOOT: [string, [string, string][]][] = [
  ['The check', [['/try', 'Try it with your voice'], ['/recorded', 'Recorded check'], ['/check', 'Full four-minute check'], ['/hearing', 'Hearing check']]],
  ['For physicians', [['/clinician', "Physician's view"], ['/story', 'One case, both screens'], ['/year', 'A year of checks'], ['/programme', 'Programme view']]],
  ['Evidence', [['/benchmark', 'How the flag was tested'], ['/rescore', 'Blind re-scoring'], ['/me/decline', 'What the person sees'], ['/how', 'What is real']]],
]

export function Footer() {
  return (
    <footer className="dfoot">
      <div className="dfoot__cta">
        <div><h2>Four minutes, by voice. Try it now.</h2><p>Gulf Arabic or English, at home, compared with your own earlier checks.</p></div>
        <p className="dfoot__btns"><Link to="/try" className="dfoot__btn">Try it with your voice</Link><Link to="/year" className="dfoot__btn dfoot__btn--ghost">See a year of checks</Link></p>
      </div>
      <div className="dfoot__in">
        <div className="dfoot__brand"><span className="d-mark" aria-hidden="true"><Waves /></span>Spoken memory check</div>
        {FOOT.map(([h, items]) => (
          <nav key={h} aria-label={h}><p>{h}</p>{items.map(([to, l]) => <Link key={to} to={to}>{l}</Link>)}</nav>
        ))}
      </div>
      <p className="dfoot__small">Prototype for Statement 8, Protecting Brain Health Earlier. People shown are synthetic. It does not diagnose.</p>
    </footer>
  )
}

/** Each new screen starts at the top. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
