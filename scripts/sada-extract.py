# Pulls a fixed sample of clips out of the SADA 2022 test split (Saudi TV speech, CC BY-NC-SA 4.0)
# for scripts/sada-bench.ts: every clip labelled Elderly, plus seeded random samples of adult
# speakers by dialect. Writes 16 kHz mono WAV files and a manifest. Nothing here is committed.
#
# Usage: python -I scripts/sada-extract.py external/sada/test.parquet external/sada/clips
import io, json, random, sys
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import soundfile as sf

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
SEED = 20261115
ADULT_SAMPLE = {'Khaliji': 200, 'Najdi': 100, 'Hijazi': 100}

meta = pq.read_table(src, columns=['speaker_age', 'speaker_dialect', 'speaker_gender', 'cleaned_text']).to_pydict()
rows = range(len(meta['speaker_age']))
age = lambda i: meta['speaker_age'][i].split(' ')[0]
pick = [i for i in rows if age(i) == 'Elderly']
rnd = random.Random(SEED)
for dialect, n in ADULT_SAMPLE.items():
    pool = [i for i in rows if age(i) == 'Adult' and meta['speaker_dialect'][i] == dialect]
    pick += rnd.sample(pool, min(n, len(pool)))
pick.sort()

audio = pq.read_table(src, columns=['audio']).column('audio')
manifest = []
for i in pick:
    a = audio[i].as_py()
    x, sr = sf.read(io.BytesIO(a['bytes']), dtype='float32', always_2d=True)
    x = x.mean(axis=1)
    if sr != 16000:  # linear resampling is enough for speech recognition input
        t = np.arange(0, len(x) * 16000 / sr) * sr / 16000
        x = np.interp(t, np.arange(len(x)), x).astype('float32')
    name = f'{i:05d}.wav'
    sf.write(out / name, x, 16000, subtype='PCM_16')
    manifest.append({'file': name, 'row': i, 'age': age(i), 'dialect': meta['speaker_dialect'][i],
                     'gender': meta['speaker_gender'][i], 'text': meta['cleaned_text'][i], 'seconds': round(len(x) / 16000, 2)})
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
print(len(manifest), 'clips;', sum(m['seconds'] for m in manifest) / 60, 'minutes')
