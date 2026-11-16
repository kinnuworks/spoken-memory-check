# Assumptions, dependencies and limits

## What this is not
- It does not diagnose. It reports a change from a person's own earlier scores.
- It has not been tested in patients, in the UAE or anywhere else. There are no Gulf norms.
- A personal baseline cannot show impairment that was already present when the person enrolled. The clinic test at the screening visit covers that.

## Figures in the rule and where they come from
- One check varies within a person by 4.0 points. Built from published retest studies of similar tasks: animal naming 3.2 (Duff et al., 62 older adults, one week; Gavett et al., 4,217 adults, one year) and phone word recall 2.2 (Health and Retirement Study, 17,913 people; Lachman et al., phone retest 0.66). No study has retested this exact check, in Arabic or at home by voice. Our volunteer retest will replace the figure.
- Practice adds up to 1.0 point: 0.6 published for animal naming at one week, 0.4 assumed for word recall with a different list each time.
- At these figures a single check must fall about 7.6 points below a three-check baseline before it counts as low.
- The slow-decline route uses the same 4.0 and 1.0. Its cut-offs (slope over error at or below −1.9, from the eighth scored check, on two checks in a row) were chosen on simulated people from one seed and reported on another. They are tuned to a simulation, not to patients.
- The rule has no term for normal ageing, which the literature puts at roughly half a point a year on a total like ours. The slow-decline route makes this matter more: over several years, normal ageing alone would push the line down and raise packets in healthy people. Before a second year of use the route needs an ageing term, or a baseline that is renewed.
- The line uses the check's place in the schedule, not the date. The three baseline checks are days apart and later ones about six weeks apart, so the slope is in points per check, and a long gap between checks is not allowed for.
- Regression to the mean: someone who enrols on a good run of days has a baseline above their usual level, and both routes then read the return to normal as a fall. Averaging three checks reduces this but does not remove it. The simulation draws baselines without this selection, so it does not show the effect.
- Practice is modelled as one smooth curve. If the real gain is smaller, the rule reads the missing gain as a small fall, and the line route is more sensitive to this than the flag.

## What the benchmark says
- False alarms in stable people, both routes together: 4.9% a year (3.4% with the drop route alone). At the upper bound for variation (4.5) that rises to 8.2% (6.2% before); at the lower bound (3.5) it is 2.3% (1.5% before). With no practice gain at all it is 6.8% (4.6% before).
- Slow decline is still often missed within a year: a loss of one point per check is caught in 45% of simulated people (32% before the slow-decline route), two points per check in 94% (85% before), three in nearly all.
- The cost in workload: with 2% of members in real decline, packets rise from about 50 to 65 per 1,000 members a year, and real ones from about 17 to 18. Most of the extra packets from the new route are false alarms.
- Published cohort work (Grober et al., 92 people who went on to an Alzheimer's diagnosis) puts faster fluency decline about three years, and recall decline about seven years, before diagnosis. On those rates a rule like ours would plausibly see the last two to three years, not the earliest change.
- The benchmark is a simulation under stated settings. It does not show that the check detects disease.

## Whether people keep doing it
- In open online registries about half of people do a second cognitive session and a third do a third. With a loaned tablet and reminder calls, three quarters of 114 older adults completed every monthly session in one study. So the three baseline checks are asked for in the first two weeks, and reminders are part of the design, not an extra.

## Speech
- By default one listener scores: an open speech model on the device, plus own-voice matching for recall. The browser's own recogniser is an opt-in second listener. Phones (including every iPhone) and low-memory devices cannot run the on-device model, so there the person must turn on the browser's recogniser or type; the screen says so.
- On a computer voice the on-device listener heard 19 of 20 English animals with the base model; in a separate test the small model heard 17 of 20 Arabic animals. On real single-word recordings it heard 62% of 387 English clips and 82% of 720 Arabic clips, and 93% of the Arabic clips with the speaker's own voice as the answer key (`docs/HUMAN_SPEECH_BENCH.md`).
- Recognition has not been measured on older adults doing the check, or on Emirati speakers. On public Saudi TV speech labelled by age and dialect (SADA), Jais-ASR's word error was about the same for older and adult Gulf speakers; the on-device model makes many errors on running speech at every age (`docs/OLDER_SPEAKERS_BENCH.md`).
- Arabic word lists and prompts are drafts that no native Gulf Arabic speaker has reviewed. Prompts use the device's synthetic voice.
- The two word lists per language have not been shown to be equally hard.
- Someone in the room can prompt the person, and the check cannot tell.

## Programme fit
- The packet's risk fields exist only for members of the adult screening programme who attended a visit. For anyone else there is no record to fill from.
- The 15-working-day target is borrowed from the programme's own referral indicator. It is our target, not a programme rule for home checks.
- B12 and thyroid tests are not part of the screening package, so the physician has to order them.
- Patient wording is a fixed template offered for the public health centre to approve. Nothing abnormal is shown in the app.

## Before any use with patients
- Ethics approval and a validation study.
- The regulator's approval for processing voice in a cloud service, or an on-premise speech service.
- A physician's review of the packet. None has reviewed it yet.

## Dependencies
- A browser with speech recognition (Chrome, Edge, Safari) and a microphone.
- React, Vite, TypeScript, Vitest (open source).
