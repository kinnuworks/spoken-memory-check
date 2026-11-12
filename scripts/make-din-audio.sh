#!/usr/bin/env bash
# Makes the digit recordings for the hearing test with the computer's own voices
# (macOS "say"): Samantha for English, Majed for Arabic. These are synthetic stand-ins
# until a native speaker records them; the app labels them so.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
en=(zero one two three four five six seven eight nine)
ar=(صفر واحد اثنان ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة)
for lang in en ar; do
  mkdir -p public/din/$lang
  for d in 1 2 3 4 5 6 8 9; do
    if [ $lang = en ]; then voice=Samantha; word=${en[$d]}; else voice=Majed; word=${ar[$d]}; fi
    say -v "$voice" -r 170 -o "$tmp/$lang$d.aiff" "$word"
    afconvert -f WAVE -d LEI16@22050 -c 1 "$tmp/$lang$d.aiff" "public/din/$lang/$d.wav"
  done
done
rm -rf "$tmp"
ls -la public/din/*
