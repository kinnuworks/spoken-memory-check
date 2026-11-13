# Own-voice word spotting on real recorded words

This tests one idea: in a word-list memory check, the person repeats each list word once right after hearing it, and those recordings become the answer key. In delayed recall, we look for the list words by comparing what they say with their own earlier recordings. No speech-to-text model is involved, so in principle it does not depend on language or dialect, and it runs in the browser.

The code is `src/engine/templates.ts` (MFCC features and dynamic time warping, plain TypeScript, no dependencies). Every figure below comes from one run of `scripts/template-bench.ts` with seed 20261114. The raw output is in `src/data/template-bench.json`. The script is deterministic: two runs gave identical results apart from timings. In the JSON, a threshold of `null` means no cost limit.

## Short version

- With one template per word, the matcher picks the right word from a 10-word list 94% of the time in Arabic and 76% in English. That is closed-set picking with no option to say "none of these".
- A real check also has to reject words that are not on the list. With thresholds set so about 5% of non-list words get through, it accepts the right word for 70% of Arabic list words and 53% of English ones. It almost never credits the wrong list word (0.1% Arabic, 1.7% English).
- In simulated recall recordings (several words in a row, with pauses), it found 71% of the list words said when no noise was added, 52% with background noise at 20 dB in the same room, and 30% at 10 dB. False detections were rare (0.04 to 0.12 per recording). Errors are almost all misses, so the recall score comes out too low.
- On the Whisper bench's own Arabic clips (single digits and yes/no), Whisper or the templates got 93.1% right (speaker interval 90.7 to 95.4%), against 82.1% for the Arabic-tuned Whisper alone. With the earlier Whisper model the figures were 80.4% and 39.6%. The templates added 0.8% false credits. English has only 113 clips that qualify and is weak evidence: 85.0% against 57.5%.
- It is fast: about 1 to 2 ms to process a one-second clip in Node, and under 3.5 ms per second of recall audio.

My view: it is not strong enough to score recall on its own. Read the section on putting it in the app before deciding.

## What this does and does not measure

These are the same two public datasets as `docs/HUMAN_SPEECH_BENCH.md`: one-second clips of single command words read aloud by adult volunteers. Neither dataset gives ages, neither is Gulf Arabic, and the Arabic README names no dialect. Each speaker recorded everything in one session.

That makes this easier than the real use in several ways:

- Same session. The template and the test repeats were recorded minutes apart, in the same place, on the same device, in the same reading voice. In the check, registration and delayed recall are also minutes apart, which helps, but the person may be sitting differently or holding the phone differently by then.
- Read speech, not recall. Recall is spontaneous. People hesitate, say "um", say the word inside a phrase ("there was a chair"), use a plural, or change the stress. None of that is in these clips.
- Simulated recall recordings. The continuous test joins separate one-second clips with clean pauses of 0.3 to 0.8 s. Real recall has uneven pauses, words that run together and talk between words.
- Young adult volunteers. Older speakers, speech affected by cognitive decline, missing teeth or dentures, and hearing loss are not represented.

It is also harder than the real use in one way: the command words include near pairs (on/off, up/down; in Arabic, the digits), and the check's own lists could be chosen to avoid sound-alike words.

## Method

### Features and matching

- 25 ms frames every 10 ms, pre-emphasis 0.97, Hamming window, 512-point FFT, 26 mel filters (20 Hz to 8 kHz), log, DCT to 13 coefficients, then cepstral mean normalisation over the clip and delta coefficients over ±2 frames: 26 values per frame.
- Mel energies are floored 30 dB below the clip's loudest frame, so a quiet template and a noisier recall share the same floor. This setting was chosen on development speakers only (see below). Spectral noise subtraction was also tried and made results much worse, so it is off.
- Silence at each end of a clip is trimmed by frame energy.
- DTW: Euclidean frame distance, a Sakoe-Chiba band of 20% of the longer clip around the length-scaled diagonal, and cost divided by the total length of both clips. Pairs whose lengths differ by more than 2.5 times are not compared.
- `classify` returns the closest list word, its cost, and its margin over the runner-up (1 minus best cost divided by second-best cost). A clip is accepted only if the cost is at most 4.8 and the margin at least 0.2.
- `spot` splits a longer recording into segments at pauses of 180 ms or more, by frame energy, and splits any segment longer than 1.6 s at its quietest point. It then classifies each segment. A word said twice is credited once.

