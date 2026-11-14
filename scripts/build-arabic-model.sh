#!/usr/bin/env bash
# Builds the smaller Arabic speech model this site serves, from the public onnx-community/whisper-small-ar-ONNX
# (Apache-2.0): the 4-bit encoder and decoder unchanged, except that the decoder's token-embedding table is
# stored as 4-bit (scripts/shrink-arabic-model.py). Needs Python with onnx and numpy in external/ort-venv.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=https://huggingface.co/onnx-community/whisper-small-ar-ONNX/resolve/main
OUT=external/models/whisper-small-ar-q4emb
mkdir -p "$OUT/onnx" external/models/src-small-ar/onnx
for f in config.json generation_config.json preprocessor_config.json tokenizer.json tokenizer_config.json; do
  curl -sfL -o "$OUT/$f" "$SRC/$f"
done
curl -sfL -o "$OUT/onnx/encoder_model_q4.onnx" "$SRC/onnx/encoder_model_q4.onnx"
curl -sfL -o external/models/src-small-ar/onnx/decoder_model_merged_q4.onnx "$SRC/onnx/decoder_model_merged_q4.onnx"
external/ort-venv/bin/python -I scripts/shrink-arabic-model.py external/models/src-small-ar/onnx/decoder_model_merged_q4.onnx "$OUT/onnx/decoder_model_merged_q4.onnx" 4
curl -sfL -o "$OUT/LICENSE.txt" https://www.apache.org/licenses/LICENSE-2.0.txt
printf "Modified copy of onnx-community/whisper-small-ar-ONNX (from ayoubkirouane/whisper-small-ar, Apache-2.0).\nChange: the decoder token-embedding table is stored as 4-bit numbers with one 16-bit scale per block of 64, restored by standard ONNX operators at load. Nothing else is changed.\n" > "$OUT/NOTICE.txt"
mkdir -p public/models && ln -sfn ../../$OUT public/models/whisper-small-ar-q4emb
