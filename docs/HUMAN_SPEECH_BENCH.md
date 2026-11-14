# Second listener on real recorded words

This measures one part of the check: how often the on-device second listener, followed by our own word matching, finds the right word in a recording of a real person saying one word. It uses two public datasets of single spoken words. Every figure in the results tables comes from one run of `scripts/human-speech-bench.ts` per language, and the raw output, including each clip's transcript, is in `src/data/human-speech-bench.json`. The Arabic run uses the listener and matcher chosen by the experiments in the section "How the Arabic listener was chosen"; the English run is unchanged.

## What this does and does not measure

It measures the second listener only. The browser's own recogniser (the first listener) is not tested here, because it needs a live browser and cannot run headless. In the app a word counts when either listener hears it, so these numbers describe one of the two listeners, not the check's final scoring.

The clips are isolated single words, about one second each. The check itself asks for lists of words, a minute of animal names and counting backwards in one long recording, so the listener has more context there than here. These results may be better or worse than what happens in a real check, and this run cannot say which.

The speakers are adult volunteers. Neither dataset's README gives their ages, and they are not older adults recruited for this purpose. Neither dataset is Gulf Arabic: the Arabic Speech Commands README does not name a dialect at all. Nothing here tells us how the listener does with older speakers, with Gulf dialect, or with speech affected by cognitive decline.

## Setup

- Models and settings: the same as `src/speech/whisper.worker.ts`. English uses `onnx-community/whisper-base` with q8 weights. Arabic uses `onnx-community/whisper-small-ar-ONNX` with q4 weights: an ONNX conversion of `ayoubkirouane/whisper-small-ar`, which is OpenAI's whisper-small fine-tuned on Arabic Common Voice 11 and released under Apache-2.0. Both languages use the same style prompt (a list of ten everyday nouns), the same speech gate, the same 120-token limit and the same filter for looping output. The script checks the worker file for these settings and stops if they have changed.
- Runtime: Node 26 with Transformers.js. The browser runs the model on the WebAssembly backend; in Node the wasm backend did not load, so the same q8 ONNX files ran on onnxruntime's CPU backend. Small numeric differences from the browser are possible.
- Matching: yes and no go through `readYesNo` from `src/engine/yesno.ts`, which needs an exact word. Cat, dog and bird go through `matchClosedSet` against the English `ANIMALS` rows from `src/engine/lexicon.ts`, so "kitten" counts as cat and "puppy" as dog.
- Numbers: the app has no number matcher yet (counting backwards is not scored by word matching). The script's `readNumbers` accepts the digit (0 to 9, Western or Eastern Arabic numerals) and matches words with the app's `matchClosedSet` against a ten-row set: the English word and common Arabic spellings (for example اثنان, اثنين, ثلاثة, ثلاث, ثمانية, ثماني). In Arabic that means the app's near-miss rules apply to digits the same way they apply to a ten-word list (see "Arabic near misses" below). The number rows were written for this test and are not part of the app.
- Outcomes: "correct" means the expected word was found. "Wrong word" means the listener returned text but the expected word was not found in it (for yes and no, this includes an unclear answer). "Nothing heard" means an empty transcript, either because the speech gate found no speech or because the model returned nothing usable.
- Intervals are Wilson 95% intervals.

## Sample

The random sample uses a seeded generator (mulberry32). The seed is 20261112 for English and 20261113 for Arabic. For each word the script takes up to 60 clips, going round the speakers in shuffled order and taking one clip from each speaker per round, so no speaker is over-represented.

- English: Google Speech Commands v0.02 test set. Yes and no have their own folders (419 and 405 clips), so 60 of each were taken, every one from a different speaker. The digits and cat, dog and bird are in the test set's `_unknown_` folder with between 7 and 34 clips each, so all of them were used. Speaker ids come from the file names. 387 clips, 168 speakers.
- Arabic: Arabic Speech Commands v1.0. Its 30 speakers each recorded every keyword 10 times (300 clips per keyword). The script took 60 per word, two from each speaker, for the digits zero to nine, yes (نعم) and no (لا). 720 clips, 30 speakers. The dataset has no animal words.

