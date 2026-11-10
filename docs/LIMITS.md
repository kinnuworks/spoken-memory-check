# Assumptions, dependencies and limits

## What this is not
- It does not diagnose. It reports a change from a person's own earlier scores.
- It has not been tested in patients, in the UAE or anywhere else. There are no Gulf norms.
- A personal baseline cannot show impairment that was already present when the person enrolled. The clinic test at the screening visit covers that.

## Assumptions in the rule
- One check varies within a person by 3.5 points. This is an assumption built from a published one-year retest figure for animal naming and a guess for word recall. Volunteer retest data will replace it.
- Practice adds up to 1.5 points. Assumption.
- The benchmark shows what follows if these are wrong: with a true variation of 4.5 points, false alarms in stable people rise from 3.4% to 10.9% a year.

## What the benchmark says the rule misses
- Slow decline. A loss of one point per check is caught within a year in 38.5% of simulated people.
- The benchmark is a simulation under stated settings. It does not show that the check detects disease.

## Speech
- This build uses one recogniser, the browser's own. Each score therefore has no range yet. The design uses two recognisers and reports a range.
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
