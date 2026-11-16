"""Speaks every job in a jobs file with open voices, through sherpa-onnx, and writes 16-bit mono WAVs.

English: Piper en_US-ljspeech (medium). The LJ Speech recordings are public domain; the Piper voices
repository is MIT. Arabic: Nabra-82M (Modern Standard Arabic), a fine-tune of Kokoro-82M, licensed
Apache-2.0 by its author. Both from the k2-fsa/sherpa-onnx "tts-models" release on GitHub.

Each word is spoken on its own, trimmed, and joined with the given pauses, so the pauses are exact.
macOS afconvert does the final resampling, as the earlier scripts did.

usage: external/tts-venv/bin/python -I scripts/open_voice_synth.py <jobs.json> <models-dir>
Needs sherpa-onnx 1.13.8 (version 2 no longer bundles the espeak-ng step these voices use).
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import sherpa_onnx
import soundfile as sf


def piper_en(root):
    d = os.path.join(root, "vits-piper-en_US-ljspeech-medium")
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        vits=sherpa_onnx.OfflineTtsVitsModelConfig(
            model=os.path.join(d, "en_US-ljspeech-medium.onnx"),
            tokens=os.path.join(d, "tokens.txt"),
            data_dir=os.path.join(d, "espeak-ng-data"),
            # No random variation, so the same text always gives the same recording.
            noise_scale=0.0, noise_scale_w=0.0),
        num_threads=4)))


def nabra_ar(root):
    d = os.path.join(root, "nabra-82m-arabic-int8")
    model = [f for f in os.listdir(d) if f.endswith(".onnx")][0]
    return sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
        kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
            model=os.path.join(d, model),
            voices=os.path.join(d, "voices.bin"),
            tokens=os.path.join(d, "tokens.txt"),
            data_dir=os.path.join(d, "espeak-ng-data")),
        num_threads=4)))


def trim(x, rate, pad_ms=30):
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    if peak == 0.0:
        return x
    loud = np.nonzero(np.abs(x) >= peak * 0.02)[0]
    pad = int(rate * pad_ms / 1000)
    return x[max(0, loud[0] - pad): min(len(x), loud[-1] + 1 + pad)]


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    root = sys.argv[2]
    voices = {}
    for job in spec["jobs"]:
        lang = job["lang"]
        if lang not in voices:
            voices[lang] = piper_en(root) if lang == "en" else nabra_ar(root)
        tts = voices[lang]
        rate = tts.sample_rate
        # Nabra is clearer to the listeners a little slower (9 of 14 animals at 0.85 against 6 at 1.0, in testing).
        speed = (0.85 if lang == "ar" else 1.0) * (1.0 + job["ratePct"] / 100.0)
        parts = []
        for i, word in enumerate(job["words"]):
            audio = tts.generate(word, sid=0, speed=speed)
            if len(audio.samples) == 0:
                sys.exit("the %s voice returned no audio for %r" % (lang, word))
            x = trim(np.asarray(audio.samples, dtype=np.float32), rate)
            if i:
                gap = spec["gaps"][(i - 1) % len(spec["gaps"])]
                parts.append(np.zeros(int(rate * gap / 1000), dtype=np.float32))
            parts.append(x)
        x = np.concatenate(parts)
        if not job["trim"]:
            edge = np.zeros(int(rate * 0.15), dtype=np.float32)
            x = np.concatenate([edge, x, edge])
        peak = float(np.max(np.abs(x)))
        if peak > 0:
            x = x * (0.89 / peak)  # about -1 dBFS, the same level for every clip
        with tempfile.TemporaryDirectory() as tmp:
            raw = os.path.join(tmp, "raw.wav")
            sf.write(raw, x, rate, subtype="FLOAT")
            os.makedirs(os.path.dirname(job["out"]), exist_ok=True)
            subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@%d" % job["sampleRate"], "-c", "1", raw, job["out"]], check=True)
        sys.stdout.write(".")
        sys.stdout.flush()
    print("\ndone: %d files" % len(spec["jobs"]))


if __name__ == "__main__":
    main()
