#!/usr/bin/env bash
# Builds the app and deploys only the built files to Vercel.
# Source files never leave this machine; only dist/ is uploaded.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build

out="${DEPLOY_DIR:-$(mktemp -d)}"
rm -rf "$out/site"
mkdir -p "$out/site"
cp -R dist/. "$out/site/"

# Cross-origin isolation lets the on-device speech model use several threads.
cat > "$out/site/vercel.json" <<'JSON'
{
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
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
JSON

cd "$out/site"
vercel deploy --prod --yes --name "${VERCEL_PROJECT:-spoken-memory-check}"
