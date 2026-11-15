# For the judges: where to find the evidence

Live demo: open the link, no sign-up. Three buttons on the first screen. Everything about synthetic people is labelled.

| Criterion | Where to look | What is real |
|---|---|---|
| Health impact and clinical relevance | Home page; "A year of checks" (six cases, every route); the physician's packet; `docs/LIMITS.md` | Our analysis of a public US survey: a fixed animal-naming cutoff flags 48% of healthy adults with under 9 years of school against 16% of graduates |
| Technical depth and architecture | "How it works, and what is real"; `src/engine/` (matcher, range scoring, rule); `src/speech/` (two listeners, one on the device) | 221 automated tests, listed in `docs/TESTED_CASES.md`; they run every line of the decision code (629 of 629) and catch 92% of 897 deliberate bugs put into the decision rules (mutation testing, Evidence page). Both listeners measured on older and Gulf speakers in public Saudi TV speech: no age penalty (`docs/OLDER_SPEAKERS_BENCH.md`) |
| Working solution and demonstration quality | "Try it with your voice" (30 seconds); "Play a recorded check" (no microphone); the full four-minute check | Runs in Chrome, Edge and Safari on a laptop. After each deploy a headless browser runs the live site end to end (every screen, consent lock, both recorded checks scored on the device, packet to closed referral): 5 of 5 steps passed, `scripts/live-check.ts` |
| Responsible AI, safety and data governance | No language model anywhere; the rule shown in full on the packet; `docs/SAFETY_CASE.md`; `docs/DATA_SOURCES.md`; consent in four parts | Deterministic rule; 96% of deliberate bugs in it caught by the tests, and every branch of it run by them. Every screen the person reads measures at reading grade 4 or under in English (`scripts/reading-grade.ts`); Arabic not graded |
| Scalability and deployment readiness | Programme view; FHIR export; on-device listener; `docs/PILOT.md` | FHIR R4 passes the official HL7 validator with 0 errors; the referral also goes out as the HL7 v2 REF message Malaffi asks for. Scoring runs on the person's device, so server load does not grow with the number of members |
| Commercial viability and path to pilot | Home page, "Who pays": Thiqa packages 52-45 and 52-46, a cost model with an uptake slider (about AED 26 per eligible member a year at 40% uptake), billing routes and the first organisations we would ask; `docs/COMMERCIAL.md`, `docs/PILOT.md` | Costs come from published Azure prices plus stated assumptions; no partner has agreed yet |

What is simulated: the six people, the programme year, and the flag benchmark. What is still to come: native Arabic review, physician review, volunteer measurements.
