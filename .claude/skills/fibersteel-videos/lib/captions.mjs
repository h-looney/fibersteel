#!/usr/bin/env node
// Captions for a recorded video, from the kit's timeline.json: node captions.mjs <work-dir> <out.vtt> [<out.srt>]
// Each scene's narration becomes cues timed to its clip; long lines are split at sentence ends, then kept to two
// lines of about 42 characters, with the clip's time shared out by length.
import fs from 'node:fs';
import path from 'node:path';

const [dir, vttOut, srtOut] = process.argv.slice(2);
if (!dir || !vttOut) {
  console.error('usage: captions.mjs <work-dir> <out.vtt> [<out.srt>]');
  process.exit(2);
}
const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));

const MAX = 84; // two lines of ~42
function chunks(text) {
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
  const out = [];
  for (const s of sentences) {
    if (s.length <= MAX) { out.push(s); continue; }
    // Split a long sentence at a comma or space near the middle of each piece
    let rest = s;
    while (rest.length > MAX) {
      let cut = rest.lastIndexOf(', ', MAX);
      if (cut < MAX / 2) cut = rest.lastIndexOf(' ', MAX);
      out.push(rest.slice(0, cut + (rest[cut] === ',' ? 1 : 0)).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}
function wrap(line) {
  if (line.length <= 42) return line;
  const mid = Math.floor(line.length / 2);
  const left = line.lastIndexOf(' ', mid);
  const right = line.indexOf(' ', mid);
  const at = left < 0 ? right : right < 0 ? left : mid - left <= right - mid ? left : right;
  return at < 0 ? line : `${line.slice(0, at)}\n${line.slice(at + 1)}`;
}
const stamp = (t, sep) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s}${sep}${String(ms % 1000).padStart(3, '0')}`;
};

const cues = [];
for (const scene of tl.scenes) {
  if (!scene.narration || !scene.audioDuration) continue;
  const parts = chunks(scene.narration);
  const total = parts.reduce((n, p) => n + p.length, 0);
  let t = scene.start;
  for (const p of parts) {
    const d = (scene.audioDuration * p.length) / total;
    cues.push({ from: t, to: t + d, text: wrap(p) });
    t += d;
  }
}
fs.writeFileSync(vttOut, `WEBVTT\n\n${cues.map((c) => `${stamp(c.from, '.')} --> ${stamp(c.to, '.')}\n${c.text}`).join('\n\n')}\n`);
if (srtOut) fs.writeFileSync(srtOut, `${cues.map((c, i) => `${i + 1}\n${stamp(c.from, ',')} --> ${stamp(c.to, ',')}\n${c.text}`).join('\n\n')}\n`);
console.log(`${cues.length} captions → ${vttOut}${srtOut ? ` and ${srtOut}` : ''}`);
