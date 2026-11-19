"""Builds the Arabic recordings from words spoken by an ElevenLabs voice, and writes 16-bit mono WAVs.

The words were made with ElevenLabs text to speech on a Starter plan, whose terms allow commercial
use of the audio: premade voice "Roger", model eleven_multilingual_v2, language ar, stability 0.8.
Each batch file holds ten words in the order of BATCHES below, separated by 1.5 s breaks. This
script cuts each batch at its silences, then builds every job the same way open_voice_synth.py does:
each word trimmed, joined with the given pauses, the rate changed by ratePct, about -1 dBFS.

usage: external/tts-venv/bin/python -I scripts/el_voice_synth.py <jobs.json> <batch-dir>
<batch-dir> holds batch1.mp3 to batch4.mp3 (kept under external/, never committed).
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

RATE = 44100
BATCHES = [
    "نهر شمعة طبيب نافذة حديقة قلم جسر زبدة معطف مرآة",
    "كرسي جمل حصان قطة كلب أسد نمر فيل زرافة غزال",
    "صقر سمكة بقرة خروف ثعلب لا. ماعز حمار قرد دب",
    "ذئب أرنب واحد اثنان ثلاثة أربعة خمسة ستة ثمانية تسعة",
]


def load(path):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "x.wav")
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEF32@%d" % RATE, "-c", "1", path, wav], check=True)
        x, r = sf.read(wav, dtype="float32")
    assert r == RATE
    return x


def split(x, n):
    """The n loud stretches of x, cut where at least 0.6 s is quiet."""
    win = int(RATE * 0.02)
    env = np.array([np.abs(x[i:i + win]).max() for i in range(0, len(x), win)])
    loud = env > env.max() * 0.03
    segs, start, quiet = [], None, 0
    for i, on in enumerate(loud):
        if on:
            start = i if start is None else start
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet * 0.02 >= 0.6:
                segs.append((start, i - quiet + 1))
                start, quiet = None, 0
    if start is not None:
        segs.append((start, len(loud)))
    if len(segs) != n:
        sys.exit("expected %d words, found %d" % (n, len(segs)))
    return [x[a * win:b * win] for a, b in segs]


def trim(x, pad_ms=30):
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    if peak == 0.0:
        return x
    loud = np.nonzero(np.abs(x) >= peak * 0.02)[0]
    pad = int(RATE * pad_ms / 1000)
    return x[max(0, loud[0] - pad): min(len(x), loud[-1] + 1 + pad)]


def rate(x, pct):
    """Plays x pct percent faster (or slower when negative), by resampling."""
    if not pct:
        return x
    n = int(round(len(x) / (1.0 + pct / 100.0)))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    words = {}
    for i, line in enumerate(BATCHES, 1):
        names = line.split()
        for name, seg in zip(names, split(load(os.path.join(sys.argv[2], "batch%d.mp3" % i)), len(names))):
            words[name] = trim(seg)
    for job in spec["jobs"]:
        parts = []
        for i, word in enumerate(job["words"]):
            if word not in words:
                sys.exit("no recording of %r" % word)
            if i:
                gap = spec["gaps"][(i - 1) % len(spec["gaps"])]
                parts.append(np.zeros(int(RATE * gap / 1000), dtype=np.float32))
            parts.append(rate(words[word], job["ratePct"]))
        x = np.concatenate(parts)
        if not job["trim"]:
            edge = np.zeros(int(RATE * 0.15), dtype=np.float32)
            x = np.concatenate([edge, x, edge])
        peak = float(np.max(np.abs(x)))
        if peak > 0:
            x = x * (0.89 / peak)
        with tempfile.TemporaryDirectory() as tmp:
            raw = os.path.join(tmp, "raw.wav")
            sf.write(raw, x, RATE, subtype="FLOAT")
            os.makedirs(os.path.dirname(job["out"]), exist_ok=True)
            subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@%d" % job["sampleRate"], "-c", "1", raw, job["out"]], check=True)
    print("%d recordings written" % len(spec["jobs"]))


if __name__ == "__main__":
    main()
