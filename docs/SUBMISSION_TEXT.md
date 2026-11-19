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
A four-minute memory check by voice, at home, for adults in Abu Dhabi's screening programme. It compares each check with the person's own baseline and screening-record risk factors, gives plain prevention steps, and tells their physician only about lasting change.

Statement 8, item by item:
1. Culturally valid and accessible: spoken in Gulf Arabic or English, nothing to read or type. A hearing check comes first.
2. Longitudinal change: three checks set a personal baseline. One low check means a repeat check; two in a row averaging about 9.5 points below it, or a steady fall, send a packet; a very large fall goes the same day.
3. Integrated risk context: the packet shows ten of the fourteen Lancet risk factors from the screening record (blood pressure, HbA1c, LDL, mood, hearing), and, each under its own consent, family history and Emirati Genome Programme results.
4. Prevention and timely care: the person sees plain steps from their own record. The packet puts treatable causes first (B12, thyroid, mood, hearing, sleep apnoea, medicines), then refers to neurology, geriatrics or audiology on a 15-working-day clock.
5. Safety and oversight: no score at home, ranges with stated limits, a physician approves every routine packet, and no language model makes any decision.
6. Validation: the statement's seven measures, by language, age and schooling, each marked measured, simulated or not yet.

Back-test on public data (Arabic Speech Commands, 30 adults): the on-device model, with the person's own voice as the answer key, heard 93% of 720 Arabic words. In simulation, 5.2% of stable simulated members get a false packet a year; 97% of those losing 2 points a check are flagged.

Abu Dhabi fit: HL7 v2 REF referrals for Malaffi, FHIR R4 with 0 validator errors, Thiqa packages 52-45 and 52-46, a modelled AED 26 per member a year.

Not yet: no patients or older Emirati volunteers, Arabic lists not reviewed by a native speaker, retest error from published studies.
<!-- summary:end -->

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
