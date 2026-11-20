import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { onSent, sentSoFar } from '../privacy/meter'

/** What this page has sent off the device since it opened, counted as it happens. */
export default function SentMeter({ browserOn = false }: { browserOn?: boolean }) {
  const [s, setS] = useState(sentSoFar())
  useEffect(() => onSent(setS), [])
  const none = s.bytes === 0 && s.uploads === 0
  return (
    <p className={`note sent-meter${none ? ' is-zero' : ''}`} data-sent-bytes={s.bytes} data-sent-uploads={s.uploads}>
      <strong>Sent from this device since this page opened: {s.bytes.toLocaleString('en')} bytes{s.uploads ? ` in ${s.uploads} upload${s.uploads === 1 ? '' : 's'}` : ''}.</strong>{' '}
      {none ? 'Your voice stayed here. Only the app and the speech model were downloaded.' : 'Something was sent: the count includes every upload this page made.'}
      {browserOn ? " The browser's own speech service, which you turned on, records audio inside the browser, where this count cannot see it." : ''}{' '}
      <Link to="/benchmark#privacy">How this is checked</Link>
    </p>
  )
}
