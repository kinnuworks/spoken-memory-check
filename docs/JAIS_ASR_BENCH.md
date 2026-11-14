# Jais-ASR on the same recorded words

The question: does Jais-ASR, the Arabic speech model from MBZUAI's Institute of Foundation Models (IFM) and Inception, find the right word more often than the app's on-device listener? The comparison uses the same 720 Arabic and 387 English single-word clips as `docs/HUMAN_SPEECH_BENCH.md`, scored with the app's own matching. On those clips the current app (Arabic-tuned whisper-small, q4) gets 82% of the Arabic words right.

Jais-ASR got 97% of the Arabic clips right (95.6-98.1 Wilson; 95.6-98.5 when speakers are resampled). It also got 90% of the English clips, against 62% for the app's English whisper-base. Combined with the speaker's own-voice templates, it reached 99.2% on Arabic, against 93.1% for Whisper with templates. Every number below comes from one run on 14 Nov 2026. The raw transcripts and per-clip outcomes are in `src/data/jais-asr-bench.json`.

## What was run

- Build: `IFM/Jais-ASR-MLX-4bit`, revision `0867c7a` (13 Oct 2026). Its text decoder is 4-bit GPTQ, which IFM says has the same values as `Jais-ASR-Q4_K_S.gguf`, and its audio encoder is bf16. The download is 4.5 GB. It was fetched anonymously, without a Hugging Face token.
- Runtime: on this Mac (Apple M5, 16 GB), using `mlx-vlm` at commit `6ecadd7` with IFM's `mlx-vlm-jais-asr.patch` from the model repo, exactly as the model card documents, plus MLX 0.32.4 and PyTorch 2.15 (the audio processor needs it). It runs on the Mac's GPU through Metal. The GGUF and transformers routes were not needed.
- Settings: the model card's command-line example. The user prompt is empty, decoding is greedy (temperature 0) with repetition penalty 1.05, and output stops at 256 tokens. The language is pinned to the clip's language (`ar` or `en`), which still lets the model choose any of the 19 Arabic dialect tags. Diacritics and code-switching are off. The output goes through the model repo's own `postprocess.split_text`, which separates the dialect tag and the no-speech signal from the transcript.
- Input: the raw one-second clip. There is no speech gate and no style prompt, unlike the Whisper setup.
- Scoring: `scripts/jais-asr-score.ts` uses the same `readNumbers`, `readYesNo` and `matchClosedSet` rules (Arabic near-miss rules included) and the same correct, wrong-word and nothing-heard outcomes as `scripts/human-speech-bench.ts`. As a check, the script rescores every stored Whisper transcript with the same rules and stops if any outcome differs from the published one. None did.
- Intervals: Wilson 95% intervals treat each clip as independent. The speaker-bootstrap interval resamples speakers with replacement (2,000 draws, seeded), so it allows for clips from one person failing together. Arabic has 30 speakers, each giving 24 clips.

To reproduce: `JAIS_BACKEND=mlx external/jais-mlx-venv/bin/python -I scripts/jais-asr-transcribe.py ar` (then `en`), `npx tsx scripts/jais-asr-score.ts`, then `npx tsx scripts/jais-asr-templates.ts`.

### Speed and memory on this Mac

| | Arabic (720 clips) | English (387 clips) |
|---|---|---|
| Seconds a clip, median (mean) | 0.51 (0.56) | 0.52 (0.55) |
| Whole run, including Python start and a 4 to 6 s model load | 401 s | 223 s |
| Peak MLX memory | 4.74 GB | 4.67 GB |
| Peak process memory footprint (`/usr/bin/time -l`) | 5.59 GB | 5.50 GB |

The first clip after loading took 6.9 s. Other work was running on the machine at the same time, so treat the timings as rough. The app's Whisper bench took 1.27 s a clip on the CPU, so the two timings are not like for like.

## Results

### Arabic (720 clips, 30 speakers)

