#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CURRENT="$HERE/STING_DEMO_VISUAL_CUT.mp4"
DOOR="$HERE/01-door.png"
CAST="$HERE/02-cast.png"
DUEL="$HERE/03-sealed-duel.png"
MISS="$HERE/04-miss-lockout.png"
PROOF="$HERE/05-webmcp-proof.png"
CARD="$HERE/06-card-current.jpg"
LETTER="$HERE/07-card-letter-and-brief-current.jpg"
BRIEF="$HERE/08-field-brief-current.jpg"
SLATE_SVG="$HERE/STING_END_SLATE.svg"
SLATE_PNG="$HERE/STING_END_SLATE.png"
OUTPUT="$HERE/STING_DEMO_VISUAL_CUT_REFINED.mp4"

for required in "$DOOR" "$CAST" "$DUEL" "$MISS" "$PROOF" "$CARD" "$LETTER" "$BRIEF" "$SLATE_PNG"; do
  if [[ ! -f "$required" ]]; then
    echo "Missing required asset: $required" >&2
    exit 1
  fi
done

if command -v sips >/dev/null 2>&1 && [[ "$SLATE_SVG" -nt "$SLATE_PNG" ]]; then
  sips -s format png "$SLATE_SVG" --out "$SLATE_PNG" >/dev/null
fi

# Assemble the judge-first sequence from the checked-in stills. The final three
# frames come from the same completed ChatGPT/IAB room: card, sealed letter,
# then the field brief at a readable size.
ffmpeg -hide_banner -loglevel warning -y \
  -loop 1 -t 10 -i "$DOOR" \
  -loop 1 -t 33 -i "$CAST" \
  -loop 1 -t 22 -i "$DUEL" \
  -loop 1 -t 22 -i "$MISS" \
  -loop 1 -t 20 -i "$PROOF" \
  -loop 1 -t 21 -i "$CARD" \
  -loop 1 -t 20 -i "$LETTER" \
  -loop 1 -t 14 -i "$BRIEF" \
  -loop 1 -t 12 -i "$SLATE_PNG" \
  -filter_complex "\
    [0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v0];\
    [1:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v1];\
    [2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v2];\
    [3:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v3];\
    [4:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v4];\
    [5:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v5];\
    [6:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v6];\
    [7:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x080808,fps=30,setsar=1[v7];\
    [8:v]scale=1920:1080,fps=30,setsar=1[v8];\
    [v0][v1][v2][v3][v4][v5][v6][v7][v8]concat=n=9:v=1:a=0,format=yuv420p[outv]" \
  -map "[outv]" -c:v libx264 -preset medium -crf 18 -movflags +faststart "$OUTPUT"

mv "$OUTPUT" "$CURRENT"

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$CURRENT")"
echo "Built $CURRENT (${duration}s)"