Run time on this Mac: English 163 s for 387 clips (0.42 s a clip). Arabic 914 s for 720 clips (1.27 s a clip). Model downloads are not included. The earlier Arabic run with whisper-small took 4.03 s a clip, but a rerun of that setting on 180 clips during the experiments took 0.66 s a clip, so the old figure was probably slowed by other work on the machine and the two timings should not be compared.

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

### Arabic (onnx-community/whisper-small-ar-ONNX, q4, 720 clips)

| Word or task | Clips | Speakers | Correct (95% CI) | Wrong word (95% CI) | Nothing heard (95% CI) |
|---|---|---|---|---|---|
| zero | 60 | 30 | 63% (51-74) | 37% (26-49) | 0% (0-6) |
| one | 60 | 30 | 90% (80-95) | 10% (5-20) | 0% (0-6) |
| two | 60 | 30 | 57% (44-68) | 43% (32-56) | 0% (0-6) |
| three | 60 | 30 | 97% (89-99) | 3% (1-11) | 0% (0-6) |
| four | 60 | 30 | 90% (80-95) | 10% (5-20) | 0% (0-6) |
| five | 60 | 30 | 93% (84-97) | 7% (3-16) | 0% (0-6) |
| six | 60 | 30 | 77% (65-86) | 23% (14-35) | 0% (0-6) |
| seven | 60 | 30 | 95% (86-98) | 5% (2-14) | 0% (0-6) |
| eight | 60 | 30 | 95% (86-98) | 5% (2-14) | 0% (0-6) |
| nine | 60 | 30 | 82% (70-89) | 18% (11-30) | 0% (0-6) |
| yes | 60 | 30 | 48% (36-61) | 52% (39-64) | 0% (0-6) |
| no | 60 | 30 | 98% (91-100) | 2% (0-9) | 0% (0-6) |
| Task: digits | 600 | 30 | 84% (81-87) | 16% (13-19) | 0% (0-1) |
| Task: yes/no | 120 | 30 | 73% (65-80) | 27% (20-35) | 0% (0-3) |
| All Arabic | 720 | 30 | 82% (79-85) | 18% (15-21) | 0% (0-1) |

The previous Arabic setting (`onnx-community/whisper-small`, q8, exact matching) got 40% (36-43) of the same 720 clips right: digits 39% (35-43), yes/no 42% (33-51). Both changes contributed. With exact matching, the new model gets 66% of the 600 digit clips; the near-miss rules raise that to 84%. The old model with the new rules gets 63% of digits. No digit clip matched a wrong digit in this run (0 of 600).

The Arabic intervals treat every clip as independent. Each speaker gives two clips per word and 24 in total, and clips from one speaker are likely to fail together, so the true uncertainty is wider than shown, most of all for the task and overall rows, which rest on 30 people.

## What went wrong

English errors mostly come from the style prompt. Of the 142 wrong English transcripts, 93 contain one of the ten nouns in the prompt. "Yes" came back as "house," 21 times out of 60, and "no" came back as "door," 23 times out of 60. "Three" became "tree" 14 times; "tree" is in the prompt and also sounds close. The prompt was chosen for word lists, where it helps the model write single nouns. On a lone one-second word it pulls the model towards the prompt's own words. In the app this listener only hears the word lists and the animals. The spoken yes-or-no question and counting backwards go to the browser's recogniser alone (`useSecond` is false for those stages in `src/pages/Check.tsx`), so the digit and yes/no figures here describe the on-device model, not how the app scores those stages. If the on-device listener is ever added to those stages, it needs its own prompt first. This run did not test any other prompt.

With the previous model, Arabic errors were mostly near misses: سفر for صفر (zero, 30 of 60), سبا for سبعة, سمانيا for ثمانية, تسعى for تسعة, نام for نعم. The fine-tuned model makes fewer of them, and the near-miss rules now accept the ones that are a folded letter or one letter away. The errors left are further off. Two came out as إسلام or سنان (4 and 2 of 60), six as سيطة or سدة, nine as تساء or سا. Yes (نعم) is the weakest word at 48%: the model wrote نام 9 times, نوم 9 times and a bare full stop 8 times. نعم has three letters, so the rules never stretch it, and readYesNo needs an exact word anyway.

Animals (English only) did best, at 89% (72-96) on 27 clips, but the sample is small: the test set has only 7 to 10 clips each for cat, dog and bird.

