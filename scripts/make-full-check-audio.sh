#!/usr/bin/env bash
# SUPERSEDED for English: scripts/make-open-voice-audio.ts makes the English files with an open voice.
# Apple's licence allows the macOS system voices only for personal, non-commercial use, so the Arabic
# files these make are replaced before submission. Do not use this script for anything published.
# Makes the person's side of one full spoken check with the computer's own voices (macOS "say"):
# Samantha for English, Majed for Arabic. Used by the recorded full check page, which needs no
# microphone. These are synthetic stand-ins, labelled as such in the app; no person is recorded.
#
# Per language, under public/samples/full/<lang>/ (16 kHz mono 16-bit WAV):
#   reg-01.wav .. reg-10.wav  each word of list 1 said back once, at a slightly different rate
#   recall-1.wav              immediate recall: 7 of the 10 words and one word not on the list
#   animals.wav               14 animals with pauses
#   recall-2.wav              delayed recall: 6 of the 10 words
#   answer.wav                "no" to the everyday-tasks question
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Joins words with pauses of varied length, as a person recalling them would.
spaced() {
  local out="" gaps=(900 1300 700 1600 1000 800 1400 1100 1200 900 1500 800 1000 1300)
  local i=0
  for w in "$@"; do
    if [ -n "$out" ]; then out="$out [[slnc ${gaps[$((i % ${#gaps[@]}))]}]] "; fi
    out="$out$w"
    i=$((i + 1))
  done
  printf '%s' "$out"
}

make() { # voice rate text out
  say -v "$1" -r "$2" -o "$tmp/clip.aiff" "$3"
  afconvert -f WAVE -d LEI16@16000 -c 1 "$tmp/clip.aiff" "$4"
}

for lang in en ar; do
  dir=public/samples/full/$lang
  rm -rf "$dir"; mkdir -p "$dir"
  if [ $lang = en ]; then
    voice=Samantha
    words=(river candle doctor window garden pencil bridge butter jacket mirror)
    recall1=(river candle window garden carpet bridge mirror jacket)
    animals=(dog cat horse cow lion tiger elephant giraffe camel monkey rabbit eagle shark sheep)
    recall2=(river window garden mirror candle butter)
    answer="No."
  else
    voice=Majed
    words=(نهر شمعة طبيب نافذة حديقة قلم جسر زبدة معطف مرآة)
    recall1=(نهر شمعة نافذة حديقة كرسي جسر مرآة معطف)
    animals=(جمل حصان قطة كلب أسد نمر فيل زرافة غزال صقر سمكة بقرة خروف ثعلب)
    recall2=(نهر نافذة حديقة مرآة شمعة زبدة)
    answer="لا."
  fi
  rates=(160 172 150 180 165 155 175 168 158 185)
  for i in "${!words[@]}"; do
    make "$voice" "${rates[$i]}" "${words[$i]}" "$dir/reg-$(printf %02d $((i + 1))).wav"
  done
  make "$voice" 165 "$(spaced "${recall1[@]}")" "$dir/recall-1.wav"
  make "$voice" 170 "$(spaced "${animals[@]}")" "$dir/animals.wav"
  make "$voice" 158 "$(spaced "${recall2[@]}")" "$dir/recall-2.wav"
  make "$voice" 165 "$answer" "$dir/answer.wav"
done
du -sh public/samples/full/*