### Thresholds and tuning

The 30 Arabic speakers were split at random into 15 development and 15 test speakers. The thresholds came from the development speakers only: the rule was "the most correct accepts while letting through at most 5% of non-list words". The front-end choice (the 30 dB floor, no noise subtraction) was also made by comparing a handful of settings on the development speakers' simulated recall recordings. All Arabic figures below are test speakers unless stated. English was not used for any tuning, so the English figures show how the Arabic-tuned settings carry over to another language.

### Isolated words

- Arabic (Arabic Speech Commands v1.0: 30 speakers, 40 words, 10 repeats each). For each test speaker, 10 random words of the 40 form the list and 10 other random words are the non-list words. One random repeat of each list word is the template. The other 9 repeats are test clips (1,350 in all), and all 10 repeats of each non-list word test rejection (1,500). A second list type uses the digits zero to nine as the list.
- English (Google Speech Commands v0.02 test set). 49 speakers have at least two repeats of each of the 10 core words (yes, no, up, down, left, right, on, off, stop, go). Those words are the list. One random repeat per word is the template and every other repeat is a test clip (1,807). For rejection, each core word in turn is left off the list and its clips are tested against the other 9 templates, plus the same speaker's other words where the test set has any (2,489 non-list clips in all).

### Simulated recall

For each speaker, 4 to 7 list words (repeats that were not the template) and 1 to 2 non-list words were trimmed, shuffled and joined with 0.3 to 0.8 s pauses after a 0.5 s lead-in. Arabic used the 15 test speakers with 10 recordings each (150 recordings). English used all 49 speakers with 4 each (196), with a list of 8 core words and the other 2 as non-list words.

Noise came from the Arabic dataset's own background recordings (street, kitchen, boiler, washing machine, water tap and so on). Each speaker got one of these as "their room".

- No noise added: only the dataset's own recording conditions.
- Same room, 20 dB and 10 dB: the noise is added to the recall recording and to the template clips, because registration and recall happen in the same place.
- Quiet templates, noisy recall, 20 dB: noise added to the recall only, as if the room got louder between registration and recall.
- Same room, 20 dB, two templates: two repeats of each word as templates.

A hit is a list word that was said and detected. A false detection is a detected list word that was not said, whether it came from a non-list word, a misheard list word or noise. Count error is the number of words detected minus the number said, which is what a recall score would be off by.

### Intervals

Each rate has two 95% intervals. The Wilson interval treats every clip as independent. The speaker bootstrap resamples speakers 2,000 times, which allows for clips from one speaker failing together. Use the bootstrap one: it is wider and closer to the truth, most of all for Arabic, which rests on 15 test speakers.

## Results

### Isolated words, one template per word

| Condition | Picks the right word (no rejection) | Right word accepted | Wrong list word accepted | Non-list word accepted (false accept) |
|---|---|---|---|---|
| Arabic, random 10-word lists, 15 test speakers | 94.1% (bootstrap 90.7-97.0) | 70.4% (65.1-75.6) | 0.1% (0.0-0.4) | 3.4% (1.7-5.4) |
| Arabic, digits list, 15 test speakers | 92.9% (89.1-96.1) | 70.0% (63.0-75.7) | 0.4% (0.1-0.9) | 3.6% (1.8-5.7) |
| Arabic, random lists, two templates per word | 97.0% (94.4-98.9) | 81.2% (75.9-86.0) | 0.1% (0.0-0.3) | 5.2% (3.0-7.6) |
| English, 10 core words, 49 speakers | 76.0% (70.2-81.4) | 52.5% (46.0-58.9) | 1.7% (0.9-2.6) | 7.2% (5.5-8.9) |

Per-speaker accuracy when picking without rejection: Arabic random lists ranged from 82% to 100% (median 98%), Arabic digits from 77% to 100% (median 96%), and English from 44% to 100% (median 80%).

English is clearly worse. The Google clips come from many different devices and rooms and are often clipped or noisy, and some English speakers have only two repeats of a word, so one bad template can't be outvoted. The English false-accept rate (7.2%) is above the 5% target because the thresholds were tuned on Arabic.

#### Trade-off

Isolated Arabic test speakers, random lists, minimum margin fixed at 0.2:

