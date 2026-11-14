# Path to a pilot

## What is asked for
A twelve-month pilot at one adult screening provider in Abu Dhabi, after ethics approval. This is a feasibility pilot, not a validation of accuracy.

## Who
Programme members aged 50 to 64, between their three-yearly clinic memory tests, who agree at their screening visit. People with a known diagnosis of dementia or mild cognitive impairment are not enrolled.

## Design
Two arms, assigned at random at the screening visit:
- Usual care: the clinic memory test at the next scheduled visit.
- Home checks: usual care plus the spoken check about every six weeks, the first three within two weeks.

The pilot is powered on process measures, not on finding disease. True decline is too rare in this age group for a one-site, one-year pilot to measure detection.

## What is measured
Primary:
- Share of enrolled members who complete a baseline (three scored checks).
- Share of physician-approved packets that reach a specialist assessment within 15 working days of the in-person visit.

Secondary:
- Checks completed per member per year; drop-off over time.
- Packets per 1,000 members, and the share the physician dismisses (false-referral burden).
- Physician minutes per packet.
- Agreement between the two listeners and with a human listener on a random sample of recordings, by language, age band and schooling.
- Retest reliability and practice gain from the baseline checks. These replace the published figures the rule uses today.
- Whether people understood the invitation wording (asked at the visit).
- Any harm reported: distress, false reassurance, complaints.

## Size
For the completion measure: with an expected baseline completion of 55% and a margin of plus or minus 7 percentage points at 95% confidence, about 200 people in the home-check arm. Enrolling 250 per arm allows for those who never start. The second primary measure is descriptive, because approved packets will number in the tens.

## Stop rules
Pause enrolment and review if any of these happens:
- Physicians dismiss more than half of packets over any three-month period.
- More than one complaint per 100 members about distress caused by the check.
- Any serious event where a home check delayed care, judged by the site's clinical lead.
- The two listeners disagree so often that more than 20% of checks are not scored.

## What it costs
Estimates before measurement. Each is to be confirmed in the pilot.
- Speech recognition: the on-device listener costs nothing per check. A cloud listener in the UAE region costs a few US cents per check at list prices (about four minutes of audio).
- Hosting: one small web service and a database in a UAE region.
- Physician time: about 10 minutes per packet. At about 65 packets per 1,000 members a year (simulated, assuming 2% of members in real decline), about 11 physician-hours per 1,000 members a year.
- Pilot price to the programme: a fixed per-member fee to be set after the cost lines above are measured. We do not quote a figure before measuring.

## Who pays, in order
1. The adult screening programme, for members it already screens, as part of the screening package.
2. Private insurers and employers, for expatriate residents, who are outside the programme today.
3. Screening programmes elsewhere in the Gulf.

## Regulatory route
Software that informs a clinician's decision about cognitive change is likely to count as medical-device software in the UAE. The pilot runs as research under ethics approval. Registration would follow the pilot, on the evidence it produces. Speech is processed on the device or in a UAE cloud region; cloud processing of health data needs the Department of Health's approval under its information-security standard.

## Stages and exit tests
1. Now: prototype on synthetic data. Exit when: physician review done, native Arabic review done, volunteer agreement and retest measured.
2. Pilot (12 months, one site). Exit when: primary measures met, stop rules not triggered, cost per member measured.
3. Second site and more languages (Hindi, Urdu, Malayalam, Tagalog). Exit when: agreement and retest hold in each new language.
4. Programme roll-out, linked to the screening record and the emirate's health information exchange.
