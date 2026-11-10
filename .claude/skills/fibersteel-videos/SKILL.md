---
name: fibersteel-videos
description: Make narrated demo videos of the FiberSteel Boat Lifts redesign to send to the client, locally and for free. Covers a tour of the website (the lift and quote path first, then the familiar pages) and a walkthrough of one feature (the "Lifts we've installed" showcase). Playwright records in its own fresh headless Chromium, never the user's Chrome or anything signed in. Kokoro narrates locally (Apache 2.0, OK for client work, voice af_heart), and ffmpeg assembles an H.264 MP4 with captions. Use it when asked for a demo video, walkthrough or feature video, a video for FiberSteel or the customer, or a re-recording after the UI changed.
---

# FiberSteel videos

The videos are for a client, FiberSteel Boat Lifts, so they have to be accurate. Never narrate something the video
doesn't show, and never claim features or numbers the demo doesn't have. Write the name **FiberSteel** in every line.

This skill is adapted from the HMI concept's `hmi-videos` (itself from the K54 team kit, `k54-videos`) and uses the same
local tools, installed under `~/.demo-video`:
- Playwright, with its own Chromium;
- Kokoro, for narration;
- ffmpeg.

**Never use ElevenLabs, macOS `say` or Remotion** for anything that's sent: their licences don't allow it.

## The videos

Each video lives in `.claude/skills/fibersteel-videos/videos/<name>/`. Its narration is in `script.json`, one short line
per scene. Its browser steps are in `flow.mjs`, one function per scene.

