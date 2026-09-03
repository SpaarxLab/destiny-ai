#!/usr/bin/env bash
# Generate a clearly synthetic, timing-aligned STING narration and mux it with
# the locked 2:54 visual cut. No cloned or user-impersonating voice is used.

set -euo pipefail

readonly VOICE='Daniel'
readonly TARGET_LUFS='-16'
readonly TARGET_TRUE_PEAK='-1.5'
readonly TARGET_LRA='7'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly VISUAL_CUT="$SCRIPT_DIR/STING_DEMO_VISUAL_CUT.mp4"
readonly NARRATION_AUDIO="$SCRIPT_DIR/STING_DEMO_SYNTHETIC_NARRATION.m4a"
readonly FINAL_VIDEO="$SCRIPT_DIR/STING_DEMO_NARRATED.mp4"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Error: %s is required.\n' "$1" >&2
    exit 1
  }
}

require_command say
require_command ffmpeg
require_command ffprobe

[[ -f "$VISUAL_CUT" ]] || {
  printf 'Error: missing visual cut: %s\n' "$VISUAL_CUT" >&2
  exit 1
}

work_dir="$(mktemp -d)"
printf 'Working directory: %s\n' "$work_dir"

cleanup() {
  local temp_root="${TMPDIR:-/tmp}"
  temp_root="${temp_root%/}"
  if [[ -d "$work_dir" && "$work_dir" == "$temp_root"/tmp.* ]]; then
    rm -rf -- "$work_dir"
  fi
}
trap cleanup EXIT

texts=(
  'Your AI says it knows you. STING makes it prove it, before you give it the answer.'
  'STING is a three-minute, no-typing-required game for a person and their agent. The agent casts eight possible lives from what it knows. You tap the ones that sting.'
  'This is not an AI quiz. The page gives the agent structured Web M C P tools, but only the move this phase permits. First it may inspect and cast. After a mandatory cold read, it may bet or ask once. The person still owns every tap.'
  'Here is the key move. Before I choose, the agent calls stage duel and seals a chip-staked bet on which side I will pick. The page hashes that commitment. It cannot see my tap or rewrite the bet afterward.'
  'I choose the other side. It loses two chips. Now the browser changes what the agent may do: stage duel disappears. It cannot bet again until it makes a specific public correction about what it misread.'
  "That is Web M C P doing product work, not sitting beside the product. The catalogue is the trust meter. A miss changes the agent's actual capabilities, not just the colour of a button."
  'After enough earned evidence, STING gives a provisional read: what I kept choosing, the tension I have not settled, and what I may be underrating. I can kill a wrong line, and that exact claim cannot return.'
  'Then it turns the read into one bounded test this week, with a clear done looks like. A sealed letter is withheld until the due date, so reality settles the next bet. The result is not advice. It is a record of what survived contact with my choices.'
  'Finally, STING writes a field brief for any future AI: treat this as revisable evidence, name the tradeoff, make a bet, and admit what you misread. Less performance. More proof.'
  'STING. Your AI says it knows you. Prove it wrong.'
)

slots=(10 15 18 22 22 20 21 20 14 12)
rates=(170 170 175 170 170 170 175 185 180 165)

for index in "${!texts[@]}"; do
  number=$((index + 1))
  source_audio="$work_dir/spoken-${number}.aiff"
  aligned_audio="$work_dir/aligned-${number}.wav"
  slot="${slots[$index]}"
  rate="${rates[$index]}"

  say -v "$VOICE" -r "$rate" -o "$source_audio" "${texts[$index]}"
  spoken_duration="$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "$source_audio")"
  awk -v spoken="$spoken_duration" -v slot="$slot" 'BEGIN { exit !(spoken <= slot - 0.6) }' || {
    printf 'Error: segment %s is %.3fs and does not fit its %ss slot.\n' "$number" "$spoken_duration" "$slot" >&2
    exit 1
  }

  ffmpeg -hide_banner -loglevel error -nostdin -y \
    -i "$source_audio" \
    -af "adelay=300:all=1,apad,atrim=duration=${slot}" \
    -ar 48000 \
    -ac 1 \
    "$aligned_audio"

  printf 'Segment %02d: %6.3fs spoken / %2ss slot / %s wpm\n' "$number" "$spoken_duration" "$slot" "$rate"
done

ffmpeg -hide_banner -loglevel error -nostdin -y \
  -i "$work_dir/aligned-1.wav" \
  -i "$work_dir/aligned-2.wav" \
  -i "$work_dir/aligned-3.wav" \
  -i "$work_dir/aligned-4.wav" \
  -i "$work_dir/aligned-5.wav" \
  -i "$work_dir/aligned-6.wav" \
  -i "$work_dir/aligned-7.wav" \
  -i "$work_dir/aligned-8.wav" \
  -i "$work_dir/aligned-9.wav" \
  -i "$work_dir/aligned-10.wav" \
  -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a]concat=n=10:v=0:a=1,loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA},aresample=48000[narration]" \
  -map '[narration]' \
  -c:a aac \
  -b:a 192k \
  -movflags +faststart \
  -t 174 \
  "$NARRATION_AUDIO"

ffmpeg -hide_banner -loglevel error -nostdin -y \
  -i "$VISUAL_CUT" \
  -i "$NARRATION_AUDIO" \
  -map 0:v:0 \
  -map 1:a:0 \
  -map_metadata 0 \
  -c:v copy \
  -c:a copy \
  -disposition:a:0 default \
  -t 174 \
  -movflags +faststart \
  "$FINAL_VIDEO"

printf '\nCreated:\n  %s\n  %s\n' "$NARRATION_AUDIO" "$FINAL_VIDEO"
