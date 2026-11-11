import { Outlet, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Try from './pages/Try'
import Year from './pages/Year'
import Clinician from './pages/Clinician'
import Check from './pages/Check'
import Benchmark from './pages/Benchmark'
import Person from './pages/Person'
import Recorded from './pages/Recorded'
import Programme from './pages/Programme'
import How from './pages/How'
import { Footer, Nav, ScrollToTop } from './components/Shell'

function Page() {
  return <main className="page"><Outlet /></main>
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<Page />}>
          <Route path="/try" element={<Try />} />
          <Route path="/year" element={<Year />} />
          <Route path="/year/:id" element={<Year />} />
          <Route path="/clinician" element={<Clinician />} />
          <Route path="/clinician/:id" element={<Clinician />} />
          <Route path="/check" element={<Check />} />
          <Route path="/benchmark" element={<Benchmark />} />
          <Route path="/recorded" element={<Recorded />} />
          <Route path="/programme" element={<Programme />} />
          <Route path="/how" element={<How />} />
          <Route path="/me" element={<Person />} />
          <Route path="/me/:id" element={<Person />} />
        </Route>
      </Routes>
      <Footer />
    </>
  )
}
