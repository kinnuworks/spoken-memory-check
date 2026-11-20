// Serves the built site and the speech-token function from one Node process, with no Vercel
// and no packages, so it can run on a server or container in a UAE region.
// Usage: npm run build && PORT=8080 SITE_ORIGIN=https://your.host node deploy/uae/server.mjs
// Optional: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (uaenorth) turn on the UAE listener.
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tokenHandler from '../../api/speech-token.js'

const ROOT = resolve(fileURLToPath(new URL('../../dist', import.meta.url)))
const PORT = Number(process.env.PORT ?? 8080)
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.onnx': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
}
// The same headers the hosted site sends (scripts/deploy.sh).
const HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()',
}

async function api(req, res) {
  let body = ''
  for await (const chunk of req) body += chunk
  req.body = body
  const out = {
    status(code) { res.statusCode = code; return out },
    setHeader(k, v) { res.setHeader(k, v); return out },
    json(obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return out },
  }
  await tokenHandler(req, out)
}

createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v)
  const url = new URL(req.url ?? '/', 'http://local')
  if (url.pathname === '/api/speech-token') return api(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end() }
  let path = normalize(join(ROOT, decodeURIComponent(url.pathname)))
  if (!path.startsWith(ROOT)) { res.statusCode = 403; return res.end() }
  try { if (statSync(path).isDirectory()) path = join(path, 'index.html') } catch { path = join(ROOT, 'index.html') }
  let size
  try { size = statSync(path).size } catch { res.statusCode = 404; return res.end('not found') }
  res.setHeader('Content-Type', TYPES[extname(path)] ?? 'application/octet-stream')
  res.setHeader('Content-Length', size)
  if (url.pathname.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  else if (url.pathname.startsWith('/models/')) res.setHeader('Cache-Control', 'public, max-age=604800')
  if (req.method === 'HEAD') return res.end()
  createReadStream(path).pipe(res)
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`))
