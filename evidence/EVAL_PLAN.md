# Evaluation plan

This plan is written and committed before any evaluation run. The commit hash and time of this file show that the question, the data, the baseline and the success rule were fixed before any result existed. If something has to change after a run, the change goes under "Changes after the first run" with its reason, and the original lines stay as they were.

There are no real users in this evaluation. Nobody was recruited, messaged or contacted for it, and our own traffic counts as testing, never as usage.

## Question
Does the check's on-device listening (an open speech model plus matching against the speaker's own voice) find the right word in real recordings of people saying single Arabic words?

## Metric and threshold
- Metric: share of clips where the listeners together produce the word the speaker said (k of n clips), with the speaker's own recording of each word as the answer key
- Threshold: above the first on-device model alone on the same clips (39.6%), with the low end of the 95% interval above it
- Interval: 95%, from `python3 evidence/interval.py` (Wilson for k of n, bootstrap for a mean or a difference)

## Data
- Dataset: Arabic Speech Commands v1.0, https://zenodo.org/records/4662481, CC BY 4.0
- Version or hash: v1.0 (Zenodo record 4662481), downloaded 12 Nov 2026 into external/speech-commands-ar
- Split: 720 clips from 30 adult speakers (digits and yes/no). Not split by time: the Arabic model and matcher were chosen on these same clips (scripts/arabic-asr-experiments.ts), so the result is optimistic; a held-out speaker split is the next test.

## Baseline
- Whose: none published on this exact task; our own first model alone (onnx-community whisper-small, 39.6% on the same clips) is the comparison

## Success rule
The listeners' share beats 39.6% and the low end of its 95% Wilson interval is above 39.6%.

## Models and seeds
- Models: an open speech model running on the device (see docs/HUMAN_SPEECH_BENCH.md for the exact one)
- Seeds: none (transcription is deterministic; the speaker bootstrap uses the seed in the bench script)

## How results are reported
Every result names its kind at first mention, gives n, the source, the period and a 95% interval, and links its rerun command and commit. Measured numbers and estimates are kept apart, and failures are shown next to successes.

| Kind | Label at first mention | Travels with the number | Never used for this kind |
|---|---|---|---|
| Replay on public data | Back-test on public data (<dataset>, <years>) | n records, source and licence, period, whose baseline, 95% interval, rerun command and commit | `users`, `patients helped`, `customers`, `pilot`, `deployed with`, `proven`, `clinically validated` |
| Estimate from a replay | Estimate, not an observed result | the assumptions, and the data fields used to price it | `impact achieved`, `saved X hours for users`, `lives saved` |
| Real public system | Test transactions from wallets we control (addresses listed), or replayed in our own forks | counts, links, addresses | `users`, `volume`, `traction` |
| Break test | Our own break test (we tried to make it fail) | what we tried, how many attempts, what broke and what we fixed | `users`, `testers`, `validated` |

The README and the submission text open their evidence section with one line before any number:

> Evidence, stated plainly: no real users yet; it was built for this hackathon. Instead: <a back-test on <dataset> against <published baseline>>, <test transactions from wallets we control>, <our own break test of <the main claim>>. Each one reruns from the repo with one command.

Then one card per claim:

> Claim: <product> <does k of n <cases>> at <budget>.
> Evidence type: <label from the table above>, not real users.
> Data: <dataset, link, licence>, <period>, <n rows>. Baseline: <source> scores <x> on the same split.
> Result: <y> (95% interval <a> to <b>).
> Rerun: `<command>` at commit <hash>. Limits: <historical data, no live behaviour; any specific skew>.

Then a short limits paragraph, in numbers: zero real users, the interval, the data's years, and the next real test, with the metric and threshold that would change the conclusion.

## Changes after the first run
- 18 Nov 2026: this plan was written after the measurements (12 to 17 Nov), when the kit's evidence rules arrived. It records the question, data and rule those runs used; it does not pre-register them. Result: 670 of 720 = 93.1% (95% Wilson interval 91.0% to 94.7%), above 39.6%. Model and matcher were tuned on the same clips (see Split).
