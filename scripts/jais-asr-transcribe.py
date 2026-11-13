# Sends each clip the human-speech bench used to the official Jais-ASR demo Space (IFM/jais-asr,
# bf16 weights on Hugging Face ZeroGPU) and saves the raw transcripts. Scoring is done separately by
# scripts/jais-asr-score.ts with the app's own matchers.
# Usage: external/jais-venv/bin/python -I scripts/jais-asr-transcribe.py ar|en [limit]
# Resumable: clips already in the output file are skipped.
# Set JAIS_URL (e.g. http://localhost:8080) to use a local llama-server's
# /v1/audio/transcriptions endpoint instead of the Space.
import json
import os
import re
import sys
import time

from gradio_client import Client, handle_file

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
if JAIS_URL:
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
    client = Client('IFM/jais-asr', verbose=False)
for i, c in enumerate(clips):
    if c['file'] in done:
        continue
    for attempt in range(6):
        try:
            t0 = time.time()
            text, detected, status = client.predict(
                (os.path.join(ROOT, c['file']) if JAIS_URL else handle_file(os.path.join(ROOT, c['file']))), False, False, lang, api_name='/transcribe')
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
    if (i + 1) % 10 == 0:
        json.dump(done, open(out_path, 'w'), ensure_ascii=False, indent=1)
        print(lang, i + 1, len(clips), flush=True)
json.dump(done, open(out_path, 'w'), ensure_ascii=False, indent=1)
print('done', len(done))
