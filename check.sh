#!/usr/bin/env bash
# The checks that prove this project works. The Stop hook runs this file whenever the
# session tries to finish, and sends it back to work while anything here fails. Keep it
# to a few minutes, and never make a check pass by skipping, weakening or special-casing it.
set -euo pipefail
cd "$(dirname "$0")"

echo "== types"
npx tsc -b

echo "== lint"
npx oxlint src

echo "== unit and rule tests"
npx vitest run src

# The rule's nine safety promises on a million random histories (about 20 s).
SAFETY_NO_WRITE=1 npx tsx scripts/safety-check.ts 1000000

# Evidence labels: once evidence/EVAL_PLAN.md exists, the public text (README, submission text,
# video script) must label every evidence claim for its kind.
if [ -f evidence/EVAL_PLAN.md ] && [ -f evidence_lint.py ]; then
  echo "== evidence labels"
  python3 -I evidence_lint.py
fi

# The demo path in a real browser against the live site, as a judge meets it: every
# screen, consent, the recorded check scored on the device in English and Arabic, and a
# packet to a closed referral with the HL7 and FHIR files. It also records a screen video
# of the run into output/demo-path/ (the rough cut; output/ is never committed).
echo "== demo path on the live site"
mkdir -p output/demo-path
LIVE_CHECK_NO_WRITE=1 LIVE_CHECK_VIDEO=output/demo-path npx tsx scripts/live-check.ts

# The microphone path: "Try it with your voice" on the live site with a computer voice fed in as
# Chromium's microphone, plus a control with silence (English here; the Arabic run downloads the
# larger model and is run on its own: npx tsx scripts/mic-check.ts).
echo "== microphone path on the live site"
MIC_CHECK_NO_WRITE=1 npx tsx scripts/mic-check.ts https://spoken-memory-check.vercel.app en