| Word or task | Clips | Correct (Wilson; speaker bootstrap) | Wrong word (Wilson; speaker bootstrap) | Nothing heard |
|---|---|---|---|---|
| zero | 60 | 98% (91-100; 95-100) | 2% (0-9; 0-5) | 0 |
| one | 60 | 100% (94-100; 100-100) | 0% (0-6; 0-0) | 0 |
| two | 60 | 92% (82-96; 83-98) | 8% (4-18; 2-17) | 0 |
| three | 60 | 100% (94-100; 100-100) | 0% (0-6; 0-0) | 0 |
| four | 60 | 98% (91-100; 95-100) | 2% (0-9; 0-5) | 0 |
| five | 60 | 100% (94-100; 100-100) | 0% (0-6; 0-0) | 0 |
| six | 60 | 98% (91-100; 95-100) | 2% (0-9; 0-5) | 0 |
| seven | 60 | 97% (89-99; 92-100) | 3% (1-11; 0-8) | 0 |
| eight | 60 | 100% (94-100; 100-100) | 0% (0-6; 0-0) | 0 |
| nine | 60 | 87% (76-93; 75-97) | 13% (7-24; 5-25) | 0 |
| yes (نعم) | 60 | 95% (86-98; 90-100) | 5% (2-14; 0-10) | 0 |
| no (لا) | 60 | 100% (94-100; 100-100) | 0% (0-6; 0-0) | 0 |
| Task: digits | 600 | 97% (95-98; 95-99) | 3% (2-5; 2-5) | 0 |
| Task: yes/no | 120 | 98% (93-99; 95-100) | 3% (1-7; 0-5) | 0 |
| All Arabic, Jais-ASR | 720 | 97% (96-98; 96-99) | 3% (2-4; 2-4) | 0 |
| Whisper (current app), digits | 600 | 84% (81-87; 80-87) | 16% (13-19; 13-20) | 0 |
| Whisper (current app), yes/no | 120 | 73% (65-80; 67-80) | 27% (20-35; 20-33) | 0 |
| All Arabic, Whisper (current app) | 720 | 82% (79-85; 79-85) | 18% (15-21; 15-21) | 0 |

Clip by clip, both got 585 right and both missed 15. Jais-ASR got 114 clips that Whisper missed, and Whisper got 6 that Jais-ASR missed. Five of those six were nine (تسعة), which Jais-ASR wrote as ستة (six), ساعة or ديسان. The sixth was a yes clip that Jais-ASR wrote in Latin letters as "Now". Of the 15 clips both missed, 5 are two (both models often wrote نان or a word like سلام) and 4 are nine.

The worst kind of miss is a transcript that matches another word in the same closed set, because that gives credit to the wrong answer. Jais-ASR did this on 5 of 720 clips. Two were nine written as ستة, which is six. The other three come from the app's near-miss rules rather than from the model: ساعة and الساعة (for nine) are one letter from سبعة, so they matched seven, and سلام (for two) matched three. Whisper did it once, writing لا (no) for a yes clip. In English, Jais-ASR did it twice ("Seven" for zero, "Two" for three) and Whisper never.

Jais-ASR tagged 604 Arabic clips as MSA and the rest as Egyptian (32), Moroccan (26), Saudi (17), Iraqi (16), Omani (13), Libyan (6), Mauritanian (5) and Lebanese (1). The dataset does not record dialect, so these tags cannot be checked. It never returned its no-speech signal on Arabic.

### English (387 clips, 168 speakers)

| Task | Clips | Correct (Wilson; speaker bootstrap) | Wrong word | Nothing heard |
|---|---|---|---|---|
| Digits | 240 | 88% (83-91; 83-91) | 12% | 0% (1 clip) |
| Yes/no | 120 | 96% (91-98; 92-99) | 4% | 0 |
| Animals | 27 | 89% (72-96; 72-100) | 11% | 0 |
| All English, Jais-ASR | 387 | 90% (87-93; 87-93) | 10% | 0% (1 clip) |
| All English, Whisper-base (current app) | 387 | 62% (57-67; 56-67) | 37% | 1% |

Clip by clip, Jais-ASR got 114 clips that Whisper missed, and Whisper got 5 that Jais-ASR missed. Four is the weakest word (61%), because six of the misses were written "for". With the language pinned to English, Jais-ASR still wrote some clips in Arabic script (zero as صفر or زيرو, eight as إيه, nine as نعم). It returned its no-speech signal on one clip. The app's English listener is whisper-base, a smaller model than the Arabic one, so this gap says more about model size than about Arabic.

## Jais-ASR or the speaker's own voice

The app can also match a word against the speaker's own recordings of the list words (MFCC and DTW templates, `scripts/template-bench.ts`). `scripts/jais-asr-templates.ts` reruns the per-clip template step from that script with the same seeds, clip order and strict thresholds (maximum cost 4.8, minimum margin 0.2), so each clip gets the same template draw as the published run. Before writing anything, the script checks that the Whisper, template and Whisper-or-template counts match `src/data/template-bench.json` exactly. They did. Templates are one other repeat by the same speaker of each word in the closed set: the ten digits for digit clips, and yes and no for yes/no clips.

| Arabic, 720 clips | Correct (Wilson; speaker bootstrap) |
|---|---|
| Whisper alone | 82.1% (79.1-84.7; 79.2-85.0) |
| Templates alone | 71.0% (67.6-74.2; 65.3-76.7) |
| Whisper or templates (what the app can do now) | 93.1% (91.0-94.7; 90.7-95.4) |
| Jais-ASR alone | 97.1% (95.6-98.1; 95.6-98.5) |
| Jais-ASR or templates | 99.2% (98.2-99.6; 98.3-99.7) |
| Jais-ASR or Whisper | 97.9% (96.6-98.7; 96.5-99.2) |
| Jais-ASR or Whisper or templates | 99.3% (98.4-99.7; 98.5-99.9) |

