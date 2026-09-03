#!/usr/bin/env bash
# Mux one recorded STING voiceover onto the locked 2:54 visual cut.
#
# This deliberately copies the H.264 video stream instead of re-encoding it.
# The only newly encoded stream is AAC narration. Captions stay as an uploadable
# SRT sidecar so this workflow does not require FFmpeg's subtitles/libass filter.

set -euo pipefail

readonly TARGET_SECONDS=174
readonly TARGET_LUFS='-16'
readonly TARGET_TRUE_PEAK='-1.5'
readonly TARGET_LRA='11'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly VISUAL_CUT="$SCRIPT_DIR/STING_DEMO_VISUAL_CUT.mp4"
readonly CAPTIONS="$SCRIPT_DIR/STING_DEMO_NARRATED.srt"
DEFAULT_OUTPUT="$SCRIPT_DIR/STING_DEMO_FINAL_WITH_VOICEOVER.mp4"

usage() {
  cat <<'EOF'
Usage:
  ./mux-voiceover.sh /absolute/path/to/voiceover.m4a [--output /path/to/final.mp4] [--overwrite]

The source may be any audio format your local FFmpeg can read (M4A, WAV, MP3,
or AIFF). M4A/AAC at 48 kHz is preferred. The resulting movie is exactly 2:54
long: narration is normalized, silence is appended when it finishes early, and
audio after 2:54 is discarded.
EOF
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "'$1' is required. Install a full FFmpeg build and try again."
}

has_filter() {
  local name="$1"
  # Do not use grep -q here: with pipefail, it can close early and make FFmpeg
  # report SIGPIPE even though the filter exists.
  ffmpeg -hide_banner -filters 2>/dev/null | grep -E "[[:space:]]${name}[[:space:]]" >/dev/null
}

copy_sidecar() {
  local source="$1"
  local destination="$2"
  cp "$source" "$destination"
}

if [[ "${1:-}" == '--help' || "${1:-}" == '-h' ]]; then
  usage
  exit 0
fi

voiceover="${1:-}"
[[ -n "$voiceover" ]] || {
  usage >&2
  exit 2
}
shift

output="$DEFAULT_OUTPUT"
overwrite=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      [[ $# -ge 2 ]] || die '--output needs a .mp4 path.'
      output="$2"
      shift 2
      ;;
    --overwrite)
      overwrite=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

require_command ffmpeg
require_command ffprobe

[[ -f "$VISUAL_CUT" ]] || die "Missing locked visual cut: $VISUAL_CUT"
[[ -f "$CAPTIONS" ]] || die "Missing captions: $CAPTIONS"
[[ -f "$voiceover" ]] || die "Voiceover file not found: $voiceover"
[[ "$output" == *.mp4 ]] || die "Output must end in .mp4: $output"

output_dir="$(dirname -- "$output")"
output_basename="$(basename -- "$output")"
[[ -d "$output_dir" ]] || die "Output directory does not exist: $output_dir"
[[ -w "$output_dir" ]] || die "Output directory is not writable: $output_dir"

caption_output="${output%.mp4}.srt"
if [[ "$overwrite" -ne 1 ]]; then
  [[ ! -e "$output" ]] || die "Refusing to overwrite $output. Re-run with --overwrite when that is intentional."
  [[ ! -e "$caption_output" ]] || die "Refusing to overwrite $caption_output. Re-run with --overwrite when that is intentional."
fi

audio_kind="$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=nokey=1:noprint_wrappers=1 "$voiceover" 2>/dev/null || true)"
[[ "$audio_kind" == 'audio' ]] || die "The supplied file has no readable audio stream: $voiceover"

visual_duration="$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "$VISUAL_CUT")"
awk -v duration="$visual_duration" 'BEGIN { exit !(duration >= 173.95 && duration <= 174.05) }' \
  || die "The locked visual cut is not 2:54 ($visual_duration seconds). Do not mux a mismatched cut."

audio_duration="$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "$voiceover")"

# We never burn captions into the picture: preserving the locked visual stream is
# more valuable, and this SRT can be uploaded directly to YouTube. If a local
# FFmpeg build lacks one of the audio filters, still leave a usable captions file
# next to the requested output and stop rather than making a misleading render.
if ! has_filter loudnorm || ! has_filter apad || ! has_filter aresample; then
  copy_sidecar "$CAPTIONS" "$caption_output"
  die "This FFmpeg build lacks loudnorm, apad, or aresample. Captions were saved to $caption_output; install a full FFmpeg build before rendering narration."
fi

tmp_video="$output_dir/.${output_basename%.mp4}.tmp.$$.mp4"
tmp_captions="$output_dir/.${output_basename%.mp4}.tmp.$$.srt"
cleanup() {
  rm -f -- "$tmp_video" "$tmp_captions"
}
trap cleanup EXIT

printf 'Narration source: %s seconds\n' "$audio_duration"
printf 'Rendering: %s seconds (video copied; AAC narration normalized to %s LUFS)\n' "$TARGET_SECONDS" "$TARGET_LUFS"

ffmpeg -hide_banner -nostdin -y \
  -i "$VISUAL_CUT" \
  -i "$voiceover" \
  -filter_complex "[1:a:0]aresample=48000,loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA},aresample=48000,apad=pad_dur=${TARGET_SECONDS}[voice]" \
  -map 0:v:0 \
  -map '[voice]' \
  -map_metadata 0 \
  -c:v copy \
  -c:a aac \
  -b:a 192k \
  -disposition:a:0 default \
  -t "$TARGET_SECONDS" \
  -movflags +faststart \
  "$tmp_video"

rendered_duration="$(ffprobe -v error -show_entries format=duration -of default=nokey=1:noprint_wrappers=1 "$tmp_video")"
awk -v duration="$rendered_duration" 'BEGIN { exit !(duration >= 173.95 && duration <= 174.10) }' \
  || die "Rendered movie duration is unexpected: $rendered_duration seconds. Temporary output was kept out of the final path."

copy_sidecar "$CAPTIONS" "$tmp_captions"
mv -f -- "$tmp_video" "$output"
mv -f -- "$tmp_captions" "$caption_output"

printf '\nCreated:\n  %s\n  %s\n' "$output" "$caption_output"
printf 'Video was stream-copied from the locked 1920x1080 / 30 fps visual cut.\n'
