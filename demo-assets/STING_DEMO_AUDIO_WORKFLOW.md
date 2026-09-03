# Add your voiceover to the STING demo

You can send one recording of the voiceover script and this workflow will make
the final submission-ready movie. Do not re-edit the visual cut first.

## Record this

- Preferred: a single **M4A/AAC recording at 48 kHz**, exported from Voice
  Memos, QuickTime, or a phone recorder. WAV, MP3, and AIFF also work if
  FFmpeg can read them.
- Speak the attached [`STING_DEMO_VOICEOVER.md`](STING_DEMO_VOICEOVER.md) at a
  calm, conversational pace. Finish the main explanation by **2:42**, then read
  the short closing tagline over the twelve-second end slate.
- Record clean narration only: no music, no automatic background soundtrack,
  and ideally no room echo. Start speaking at 0:00; a little silence at the end
  is fine because the muxer safely fits it to the locked cut.
- If your voiceover is longer than 2:54, the excess is deliberately removed.
  Re-record rather than allowing a sentence to be cut off.

## Make the final video

From this folder, run:

```bash
bash mux-voiceover.sh /absolute/path/to/STING-voiceover.m4a
```

This creates:

```text
STING_DEMO_FINAL_WITH_VOICEOVER.mp4
STING_DEMO_FINAL_WITH_VOICEOVER.srt
```

The MP4 keeps the exact original H.264 video stream (1920×1080, 30 fps) and
adds an AAC narration track normalized toward -16 LUFS. It is padded with
silence or cut safely to **174 seconds / 2:54**. The SRT is copied from the
canonical `STING_DEMO_NARRATED.srt` timing file and is an uploadable caption
sidecar for YouTube.

To choose another final path, or intentionally replace a prior render:

```bash
bash mux-voiceover.sh /absolute/path/to/STING-voiceover.m4a \
  --output /absolute/path/to/STING-submit.mp4 \
  --overwrite
```

## Why captions are a sidecar

The workflow does not burn captions into the image, so it does not depend on
FFmpeg's optional `subtitles` / libass filter and does not re-encode the
locked visual cut. Upload the generated `.srt` alongside the MP4 in YouTube
Studio, or use it in an editor if burned-in captions become desirable later.

The muxer requires FFmpeg's standard `loudnorm`, `apad`, and `aresample` audio
filters. If one is absent, it writes the requested `.srt` sidecar and stops
instead of producing a video with unreliable loudness or duration. On macOS,
a full Homebrew FFmpeg install normally provides them.

## Quick verification

```bash
ffprobe -v error -show_entries format=duration \
  -of default=nokey=1:noprint_wrappers=1 \
  STING_DEMO_FINAL_WITH_VOICEOVER.mp4
```

It should report approximately `174.000000` seconds (an AAC container may
display a few milliseconds of encoder padding).
