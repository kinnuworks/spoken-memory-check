#!/usr/bin/env bash
# Builds the app and deploys the built files plus the api/ function to Vercel.
# Other source files never leave this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/count-tests.sh
npm run build

# The Arabic speech model is served from this site (built by scripts/build-arabic-model.sh, not in git).
test -s dist/models/whisper-small-ar-q4emb/onnx/decoder_model_merged_q4.onnx || { echo "Arabic model missing: run scripts/build-arabic-model.sh"; exit 1; }
# English loads from huggingface.co, with this site's unchanged copy as the fallback (scripts/build-english-model.sh).
test -s dist/models/whisper-base/onnx/decoder_model_merged_quantized.onnx || { echo "English model copy missing: run scripts/build-english-model.sh"; exit 1; }

out="${DEPLOY_DIR:-$(mktemp -d)}"
rm -rf "$out/site"
mkdir -p "$out/site"
cp -R dist/. "$out/site/"
# The token function for the optional UAE speech listener (no audio passes through it).
mkdir -p "$out/site/api"
cp api/*.js "$out/site/api/"
echo '{ "private": true, "type": "module" }' > "$out/site/package.json"

# Cross-origin isolation lets the on-device speech model use several threads.
# The one server function (the speech token) runs in Vercel's Dubai region, dxb1.
cat > "$out/site/vercel.json" <<'JSON'
{
  "regions": ["dxb1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "Permissions-Policy", "value": "microphone=(self), camera=(), geolocation=()" }
      ]
    },
    {
      "source": "/models/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800" }]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
JSON

cd "$out/site"
vercel deploy --prod --yes --name "${VERCEL_PROJECT:-spoken-memory-check}"

# Run the live site end to end in a headless browser, and say loudly if anything broke.
cd - >/dev/null
npx tsx scripts/live-check.ts || { echo "LIVE CHECK FAILED: the deployed site did not pass end to end"; exit 1; }
