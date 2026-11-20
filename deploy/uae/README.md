# Hosting it in the UAE

The live demo runs on Vercel, outside the UAE. No health data reaches that server: scoring runs on the person's device, and scores stay in the browser. A pilot would still host the site in the UAE, so this folder runs the whole thing from one Node process with no Vercel and no packages.

## What it serves
- The built site (`dist/`), including the Arabic speech model, with the same security headers as the hosted site (cross-origin isolation for the on-device model, no framing, microphone for this site only).
- `api/speech-token.js`, unchanged: it hands the browser a short-lived token for Azure AI Speech in UAE North when `AZURE_SPEECH_KEY` is set, and answers "not available" when it isn't. No audio passes through it.

## Run it
```bash
npm ci && npm run build
PORT=8080 SITE_ORIGIN=https://your.host node deploy/uae/server.mjs
```
`SITE_ORIGIN` is the address people open; the token function serves only that origin. Optional: `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION=uaenorth`.

The `Dockerfile` here packs the same thing into one container, for example for Azure Container Apps in UAE North. It is not built by this repo's checks.

## Checked
On 20 Nov 2026 the demo-path check (`scripts/live-check.ts`) ran against this server on a laptop (`http://localhost:4391`): 5 of 5 steps passed. Every screen opened without an error; the full check stayed locked until consent; the recorded checks scored on the device in English (26 of 27 words heard) and Arabic (24 to 27 of 27); the packet reached a closed referral with the HL7 v2 message and the FHIR bundle.

To repeat it:
```bash
PORT=4391 node deploy/uae/server.mjs &
LIVE_CHECK_NO_WRITE=1 npx tsx scripts/live-check.ts http://localhost:4391
```

## What still leaves the device
- The English speech model downloads once from huggingface.co, falling back to this site's own copy. A UAE deployment can point the English host in `src/speech/whisper.worker.ts` at its own copy so nothing comes from outside.
- With the person's opt-in and a key set, up to three recordings per check go to Azure UAE North for the second listener, and are not kept there.
- Nothing else. There is no analytics or font service.