| Name | Shows | Length |
|---|---|---|
| `website-tour` | The public site, lift and quote path first: home, lifts by boat type, a lift-type page, the sizes and the calculator with FiberSteel's formula, and sending a quote request (emailed to FiberSteel for review). Then the pages owners know from the current site, modernized: remotes, dock steps, used lifts, dealers, owner help, the warranty, contact, and the side topics in the footer | about 2:00 |
| `installs-feature` | "Lifts we've installed": the showcase and its filters, an install page, the lift and home pages, how installs get added (over time, from FiberSteel's photos of finished jobs), and the site with the showcase left off, then back on | about 1:10 |

## Make a video (what to run)

Run everything from the repo root, one video at a time. The runner needs the git repo (it
finds the root with `git rev-parse`) — it exists locally even before anything is committed.

1. **Setup check.** Both of these must exist:
   - `~/.demo-video/kit/VERSION`
   - `~/.demo-video/kokoro/.venv/bin/python`

   If either is missing, stop and tell the user. The kit is installed once with the k54-videos `install.sh`, which
   downloads about 1 GB. Don't install it yourself, and don't change anything in `~/.demo-video`.
2. **Check the flow first** (about 30 s, no video). The first run also builds the site:
   ```bash
   bash .claude/skills/fibersteel-videos/bin/fibersteel-video.sh <name> --check
   ```
   It must end with `Flow check passed`. If a scene fails, **stop**. Report three things: the scene name, the error
   line, and the screenshot path it prints (`video-drafts/work/<name>/error-<scene>.png`). Look at the screenshot first.
   Don't edit the flows unless you were asked to.
3. **Make it:**
   ```bash
   bash .claude/skills/fibersteel-videos/bin/fibersteel-video.sh <name> --no-build
   ```
   Use `--no-build` only when step 2 just built the site (or `dist/` was built with `--base /fibersteel`). Kokoro takes
   about 45 seconds per narration line it hasn't voiced before, and lines are cached by their text. A first run takes
   10 to 20 minutes; a re-run with unchanged lines takes 3 to 4. The Bash tool stops a foreground command after 10
   minutes, so run this one in the background (`run_in_background`) and wait for its notification. If it was cut off
   anyway, run it again: the cache makes it resume quickly.

   The run levels every narration line to the same loudness, then measures each line in the finished video. If one is
   off, it stops with `Loudness check failed` and names the scene. Report that and stop: never send a video from a run
   that didn't pass. The script prints the files it made:
   - `video-drafts/<name>.mp4`
   - `video-drafts/<name>.captioned.mp4`, with the captions burned in for watching without sound
   - `video-drafts/<name>.vtt` and `.srt`, the captions
   - `video-drafts/frames/<name>-<m>m<ss>s.jpg`, a frame every 8 seconds from 0:04, named by its exact time in the video
4. **Look at the frames before you call it done.** Open every `video-drafts/frames/<name>-*.jpg` and check that:
   - no frame shows an error page, a "Not found", a blank or white frame, or a spinner that never finished;
   - **every narration line is true of what's on screen while it plays.** Use the `.vtt` captions for the times, and
     extract extra frames where you need them (`ffmpeg -ss <seconds> -i <mp4> -frames:v 1 out.jpg`). A line that names
     something the video doesn't show is a problem, even if the site can do it;
   - no page names an employee ("Call us", never a person's name), and the forms' concept-demo note is hidden.

   Also extract one frame from the captioned copy and check the caption is readable:
   ```bash
   ffmpeg -loglevel error -y -ss 20 -i video-drafts/<name>.captioned.mp4 -frames:v 1 video-drafts/frames/<name>-captioned.jpg
   ```
5. **Report** for each video:
   - its length;
   - the two MP4 paths;
   - that the loudness check passed;
   - anything odd you saw in the frames, with the frame file name.

   If a run warns that a scene "keeps moving after its narration ends", include the warning. It's cosmetic, but worth
   knowing.

Options:
- `--live` records the published site (https://h-looney.github.io/fibersteel/) instead of a local build. Use it only
  when asked, and only once the site is published: the live site may be behind the code on this machine.
- `FS_VIDEO_PORT=4397` uses another port if 4398 is taken.

## Rules

- **Recording is safe.** The site is static and nothing is sent anywhere: the forms are simulated. Each run starts
  from a fresh browser.
- **Never click anything that leaves the concept site** — dealer websites, the Vrbo listing, Google Maps directions,
  `tel:` and `mailto:` links, YouTube. Point at them (hover) instead. The flows don't load the map or the videos either.
- **Sample data stays fictional.** Use `example.com` emails, 555 phone numbers and invented customers. Never name a
  FiberSteel employee, in narration or typed text: the site says "Call us", because whoever answers may be someone
  else.
- **No invented claims.** Install samples and used-lift listings are labelled as samples on the site. The narration
  must not call them real FiberSteel jobs or listings. Specs and prices are only the ones FiberSteel's site states.
- **The website only.** There is no staff app. Never narrate one, or anything staff do in the site itself:
  - The real site emails each request to the address FiberSteel chooses, for the team to review.
  - Hide the forms' concept-demo note (`[data-demo-note]`), as both flows do in `ready`: it isn't part of the real
    site, and the narration says what really happens.
  - New installs are "added over time, from the photos FiberSteel sends of finished jobs". The showcase on/off is a
    build setting (src/data/features.ts): say it "can stay off", never that FiberSteel flips a switch.
- **Hand over H.264 MP4**, which plays everywhere, including iPhones and email previews.
- **Don't commit generated files.** `video-drafts/` is gitignored. Only `script.json`, `flow.mjs`, `bin/` and `lib/`
  are source.

## Making a new video (for whoever writes flows)

1. Copy the closest video folder to `videos/<new-name>/`.
2. Write `script.json`: `{ "title", "voice": { "kokoroVoice": "af_heart", "kokoroLang": "en" }, "scenes": [{ "id", "narration" }] }`.
   - Scene ids use lowercase letters, numbers and dashes.
   - Narration is one or two short sentences in plain words and the present tense, using the interface's own labels.
3. Write `flow.mjs` as `export default { baseURL, start, viewport, login?, ready?, scenes: { '<id>': async (api) => {} } }`.
   Points that differ from a normal script:
   - Keep it self-contained, with **no imports**: the kit loads it from a work folder.
   - `baseURL` comes from `process.env.FS_VIDEO_BASE_URL`, and every path starts with `/fibersteel/`.
   - The `api` has `page` (Playwright), `click(target, { after, zoom })`, `hover(target)`, `type(target, text, { delay })`,
     `press(key)`, `scroll(px, seconds)` and `pause(seconds)`. A target is a CSS selector or a Playwright locator.
   - `pause()` and `after` are skipped in `--check`. Where something must finish before you navigate, use
     `page.waitForTimeout()` instead.
   - `login` runs off camera, and its localStorage carries into the recording.
   - To show the site with the installs showcase left off, serve pages as a build with `installs: false` marks them
     (`<html data-installs="off">`): `installs-feature/flow.mjs` does it with `page.route()`.
   - Scroll smoothly with the `scrollTo()` helper in the existing flows. Don't use the kit's `scroll()` for long
     distances: its wheel steps run far slower than their `seconds`.
   - Say only what the scene shows. The samples are samples, a feature you don't open isn't narrated, and dates and
     the open/closed status on screen must not contradict the narration.
4. Run `--check` until it passes, then make the video and review its frames as above.

## How it works

`bin/fibersteel-video.sh` runs these steps:
1. builds the site with `--base /fibersteel`;
2. serves `dist/` at `http://127.0.0.1:4398/fibersteel/` (`lib/serve.mjs`);
3. copies the video's source to `video-drafts/work/<name>/`, switching off the kit's own levelling (`"loudnorm": false`);
4. runs the kit's `record.mjs --check`, then `voiceover.mjs --kokoro`;
5. levels every clip to −16 LUFS (`lib/level.mjs`): it measures each clip's loudness, applies that one gain and limits
   the peaks;
6. runs the kit's `record.mjs` (paced to each narration clip, with a drawn cursor and click ripples), then `assemble.mjs`;
7. re-encodes the result as H.264 and measures each narrated line in it (`lib/level.mjs --check`);
8. writes the captions from the timeline (`lib/captions.mjs`) and burns a copy into the video;
9. pulls out the review frames.

Why the kit's levelling is off: it runs ffmpeg's single-pass `loudnorm` on each clip, and ffmpeg 4.4 gets clips shorter
than about 3 seconds badly wrong. In testing on the HMI videos, a 2.9-second line came out 29 dB too quiet, and every
short line in their first round was nearly inaudible because of it.