| Cost limit | Right word accepted | Wrong list word accepted | False accept |
|---|---|---|---|
| 3.5 | 31.4% | 0.0% | 0.1% |
| 4.0 | 50.0% | 0.1% | 0.7% |
| 4.5 | 64.3% | 0.1% | 2.1% |
| 4.8 (chosen) | 70.4% | 0.1% | 3.4% |
| 5.0 | 73.3% | 0.2% | 4.1% |
| 5.5 | 75.7% | 0.4% | 5.2% |
| 6.0 or more | 76.4 to 76.5% | 0.8% | 5.9 to 6.4% |

English with the same settings: 41.6% accepted at 2.8% false accept (cost 4.0), 52.5% at 7.2% (4.8), and 55.2% at 12.4% with no cost limit. Above about 5.5 the margin rule is what rejects clips, so raising the cost limit further does nothing. The full curves are in the JSON.

### Simulated recall recordings

| Condition | Arabic: list words found | Arabic: false detections per recording | English: list words found | English: false detections per recording |
|---|---|---|---|---|
| No noise added | 71.4% (63.5-79.3) | 0.04 | 53.3% (47.0-59.7) | 0.03 |
| Same room, 20 dB | 52.2% (39.3-63.9) | 0.09 | 43.1% (37.1-49.2) | 0.04 |
| Same room, 10 dB | 29.6% (20.9-37.8) | 0.12 | 24.6% (19.6-30.0) | 0.02 |
| Quiet templates, noisy recall, 20 dB | 45.1% (35.8-54.0) | 0.04 | 29.0% (23.8-34.4) | 0.04 |
| Same room, 20 dB, two templates | 47.8% (38.6-56.7) | 0.03 | 44.7% (38.2-51.0) | 0.03 |

(Bootstrap intervals over speakers. The English two-template row uses the 39 speakers with at least three repeats of every word.)

Of the detected words, 93% to 99% were really said. The problem is misses. With no noise added, the Arabic recall count came out exactly right in 22% of recordings (33 of 150) and on average 1.5 words too low. In the same room at 20 dB it was on average 2.5 words too low, out of 4 to 7 said.

Segmentation was not the main cause. Recordings produced 1.01 to 1.09 segments per word spoken, so words were seldom merged or split. Most misses are segments that matched the right template, but not closely enough to pass the threshold, and noise makes that much worse.

Two templates per word helped isolated clips (accepts rose from 70% to 81%) but not noisy recall (52% against 48% for Arabic, 43% against 45% for English, both within the intervals).

Loosening the thresholds trades misses for false detections (same room, 20 dB):

| Cost limit, margin | Arabic found | Arabic false per recording | English found | English false per recording |
|---|---|---|---|---|
| 4.8, 0.2 (chosen) | 52.2% | 0.09 | 43.1% | 0.04 |
| 5.5, 0.15 | 62.2% | 0.23 | 54.7% | 0.12 |
| 6.0, 0.10 | 69.4% | 0.37 | 65.4% | 0.29 |
| 7.0, 0.05 | 79.0% | 0.62 | 75.2% | 0.53 |
| none | 85.5% | 1.10 | 80.8% | 0.87 |

### Compared with the on-device Whisper listener (Arabic digits)

`docs/HUMAN_SPEECH_BENCH.md` measured whisper-small on single Arabic digits from the same dataset: 39% correct overall (35 to 43%), and per digit, zero 12%, one 67%, two 33%, three 15%, four 73%, five 75%, six 58%, seven 38%, eight 18%, nine 2%.

On the same ten words over all 30 speakers, own-voice templates pick the right digit 92.7% of the time (bootstrap 89.7-95.3): zero 82%, one 97%, two 92%, three 90%, four 94%, five 95%, six 97%, seven 87%, eight 98%, nine 94%. With rejection switched on (test speakers), the right digit is accepted 70.0% of the time.

The two tests ask different questions, so this is not a fair contest. Whisper hears a stranger and can write anything at all. The template matcher has already heard this exact person say this exact word, and only has to choose one of ten (chance is 10%). The comparison shows that own-voice matching does well on exactly the words where Whisper fails in Arabic (zero, three, eight, nine), not that one method is better than the other in general.

### Whisper and templates together, on the Whisper bench's own clips

