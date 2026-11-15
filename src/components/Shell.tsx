import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Mic, Waves } from './Icons'
import { direction, type Dir } from './direction'

import { ICON } from './brand'

export function Nav() {
  const dir = direction()
  if (dir) return <DirNav dir={dir} />
  return (
    <header className="nav">
      <div className="nav__bar">
        <Link to="/" className="nav__brand"><img className="app-icon" src={ICON} alt="" />Spoken memory check</Link>
        <nav className="nav__links" aria-label="Main">
          <NavLink to="/story">One case</NavLink>
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

/** The header in each design direction, slot for slot with its reference. */
function DirNav({ dir }: { dir: Dir }) {
  const { pathname } = useLocation()
  const links: [string, string][] =
    dir === 'b' ? [['/story', 'One case'], ['/benchmark', 'Evidence'], ['/how', 'How it works']]
    : [['/story', 'One case'], ['/year', 'A year of checks'], ['/benchmark', 'Evidence'], ['/how', 'How it works']]
  return (
    <header className={`dnav dnav--${dir}${pathname === '/' ? ' dnav--home' : ''}`}>
      <div className="dnav__in">
        <Link to="/" className="dnav__brand"><span className="d-mark" aria-hidden="true"><Waves /></span>Spoken memory check</Link>
        <nav className="dnav__links" aria-label="Main">{links.map(([to, l]) => <NavLink key={to} to={to}>{l}</NavLink>)}</nav>
        <div className="dnav__end">
          <Link to="/clinician" className="dnav__signin">Physician's view</Link>
          <Link to="/recorded" className="dnav__btn"><span className="dnav__wide">Play a recorded check</span><span className="dnav__narrow">Recorded check</span></Link>
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  const dir = direction()
  if (dir) return <DirFooter dir={dir} />
  return (
    <footer className="footer">
      <div className="container">
        <span className="brand"><img className="app-icon" src={ICON} alt="" />Spoken memory check</span>
        <nav aria-label="More">
          <Link to="/check">Full four-minute check</Link>
          <Link to="/hearing">Hearing check</Link>
          <Link to="/rescore">Blind re-scoring</Link>
          <Link to="/me/decline">What the person sees</Link>
          <Link to="/programme">Programme view</Link>
          <Link to="/how">What is real</Link>
        </nav>
        <span>Prototype for Statement 8, Protecting Brain Health Earlier. People shown are synthetic. It does not diagnose.</span>
      </div>
    </footer>
  )
}

const FOOT: [string, [string, string][]][] = [
  ['The check', [['/try', 'Try it with your voice'], ['/recorded', 'Recorded check'], ['/check', 'Full four-minute check'], ['/hearing', 'Hearing check']]],
  ['For physicians', [['/clinician', "Physician's view"], ['/story', 'One case, both screens'], ['/year', 'A year of checks'], ['/programme', 'Programme view']]],
  ['Evidence', [['/benchmark', 'How the flag was tested'], ['/rescore', 'Blind re-scoring'], ['/me/decline', 'What the person sees'], ['/how', 'What is real']]],
]

function DirFooter({ dir }: { dir: Dir }) {
  return (
    <footer className={`dfoot dfoot--${dir}`}>
      {dir === 'c' && (
        <div className="dfoot__cta">
          <div><h2>Four minutes, by voice. Try it now.</h2><p>Gulf Arabic or English, at home, compared with your own earlier checks.</p></div>
          <p className="dfoot__btns"><Link to="/try" className="dfoot__btn">Try it with your voice</Link><Link to="/year" className="dfoot__btn dfoot__btn--ghost">See a year of checks</Link></p>
        </div>
      )}
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
