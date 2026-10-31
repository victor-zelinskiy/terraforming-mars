#!/usr/bin/env node
/*
 * THE FIELD LOG REPORT — reads what the clients' flight recorders dropped into `db/field-log/*.jsonl` (the box:
 * `~/.config/terraforming-mars/embedded/db/field-log/`) and lays the freezes out: every PREVIOUS-SESSION record whose
 * last heartbeats show a live prompt with nothing accepting (the screen the player reloaded away from), every tagged
 * line by tag, grouped by game and seat.
 *
 *   node scripts/field-log-report.mjs <file-or-dir> [--detail]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: field-log-report.mjs <file-or-dir> [--detail]');
  process.exit(2);
}
const detail = args.includes('--detail');
const files = fs.statSync(target).isDirectory() ? fs.readdirSync(target).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(target, f)) : [target];
const rows = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter((l) => l !== '').map((l) => {
  try {
    return JSON.parse(l);
  } catch {
    return undefined;
  }
}).filter((r) => r !== undefined));

const byTag = new Map();
const freezes = [];
const sessions = new Map();
for (const r of rows) {
  const rec = r.record ?? {};
  const key = `${rec.game ?? '?'} ${rec.player ?? '?'} ${rec.profile ?? ''}`;
  const s = sessions.get(key) ?? {posts: 0, lines: 0, kinds: new Set()};
  s.posts++;
  s.lines += (rec.lines ?? []).length;
  s.kinds.add(r.kind);
  sessions.set(key, s);
  for (const l of rec.lines ?? []) {
    const tag = /^\[[^\]]+\]/.exec(l.text)?.[0] ?? '?';
    const shape = l.text.replace(/\d+/g, '#').slice(0, 110);
    const t = byTag.get(tag) ?? new Map();
    t.set(shape, (t.get(shape) ?? 0) + 1);
    byTag.set(tag, t);
  }
  if (r.kind === 'previous-session') {
    const hb = rec.heartbeats ?? [];
    const last = hb[hb.length - 1];
    if (last !== undefined && last.prompt !== '' && !last.accepting) {
      freezes.push({at: r.at, nav: r.navigation, key, last, lines: (rec.lines ?? []).slice(-6).map((l) => l.text.slice(0, 160))});
    }
  }
}

console.log(`FIELD LOG — ${rows.length} posts, ${sessions.size} sessions (game · player · profile)`);
console.log('');
console.log(`■ SCREENS RELOADED AWAY FROM A LIVE PROMPT WITH NOTHING ACCEPTING (the freeze's own signature): ${freezes.length}`);
for (const f of freezes.slice(0, detail ? 200 : 40)) {
  console.log(`  ${f.at}  ${f.key}  came back by «${f.nav}»  last: prompt ${f.last.prompt}  quiet ${f.last.quietS}s  presses ${f.last.presses}  inFlight [${(f.last.inFlight ?? []).join(', ')}]  frames [${(f.last.frames ?? []).join(' ')}]  ${f.last.section}`);
  for (const l of f.lines) {
    console.log(`        ${l}`);
  }
}
console.log('');
console.log('■ TAGGED LINES by tag and shape:');
for (const [tag, shapes] of [...byTag.entries()].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) {
  const total = [...shapes.values()].reduce((x, y) => x + y, 0);
  console.log(`  ${tag}  ${total}×`);
  for (const [shape, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, detail ? 50 : 6)) {
    console.log(`     ${String(n).padStart(4)}×  ${shape}`);
  }
}
if (detail) {
  console.log('');
  console.log('■ SESSIONS:');
  for (const [k, s] of sessions) {
    console.log(`  ${k}  posts ${s.posts}  lines ${s.lines}  [${[...s.kinds].join(', ')}]`);
  }
}