This uses exactly the clips the Whisper bench scored (`clipsUsed` in `src/data/human-speech-bench.json`, digits and yes/no only). For each clip, the speaker's templates are a different repeat, by the same speaker, of every word in the closed set: digits 0 to 9 for a digit clip, and yes and no for a yes/no clip. Because two words is a small set for rejecting, yes/no is also reported with the 10 digits added as distractors (12 candidates). Thresholds are the strict ones (cost at most 4.8, margin at least 0.2).

A clip counts as correct for the combination if Whisper got it right or the template matcher accepted the right word. A false credit is the template matcher accepting a wrong word. Whisper's own outcome stays as the Whisper bench scored it. Its "wrong" outcome only means the expected word was not found, so any wrong word Whisper credited is not counted here.

Arabic: all 720 clips qualify (30 speakers, 10 repeats each).

The table below was measured with the earlier Whisper model (whisper-small, 40% alone). With the Arabic-tuned model now in the app, the overall row is: Whisper alone 82.1%, templates alone 71.0%, either 93.1% (speaker interval 90.7 to 95.4%), template false credit 0.8%. Current figures are in `src/data/template-bench.json`.

| Task | Clips | Whisper alone | Templates alone | Whisper or templates | Template false credit |
|---|---|---|---|---|---|
| Digits (10 candidates) | 600 | 39.2% (W 35.3-43.1; B 35.0-43.3) | 71.2% (W 67.4-74.6; B 65.5-77.0) | 80.2% (W 76.8-83.2; B 75.7-84.8) | 0.8% (W 0.4-1.9; B 0.2-1.5) |
| Yes/no (2 candidates) | 120 | 41.7% (W 33.2-50.6; B 32.5-50.8) | 70.0% (W 61.3-77.5; B 60.0-80.0) | 81.7% (W 73.8-87.6; B 75.0-87.5) | 0.8% (W 0.1-4.6; B 0.0-2.5) |
| Yes/no (12 candidates, digits as distractors) | 120 | 41.7% | 62.5% (W 53.6-70.6; B 53.3-70.8) | 78.3% (W 70.1-84.8; B 70.8-85.0) | 0.0% (W 0.0-3.1) |
| All (yes/no with 2 candidates) | 720 | 39.6% (W 36.1-43.2; B 36.7-42.6) | 71.0% (W 67.6-74.2; B 65.3-76.7) | 80.4% (W 77.4-83.2; B 76.4-84.4) | 0.8% (W 0.4-1.8; B 0.3-1.5) |
| All, 15 test speakers only | 360 | 40.0% (B 36.4-43.9) | 70.0% (B 62.2-78.3) | 80.3% (W 75.9-84.1; B 74.4-85.3) | 0.6% (B 0.0-1.4) |

W is the Wilson 95% interval, treating clips as independent. B is the bootstrap over speakers. The thresholds were tuned on the other 15 Arabic speakers, so the last row is the cleanest estimate. It agrees with the row for all 30.

Whisper got the wrong word on 432 of the 720 Arabic clips. On 5 of those (1.2%, B 0.2-2.1), the template matcher also accepted a wrong word, so neither listener rescued the clip and a false credit came on top. The other false credit (1 of 6) was on a clip Whisper got right.

English: only clips where the same speaker has another repeat of the word qualify. That is 113 of 360: 40 of 240 digit clips (18 speakers) and 73 of 120 yes/no clips (61 speakers). The Google test set has few repeats per speaker outside yes and no. As a result, the English candidate sets are small and uneven. Digit clips had 1 to 6 candidate words (mean 3.1), and yes/no clips had 1 or 2 (mean 1.8), because some speakers never recorded the other word. With only one candidate, the margin rule cannot reject anything. Read the English rows as weak evidence.

| Task | Clips | Whisper alone | Templates alone | Whisper or templates | Template false credit |
|---|---|---|---|---|---|
| Digits | 40 | 72.5% (W 57.2-83.9; B 55.0-87.5) | 75.0% (W 59.8-85.8; B 55.6-90.5) | 97.5% (W 87.1-99.6; B 91.7-100) | 0.0% (W 0.0-8.8) |
| Yes/no | 73 | 49.3% (W 38.2-60.5; B 37.5-61.4) | 76.7% (W 65.8-84.9; B 66.2-86.3) | 78.1% (W 67.3-86.0; B 68.4-87.3) | 1.4% (W 0.2-7.4; B 0.0-4.3) |
| All | 113 | 57.5% (W 48.3-66.2; B 46.7-67.5) | 76.1% (W 67.5-83.0; B 65.8-85.0) | 85.0% (W 77.2-90.4; B 77.7-91.6) | 0.9% (W 0.2-4.8; B 0.0-2.9) |

