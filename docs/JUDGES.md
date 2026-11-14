# For the judges: where to find the evidence

Live demo: open the link, no sign-up. Three buttons on the first screen. Everything about synthetic people is labelled.

| Criterion | Where to look | What is real |
|---|---|---|
| Health impact and clinical relevance | Home page; "A year of checks" (six cases, every route); the physician's packet; `docs/LIMITS.md` | Our analysis of a public US survey: a fixed animal-naming cutoff flags 48% of healthy adults with under 9 years of school against 16% of graduates |
| Technical depth and architecture | "How it works, and what is real"; `src/engine/` (matcher, range scoring, rule); `src/speech/` (two listeners, one on the device) | 194 automated tests, listed in `docs/TESTED_CASES.md`; they catch 92% of 897 deliberate bugs put into the decision rules (mutation testing, Evidence page). Both listeners measured on older and Gulf speakers in public Saudi TV speech: no age penalty (`docs/OLDER_SPEAKERS_BENCH.md`) |
| Working solution and demonstration quality | "Try it with your voice" (30 seconds); "Play a recorded check" (no microphone); the full four-minute check | Runs in Chrome, Edge and Safari on a laptop |
| Responsible AI, safety and data governance | No language model anywhere; the rule shown in full on the packet; `docs/SAFETY_CASE.md`; `docs/DATA_SOURCES.md`; consent in four parts | Deterministic rule; 96% of deliberate bugs in it caught by the tests |
| Scalability and deployment readiness | Programme view; FHIR export; on-device listener; `docs/PILOT.md` | FHIR resources generated and tested |
| Commercial viability and path to pilot | `docs/PILOT.md`: who pays, cost lines, design, size, stop rules, stages | Cost lines are estimates until measured |

What is simulated: the six people, the programme year, and the flag benchmark. What is still to come: native Arabic review, physician review, volunteer measurements.
