# Second listener on real recorded words

This measures one part of the check: how often the on-device second listener, followed by our own word matching, finds the right word in a recording of a real person saying one word. It uses two public datasets of single spoken words. Every figure below comes from one run of `scripts/human-speech-bench.ts`, and the raw output, including each clip's transcript, is in `src/data/human-speech-bench.json`.

## What this does and does not measure

It measures the second listener only. The browser's own recogniser (the first listener) is not tested here, because it needs a live browser and cannot run headless. In the app a word counts when either listener hears it, so these numbers describe one of the two listeners, not the check's final scoring.

The clips are isolated single words, about one second each. The check itself asks for lists of words, a minute of animal names and counting backwards in one long recording, so the listener has more context there than here. These results may be better or worse than what happens in a real check, and this run cannot say which.

The speakers are adult volunteers. Neither dataset's README gives their ages, and they are not older adults recruited for this purpose. Neither dataset is Gulf Arabic: the Arabic Speech Commands README does not name a dialect at all. Nothing here tells us how the listener does with older speakers, with Gulf dialect, or with speech affected by cognitive decline.

## Setup

- Models and settings: the same as `src/speech/whisper.worker.ts`. English uses `onnx-community/whisper-base`, Arabic uses `onnx-community/whisper-small`, both with q8 weights, the same style prompt (a list of ten everyday nouns), the same speech gate, the same 120-token limit and the same filter for looping output. The script checks the worker file for these settings and stops if they have changed.
- Runtime: Node 26 with Transformers.js. The browser runs the model on the WebAssembly backend; in Node the wasm backend did not load, so the same q8 ONNX files ran on onnxruntime's CPU backend. Small numeric differences from the browser are possible.
- Matching: yes and no go through `readYesNo` from `src/engine/yesno.ts`. Cat, dog and bird go through `matchClosedSet` against the English `ANIMALS` rows from `src/engine/lexicon.ts`, so "kitten" counts as cat and "puppy" as dog.
- Numbers: the app has no number matcher yet (counting backwards is not scored by word matching). The script has its own, `readNumbers`, which accepts the digit (0 to 9, Western or Eastern Arabic numerals), the English word, and common Arabic spellings (for example اثنان, اثنين, ثلاثة, ثلاث, ثمانية, ثماني). The Arabic forms go through the app's Arabic normaliser first. This matcher was written for this test and is not part of the app.
- Outcomes: "correct" means the expected word was found. "Wrong word" means the listener returned text but the expected word was not found in it (for yes and no, this includes an unclear answer). "Nothing heard" means an empty transcript, either because the speech gate found no speech or because the model returned nothing usable.
- Intervals are Wilson 95% intervals.

## Sample

The random sample uses a seeded generator (mulberry32). The seed is 20261112 for English and 20261113 for Arabic. For each word the script takes up to 60 clips, going round the speakers in shuffled order and taking one clip from each speaker per round, so no speaker is over-represented.

- English: Google Speech Commands v0.02 test set. Yes and no have their own folders (419 and 405 clips), so 60 of each were taken, every one from a different speaker. The digits and cat, dog and bird are in the test set's `_unknown_` folder with between 7 and 34 clips each, so all of them were used. Speaker ids come from the file names. 387 clips, 168 speakers.
- Arabic: Arabic Speech Commands v1.0. Its 30 speakers each recorded every keyword 10 times (300 clips per keyword). The script took 60 per word, two from each speaker, for the digits zero to nine, yes (نعم) and no (لا). 720 clips, 30 speakers. The dataset has no animal words.

Run time on this Mac: English 163 s for 387 clips (0.42 s a clip). Arabic 2,902 s for 720 clips (4.03 s a clip). Model downloads are not included.

## Results

### English (onnx-community/whisper-base, q8, 387 clips)

| Word or task | Clips | Speakers | Correct (95% CI) | Wrong word (95% CI) | Nothing heard (95% CI) |
|---|---|---|---|---|---|
| zero | 24 | 21 | 54% (35-72) | 46% (28-65) | 0% (0-14) |
| one | 25 | 24 | 72% (52-86) | 28% (14-48) | 0% (0-13) |
| two | 20 | 17 | 60% (39-78) | 35% (18-57) | 5% (1-24) |
| three | 26 | 24 | 31% (17-50) | 69% (50-83) | 0% (0-13) |
| four | 18 | 17 | 17% (6-39) | 83% (61-94) | 0% (0-18) |
| five | 23 | 23 | 65% (45-81) | 35% (19-55) | 0% (0-14) |
| six | 28 | 27 | 89% (73-96) | 11% (4-27) | 0% (0-12) |
| seven | 18 | 16 | 83% (61-94) | 17% (6-39) | 0% (0-18) |
| eight | 34 | 30 | 74% (57-85) | 26% (15-43) | 0% (0-10) |
| nine | 24 | 21 | 92% (74-98) | 8% (2-26) | 0% (0-14) |
| yes | 60 | 60 | 48% (36-61) | 47% (35-59) | 5% (2-14) |
| no | 60 | 60 | 52% (39-64) | 47% (35-59) | 2% (0-9) |
| cat | 10 | 9 | 90% (60-98) | 10% (2-40) | 0% (0-28) |
| dog | 7 | 7 | 86% (49-97) | 14% (3-51) | 0% (0-35) |
| bird | 10 | 10 | 90% (60-98) | 10% (2-40) | 0% (0-28) |
| Task: digits | 240 | 118 | 65% (59-71) | 35% (29-41) | 0% (0-2) |
| Task: yes/no | 120 | 103 | 50% (41-59) | 47% (38-56) | 3% (1-8) |
| Task: animals | 27 | 24 | 89% (72-96) | 11% (4-28) | 0% (0-12) |
| All English | 387 | 168 | 62% (57-67) | 37% (32-42) | 1% (1-3) |

