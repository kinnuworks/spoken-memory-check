# Submission form text (draft)

Every figure below comes from a file in this repository; the source is listed under each box. Character counts are checked by `src/engine/sitetext.test.ts`.

## Challenge

[Population Health] Protecting Brain Health Earlier

## Solution stage

Prototype

## Technology type

Machine learning; Software application; Analytics

## Software, hardware or both

Software

## Solution summary (2,000 characters)

<!-- summary:start -->
A four-minute spoken memory check that Abu Dhabi's adult screening programme could pilot next quarter. It finds change against each person's own baseline between clinic visits, says how sure it is, and gives their physician one clear next step.

Health impact and clinical relevance: members of the programme say ten words back, recall them, name animals for a minute and recall the words again, at home, in Gulf Arabic or English. A hearing check comes first. Three checks set a personal baseline, so low schooling is not read as decline. Two checks in a row well below that baseline, or a steady fall, send a packet to the ordering physician, who approves before anyone is invited. It watches people already in the programme; it does not screen the population.

Technical depth: an open speech model runs on the device and the person's own voice is the answer key, so each score is a range from two listeners. The rule is plain code with no language model.

Working solution: the live demo needs no sign-up and runs from a recorded check to a closed referral. In tests on real recordings, the listeners heard 93% of 720 Arabic words from 30 adults. In simulation, 5.2% of stable people get a false packet in a year, and 97% of people losing 2 points per check are flagged.

Responsible AI: consent comes in parts and each is off by default, family and genome context included. Scores stay on the device. A failed hearing check holds the check. Every decision is logged.

Scalability: referrals leave as HL7 v2 REF messages for Malaffi and FHIR R4 that passes the official validator with 0 errors. Both speech models are served from our own site.

Commercial path: the Thiqa packages 52-45 and 52-46 already fund hearing and dementia screening, and the modelled cost is about AED 26 per eligible member a year.

Not yet: no patients or older Emirati volunteers, Arabic lists not reviewed by a native speaker, and retest variation taken from published studies.
<!-- summary:end -->

Sources: `src/data/own-voice-summary.json` (93%, 720, 30), `src/data/benchmark.json` (5.2%, 97%), `docs/FHIR_VALIDATION.md`, `docs/COMMERCIAL.md` and `src/engine/cost.ts` (AED 26), `docs/LIMITS.md`.

## What has been built during the challenge? (1,500 characters)

<!-- built:start -->
Everything here was built during the challenge; the first code was written on 10 November.

The spoken check runs in the browser in English and Gulf Arabic, with an on-device speech model, own-voice matching and a digits-in-noise hearing check. A recorded voice lets anyone run the full check with no microphone.

The change rule uses a personal baseline, two routes to a packet and an urgent route, with a simulated benchmark against simpler rules.

The physician's packet shows treatable contributors, the 2024 Lancet risk factors from the screening record, family history and genome results only with consent, a decision log and a 15-working-day referral clock. Referrals export as HL7 v2 and FHIR R4.

There is also a programme view, blind re-scoring of one check in ten and a cost model.

Measured: listeners on 720 real Arabic and 113 real English recordings, and older against adult Gulf speakers on public TV speech. The tests run every line of the decision code. 92% of 1,026 deliberate bugs are caught. A headless browser runs the live site end to end after each deploy, with 0 accessibility violations in axe checks.
<!-- built:end -->

Sources: `docs/HUMAN_SPEECH_BENCH.md`, `docs/TEMPLATE_BENCH.md`, `docs/OLDER_SPEAKERS_BENCH.md`, `src/data/coverage-summary.json`, `src/data/mutation-summary.json`, `src/data/live-check.json`, `docs/ACCESSIBILITY.md`.

## Prototype / deployment link

https://spoken-memory-check.vercel.app

## Conflict of interest

To be confirmed by the entrant.