"Nothing heard" was rare in both languages (1% English, 0% Arabic). Almost every failure was a wrong word, not silence. In Arabic, 8 of the wrong words were a lone full stop, which is close to silence.

## How the Arabic listener was chosen

`scripts/arabic-asr-experiments.ts` compared models, prompts and matchers on the first 15 clips per word of the bench sample (180 clips, 30 speakers, same seed). It caches every transcript in `external/asr-experiments/`. To measure false accepts it also transcribed 140 clips of the dataset's 28 other keywords (five each, such as أسفل, تسجيل, موافق) and 60 recordings made by joining five different keywords from one speaker with half a second of silence. The figures in this section come from that script, not from the full bench run above.

### Models (180 clips, exact matching / with the near-miss rules)

| Setting | Download | Correct, exact | Correct, near-miss rules | Seconds a clip |
|---|---|---|---|---|
| whisper-small q8, style prompt (previous app setting) | 249 MB | 40% (33-47) | 57% (50-64) | 0.66 |
| whisper-small q8, no prompt | 249 MB | 39% (32-46) | 58% (51-65) | 1.40 |
| whisper-small q8, prompt of other number words or short replies | 249 MB | 44% (37-52) | 63% (56-70) | 1.36 |
| whisper-small-ar q8, no prompt | 406 MB | 67% (60-74) | 82% (76-87) | 1.31 |
| whisper-small-ar q8, style prompt | 406 MB | 68% (61-75) | 83% (77-88) | 0.65 |
| whisper-small-ar q8, prompt of other number words or short replies | 406 MB | 72% (65-78) | 83% (77-88) | 0.66 |
| whisper-small-ar q4, no prompt | 299 MB | 66% (59-73) | 82% (76-87) | 1.15 |
| whisper-small-ar q4, style prompt | 299 MB | 63% (56-70) | 81% (75-86) | 1.26 |
| whisper-small-arabic-dialectal-v2 (OpenVoiceOS ONNX), no prompt | about 706 MB | 59% (52-66) | 71% (64-77) | 0.85 |
| whisper-small-arabic-dialectal-v2, style prompt | about 706 MB | 53% (46-60) | 64% (57-71) | 0.61 |
| whisper-large-v3-turbo q4, no prompt | about 760 MB | 43% (36-51) | 59% (52-66) | 8.64 |

Download is the encoder plus merged decoder at that precision, as listed on Hugging Face. Seconds a clip is Node on the CPU backend of this Mac, and runs shared the machine with other work, so treat timings as rough. The fine-tuned small model was clearly better than every other option, and its q4 weights scored within a few points of q8 while staying under 300 MB, so the app uses q4. The prompt made little difference to the fine-tuned model on single words, so the app keeps the style prompt it already used for word lists. Large-v3-turbo was no better than whisper-small here, too big to download, and about 13 times slower. Whisper-medium was not tried: its smallest published build (q4f16) is about 520 MB. The dialectal model is Apache-2.0 but its ONNX export's int8 decoder is the same size as the fp32 one, so it does not look quantised, and it scored lower anyway.

On the 60 five-word recordings, words found went from 77% (72-82) for the previous setting to 85% (80-88) for the fine-tuned model with exact matching, and 95% (92-97) with the near-miss rules. Joined words are easier than lone ones for every setting.

### Arabic near misses (`src/engine/match.ts`)

After exact matching, any Arabic word left over is tried again against the single-word forms of the set:

- Folding: ص, ث and س count as one letter, as do ط and ت, ظ, ذ and ز, and ض and د. A final ة, ه or ا counts as ه. This applies to every closed set.
- One letter added, dropped or changed, after folding, only when the set has 12 rows or fewer (the word lists, not the 65-row animal set), only for forms of four letters or more, and only when the first letter agrees.
- A word that comes close to two rows matches neither. English matching is unchanged.

False accepts, measured three ways:

- Clips of one keyword that matched a different keyword: 0 of 180 for the fine-tuned model, before and after the rules. On the full bench run, 0 of 600 digit clips matched a wrong digit.
- The 140 clips of other keywords. For the fine-tuned model, 3 matched a digit, yes or no with the rules, against 2 with exact matching; the new one was إِدّأ (start) read as أبدا (never, a "no" word). None matched a word on either app word list or an animal. For the previous model, the rules added one match to a list word: طيب (good) to طبيب (doctor). Without the first-letter condition, 11 of the 140 fine-tuned clips matched a list word or animal, which is why that condition is there.
- Five-word recordings: 2 of 60 picked up a digit that was not said, both seven, from سبة (six) and ساعة (said for nine). Six and seven are one letter apart (ستة, سبعة); the two app word lists have no pair of words that close.