### Arabic (onnx-community/whisper-small, q8, 720 clips)

| Word or task | Clips | Speakers | Correct (95% CI) | Wrong word (95% CI) | Nothing heard (95% CI) |
|---|---|---|---|---|---|
| zero | 60 | 30 | 12% (6-22) | 88% (78-94) | 0% (0-6) |
| one | 60 | 30 | 67% (54-77) | 33% (23-46) | 0% (0-6) |
| two | 60 | 30 | 33% (23-46) | 67% (54-77) | 0% (0-6) |
| three | 60 | 30 | 15% (8-26) | 82% (70-89) | 3% (1-11) |
| four | 60 | 30 | 73% (61-83) | 27% (17-39) | 0% (0-6) |
| five | 60 | 30 | 75% (63-84) | 25% (16-37) | 0% (0-6) |
| six | 60 | 30 | 58% (46-70) | 42% (30-54) | 0% (0-6) |
| seven | 60 | 30 | 38% (27-51) | 62% (49-73) | 0% (0-6) |
| eight | 60 | 30 | 18% (11-30) | 80% (68-88) | 2% (0-9) |
| nine | 60 | 30 | 2% (0-9) | 98% (91-100) | 0% (0-6) |
| yes | 60 | 30 | 27% (17-39) | 73% (61-83) | 0% (0-6) |
| no | 60 | 30 | 57% (44-68) | 43% (32-56) | 0% (0-6) |
| Task: digits | 600 | 30 | 39% (35-43) | 60% (56-64) | 1% (0-1) |
| Task: yes/no | 120 | 30 | 42% (33-51) | 58% (49-67) | 0% (0-3) |
| All Arabic | 720 | 30 | 40% (36-43) | 60% (56-64) | 0% (0-1) |

The Arabic intervals treat every clip as independent. Each speaker gives two clips per word and 24 in total, and clips from one speaker are likely to fail together, so the true uncertainty is wider than shown, most of all for the task and overall rows, which rest on 30 people.

## What went wrong

English errors mostly come from the style prompt. Of the 142 wrong English transcripts, 93 contain one of the ten nouns in the prompt. "Yes" came back as "house," 21 times out of 60, and "no" came back as "door," 23 times out of 60. "Three" became "tree" 14 times; "tree" is in the prompt and also sounds close. The prompt was chosen for word lists, where it helps the model write single nouns. On a lone one-second word it pulls the model towards the prompt's own words. In the app this listener only hears the word lists and the animals. The spoken yes-or-no question and counting backwards go to the browser's recogniser alone (`useSecond` is false for those stages in `src/pages/Check.tsx`), so the digit and yes/no figures here describe the on-device model, not how the app scores those stages. If the on-device listener is ever added to those stages, it needs its own prompt first. This run did not test any other prompt.

Arabic errors are mostly near misses, not prompt words: only 10 of 432 wrong Arabic transcripts contain a prompt word. The most common wrong transcripts were سفر for صفر (zero, 30 of 60), سبا and سبب for سبعة (seven), ثمانيا and سمانيا for ثمانية (eight), تسعى and تسأل for تسعة (nine), سيطة and ثم for ستة (six), نام and نا for نعم (yes), and ل for لا (no). Many are one letter or one ending away from the right word. A looser Arabic match, for example folding س and ص or allowing one-letter differences on short closed sets, might recover some of these, but it would also raise the chance of matching a word nobody said. That trade-off has not been measured.

Animals (English only) did best, at 89% (72-96) on 27 clips, but the sample is small: the test set has only 7 to 10 clips each for cat, dog and bird.

"Nothing heard" was rare in both languages (1% English, under 1% Arabic). Almost every failure was a wrong word, not silence.

## Data, licences and citations

Both datasets are used unchanged, under CC BY 4.0. They are extracted under `external/` for this test and are not shipped with the app.

- Google Speech Commands v0.02, test set. Licence: Creative Commons Attribution 4.0 International. Pete Warden, "Speech Commands: A Dataset for Limited-Vocabulary Speech Recognition", arXiv:1804.03209, 2018. The test set's README gives its original location as http://download.tensorflow.org/data/speech_commands_v0.02.tar.gz
- Arabic Speech Commands v1.0. Licence: Creative Commons Attribution 4.0 International. Abdulkader Ghandoura, Farouk Hjabo and Oumayma Al Dakkak, "Building and Benchmarking an Arabic Speech Commands Dataset for Small-Footprint Keyword Spotting", Engineering Applications of Artificial Intelligence, 2021. Zenodo record 4662481.
- Whisper model weights by OpenAI (MIT), in the ONNX conversions published by onnx-community on Hugging Face.

## How to rerun

1. Extract the two archives into `external/speech-commands-en/x/` and `external/speech-commands-ar/x/`.
2. `npx tsx scripts/human-speech-bench.ts en`, then `npx tsx scripts/human-speech-bench.ts ar`. Each run merges its language into `src/data/human-speech-bench.json`.
3. `npx tsx scripts/human-speech-bench.ts md` prints the tables above from that file.
