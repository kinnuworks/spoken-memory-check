#!/usr/bin/env bash
# Runs the tests and writes the passing count to src/data/tests.json and the README,
# so the number shown never drifts from the real one. Fails if any test fails.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp)
npx vitest run --reporter=json --outputFile="$tmp" >/dev/null
node -e '
const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (r.numFailedTests > 0) { console.error(r.numFailedTests + " tests failed"); process.exit(1) }
const n = r.numPassedTests;
require("fs").writeFileSync("src/data/tests.json", JSON.stringify({ passed: n, date: new Date().toISOString().slice(0, 10) }) + "\n");
for (const f of ["README.md", "docs/JUDGES.md", "docs/DECK_CONTENT.md"]) {
  const s = require("fs").readFileSync(f, "utf8").replace(/\b\d+ automated tests\b/g, n + " automated tests");
  require("fs").writeFileSync(f, s);
}
console.log(n + " tests passed");
' "$tmp"
rm -f "$tmp"
