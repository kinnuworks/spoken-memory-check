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
A four-minute memory check by voice at home for adults in Abu Dhabi's screening programme. Their physician hears only about lasting change.

Statement 8:
1. Culturally valid and accessible: spoken in Gulf Arabic or English, nothing to read or type. Hearing is checked first.
2. Cognitive and functional change: three checks set a personal baseline. One low check means a repeat; two in a row averaging about 9.5 points below it, a steady fall, or a yes to the everyday-tasks question send a packet; a very large fall goes the same day.
3. Integrated risk context: the packet reads the checks with all eight named areas (sleep too), weighs modifiable risk with the LIBRA index, and adds family history and Emirati Genome Programme results only under their own consent.
4. Prevention and timely care: the person gets plain steps from their own record. The packet lists treatable causes first (B12, thyroid, mood, hearing, sleep apnoea, medicines), then a specialist referral on a 15-working-day clock.
5. Safety and oversight: no score at home, a physician approves every routine packet, and no language model decides.
6. Validation: the statement's seven measures, by language, age and schooling, each marked measured, simulated or not yet.

Measured: with each speaker's own voice as the answer key, the on-device model heard 93% of 720 Arabic words from 30 adults. Simulated: 5.2% false packets a year in stable people; 97% of those losing 2 points a check flagged if every word is heard.

Abu Dhabi fit: HL7 v2 referrals for Malaffi, FHIR R4 with 0 validator errors, UAE self-hosting, Thiqa packages 52-45 and 52-46 as payer, modelled at AED 26 a member a year.

Pilot plan: after ethics approval, 12 months at one screening provider, 250 per arm randomised to usual care or home checks. Measures: baseline completion and specialist visits within 15 working days.

Not yet: no partner, no patients or older Emirati volunteers, no native review of Arabic lists, retest error borrowed from studies.
<!-- summary:end -->

## What has been built during the challenge? (1,500 characters)

<!-- built:start -->
Everything here was built during the challenge; the first code was written on 10 November.

The spoken check runs in the browser in English and Gulf Arabic, with an on-device speech model, own-voice matching and a digits-in-noise hearing check. A recorded voice lets anyone run the full check with no microphone.

The change rule uses a personal baseline, two routes to a packet and an urgent route, with a simulated benchmark against simpler rules.

The physician's packet shows treatable contributors, risk context in the statement's eight areas with the LIBRA index, family history and genome results only with consent, a decision log and a 15-working-day referral clock. Referrals export as HL7 v2 and FHIR R4. The site also runs self-hosted from one Node process.

There is also a programme view, blind re-scoring of one check in ten and a cost model.

Measured: listeners on 720 real Arabic and 113 real English recordings, and older against adult Gulf speakers on public TV speech. The tests run every line of the decision code. 92% of 1,026 deliberate bugs are caught. A headless browser runs the live site end to end after each deploy, with 0 accessibility violations in axe checks, and a second run feeds a computer voice in as the microphone: 8 animals credited in English and 8 in Arabic in 20 seconds, each one said, while silence fails the sound check.

The demo voices have licences that allow commercial use: an open English voice and a paid-plan Arabic voice.
<!-- built:end -->

Sources: `docs/HUMAN_SPEECH_BENCH.md`, `docs/TEMPLATE_BENCH.md`, `docs/OLDER_SPEAKERS_BENCH.md`, `src/data/coverage-summary.json`, `src/data/mutation-summary.json`, `src/data/live-check.json`, `docs/ACCESSIBILITY.md`.

## Prototype / deployment link

https://spoken-memory-check.vercel.app

## Conflict of interest

To be confirmed by the entrant.
