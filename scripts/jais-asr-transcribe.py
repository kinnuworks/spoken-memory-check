# Transcribes each clip the human-speech bench used with Jais-ASR and saves the raw transcripts.
# Scoring is done separately by scripts/jais-asr-score.ts with the app's own matchers.
# Three backends:
#   JAIS_BACKEND=mlx (used for the published run): IFM/Jais-ASR-MLX-4bit on this Mac through mlx-vlm at
#     commit 6ecadd7 with IFM's mlx-vlm-jais-asr.patch, settings as the model card's CLI example
#     (greedy, repetition penalty 1.05, at most 256 tokens, --language pinned to the clip language).
#     external/jais-mlx-venv/bin/python -I scripts/jais-asr-transcribe.py ar|en [limit]
#   JAIS_URL=http://localhost:8080: a local llama-server's /v1/audio/transcriptions endpoint.
#   default: the official IFM/jais-asr Hugging Face Space (bf16 on ZeroGPU), anonymous, quota-limited.
#     external/jais-venv/bin/python -I scripts/jais-asr-transcribe.py ar|en [limit]
# Resumable: clips already in the output file are skipped.
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lang = sys.argv[1]
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 0
bench = json.load(open(os.path.join(ROOT, 'src/data/human-speech-bench.json')))
clips = bench[lang]['clipsUsed']
if limit:
    clips = clips[:limit]
out_path = os.path.join(ROOT, f'external/jais-asr/transcripts-{lang}.json')
os.makedirs(os.path.dirname(out_path), exist_ok=True)
done = json.load(open(out_path)) if os.path.exists(out_path) else {}

JAIS_URL = os.environ.get('JAIS_URL')
BACKEND = os.environ.get('JAIS_BACKEND', 'url' if JAIS_URL else 'space')
MLX_MODEL = os.path.join(ROOT, 'external/models/Jais-ASR-MLX-4bit')
meta_path = os.path.join(ROOT, 'external/jais-asr/run-meta.json')
if BACKEND == 'mlx':
    import importlib.util
    import resource

    import mlx.core as mx
    from mlx_vlm import apply_chat_template, generate, load

    spec = importlib.util.spec_from_file_location('jais_postprocess', os.path.join(MLX_MODEL, 'postprocess.py'))
    post = importlib.util.module_from_spec(spec)
    sys.modules['jais_postprocess'] = post
    spec.loader.exec_module(post)
    t_load = time.time()
    model, processor = load(MLX_MODEL, trust_remote_code=True)
    load_seconds = time.time() - t_load
    prompt = apply_chat_template(processor, model.config, '', num_images=0, num_audios=1, enable_thinking=False)
    GEN = dict(temperature=0.0, repetition_penalty=1.05, max_tokens=256)

    class Client:  # same predict() shape as the Space
        def predict(self, path, _d, _c, language, api_name=None):
            t0 = time.time()
            r = generate(model, processor, prompt, audio=[path], verbose=False, language=language, **GEN)
            dt = time.time() - t0
            raw = r.text if hasattr(r, 'text') else str(r)
            p = post.split_text(raw)
            status = ('No speech detected. ' if p.refused else '') + ('token limit. ' if getattr(r, 'generation_tokens', 0) >= GEN['max_tokens'] else '') + f'Transcribed in {dt:.2f} s'
            self.last_raw = raw
            return p.text or '', p.language or '', status
    client = Client()
elif BACKEND == 'url':
    import httpx

    class Client:  # same predict() shape as the Space, backed by the OpenAI-style endpoint
        def predict(self, path, _d, _c, language, api_name=None):
            t0 = time.time()
            with open(path, 'rb') as f:
                r = httpx.post(JAIS_URL + '/v1/audio/transcriptions', files={'file': f}, data={'language': language}, timeout=300)
            r.raise_for_status()
            j = r.json()
            return j.get('text', ''), j.get('language', ''), f'Transcribed in {time.time() - t0:.2f} s'
    client = Client()
else:
    from gradio_client import Client, handle_file
    client = Client('IFM/jais-asr', verbose=False)
for i, c in enumerate(clips):
    if c['file'] in done:
        continue
    for attempt in range(6):
        try:
            t0 = time.time()
            text, detected, status = client.predict(
                (os.path.join(ROOT, c['file']) if BACKEND != 'space' else handle_file(os.path.join(ROOT, c['file']))), False, False, lang, api_name='/transcribe')
            wall = time.time() - t0
            break
        except Exception as e:  # quota or queue errors: back off, then retry
            msg = str(e)
            print('error', c['file'], msg[:200], flush=True)
            if 'quota' in msg.lower():
                json.dump(done, open(out_path, 'w'), ensure_ascii=False, indent=1)
                sys.exit(2)
            time.sleep(10 * (attempt + 1))
    else:
        sys.exit(3)
    m = re.search(r'Transcribed in ([\d.]+) s', status or '')
    done[c['file']] = {
        'word': c['word'], 'text': text or '', 'language': detected,
        'refused': 'No speech detected' in (status or ''), 'truncated': 'token limit' in (status or ''),
        'gpuSeconds': float(m.group(1)) if m else None, 'wallSeconds': round(wall, 2),
    }
    if BACKEND == 'mlx':
        done[c['file']]['raw'] = client.last_raw
    if (i + 1) % 10 == 0:
        json.dump(done, open(out_path, 'w'), ensure_ascii=False, indent=1)
        print(lang, i + 1, len(clips), flush=True)
json.dump(done, open(out_path, 'w'), ensure_ascii=False, indent=1)
print('done', len(done))
if BACKEND == 'mlx':
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    meta['model'] = 'IFM/Jais-ASR-MLX-4bit (revision 0867c7a: 4-bit GPTQ text decoder, bf16 audio encoder), local on Apple M5 16 GB through mlx-vlm 6ecadd7 + IFM mlx-vlm-jais-asr.patch, MLX ' + mx.__version__
    meta['settings'] = {'languagePin': 'same as the clip language (ar or en), the --language option', 'diacritics': False, 'codeSwitch': False, 'prompt': 'empty user prompt, default chat template (as the card CLI example)', 'decoding': 'greedy (temperature 0), repetition penalty 1.05, at most 256 tokens', 'speechGate': 'none; raw clip sent, the model has its own no-speech signal ([IFM-NoTranscript])', 'postprocess': "the model repo's postprocess.split_text"}
    rt = meta.setdefault('runtime', {})
    rt[lang] = {'loadSeconds': round(load_seconds, 1), 'peakMlxMemoryGB': round(mx.get_peak_memory() / 1e9, 2), 'peakRssGB': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e9, 2), 'note': 'this process only; resumed runs report the last process'}
    json.dump(meta, open(meta_path, 'w'), ensure_ascii=False, indent=1)
