# Deck content, slide by slide (for the official 15-slide template)

`scripts/fill_deck.py` puts each numbered section on the template slide of the same number, under the slide's own heading. Team details (slides 1, 2, 3 and 14) live outside the repo, in `external/deck/team.json`. Slide 4 also gets the workflow diagram (`docs/images/workflow.png`).

## 1. Team name, team size, problem statement
{team}

Spoken memory check: a four-minute memory check by voice at home, in Gulf Arabic or English, compared with the person's own past checks. Their physician hears only about lasting change.

## 2. Team members
{members}

## 3. Team capability summary
{capability}

## 4. Architecture or workflow
Everything left of the physician runs in the person's browser; audio and scores stay on the device by default. Fixed rules in code make every decision: no language model. The packet reads the checks with risk context in Statement 8's eight areas and the LIBRA modifiable-risk index; context never changes the flag.

## 5. Target users and intended outcome
- Members of Abu Dhabi's adult screening programme aged 50 to 75. Thiqa's hearing and dementia screening packages cover 52-45 (ages 50 to 64, every three years) and 52-46 (65 to 75, every year), and name no memory tool.
- Their ordering physicians, who get a packet only when a change lasts, with treatable causes first.
- The screening provider's programme team, who see every member, packet and referral by facility.

Intended outcome: a lasting change in memory found between screening visits, checked for treatable causes (B12, thyroid, mood, hearing, sleep apnoea, medicines), and seen by neurology, geriatric medicine or audiology within 15 working days, without alarming anyone at home and without flagging people for having had little schooling.

## 6. How success will be measured
The seven measures Statement 8 names, each split by language, age and schooling:
- completion (baseline checks finished);
- test-retest reliability;
- sensitivity and specificity against the clinic's own assessment;
- meaningful change (practice-adjusted change beyond measurement error);
- false-referral burden (packets per 1,000 members a year, and the share physicians dismiss);
- time to clinical assessment (share of approved packets seen within 15 working days).

Also: agreement between the machine and a person who re-scores one check in ten without seeing the machine's result; physician minutes per packet; reports of distress. The pilot (slide 12) measures these; today the Evidence page marks each one measured, simulated or not yet.

## 7. Evidence supporting the approach
Real recordings, public data:
- Arabic words: the on-device model, matching recalled words against the speaker's own recording of each word, heard 93% of 720 single words from 30 adults (Arabic Speech Commands; read words, not older Gulf speakers).
- Older speakers: on Saudi TV speech labelled by age and dialect (SADA), word error was 31% for older against 33% for adult Gulf speakers (Jais-ASR); the on-device model also did no worse for older voices.

Real survey data: in NHANES 2011 to 2014 (3,110 adults aged 60 and over), a fixed cutoff of 14 animals flags 48% of healthy adults with under 9 years of school against 16% of graduates. In the Gulf, the usual MoCA cut-off classed 69.3% of 606 older adults in Dubai and Sharjah as impaired (Issa et al. 2026). A personal baseline avoids this.

Simulated: 5.2% of stable simulated members get a false packet a year; 52% of those losing 1 point a check and 97% losing 2 are flagged within the year if every word is heard (64% in Arabic, 30% in English at 2 points with miss rates from the real recordings).

Our own tests: FHIR R4 with 0 errors from the HL7 validator 7.0.5; 257 automated tests; 92% of 1,026 deliberate bugs caught; the live site walked end to end after each deploy; a computer voice fed in as the microphone credited 8 of 12 animals said in English and in Arabic, and silence failed the sound check.

## 8. Data sources and legal right to use them
- NHANES 2011 to 2014: survey, de-identified, US CDC; public domain; no personal data.
- Arabic and Google Speech Commands: single-word recordings of consenting adults; CC BY 4.0, cited; used to measure the listeners, not shipped.
- SADA 2022: Saudi TV speech, SDAIA and the Saudi Broadcasting Authority; CC BY-NC-SA 4.0; research evaluation only, not shipped or trained on.
- Demo people and histories: synthetic, ours; no personal data.
- Demo voices: synthetic speech; Piper LJ Speech (public domain, MIT) and ElevenLabs on a paid plan whose licence allows commercial use.
- Speech models: OpenAI Whisper (MIT) and an Arabic fine-tune (Apache-2.0); Jais-ASR by MBZUAI and Inception (Apache-2.0) for the optional UAE listener.

