// Counts everything this page sends off the device: the body of every fetch, XMLHttpRequest and
// beacon, and every WebSocket message. Downloads (the app's files and the speech model) are plain
// GET requests with no body, so they add nothing. Installed before the app starts, so it sees every
// request the app's own code makes. It cannot see the browser's own speech service, which records
// audio inside the browser itself when a person turns it on; the page says so where it shows the count.

export interface Sent { bytes: number; uploads: number }

const sent: Sent = { bytes: 0, uploads: 0 }
const listeners = new Set<(s: Sent) => void>()

function sizeOf(body: unknown): number | null {
  if (body === undefined || body === null) return 0
  if (typeof body === 'string') return new TextEncoder().encode(body).length
  if (body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer) return body.byteLength
  if (ArrayBuffer.isView(body)) return body.byteLength
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString()).length
  if (body instanceof FormData) {
    let n = 0
    body.forEach((v) => { n += typeof v === 'string' ? new TextEncoder().encode(v).length : v.size })
    return n
  }
  return null
}

function add(body: unknown, method = 'POST') {
  const n = sizeOf(body)
  // A request with a body of unknown size (a stream) still counts as an upload.
  if (n === 0 && method.toUpperCase() !== 'POST' && method.toUpperCase() !== 'PUT' && method.toUpperCase() !== 'PATCH') return
  sent.uploads += 1
  sent.bytes += n ?? 0
  for (const f of listeners) f({ ...sent })
}

export function installMeter() {
  const w = window as unknown as { __sentMeter?: boolean }
  if (w.__sentMeter) return
  w.__sentMeter = true
  const origFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    if (init?.body !== undefined && init.body !== null) add(init.body, method)
    else if (input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD') add(null, input.method)
    else if (method !== 'GET' && method !== 'HEAD') add(null, method)
    return origFetch(input, init)
  }
  const xhrOpen = XMLHttpRequest.prototype.open
  const xhrSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest & { __m?: string }, method: string, ...rest: unknown[]) {
    this.__m = method
    return (xhrOpen as (...a: unknown[]) => void).call(this, method, ...rest)
  } as typeof XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.send = function (this: XMLHttpRequest & { __m?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
    const m = (this.__m ?? 'GET').toUpperCase()
    if ((body !== undefined && body !== null) || (m !== 'GET' && m !== 'HEAD')) add(body, m)
    return (xhrSend as (b?: unknown) => void).call(this, body)
  }
  if (navigator.sendBeacon) {
    const beacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => { add(data ?? '', 'POST'); return beacon(url, data) }
  }
  const wsSend = WebSocket.prototype.send
  WebSocket.prototype.send = function (this: WebSocket, data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    add(data, 'POST')
    return (wsSend as (d: unknown) => void).call(this, data)
  }
}

export function sentSoFar(): Sent {
  return { ...sent }
}

export function onSent(f: (s: Sent) => void): () => void {
  listeners.add(f)
  return () => { listeners.delete(f) }
}
