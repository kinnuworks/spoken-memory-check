// Issues a short-lived token for the speech service in the UAE North region, so the browser can
// stream audio straight to that region. No audio passes through this function, and the service
// key never reaches the browser. Off until AZURE_SPEECH_KEY is set.
const REGION = process.env.AZURE_SPEECH_REGION || 'uaenorth'
// Tokens go only to this site's own pages, so another site can't spend the speech quota.
const OWN = /^(https:\/\/spoken-memory-check(-[a-z0-9-]+)?\.vercel\.app|http:\/\/localhost(:\d+)?)$/
// A self-hosted copy (deploy/uae) names its own address here.
const isOwn = (origin) => OWN.test(origin) || (!!process.env.SITE_ORIGIN && origin === process.env.SITE_ORIGIN)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const key = process.env.AZURE_SPEECH_KEY
  if (!key) return res.status(200).json({ available: false, region: REGION })
  if (req.method === 'GET') return res.status(200).json({ available: true, region: REGION })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  if (!isOwn(req.headers.origin || '')) return res.status(403).json({ error: 'not this site' })
  try {
    const r = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' } })
    if (!r.ok) return res.status(502).json({ error: `token service ${r.status}` })
    return res.status(200).json({ token: await r.text(), region: REGION })
  } catch {
    return res.status(502).json({ error: 'token service unreachable' })
  }
}