By task, Jais-ASR or templates reached 99.0% of digits (594 of 600) and 100% of yes/no (120 of 120). The templates gave credit to a wrong word on 6 of 720 clips, the same as in the published run, and none of those were clips where Jais-ASR had also heard a wrong word. Clip by clip, the templates rescued 15 of the 21 clips Jais-ASR missed, and Jais-ASR got 203 clips the templates missed.

In English, only 113 clips have another repeat by the same speaker to use as a template. On those, Whisper or templates got 85.0% (77.2-90.4), Jais-ASR alone 92.9% (86.6-96.4) and Jais-ASR or templates 97.3% (92.5-99.1).

The templates here come from the same recording session as the test clip. In the real check they would come from the registration trial, so these union figures are probably better than what the app would see.

## What this does not show

- These are single read words, about one second each, and the check asks for lists and a minute of continuous speech. Results on longer recordings could be better or worse.
- The speakers are adult volunteers. The Arabic dataset has 30 speakers, does not name a dialect, and is not Gulf or Emirati speech. Nobody in either dataset was recruited as an older adult or as someone with cognitive decline. Nothing here says how Jais-ASR does with older Emirati speakers, which is the group the app is for.
- The Arabic clips are 30 people saying 12 words. The speaker-bootstrap intervals allow for that, but 30 people is still a small group.
- The 4-bit MLX build is what ran. IFM reports nearly the same leaderboard error for it as for bf16 (22.94% against 22.85% WER), and the 3-clip pilot on IFM's bf16 Space gave the same three transcripts. A GGUF or bf16 server could still differ slightly on individual clips.
- Jais-ASR is a server-side model. Using it in the app means sending the person's voice to a server, which changes the privacy promise from "audio stays on the device" to "audio goes to a server in the UAE". The app would need consent for that, and a fallback when the network is down.

## Is an optional UAE-hosted Jais-ASR listener justified?

On accuracy, yes. On these clips it cut Arabic misses from 129 to 21 (82% to 97%), and with own-voice templates from 50 to 6 (93.1% to 99.2%). The intervals do not overlap under either method. Jais-ASR got more clips right than Whisper for 27 of the 30 speakers, the same number for 2, and one fewer for 1. It credited a wrong word on 5 clips in 720, three of them through the app's near-miss rules.

What the data does not settle is whether the gain holds for older Gulf speakers in a real check, and that is where the decision belongs. The case is for an optional second listener that a clinic switches on with the person's consent, hosted in the UAE, while the on-device Whisper and templates stay as the default and the fallback. It is not a case for replacing the on-device path, because the on-device path already gets 93% with templates and keeps audio on the device. Before relying on it in scoring, record a small set of older Emirati speakers doing the real check and compare the two listeners on those recordings.

## The model

