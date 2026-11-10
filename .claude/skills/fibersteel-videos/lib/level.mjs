#!/usr/bin/env node
// Even out the narration, so that no line is quieter or louder than the rest.
//
//   node level.mjs <work-dir>                 level every clip in <work-dir>/audio in place (after the kit's voiceover step)
//   node level.mjs <work-dir> --check <mp4>   measure each narrated line in the finished video; exit 1 if one is off
//
// Why not the kit's own levelling: it runs ffmpeg's single-pass loudnorm on each clip, and ffmpeg 4.4 gets clips
// shorter than about 3 seconds badly wrong (a 2.9-second line came out 29 dB too quiet). fibersteel-video.sh switches it
// off ("loudnorm": false) and levels here instead: measure each clip's loudness (EBU R128), apply that single gain,
// and limit the peaks. That works the same for a 2-second line as for a 12-second one.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const TARGET = -16; // LUFS: what the kit aims for
const PEAK = -1.5; // dBFS: the limiter's ceiling
const CLOSE = 0.5; // LU: a clip this close to the target is left alone, so re-runs don't re-encode it
const OFF = 2; // LU: --check fails a line further than this from the target

const args = process.argv.slice(2);
const dir = args[0];
const checkAt = args.indexOf('--check');
const mp4 = checkAt > 0 ? args[checkAt + 1] : null;
if (!dir || (checkAt > 0 && !mp4)) {
  console.error('usage: level.mjs <work-dir> [--check <video.mp4>]');
  process.exit(2);
}

function ffmpeg(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...argv], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return r.stderr;
}

// Integrated loudness (LUFS) and sample peak (dBFS) from ebur128's summary; -Infinity for silence
function measure(input, before = []) {
  const log = ffmpeg([...before, '-i', input, '-vn', '-af', 'ebur128=peak=sample', '-f', 'null', '-']);
  const summary = log.slice(log.lastIndexOf('Summary:'));
  const num = (re) => {
    const m = summary.match(re);
    return !m || m[1] === '-inf' ? -Infinity : Number(m[1]);
  };
  const lufs = num(/I:\s+(-?[\d.]+|-inf) LUFS/);
  // ebur128 reports silence as -70 LUFS, its gate
  return { lufs: lufs <= -69.9 ? -Infinity : lufs, peak: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}

const duration = (file) =>
  Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim());
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(1).padStart(6) : '     –');

if (mp4) {
  // The finished video: every narrated scene's window, from the timeline the recording wrote
  const tl = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
  const bad = [];
  console.log(`Narration loudness in ${path.basename(mp4)} (target ${TARGET} LUFS, ±${OFF}):`);
  for (const s of tl.scenes.filter((x) => x.audio && x.audioDuration > 0.5)) {
    const { lufs } = measure(mp4, ['-ss', s.start.toFixed(3), '-t', s.audioDuration.toFixed(3)]);
    const ok = Number.isFinite(lufs) && Math.abs(lufs - TARGET) <= OFF;
    if (!ok) bad.push(s.id);
    console.log(`  ${ok ? 'ok ' : 'OFF'} ${fmt(lufs)} LUFS  ${s.id}`);
  }
  if (bad.length) {
    console.error(`Loudness check failed: ${bad.join(', ')} ${bad.length === 1 ? 'is' : 'are'} not at the level of the other lines.`);
    process.exit(1);
  }
  console.log('Loudness check passed: every line is at the same level.');
  process.exit(0);
}

// The clips: level each one, then record its new length for the recording step
const manifestFile = path.join(dir, 'audio', 'durations.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const limit = 10 ** (PEAK / 20);
console.log(`Levelling the narration to ${TARGET} LUFS:`);
for (const [id, clip] of Object.entries(manifest.scenes)) {
  if (!clip.file) continue; // a silent scene
  const file = path.join(dir, clip.file);
  const before = measure(file);
  if (!Number.isFinite(before.lufs)) {
    console.log(`  silent  ${id}`);
    continue;
  }
  if (Math.abs(before.lufs - TARGET) <= CLOSE && before.peak <= PEAK + 0.5) {
    console.log(`  ok     ${fmt(before.lufs)} LUFS  ${id}`);
    continue;
  }
  const gain = TARGET - before.lufs;
  const tmp = `${file}.lvl.mp3`;
  // level=false: alimiter would otherwise turn the whole clip back up to 0 dBFS
  ffmpeg(['-y', '-loglevel', 'error', '-i', file, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${limit.toFixed(4)}:level=false`, '-ar', '44100', '-b:a', '128k', tmp]);
  const after = measure(tmp);
  if (!Number.isFinite(after.lufs) || Math.abs(after.lufs - TARGET) > 1) {
    fs.rmSync(tmp, { force: true });
    console.error(`Couldn't level ${id}: ${fmt(before.lufs)} → ${fmt(after.lufs)} LUFS`);
    process.exit(1);
  }
  fs.renameSync(tmp, file);
  clip.duration = Number(duration(file).toFixed(3));
  console.log(`  level  ${fmt(before.lufs)} → ${fmt(after.lufs)} LUFS  ${id}`);
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