With the digits added as distractors for yes/no (1 to 8 candidates, mean 3.4), templates alone scored 74.0% on yes/no, the combination 76.7%, and false credits stayed at 1 of 73.

What this shows: on single isolated words, the two listeners fail on different clips. Together they got about 80% of Arabic digits and yes/no right with the earlier model, against 40% for Whisper; with the Arabic-tuned model the union is 93%, against 82% for Whisper alone, and the template matcher adds under 1% false credits. The caveats are the same as everywhere in this doc. The templates are read repeats from the same session, recorded on the same device. These are isolated one-second words, not a recall recording. Speakers are adult volunteers, not older adults. In the real check, the templates would come from the registration trial, and the person may say the word differently in recall. The simulated recall results above show how much worse the template matcher gets in continuous speech with room noise. This combination has not been tested in that setting.

### Speed (Node 26, this Mac)

Features for a one-second clip took 0.6 to 1.9 ms, and matching one clip against 10 templates took 0.3 to 1.1 ms (the range is across runs). Spotting in a recall recording took 0.5 to 3.3 ms per second of audio (the top of that range is with two templates per word). The whole benchmark (about 11,800 clips, 5 threshold settings of simulated recall and the Whisper combination) takes about two minutes. Browser speed was not measured, but at this cost it is not a concern.

## Putting it in the app

What it does well:

- When it credits a word, it is nearly always a word the person said. Wrong-word credits were 0.1 to 1.7%, and 93 to 99% of detections in recall were real.
- It does not care about language or dialect, and it handles the Arabic words Whisper gets wrong.
- It is tiny, fast and fully on-device.

What stops it from being the scorer:

- It misses too much. Even in the easiest simulated recall, 29% of Arabic words actually said were missed. At 20 dB of room noise it was about half. In a memory check, a missed word looks the same as a forgotten word, so a healthy person would score low. This is the wrong direction for a screening tool.
- Loosening the threshold to catch more words brings in false credits (0.3 to 1.1 per recording), which hides real forgetting.
- Every number here comes from clean, read, one-session speech from young adults. Spontaneous recall by older adults will be harder, and how much harder is not measured.

Where it could still help, if tested first:

- As an extra listener next to the existing two, at the strict threshold, crediting a word when any listener hears it. Its false detections are low (0.03 to 0.09 per recording with no added noise or noise at 20 dB), so it could fill in words Whisper mishears, especially Arabic numbers and short words. On the Whisper bench's own isolated Arabic clips, the combination got 80% of digits and yes/no right, against 40% for Whisper alone, with under 1% false credits (see above). It has not been measured on recall recordings or with the registration trial as the template.
- With more templates. Word-list tests that have several learning trials give extra recordings of each word for free. Two templates raised isolated acceptance from 70% to 81%, though they did not help noisy recall here.

Before anything ships, record a few real people (ideally older adults, in Arabic and English) doing registration and delayed recall in a normal room, and run them through `spot`. This benchmark cannot stand in for that.

## How to rerun

1. Extract the datasets as described in `docs/HUMAN_SPEECH_BENCH.md`.
2. `npx tsx scripts/template-bench.ts` writes `src/data/template-bench.json` and prints the summary.
3. `DEV=1 TEMPLATE_FE='{"trim":true,"rangeDb":30}' npx tsx scripts/template-bench.ts` reruns the development-speaker comparison used to choose the front end, and writes nothing.

## Data, licences and citations

- Arabic Speech Commands v1.0, CC BY 4.0. Abdulkader Ghandoura, Farouk Hjabo and Oumayma Al Dakkak, "Building and Benchmarking an Arabic Speech Commands Dataset for Small-Footprint Keyword Spotting", Engineering Applications of Artificial Intelligence, 2021. The background noise recordings come from the same dataset.
- Google Speech Commands v0.02 (test set), CC BY 4.0. Pete Warden, "Speech Commands: A Dataset for Limited-Vocabulary Speech Recognition", arXiv:1804.03209, 2018.
- Both are used unchanged, extracted under `external/` and not shipped with the app.