- Repo: https://huggingface.co/IFM/Jais-ASR (revision `1323995`, last changed 13 Oct 2026). Not gated. The card's metadata and text say Apache 2.0. The repo has no separate LICENSE file.
- It loads with custom code (`trust_remote_code=True`), so the Python files in the repo run on load. The MLX build also ships custom code, which mlx-vlm runs.
- Architecture: a Qwen3-Omni-style audio encoder (32 layers, width 1280) feeding a Jais-3-4B text decoder. bf16 weights are 11.46 GB.
- Languages: Modern Standard Arabic and 19 dialects, including Emirati (`AE`), plus English, French, Spanish and Italian. It labels the dialect it heard and returns `[IFM-NoTranscript]` when there is no speech.
- Builds (sizes and word error rates are the vendor's, not measured here):

| Build | Size | Leaderboard WER (vendor) | Runs on |
|---|---|---|---|
| bf16, https://huggingface.co/IFM/Jais-ASR | 11.46 GB, about 12.4 GiB GPU | 22.85% | Transformers, vLLM |
| GGUF Q8_0 + mmproj F16, https://huggingface.co/IFM/Jais-ASR-GGUF | 6.71 GB, 7.55 GiB GPU | 22.83% | MBZUAI-IFM llama.cpp fork + patch |
| GGUF Q4_K_M + mmproj Q6_K | 3.71 GB, 5.03 GiB GPU | 22.99% | same |
| GGUF IQ4_XS + mmproj Q4_K (smallest) | 3.29 GB, 4.69 GiB GPU | 23.69% | same |
| MLX 4-bit, https://huggingface.co/IFM/Jais-ASR-MLX-4bit (used here) | 4.50 GB | 22.94% | mlx-vlm at a pinned commit + patch, needs PyTorch |
| MLX 8-bit, https://huggingface.co/IFM/Jais-ASR-MLX-8bit | 7.03 GB | 22.76% | same |
| FP8 and W4A16-AWQ (IFM/Jais-ASR-FP8, IFM/Jais-ASR-W4A16-AWQ) | 7.68 GB, 5.85 GB | not given | vLLM |

### Leaderboard entry

The Open Universal Arabic ASR Leaderboard (https://huggingface.co/spaces/elmresearchcenter/open_universal_arabic_asr_leaderboard) added Jais-ASR on 18 Oct 2026. The evaluation script came in through https://github.com/Natural-Language-Processing-Elm/open_universal_arabic_asr_leaderboard/pull/31, from an outside contributor. Read from the Space's `app.py` on 14 Nov 2026:

- Jais-ASR is first of 39: average WER 22.82%, CER 8.31% (the model card quotes 22.85% and 8.37%).
- Next are Sygma-ASR-Arabic (23.01%), Audar-ASR-V1-Turbo (23.17%) and cohere-transcribe-arabic-07-2026 (24.19%). Audar is better on SADA, the Saudi dialect set (28.92% against 30.52%).
- `openai/whisper-small`, the base of the app's Arabic listener before Arabic fine-tuning, is 36th at 55.13% WER.

None of the leaderboard's six test sets is Emirati, older speakers or single words.

## Deployment

### In the browser: no

There is no ONNX or Transformers.js export, Transformers.js has no `jais_asr` architecture, and the smallest build is 3.29 GB. That is roughly 13 times the Whisper-small q8 download, too much for a phone or an older laptop. The MLX run above needed about 5.6 GB of memory on a 16 GB Mac. Using Jais-ASR means sending audio to a server.

### Smallest honest server in the UAE

Azure UAE North list prices, Linux pay-as-you-go, USD per hour, from the Azure retail prices API (https://prices.azure.com/api/retail/prices with `armRegionName eq 'uaenorth'`) on 14 Nov 2026. GPU shares are from https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/gpu-accelerated/nvadsa10v5-series.

| VM | GPU | Fits | $/hour |
|---|---|---|---|
| Standard_NV12ads_A10_v5 | 1/3 A10, 8 GB | GGUF Q4_K_M (5.03 GiB peak, vendor figure) | 1.298 |
| Standard_NV18ads_A10_v5 | 1/2 A10, 12 GB | GGUF Q8_0 (7.55 GiB) | 2.288 |
| Standard_NV36ads_A10_v5 | full A10, 24 GB | bf16 (12.4 GiB) | 4.576 |
| Standard_NC24lds_xl_RTXPRO6000BSE_v6 | RTX PRO 6000 share | probably bf16, VRAM share not checked | 1.617 |
| Standard_D8as_v5 | none, 8 vCPU | GGUF on CPU, speed not measured | 0.424 |

At $1.298 an hour, an NV12ads running all month (730 h) costs about $948 before disk and bandwidth. Running it only for demos and pilot sessions costs much less. Partial A10 sizes use NVIDIA GRID drivers. ASSUMPTION: llama.cpp's CUDA build works on the 1/3 share. Microsoft markets these sizes for graphics, so test this before relying on it. Azure has no Apple silicon, so the MLX build measured here would not be the one deployed; the GGUF Q4_K_S/Q4_K_M builds are the closest server equivalent.

Hugging Face Inference Endpoints are not an option for UAE residency. The FAQ lists AWS us-east-1 and eu-west-1, Azure eastus and GCP us-east4 only (https://huggingface.co/docs/inference-endpoints/en/support/faq). For comparison, an A10G there is $1.00 an hour (https://huggingface.co/docs/inference-endpoints/en/pricing).

## History of this measurement

A first attempt stopped for lack of disk space. Before that, three zero clips went through IFM's public demo Space (https://huggingface.co/spaces/IFM/jais-asr, bf16 on ZeroGPU) until its anonymous quota ran out. Those three transcripts (صفر, صفر, صفش) are kept in `external/jais-asr/transcripts-ar.space-pilot.json`, and the local MLX run gave the same three. The transcribe script can still use the Space, or a local llama-server through `JAIS_URL`, but the published figures all come from the MLX run.

## Licences and data

- Jais-ASR: Apache 2.0, per the model card. mlx-vlm: MIT.
- Arabic Speech Commands v1.0 and Google Speech Commands v0.02: CC BY 4.0, as in `docs/HUMAN_SPEECH_BENCH.md`. Only the three pilot clips left this machine, sent to IFM's public Space, which is allowed for this public dataset. No user audio was sent anywhere.
