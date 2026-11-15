import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
// Fonts are served from this site (OFL-1.1), so no visitor request goes to a font CDN.
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
// Fonts for the three design directions being compared (Letters, Voicenotes, Cal.com).
import '@fontsource/open-runde/400.css'
import '@fontsource/open-runde/500.css'
import '@fontsource/open-runde/600.css'
import '@fontsource-variable/literata'
import '@fontsource-variable/inter'
import '@fontsource/cal-sans/400.css'
import '@fontsource-variable/instrument-sans'
import './index.css'
import './styles/design/base.css'
import './styles/design/components.css'
import App from './App.tsx'
import './styles/design/directions.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
