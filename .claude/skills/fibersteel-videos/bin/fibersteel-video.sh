#!/usr/bin/env bash
# =============================================================================
# Make one narrated FiberSteel demo video — one command, from the repo root:
#
#   bash .claude/skills/fibersteel-videos/bin/fibersteel-video.sh <name> [--check] [--live] [--no-build]
#
#   <name>      a folder in .claude/skills/fibersteel-videos/videos/ (website-tour, installs-feature)
#   --check     only run the flow at full speed, no voice and no video (validates selectors; ~30 s)
#   --live      record the published site, https://h-looney.github.io/fibersteel/, instead of a local build
#   --no-build  reuse dist/ as it is (it must have been built with --base /fibersteel)
#
# Steps: build → serve dist/ under /fibersteel → check the flow → voice it with Kokoro (local, free) → level every line
# (lib/level.mjs) → record it with Playwright's own Chromium (a fresh, signed-out browser — never your Chrome) →
# assemble an H.264 MP4 → check every line's loudness in it → captions (.vtt + .srt, and a copy with them burned in)
# → frames to look at.
#
# Output (gitignored):  video-drafts/<name>.mp4, <name>.captioned.mp4, <name>.vtt, <name>.srt, frames/<name>-<m>m<ss>s.jpg
# Work files:           video-drafts/work/<name>/ (narration clips, recording, timeline) — safe to delete
# =============================================================================
set -euo pipefail

NAME=""
CHECK=0
LIVE=0
BUILD=1
for arg in "$@"; do
  case "$arg" in
    --check) CHECK=1 ;;
    --live) LIVE=1 ;;
    --no-build) BUILD=0 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) NAME="$arg" ;;
  esac
