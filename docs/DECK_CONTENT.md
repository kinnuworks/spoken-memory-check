# Deck content, slide by slide (draft for the official 16-slide template)

Items in [brackets] need the team's details.

## 1. Team name, team size, problem statement
[Team name], [team size]. [Population Health] Protecting Brain Health Earlier.

## 2. Team members
[S.No, name, country, role, organisation, age confirmation for each member.]

## 3. Team capability summary (up to 1,000 characters)
[Draft once the team is known: engineering, clinical adviser, Arabic linguist, pilot experience.]

## 4. Architecture or workflow
Spoken check at home (sound check, ten words said back, a minute of animals, counting backwards, the words again, one question about everyday tasks) → two listeners: the browser's recogniser and an open speech model on the device, each word marked heard by both, one or neither → range score → fixed rule against the person's own baseline (practice-adjusted change against measurement error; two low checks in a row; reported change in everyday tasks; failed sound check holds; very large fall goes urgent) → physician's packet (trajectory, treatable contributors first, ten of fourteen risk factors from the screening record) → approve, edit or dismiss → in-person visit → referral tracked to closure → programme view. FHIR R4 out. No language model anywhere.

## 5. Target users and intended outcome
Adults aged 50 to 64 in the adult screening programme, who have a clinic memory test only every three years. Their ordering physicians. The public health centre. Outcome: a meaningful change found between clinic tests, checked for treatable causes first, and seen by a specialist within 15 working days, without alarming anyone at home.

## 6. How success will be measured
Baseline completion; checks per member per year; packets per 1,000 members and the share dismissed; share of approved packets assessed within 15 working days; agreement between listeners and with a human listener by language, age and schooling; retest reliability; physician minutes per packet; complaints of distress.

## 7. Evidence supporting the approach
- Our analysis of a public US survey (NHANES, 3,110 adults aged 60+): a fixed cutoff of 14 animals flags 48% of healthy adults with under 9 years of school against 16% of graduates. A personal baseline avoids this.
- Published: within-person variation of animal naming and phone word recall (Duff et al.; Gavett et al.; Health and Retirement Study); spoken word recall and fluency scored by speech recognition agree closely with human scoring in Dutch, German and English studies.
- Simulation of our flag: 3.4% false alarms a year in stable people against 27.0% for a single-low-check rule; about 50 packets per 1,000 members a year at 2% in real decline, 17 of them real; 85% of members losing two points a check are flagged within the year.
- 54 automated tests, listed by case.

## 8. Data sources and legal right to use them
NHANES (US CDC, public domain, de-identified); seeded and simulated people (ours, no personal data); our own word lists and animal names; open speech models (MIT / Apache-2.0); a tester's own scores stay on their device. No licensed cognitive test items. No data from surveys that bar automated tools.

## 9. Risks and safeguards
False reassurance (clinic test continues; everyday-tasks question overrides scores). False alarm (two low checks; physician reviews first; burden published). Mishearing (two listeners; range; "not scored", never low). Hearing loss (sound check holds). Distress (nothing abnormal shown in the app; results in person). Data leaving the country (on-device listener; cloud only in a UAE region with approval). Bias by schooling (personal baseline). Full hazard log in docs/SAFETY_CASE.md.

## 10. Hardware
None. Any phone or laptop with a browser and a microphone.

## 11. Access for evaluators
Open [live link]. No sign-up. Three buttons: try it with your voice; play a recorded check (no microphone); the physician's view. All people shown are synthetic and labelled.

## 12. Path to pilot and scale
Ethics approval, then a 12-month randomised pilot at one screening provider, 250 per arm, powered on baseline completion. Stop rules. Who pays: the screening programme for its members; insurers and employers for expatriates; other Gulf programmes. Regulatory route: research use under ethics approval, registration as medical-device software after the pilot. Stages with exit tests in docs/PILOT.md.

## 13. Pre-existing IP and third-party materials
Built during the challenge. Open-source components: React, Vite, TypeScript, Vitest, Hugging Face Transformers.js, ONNX Runtime Web, Whisper model weights (MIT). [Confirm nothing pre-existing.]

## 14. Conflict of interest
[Team to confirm: no relationship with the Department of Health, Future Health, Microsoft, Inception, MBZUAI, Hack2skill or any judge.]

## 15–16. Additional slides
- What is real and what is simulated (from the how-it-works page).
- Limits stated plainly (from docs/LIMITS.md).
