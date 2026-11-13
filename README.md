# Spoken memory check

A four-minute memory check that an adult does at home by voice, in Gulf Arabic or English, compared with their own earlier scores. A physician hears about it only after two low checks in a row, and results are given in person.

Why speech: many older adults in the Gulf had little schooling, and a test that needs reading, typing or tapping is unfair to them. Saying words back and naming animals is how memory has been tested by phone for decades.

A prototype for Abu Dhabi's adult screening programme, built for Statement 8 of the Future Health challenge, "Protecting Brain Health Earlier". It does not diagnose. The people and histories in the demo are synthetic and labelled.

## For judges: what is measured

| | |
|---|---|
| Arabic words heard right | 93% of 720 real single words from 30 adults, with the speaker's own voice as the answer key (82% for the on-device model alone; 40% before tuning). Read words, no older or Gulf speakers yet. `docs/TEMPLATE_BENCH.md` |
| Where it fits | The memory step of Thiqa's "Comprehensive hearing and dementia screening" packages 52-45 and 52-46 (IFHAS 3.0, Addendum 06), which name no memory tool. `docs/COMMERCIAL.md` |
| Hand-off | FHIR R4 with 0 errors from the official HL7 validator 7.0.5; referral as the HL7 v2 REF message with SNOMED specialty that Malaffi asks for (Circular 2026/144). `docs/FHIR_VALIDATION.md` |
| Fairness | Real US survey data: a fixed animal cutoff flags 48% of healthy adults with under 9 years of school against 16% of graduates. `analysis/` |
| Safety rule | Simulated: 3.4% false alarms a year; 85% of people losing 2 points a check flagged within the year. `scripts/benchmark.ts` |
| Quality | 105 automated tests; 0 accessibility violations in 48 axe checks. `docs/ACCESSIBILITY.md` |
| Rules | Compliance map, intended use, risk register. `docs/COMPLIANCE.md`, `docs/INTENDED_USE.md`, `docs/RISK_REGISTER.md` |

## Try it in 30 seconds

Live: https://spoken-memory-check.vercel.app (no sign-up)

1. Open the page in Chrome and choose "Try it with your voice": say three words, then name animals for 20 seconds.
2. No microphone? Choose "Play a recorded check".
3. Choose "A year of checks", then open the physician's packet and approve it through to a closed referral.

To run it yourself: `npm install`, then `npm run dev`. To redeploy: `scripts/deploy.sh` (uploads only the built files).

## What it does

- **Three listeners.** The browser's recogniser and an open speech model running on the device hear the same speech, and word recall is also matched against the person's own voice from when they said each word back. A word heard by two is confirmed, so every score is a range.
- **Compared with yourself.** The first three checks set a baseline. A later check counts as low only after the expected practice gain and the measurement error are taken into account, and a flag needs two low checks in a row.
- **Three other routes.** A reported change in everyday tasks goes to the physician whatever the score. A failed sound check holds the check instead of scoring it low. A very large fall sends the person to urgent assessment.
- **A physician decides.** The ordering physician approves, edits or dismisses a packet: the trajectory, treatable contributors first, and the risk factors the screening record already holds. After approval the app only invites the person to a visit.
- **Nobody lost.** The referral is tracked to closure against a 15-working-day target, and a programme view counts every member by facility.
- **Hearing first.** A three-minute digits-in-noise hearing check, answered by tapping, runs before the memory check. A fail becomes an audiology referral, and a weekly one-tap question tracks whether the hearing aid is worn.
- **People check the machine.** One recorded check in ten is scored again by a person who cannot see the machine's result, and agreement is tracked by language.
- **Lost signals.** The programme view lists every abnormal brain-relevant screening result with no recorded action by its target date (simulated year).
- **No language model anywhere.** Fixed rules in code make every decision.

## Evidence

- Real data: in a public US health survey (NHANES 2011 to 2014, 3,110 adults aged 60 and over), a fixed cutoff of 14 animals flags 48% of adults with under 9 years of school who report no memory problem, against 16% of graduates. `analysis/`
- Simulation of the flag: 3.4% false alarms a year in stable people; 85% of members losing two points a check are flagged within the year; at an assumed 2% of members in real decline, about 50 packets per 1,000 members a year, 17 of them real. Same settings throughout. `npx tsx scripts/benchmark.ts`
- Real recordings: on 720 real single Arabic words from 30 adults, the first on-device model heard 40%; an Arabic-tuned model with near-miss matching heard 82%; adding each speaker's own voice as the answer key raised it to 93% (speaker interval 91 to 95%), with 0.8% wrong words credited. English: 62% of 387 words. Public adult datasets, read words, not older or Gulf speakers. `docs/HUMAN_SPEECH_BENCH.md`, `docs/TEMPLATE_BENCH.md`
- 105 automated tests: `npm test`. Cases listed in `docs/TESTED_CASES.md`.

## Documents

- `docs/JUDGES.md`: where to find the evidence for each criterion
- `docs/LIMITS.md`: assumptions, dependencies and limits
- `docs/PILOT.md`: pilot design, size, costs, stop rules, stages
- `docs/SAFETY_CASE.md`: hazard log
- `docs/DATA_SOURCES.md`: every data source and the right to use it
- `docs/SCORING_RULES.md`: how animal naming is scored
