/**
 * Summarize long-game probe reports side by side.
 * Usage: node scripts/perf/summarize-longgame.mjs <label> [<label> …]
 * Reads screenshots/longgame-perf/<label>/report-deck-docked-tv.json (+ the
 * ingest report when present) and prints one comparison table.
 */
import fs from 'fs';
import path from 'path';

const labels = process.argv.slice(2);
if (labels.length === 0) {
  console.error('usage: node scripts/perf/summarize-longgame.mjs <label> …');
  process.exit(1);
}

const rows = [];
for (const label of labels) {
  const dir = path.join('screenshots', 'longgame-perf', label);
  const main = JSON.parse(fs.readFileSync(path.join(dir, 'report-deck-docked-tv.json'), 'utf8'));
  let ingest;
  try {
    ingest = JSON.parse(fs.readFileSync(path.join(dir, 'report-ingest.json'), 'utf8'));
  } catch { /* ingest test may be absent for this label */ }
  const anims = Object.values(main.paintCensus.anims ?? {}).reduce((s, n) => s + n, 0);
  rows.push({
    label,
    loops: anims,
    'idleB j50': main.idleBefore.tickJank50,
    'idleA j50': main.idleAfter.tickJank50,
    'idleA LT': main.idleAfter.longTasks,
    cold: main.wheelCold.toDom,
    'warm p50': main.wheelWarm.toDom.p50,
    'warm p95': main.wheelWarm.toDom.p95,
    mad: main.wheelWarm.toDom.mad,
    'late p50': main.wheelLate.toDom.p50,
    'late p95': main.wheelLate.toDom.p95,
    'wheel LT max': Math.max(main.wheelWarm.longTaskMax, main.wheelLate.longTaskMax),
    'ingest p50': ingest?.summary.total.p50 ?? '—',
    'flush p50': ingest?.summary.flush.p50 ?? '—',
    'commit p50': ingest?.summary.commit.p50 ?? '—',
    'hand imgs': main.handImageCensus === undefined ? '—' :
      `${main.handImageCensus.unique}u/${main.handImageCensus.decodedMB}MB/${main.handImageCensus.oversized}ov`,
    nodes: main.idleAfterSnapshot.Nodes,
    'heap MB': Math.round(main.idleAfterSnapshot.JSHeapUsedSize / 1024 / 1024 * 10) / 10,
  });
}
console.table(rows);
