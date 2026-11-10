import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Try from './pages/Try'
import Year from './pages/Year'
import Clinician from './pages/Clinician'
import Check from './pages/Check'
import Benchmark from './pages/Benchmark'

export default function App() {
  return (
    <>
      <header className="top">
        <Link to="/">Spoken memory check</Link>
        <span className="tag">Prototype. Not a diagnosis.</span>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/try" element={<Try />} />
          <Route path="/year" element={<Year />} />
          <Route path="/year/:id" element={<Year />} />
          <Route path="/clinician" element={<Clinician />} />
          <Route path="/check" element={<Check />} />
          <Route path="/benchmark" element={<Benchmark />} />
        </Routes>
      </main>
    </>
  )
}
