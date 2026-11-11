# Assumptions, dependencies and limits

## What this is not
- It does not diagnose. It reports a change from a person's own earlier scores.
- It has not been tested in patients, in the UAE or anywhere else. There are no Gulf norms.
- A personal baseline cannot show impairment that was already present when the person enrolled. The clinic test at the screening visit covers that.

## Figures in the rule and where they come from
- One check varies within a person by 4.0 points. Built from published retest studies of similar tasks: animal naming 3.2 (Duff et al., 62 older adults, one week; Gavett et al., 4,217 adults, one year) and phone word recall 2.2 (Health and Retirement Study, 17,913 people; Lachman et al., phone retest 0.66). No study has retested this exact check, in Arabic or at home by voice. Our volunteer retest will replace the figure.
- Practice adds up to 1.0 point: 0.6 published for animal naming at one week, 0.4 assumed for word recall with a different list each time.
- At these figures a single check must fall about 7.6 points below a three-check baseline before it counts as low.
- The rule has no term for normal ageing, which the literature puts at roughly half a point a year on a total like ours. Over several years that would need adding.

## What the benchmark says
- False alarms in stable people: 3.4% a year. At the upper bound for variation (4.5) that rises to 6.2%; at the lower bound (3.5) it falls to 1.5%.
- Slow decline is mostly missed within a year: a loss of one point per check is caught in 32% of simulated people, two points per check in 85%.
- Published cohort work (Grober et al., 92 people who went on to an Alzheimer's diagnosis) puts faster fluency decline about three years, and recall decline about seven years, before diagnosis. On those rates a rule like ours would plausibly see the last two to three years, not the earliest change.
- The benchmark is a simulation under stated settings. It does not show that the check detects disease.

## Whether people keep doing it
- In open online registries about half of people do a second cognitive session and a third do a third. With a loaned tablet and reminder calls, three quarters of 114 older adults completed every monthly session in one study. So the three baseline checks are asked for in the first two weeks, and reminders are part of the design, not an extra.

## Speech
- Two listeners: the browser's own recogniser and an open speech model on the device. On phones the two often cannot share the microphone, and on weaker devices the second is skipped; then one listener scores and the screen says so.
- The on-device listener was measured on a computer voice only: 19 of 20 English animals with the base model; in a separate test the small model heard 17 of 20 Arabic animals.
- Recognition has not been measured on older speakers or on Gulf Arabic speakers.
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
