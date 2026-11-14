# Older and Gulf speakers: a public-data check

Every reviewer of this check asks how well it hears older people and Gulf Arabic speakers. We have not yet recruited older Gulf volunteers. Until we do, this page answers a narrower question with public data: do the listeners hear older speakers, or Gulf speakers, worse than other adults?

## Data

SADA 2022 (Saudi Data and AI Authority), the test split, from the copy at huggingface.co/datasets/MohamedRashad/SADA22. It is speech from Saudi TV programmes, and annotators labelled each clip with the speaker's age group and dialect. The licence is CC BY-NC-SA 4.0; we use it only to measure and do not redistribute it.

The sample (`scripts/sada-extract.py`, seed 20261115):

- every clip labelled Elderly: 120, of which 83 are Gulf (Khaliji), 34 Hijazi and 3 Najdi;
- 200 random adult Gulf clips, 100 adult Najdi and 100 adult Hijazi.

## Listeners

- **On-device model, as the app runs it**: `onnx-community/whisper-small-ar-ONNX`, 4-bit, with the app's speech gate, windowing and prompt, run in Node.
- **Jais-ASR** (MBZUAI and Inception), the 4-bit MLX build on a Mac, run with the settings from its model card. This is the proposed optional UAE-hosted listener.

## Measure

Word error rate against SADA's own transcripts, after the app's Arabic letter folding, with a 95% bootstrap interval over clips. `npx tsx scripts/sada-bench.ts report` writes `src/data/sada-bench.json`.

## Results

| Speakers (clips) | Jais-ASR word error | On-device word error |
|---|---|---|
| Older, Gulf (83) | 31% (26 to 36) | 68% (63 to 74) |
| Adult, Gulf (200) | 33% (29 to 37) | 75% (71 to 79) |
| Older, other Saudi dialects (37) | 38% (28 to 50) | 80% (69 to 92) |
| Adult, Najdi (100) | 22% (18 to 28) | 61% (55 to 69) |
| Adult, Hijazi (100) | 23% (19 to 28) | 61% (54 to 69) |

Older minus adult word error, among Gulf speakers:

- Jais-ASR: −2 points (−8 to +4).
- On-device model: −7 points (−13 to 0).

What this shows:

- Neither listener heard older Gulf speakers worse than adult Gulf speakers.
- Gulf speech was harder than Najdi or Hijazi speech for both listeners, at every age. Gulf speakers are who this check is for, so that gap matters more than the age gap.
- Without the app's prompt, the on-device model gave the same picture: 68% for older Gulf speakers against 73% for adults.
- Jais-ASR made less than half as many errors as the on-device model on running speech.
- Across all dialects, older speakers come out about 6 points worse with both listeners. That is because the older group is mostly Gulf; within each dialect the older speakers were not worse.

## What it does not show

- These are TV programmes, not older adults taking a memory check at home. Speakers on TV are often clearer than people at home with a phone.
- They are sentences, not recalled single words. On real single Arabic words the on-device model alone heard 82% right, and 93% with the person's own voice as the answer key (`docs/TEMPLATE_BENCH.md`). Running speech is much harder, which is why recall is matched against the person's own voice and a word needs two listeners to be confirmed.
- Age and dialect are annotators' labels, and Saudi Gulf speech is not the same as Emirati speech.
- SADA gives no speaker ids, so several clips may come from one speaker, and the intervals are narrower than they should be.
- SADA's transcripts have their own spelling variation. That counts as error for every group alike, so it inflates every figure without biasing the comparison.

The real test is still older Emirati volunteers doing the check itself (`docs/PILOT.md`).
