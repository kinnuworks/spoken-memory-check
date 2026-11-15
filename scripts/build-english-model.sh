#!/usr/bin/env bash
# Copies the English speech model this site serves: onnx-community/whisper-base (Apache-2.0, converted from
# openai/whisper-base, MIT), 8-bit weights, unchanged. Serving it from this site means no visitor's browser
# has to reach huggingface.co. Anonymous download; no account or token is used.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=https://huggingface.co/onnx-community/whisper-base/resolve/main
OUT=external/models/whisper-base
mkdir -p "$OUT/onnx"
for f in config.json generation_config.json preprocessor_config.json tokenizer.json tokenizer_config.json; do
  curl -sfL -o "$OUT/$f" "$SRC/$f"
done
for f in encoder_model_quantized.onnx decoder_model_merged_quantized.onnx; do
  curl -sfL -o "$OUT/onnx/$f" "$SRC/onnx/$f"
done
curl -sfL -o "$OUT/LICENSE.txt" https://www.apache.org/licenses/LICENSE-2.0.txt
printf "Unmodified copy of onnx-community/whisper-base (Apache-2.0), an ONNX conversion of openai/whisper-base (MIT licence, Copyright (c) 2022 OpenAI).\n" > "$OUT/NOTICE.txt"
mkdir -p public/models && ln -sfn ../../$OUT public/models/whisper-base
ls -la "$OUT" "$OUT/onnx"
