# Jais-ASR (IFM/Jais-ASR-MLX-4bit, same setup as scripts/jais-asr-transcribe.py) on the SADA clips
# from scripts/sada-extract.py. Writes external/sada/jais.json in the shape sada-bench.ts reads.
# Resumable.
#   external/jais-mlx-venv/bin/python -I scripts/sada-jais.py
import importlib.util
import json
import os
import sys

import mlx.core as mx  # noqa: F401  (loads the Metal backend)
from mlx_vlm import apply_chat_template, generate, load

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIPS = os.path.join(ROOT, 'external/sada/clips')
MODEL = os.path.join(ROOT, 'external/models/Jais-ASR-MLX-4bit')
OUT = os.path.join(ROOT, 'external/sada/jais.json')

spec = importlib.util.spec_from_file_location('jais_postprocess', os.path.join(MODEL, 'postprocess.py'))
post = importlib.util.module_from_spec(spec)
sys.modules['jais_postprocess'] = post
spec.loader.exec_module(post)

manifest = json.load(open(os.path.join(CLIPS, 'manifest.json')))
done = json.load(open(OUT)) if os.path.exists(OUT) else {}
model, processor = load(MODEL, trust_remote_code=True)
prompt = apply_chat_template(processor, model.config, '', num_images=0, num_audios=1, enable_thinking=False)
for n, c in enumerate(manifest):
    if c['file'] in done:
        continue
    r = generate(model, processor, prompt, audio=[os.path.join(CLIPS, c['file'])], verbose=False,
                 language='ar', temperature=0.0, repetition_penalty=1.05, max_tokens=256)
    p = post.split_text(r.text if hasattr(r, 'text') else str(r))
    done[c['file']] = p.text or ''
    if n % 20 == 0:
        json.dump(done, open(OUT, 'w'), ensure_ascii=False)
        print(n, flush=True)
json.dump(done, open(OUT, 'w'), ensure_ascii=False)
print('done', len(done))
