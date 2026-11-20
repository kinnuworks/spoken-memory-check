// Copies ONNX Runtime's WebAssembly files into public/ort/, so the on-device speech model runs
// on files served by this site instead of a public CDN (cdn.jsdelivr.net, the library's default).
import { copyFileSync, mkdirSync } from 'node:fs'
mkdirSync('public/ort', { recursive: true })
for (const f of ['ort-wasm-simd-threaded.asyncify.wasm', 'ort-wasm-simd-threaded.asyncify.mjs']) copyFileSync(`node_modules/onnxruntime-web/dist/${f}`, `public/ort/${f}`)