In a pilot: the member's own spoken checks and screening-record values, with consent in parts, each off by default; family history and Emirati Genome Programme results only under their own consent. No licensed test items; no survey that bars automated tools.

## 9. Risks and safeguards
- Privacy: audio is scored on the device and not saved; scores stay in the browser; the browser's own recogniser only if the person turns it on.
- Security: no server holds health data; the one server function never sees audio; keys never reach the browser.
- Bias: each person is compared with their own baseline, not a cut-off that penalises little schooling; results are split by language, age and schooling.
- Explainability: fixed rules in code; every packet shows the trajectory, the rule that fired and a logged decision.
- Misuse: risk, not diagnosis; no score is shown at home; results are given in person.
- Human oversight: a physician approves, edits or dismisses every routine packet before anyone is told.
- Failure modes: a failed sound check holds the check instead of scoring it low; a missed or unheard check is never counted as low; a reported change in everyday tasks goes to the physician whatever the score; a very large fall goes for urgent assessment the same day.

## 10. Hardware requirements
None. Any phone or laptop with a current browser and a microphone. No wearable, sensor or connected device.

## 11. Access for evaluators
No login, no sign-up, no guest step: https://spoken-memory-check.vercel.app
- "Try it with your voice": a sound check, then 20 seconds of naming animals.
- "Play a recorded check": the full four-minute check with a computer voice, scored on your device; no microphone needed.
- "A year of checks", then the physician's packet: approve it through to a closed referral with the Malaffi message and FHIR file.

Code: {repo}. All people shown are synthetic and labelled.

## 12. Path to pilot and scale
- Stakeholders: ADPHC (runs the screening programme), Thiqa (funds packages 52-45 and 52-46), one screening provider, its ordering physicians, neurology, geriatric medicine and audiology.
- Integration: referrals as HL7 v2 REF messages with SNOMED specialty for Malaffi (Circular 2026/144); FHIR R4 for the record, the LIBRA index as a RiskAssessment. Self-hosts on UAE servers from one Node process.
- Regulatory: research use under ethics approval and DoH data rules first; registration as medical-device software after the pilot.
- Timeline assumption: a 12-month randomised pilot at one screening provider, 250 members per arm, with stop rules (docs/PILOT.md).
- Sustainability: modelled cost about AED 26 per eligible member a year at 40% uptake, inside packages Thiqa already funds. No partner has agreed yet.

## 13. Pre-existing IP and third-party materials
All code was written during the challenge (first commit 10 November 2026); nothing pre-existing. Open-source components: React, React Router, Vite, TypeScript (MIT, Apache-2.0); Transformers.js (Apache-2.0); ONNX Runtime Web (MIT); OpenAI Whisper base (MIT; browser version Apache-2.0); an Arabic Whisper-small fine-tune (Apache-2.0), served from our site in a smaller copy with its licence and a change notice; fonts under the SIL Open Font License. Demo voices: Piper en_US-ljspeech (MIT; LJ Speech recordings public domain) through sherpa-onnx (Apache-2.0) for English, and ElevenLabs on a paid plan whose licence allows commercial use for Arabic. No licensed cognitive test items. The repository carries no open-source licence, so the organiser's right of first refusal stays open.

## 14. Conflict of interest declaration
{coi}

## 15. Additional slide
The six criteria, and where each is shown:
- Health impact and clinical relevance: lasting change found between screening visits, read with risk context in eight areas and the LIBRA index, treatable causes first (physician's packet).
- Technical depth and architecture: on-device speech, own-voice matching, a change rule against a personal baseline (How it works; slide 4).
- Working solution and demonstration quality: the live demo, no login, end to end to a closed referral (slide 11).
- Responsible AI, safety and data governance: no score at home, consent in parts, physician approval, nothing leaves the device by default (slide 9).
- Scalability and deployment readiness: HL7 v2 for Malaffi, FHIR R4, phones and laptops, both speech models served from our own site, a self-hosted build for UAE servers.
- Commercial viability and path to pilot: Thiqa packages 52-45 and 52-46, about AED 26 per member a year, a 12-month pilot design (slide 12).

Not yet: no patients or older Emirati volunteers; the Arabic word lists have no native Gulf reviewer; no physician has reviewed the packet; retest error comes from published studies.