A text-only check (`npx tsx scripts/arabic-asr-experiments.ts lexicon`) runs 350 Arabic words through the rules: the two lists, the animals, about 200 everyday nouns, and words chosen because they sit one letter from a list word. None of the everyday nouns, list words or animals matches a list word or animal it should not. The chosen neighbours do match, as the rule says they will: مرات (times) counts as مرآة (mirror), تذكر (remember) as تذكرة (ticket), شرير (evil) and شريف (honest) as شريط (ribbon), أبريل (April) as إبريق (jug), طبيبة as طبيب. Against the digit set, five everyday nouns match: سماء (sky) as eight, ساعة (clock) as seven, ثلاجة (fridge) as three, سكين (knife) as two and سفر (travel) as zero. If a person says one of the list neighbours on a recall task, the check will credit the list word. That is the cost of the rules, and it has not been measured on real recall.

None of this was tested on the app's own word lists or animal names spoken by real people, on long recall recordings, on older speakers or on Gulf dialect. The digits and yes/no stand in for list words because they are the only Arabic words in the dataset.

## Data, licences and citations

Both datasets are used unchanged, under CC BY 4.0. They are extracted under `external/` for this test and are not shipped with the app.

- Google Speech Commands v0.02, test set. Licence: Creative Commons Attribution 4.0 International. Pete Warden, "Speech Commands: A Dataset for Limited-Vocabulary Speech Recognition", arXiv:1804.03209, 2018. The test set's README gives its original location as http://download.tensorflow.org/data/speech_commands_v0.02.tar.gz
- Arabic Speech Commands v1.0. Licence: Creative Commons Attribution 4.0 International. Abdulkader Ghandoura, Farouk Hjabo and Oumayma Al Dakkak, "Building and Benchmarking an Arabic Speech Commands Dataset for Small-Footprint Keyword Spotting", Engineering Applications of Artificial Intelligence, 2021. Zenodo record 4662481.
- Whisper model weights by OpenAI (MIT), in the ONNX conversions published by onnx-community on Hugging Face. The Arabic model is `ayoubkirouane/whisper-small-ar` (Apache-2.0, fine-tuned on Mozilla Common Voice 11), converted as `onnx-community/whisper-small-ar-ONNX`.

## How to rerun

1. Extract the two archives into `external/speech-commands-en/x/` and `external/speech-commands-ar/x/`.
2. `npx tsx scripts/human-speech-bench.ts en`, then `npx tsx scripts/human-speech-bench.ts ar`. Each run merges its language into `src/data/human-speech-bench.json`.
3. `npx tsx scripts/human-speech-bench.ts md` prints the tables above from that file.
4. The Arabic experiments: `npx tsx scripts/arabic-asr-experiments.ts run <config> subset|other|seq`, then `report subset`, `report seq` and `lexicon`.

## A smaller copy of the Arabic model (15 Nov)

The 4-bit build of whisper-small-ar leaves the decoder's token-embedding table (51,865 x 768) at 32 bits: 159 MB of the 232 MB decoder. `scripts/shrink-arabic-model.py` stores that table as 4-bit numbers, packed two to a byte, with one 16-bit scale per block of 64, and restores it with standard ONNX operators when the model loads. Nothing else changes. The download falls from about 299 MB to about 165 MB, and every file is under 100 MB, so this site serves the model itself (`scripts/build-arabic-model.sh`).

On all 720 real Arabic clips of the bench, with the style prompt and the app's matcher:

| Model | Download | Words heard right, all 720 clips | Wrong words credited |
|---|---|---|---|
| whisper-small-ar q4, as published | 299 MB | 82% (79 to 85) | 0% (0 to 1) |
| Same, embedding table at 4 bits (now in the app) | 165 MB | 83% (80 to 86) | 0% (0 to 1) |

The difference is inside the interval: the smaller copy hears as well as the original. `npx tsx scripts/arabic-asr-experiments.ts report full`, configurations `smallarq4-style` and `smallarq4emb4-style`.

