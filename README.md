# Spoken memory check

A four-minute memory check that an adult does at home by voice, in Gulf Arabic or English, compared with their own earlier scores. A physician hears about it only after two low checks in a row, and results are given in person.

Why speech: many older adults in the Gulf had little schooling, and a test that needs reading, typing or tapping is unfair to them. Saying words back and naming animals is how memory has been tested by phone for decades.

A prototype for Abu Dhabi's adult screening programme, built for Statement 8 of the Future Health challenge, "Protecting Brain Health Earlier". It does not diagnose. The people and histories in the demo are synthetic and labelled.

## For judges: what is measured

| | |
|---|---|
| Arabic words heard right | On the device: 93% of 720 real single words from 30 adults, with the speaker's own voice as the answer key (82% for the on-device model alone; 40% before tuning). Lab test of MBZUAI and Inception's Jais-ASR: 97.1% alone, 99.2% with own voice, as a proposed optional UAE-hosted listener. Read words from adult volunteers of unstated age. `docs/TEMPLATE_BENCH.md`, `docs/JAIS_ASR_BENCH.md` |
| Older speakers | Measured on public data, not yet on volunteers: on Saudi TV speech labelled by age and dialect (SADA, 83 older and 200 adult Gulf clips), word error was 31% for older against 33% for adult Gulf speakers with Jais-ASR, and 68% against 75% with the on-device model. Neither listener heard older Gulf voices worse. `docs/OLDER_SPEAKERS_BENCH.md` |
| Where it fits | The memory step of Thiqa's "Comprehensive hearing and dementia screening" packages 52-45 and 52-46 (IFHAS 3.0, Addendum 06), which name no memory tool. `docs/COMMERCIAL.md` |
| Hand-off | FHIR R4 with 0 errors from the official HL7 validator 7.0.5; referral as the HL7 v2 REF message with SNOMED specialty that Malaffi asks for (Circular 2026/144). `docs/FHIR_VALIDATION.md` |
| Fairness | Real US survey data: a fixed animal cutoff flags 48% of healthy adults with under 9 years of school against 16% of graduates. `analysis/`. In the Gulf, the usual MoCA cut-off classed 69.3% of 606 older adults in Dubai and Sharjah as impaired (Issa et al. 2026). Simulated: among stable people who start in the lowest fifth, one cut-off for everyone falsely flags 69% in a year and this rule 1.7%. |
| Validation | The statement's seven measures (completion, retest, sensitivity, specificity, meaningful change, false referrals, time to assessment) by language, age and schooling, each marked measured, simulated or not yet, on the Evidence page. |
| Flag rule | Simulated: two routes (two low checks in a row, and a steady slow fall). 4.9% false alarms a year; flagged within the year: 45% of people losing 1 point a check, 94% losing 2. `scripts/benchmark.ts` |
| Quality | 232 automated tests run every line of the decision code (650 of 650) and catch 92% of 897 deliberate bugs put into the rules (mutation testing). After each deploy a headless browser runs the live site end to end: every screen, the consent lock, both recorded checks scored on the device and checked word by word against what the voice said, and a packet to a closed referral (5 of 5 steps passed). 0 accessibility violations in 48 axe checks. `scripts/live-check.ts`, `docs/ACCESSIBILITY.md` |
| Safety | The person is never shown a score. Family history and genome results reach the physician only with their own consent, as context the rule never reads. A physician approves every routine packet before the person is contacted, and results are given in person; only a very large fall sends the person straight to urgent care. A missed or unheard check is never counted as low. The full check stays locked until the person agrees. Every person-facing screen reads at grade 4 or under (English). No language model makes any decision. `docs/SAFETY_CASE.md`, `docs/COMPLIANCE.md` |
| Who pays | Thiqa's screening packages 52-45 and 52-46. Modelled running cost: about AED 26 per eligible member a year at 40% uptake. No partner has agreed yet. `docs/COMMERCIAL.md` |
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
- Simulation of the flag: 4.9% false alarms a year in stable people (3.4% with the two-in-a-row route alone); flagged within the year: 45% of members losing one point a check and 94% losing two; at an assumed 2% of members in real decline, about 65 packets per 1,000 members a year, 18 of them real. Same settings throughout. `npx tsx scripts/benchmark.ts`
- Real recordings: on 720 real single Arabic words from 30 adults, the first on-device model heard 40%; an Arabic-tuned model with near-miss matching heard 82%; adding each speaker's own voice as the answer key raised it to 93% (speaker interval 91 to 95%), with 0.8% wrong words credited. English: 62% of 387 words. Public adult datasets, read words, not older or Gulf speakers. `docs/HUMAN_SPEECH_BENCH.md`, `docs/TEMPLATE_BENCH.md`
- Smaller Arabic model: the decoder's word table stored at 4 bits cuts the Arabic download from 299 MB to 165 MB, served from this site, with no loss on the 720 real clips (83% against 82%). `docs/HUMAN_SPEECH_BENCH.md`
- Older and Gulf speakers, public data: on Saudi TV speech labelled by age and dialect (SADA), word error for older Gulf speakers against adult Gulf speakers was 31% vs 33% for Jais-ASR and 68% vs 75% for the on-device model. Neither heard older Gulf voices worse; Gulf speech was harder than other dialects for both. TV sentences, not a memory check. `docs/OLDER_SPEAKERS_BENCH.md`
- Tested code: mutation testing put 897 small deliberate bugs into the decision rules one at a time, and the tests caught 826 (92%); most of the rest change only wording. `npx stryker run`
- 232 automated tests: `npm test`. Cases listed in `docs/TESTED_CASES.md`. They run all 650 lines of the decision code and 94% of its branches; the rules that decide what happens to a person are covered on every branch. `npx tsx scripts/coverage-summary.ts`
- Live end to end: after each deploy, `scripts/live-check.ts` opens the live site in headless Chromium, opens every screen, checks the full check stays locked until the person agrees, scores the recorded check in English and Arabic on the device, checks every credited and missed word against what the voice said, and takes one packet to a closed referral with the HL7 and FHIR files. No microphone in that run, so live speech is not covered.
- Plain language: every screen the person reads and every spoken prompt measures at Flesch-Kincaid grade 4 or under in English (guidance for patient material asks for 6 to 8). Arabic is not graded. `npx tsx scripts/reading-grade.ts`

## Documents

- `docs/JUDGES.md`: where to find the evidence for each criterion
- `docs/LIMITS.md`: assumptions, dependencies and limits
- `docs/PILOT.md`: pilot design, size, costs, stop rules, stages
- `docs/SAFETY_CASE.md`: hazard log
- `docs/DATA_SOURCES.md`: every data source and the right to use it
- `docs/SCORING_RULES.md`: how animal naming is scored
