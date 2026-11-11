# Spoken memory check

A four-minute memory check that an adult does at home by voice, in Gulf Arabic or English, compared with their own earlier scores. A physician hears about it only when a change lasts, and results are given in person.

Why speech: many older adults in the Gulf had little schooling, and a test that needs reading, typing or tapping is unfair to them. Saying words back and naming animals is how memory has been tested by phone for decades.

Prototype for Statement 8, Protecting Brain Health Earlier. It does not diagnose. The people and histories in the demo are synthetic and labelled.

## Try it in 30 seconds

Live: https://spoken-memory-check.vercel.app (no sign-up)

1. Open the page in Chrome and choose "Try it with your voice": say three words, then name animals for 20 seconds.
2. No microphone? Choose "Play a recorded check".
3. Choose "A year of checks", then open the physician's packet and approve it through to a closed referral.

To run it yourself: `npm install`, then `npm run dev`. To redeploy: `scripts/deploy.sh` (uploads only the built files).

## What it does

- **Two listeners.** The browser's recogniser and an open speech model running on the device hear the same speech. Each word is marked heard by both, one or neither, so every score is a range.
- **Compared with yourself.** The first three checks set a baseline. A later check counts as low only after the expected practice gain and the measurement error are taken into account, and a flag needs two low checks in a row.
- **Three other routes.** A reported change in everyday tasks goes to the physician whatever the score. A failed sound check holds the check instead of scoring it low. A very large fall sends the person to urgent assessment.
- **A physician decides.** The ordering physician approves, edits or dismisses a packet: the trajectory, treatable contributors first, and the risk factors the screening record already holds. After approval the app only invites the person to a visit.
- **Nobody lost.** The referral is tracked to closure against a 15-working-day target, and a programme view counts every member by facility.
- **No language model anywhere.** Fixed rules in code make every decision.

## Evidence

- Real data: in a public US health survey (NHANES 2011 to 2014, 3,110 adults aged 60 and over), a fixed cutoff of 14 animals flags 48% of adults with under 9 years of school who report no memory problem, against 16% of graduates. `analysis/`
- Simulation of the flag: 3.4% false alarms a year in stable people; 85% of members losing two points a check are flagged within the year; at an assumed 2% of members in real decline, about 50 packets per 1,000 members a year, 17 of them real. Same settings throughout. `npx tsx scripts/benchmark.ts`
- 54 automated tests: `npm test`. Cases listed in `docs/TESTED_CASES.md`.

## Documents

- `docs/JUDGES.md`: where to find the evidence for each criterion
- `docs/LIMITS.md`: assumptions, dependencies and limits
- `docs/PILOT.md`: pilot design, size, costs, stop rules, stages
- `docs/SAFETY_CASE.md`: hazard log
- `docs/DATA_SOURCES.md`: every data source and the right to use it
- `docs/SCORING_RULES.md`: how animal naming is scored