done

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
SKILL="$ROOT/.claude/skills/fibersteel-videos"
say() { printf '\033[1m[fibersteel-videos]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[fibersteel-videos] %s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$NAME" ] || die "Name a video: $(ls "$SKILL/videos" | tr '\n' ' ')"
SRC="$SKILL/videos/$NAME"
[ -f "$SRC/script.json" ] && [ -f "$SRC/flow.mjs" ] || die "No such video: $SRC (needs script.json and flow.mjs)"

# ── The local kit (installed once with the k54-videos installer) ─────────────
KIT="$HOME/.demo-video/kit/scripts"
export FS_VIDEO_REPO="$ROOT"
[ -f "$HOME/.demo-video/kit/VERSION" ] || die "The video kit isn't installed (~/.demo-video/kit). Run the k54-videos install.sh once."
[ -x "$HOME/.demo-video/kokoro/.venv/bin/python" ] || die "Kokoro isn't installed (~/.demo-video/kokoro). Run the k54-videos install.sh once."
command -v ffmpeg > /dev/null || die "ffmpeg is missing (Linux: sudo apt install ffmpeg)."

OUT="$ROOT/video-drafts"
WORK="$OUT/work/$NAME"
mkdir -p "$WORK" "$OUT/frames"
cp "$SRC/script.json" "$SRC/flow.mjs" "$WORK/"
# The kit's own levelling (single-pass loudnorm) leaves lines shorter than ~3 s far too quiet on ffmpeg 4.4:
# switch it off for every video, and level the clips with lib/level.mjs after voicing instead
node -e 'const fs = require("fs"), f = process.argv[1], s = JSON.parse(fs.readFileSync(f, "utf8"));
s.voice = { ...(s.voice || {}), loudnorm: false };
fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");' "$WORK/script.json"
# Screenshots from an earlier failed run would only confuse the next one
rm -f "$WORK"/error-*.png

# ── The site to record ───────────────────────────────────────────────────────
SERVER_PID=""
cleanup() { [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2> /dev/null || true; }
trap cleanup EXIT

if [ "$LIVE" = 1 ]; then
  export FS_VIDEO_BASE_URL="https://h-looney.github.io"
  say "Recording the published site: $FS_VIDEO_BASE_URL/fibersteel/"
else
  PORT="${FS_VIDEO_PORT:-4398}"
  export FS_VIDEO_BASE_URL="http://127.0.0.1:$PORT"
  if [ "$BUILD" = 1 ] || [ ! -f "$ROOT/dist/index.html" ]; then
    say "Building the site (npm run build -- --base /fibersteel)"
    (cd "$ROOT" && npm run build --silent -- --site https://h-looney.github.io --base /fibersteel > "$WORK/build.log" 2>&1) || die "The build failed — see $WORK/build.log"
  fi
  grep -q '/fibersteel/favicon.svg' "$ROOT/dist/index.html" || die "dist/ wasn't built with --base /fibersteel. Run without --no-build."
  if curl -fsS -o /dev/null "$FS_VIDEO_BASE_URL/fibersteel/" 2> /dev/null; then
    die "Port $PORT is already in use. Stop whatever is serving it, or set FS_VIDEO_PORT."
  fi
  node "$SKILL/lib/serve.mjs" "$ROOT/dist" /fibersteel "$PORT" > "$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 50); do curl -fsS -o /dev/null "$FS_VIDEO_BASE_URL/fibersteel/" 2> /dev/null && break; sleep 0.2; done
  curl -fsS -o /dev/null "$FS_VIDEO_BASE_URL/fibersteel/" || die "The local server didn't start — see $WORK/server.log"
  say "Serving the build at $FS_VIDEO_BASE_URL/fibersteel/"
fi

# ── Check, voice, record, assemble ───────────────────────────────────────────
# The kit's scripts expect to run from a folder with its own node_modules nearby: run them by absolute path
say "Checking the flow at full speed"
node "$KIT/record.mjs" "$WORK" --check
if [ "$CHECK" = 1 ]; then
  say "Flow check passed: $NAME"
  exit 0
fi

say "Voicing the narration with Kokoro (local, free)"
node "$KIT/voiceover.mjs" "$WORK" --kokoro
node "$SKILL/lib/level.mjs" "$WORK"
say "Recording (a fresh Playwright browser, paced to the narration)"
node "$KIT/record.mjs" "$WORK"
say "Assembling the MP4"
node "$KIT/assemble.mjs" "$WORK"

# ── Hand-off files ───────────────────────────────────────────────────────────
MP4="$OUT/$NAME.mp4"
ffmpeg -loglevel error -y -i "$WORK/draft.mp4" -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$MP4"
# Every narrated line in the finished video must be at the same level: frames can't show a line nobody can hear
node "$SKILL/lib/level.mjs" "$WORK" --check "$MP4" || die "A narration line is too quiet or too loud in $MP4 (see the table above)."
node "$SKILL/lib/captions.mjs" "$WORK" "$OUT/$NAME.vtt" "$OUT/$NAME.srt"
# A copy with the captions burned in, for watching with the sound off (phones, email previews)
ffmpeg -loglevel error -y -i "$MP4" \
  -vf "subtitles=$OUT/$NAME.srt:force_style='FontName=DejaVu Sans,FontSize=17,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=3,Outline=6,Shadow=0,MarginV=34'" \
  -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -c:a copy -movflags +faststart "$OUT/$NAME.captioned.mp4" \
  || say "Couldn't burn in the captions (ffmpeg without libass?) — the .vtt/.srt files are still there"

# Frames to look at before sending: one every 8 seconds, from 4 s, each seeked exactly and named by its time
# (ffmpeg's fps filter would keep the LAST frame of each 8 s slot, so its frames run seconds ahead of their label)
rm -f "$OUT/frames/$NAME"-*.jpg
LEN="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MP4" | cut -d. -f1)"
for t in $(seq 4 8 "$LEN"); do
  ffmpeg -loglevel error -y -ss "$t" -i "$MP4" -frames:v 1 -vf "scale=960:-2" -q:v 4 "$OUT/frames/$NAME-$(printf '%dm%02ds' $((t / 60)) $((t % 60))).jpg"
done

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MP4" | cut -d. -f1)"
SIZE="$(du -h "$MP4" | cut -f1)"
say "Done: $NAME — $((DUR / 60)):$(printf '%02d' $((DUR % 60))), $SIZE"
echo "  $MP4"
[ -f "$OUT/$NAME.captioned.mp4" ] && echo "  $OUT/$NAME.captioned.mp4"
echo "  $OUT/$NAME.vtt  (captions)"
echo "  $OUT/frames/$NAME-*.jpg  ($(ls "$OUT/frames/$NAME"-*.jpg | wc -l) frames to review)"
