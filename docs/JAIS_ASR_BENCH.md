# Jais-ASR on the same recorded words

The question: would Jais-ASR, the Arabic speech model from MBZUAI's Institute of Foundation Models and Inception, find the right word more often than the on-device Whisper-small listener does now (40% of 720 Arabic single-word clips, see `docs/HUMAN_SPEECH_BENCH.md`)?

**Status: the full run has not happened yet.** The model exists and is usable, and the scripts work end to end, but only 3 of the 720 clips have been transcribed. The reasons and the two ways forward are below. Nothing in this file is a Jais-ASR accuracy figure for our task.

## The model is real and licensed for use

- Repo: https://huggingface.co/IFM/Jais-ASR (revision `1323995`, last changed 13 Oct 2026). Not gated. The card's metadata and text say Apache 2.0. The repo has no separate LICENSE file.
- It loads with custom code (`trust_remote_code=True`), so the Python files in the repo run on load.
- Architecture: a Qwen3-Omni-style audio encoder (32 layers, width 1280) feeding a Jais-3-4B text decoder. bf16 weights are 11.46 GB.
- Languages: Modern Standard Arabic and 19 dialects, including Emirati (`AE`), plus English, French, Spanish and Italian. It labels the dialect it heard and returns `[IFM-NoTranscript]` when there is no speech.
- Smaller builds (sizes and word error rates are the vendor's, not measured here):

| Build | Size | Leaderboard WER (vendor) | Runs on |
|---|---|---|---|
| bf16, https://huggingface.co/IFM/Jais-ASR | 11.46 GB, about 12.4 GiB GPU | 22.85% | Transformers, vLLM |
| GGUF Q8_0 + mmproj F16, https://huggingface.co/IFM/Jais-ASR-GGUF | 6.71 GB, 7.55 GiB GPU | 22.83% | MBZUAI-IFM llama.cpp fork + patch |
| GGUF Q4_K_M + mmproj Q6_K | 3.71 GB, 5.03 GiB GPU | 22.99% | same |
| GGUF IQ4_XS + mmproj Q4_K (smallest) | 3.29 GB, 4.69 GiB GPU | 23.69% | same |
| MLX 4-bit, https://huggingface.co/IFM/Jais-ASR-MLX-4bit | 4.50 GB | 22.94% | mlx-vlm at a pinned commit + patch, needs PyTorch |
| MLX 8-bit, https://huggingface.co/IFM/Jais-ASR-MLX-8bit | 7.03 GB | 22.76% | same |
| FP8 and W4A16-AWQ (IFM/Jais-ASR-FP8, IFM/Jais-ASR-W4A16-AWQ) | 7.68 GB, 5.85 GB | not given | vLLM |

### Leaderboard entry

The Open Universal Arabic ASR Leaderboard (https://huggingface.co/spaces/elmresearchcenter/open_universal_arabic_asr_leaderboard) added Jais-ASR on 18 Oct 2026. The evaluation script came in through https://github.com/Natural-Language-Processing-Elm/open_universal_arabic_asr_leaderboard/pull/31, from an outside contributor. Read from the Space's `app.py` on 14 Nov 2026:

- Jais-ASR is first of 39: average WER 22.82%, CER 8.31% (the model card quotes 22.85% and 8.37%).
- Next are Sygma-ASR-Arabic (23.01%), Audar-ASR-V1-Turbo (23.17%) and cohere-transcribe-arabic-07-2026 (24.19%). Audar is better on SADA, the Saudi dialect set (28.92% against 30.52%).
- `openai/whisper-small`, the model family our app runs on device, is 36th at 55.13% WER.

The leaderboard uses sentences from broadcast, read speech and conversation. None of its six test sets is Emirati, older speakers or single words, so the rank does not carry over to our task without a test.

## Why the run did not finish

Two routes were tried.

1. **Local, on this Mac (Apple M5, 16 GB).** The plan was the GGUF Q4_K_M build through the patched llama.cpp with Metal. The disk had 5.5 GB free at the start and fell under 1 GB during the download (other work on the machine was writing too), so I stopped and deleted the partial download and the half-cloned llama.cpp. 2.6 GB is free now. The run needs about 3.7 GB for the model, plus a few hundred MB for the build.
2. **IFM's own demo Space** (https://huggingface.co/spaces/IFM/jais-asr, bf16 on Hugging Face ZeroGPU, with the same post-processing as the card). Three clips went through anonymously, then the Space refused with "You have exceeded your ZeroGPU runs limit. Authenticate with a Hugging Face token for more quota". I did not use the Hugging Face token stored on this machine because it belongs to a person.

### The 3-clip pilot (not a result)

All three are "zero" (صفر) clips the Whisper bench also used. Jais-ASR wrote صفر, صفر and صفش, so 2 of 3 matched. Whisper missed all three (one was سفر). The detected dialect was MSA twice and Moroccan once. GPU time was 4.1 s on a cold worker, then 0.2 s. Three clips of one word say nothing about the rate.

## How to finish it

Both scripts are ready:

- `scripts/jais-asr-transcribe.py` sends each clip in `clipsUsed` from `src/data/human-speech-bench.json` to the Space. It pins the language (`ar` or `en`), turns diacritics and code-switching off, and saves the transcript, the detected dialect, the no-speech flag and the GPU time to `external/jais-asr/transcripts-<lang>.json`. It resumes where it stopped. Run it with `external/jais-venv/bin/python -I scripts/jais-asr-transcribe.py ar`.
- `scripts/jais-asr-score.ts` scores those transcripts on exactly the same clips with the app's own `readNumbers`, `readYesNo` and `matchClosedSet` and the same correct, wrong and nothing-heard rules. It gives Wilson intervals per word and per task, the Whisper result on the same clips, and a paired count (both right, only Jais, only Whisper, neither). Run it with `npx tsx scripts/jais-asr-score.ts`.

Each route needs one thing:

- **Local:** about 5 GB of free disk. Then build the fork (`git clone -b model/K2Horizon https://github.com/MBZUAI-IFM/llama.cpp`, checkout `35999d1`, apply `llama.cpp-jais-asr.patch`, `cmake -B build && cmake --build build -j`), run `llama-server` with Q4_K_M and mmproj Q6_K, and point the transcribe script at `localhost:8080/v1/audio/transcriptions`. This also gives a real local seconds-per-clip and memory figure, which the Space cannot.
- **Space:** a Hugging Face token the owner agrees to use. Free accounts get a few minutes of ZeroGPU a day and PRO accounts 25 minutes, and the Space books at least 45 s per call, so 1,107 clips would take several days of quota. The local route is the better one.

Differences from the Whisper bench to keep in mind when it runs: no style prompt, no speech gate (the raw one-second clip goes in, and the model has its own no-speech signal), and the Space runs bf16 on a datacentre GPU, not q8 in a browser.

## Deployment

### In the browser: no

There is no ONNX or Transformers.js export, Transformers.js has no `jais_asr` architecture, and the smallest build is 3.29 GB. That is roughly 13 times the Whisper-small q8 download, too much for a phone or an older laptop. Moving to Jais-ASR means sending audio to a server, which changes the app's privacy story from "audio stays on the device" to "audio goes to a server in the UAE".

### Smallest honest server in the UAE

Azure UAE North list prices, Linux pay-as-you-go, USD per hour, from the Azure retail prices API (https://prices.azure.com/api/retail/prices with `armRegionName eq 'uaenorth'`) on 14 Nov 2026. GPU shares are from https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/gpu-accelerated/nvadsa10v5-series.

| VM | GPU | Fits | $/hour |
|---|---|---|---|
| Standard_NV12ads_A10_v5 | 1/3 A10, 8 GB | GGUF Q4_K_M (5.03 GiB peak, vendor figure) | 1.298 |
| Standard_NV18ads_A10_v5 | 1/2 A10, 12 GB | GGUF Q8_0 (7.55 GiB) | 2.288 |
| Standard_NV36ads_A10_v5 | full A10, 24 GB | bf16 (12.4 GiB) | 4.576 |
| Standard_NC24lds_xl_RTXPRO6000BSE_v6 | RTX PRO 6000 share | probably bf16, VRAM share not checked | 1.617 |
| Standard_D8as_v5 | none, 8 vCPU | GGUF on CPU, speed not measured | 0.424 |

At $1.298 an hour, an NV12ads running all month (730 h) costs about $948 before disk and bandwidth. Running it only for demos and pilot sessions costs much less. Partial A10 sizes use NVIDIA GRID drivers. ASSUMPTION: llama.cpp's CUDA build works on the 1/3 share. Microsoft markets these sizes for graphics, so test this before relying on it.

Hugging Face Inference Endpoints are not an option for UAE residency. The FAQ lists AWS us-east-1 and eu-west-1, Azure eastus and GCP us-east4 only (https://huggingface.co/docs/inference-endpoints/en/support/faq). For comparison, an A10G there is $1.00 an hour (https://huggingface.co/docs/inference-endpoints/en/pricing).

## Licences and data

- Jais-ASR: Apache 2.0, per the model card.
- Arabic Speech Commands v1.0 and Google Speech Commands v0.02: CC BY 4.0, as in `docs/HUMAN_SPEECH_BENCH.md`. The three pilot clips were sent to IFM's public Space, which is allowed for this public dataset. No user audio was sent.
