#!/usr/bin/env node
/*
 * THE FIELD OPENING REPORT — reads the index `field-opening-index.cjs` wrote on the box and answers phase 2's three
 * questions: which opening SHAPES the field walks (per human seat: the sequence of prompts from the wizard to the
 * action menu), where a HUMAN seat stood for a long time on one prompt PAST THE LOBBY (a stall candidate, with the
 * prompt it stood on and what came after — the stand's recipe), and which openings never reached the menu.
 *
 *   node scripts/field-opening-report.mjs <index-dir> [--gap <seconds>=180] [--detail] [--game <id>]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a) && !/^g[0-9a-f]{6,}$/.test(a));
if (!dir) {
  console.error('usage: field-opening-report.mjs <index-dir> [--gap <s>] [--detail] [--game <id>]');
  process.exit(2);
}
const gapS = args.includes('--gap') ? Number(args[args.indexOf('--gap') + 1]) : 180;
const detail = args.includes('--detail');
const oneGame = args.includes('--game') ? args[args.indexOf('--game') + 1] : undefined;

const games = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const opt = (o) => o === undefined ? '' : Object.entries(o).filter(([, v]) => v === true).map(([k]) => k).join('+') + ` ${o.players}p/${o.bots}bot`;

if (oneGame !== undefined) {
  const g = games.find((x) => x.game === oneGame);
  if (g === undefined) {
    console.error(`no game ${oneGame} in the index`);
    process.exit(1);
  }
  console.log(`${g.game}  ${opt(g.options)}  completed=${g.completed} reachedGen2=${g.reachedGen2}`);
  let prev;
  for (const s of g.saves) {
    if (s.error) {
      console.log(`  ${String(s.step).padStart(5)}  ERROR ${s.error}`);
      continue;
    }
    const dt = prev === undefined ? '' : `+${Math.round((s.t - prev) / 1000)}s`;
    prev = s.t;
    if (s.end) {
      console.log(`  ${String(s.step).padStart(5)} ${dt.padStart(8)}  gen ${s.gen} ${s.phase} — the opening is over`);
      continue;
    }
    console.log(`  ${String(s.step).padStart(5)} ${dt.padStart(8)}  ${s.phase.padEnd(9)} active=${String(s.active).padEnd(6)} ` +
      s.seats.map((x) => `${x.c}${x.bot ? '(bot)' : ''}:${x.wf} [pend ${x.pend} prel ${x.prel} hand ${x.hand} corp ${x.corp}]`).join('  '));
  }
  process.exit(0);
}

const shapes = new Map(); // shape → {count, games:Set}
const stalls = [];
const unfinished = [];
const errors = new Map();
let humanSeats = 0;
for (const g of games) {
  const saves = g.saves.filter((s) => !s.error && !s.end);
  for (const s of g.saves.filter((s) => s.error)) {
    const k = s.error.replace(/\d+/g, '#').slice(0, 90);
    errors.set(k, (errors.get(k) ?? 0) + 1);
  }
  if (saves.length === 0) continue;
  const colors = saves[0].seats.filter((x) => !x.bot).map((x) => x.c);
  for (const c of colors) {
    humanSeats++;
    const seq = [];
    let reachedMenu = false;
    for (const s of saves) {
      const seat = s.seats.find((x) => x.c === c);
      if (seat === undefined) continue;
      const tok = seat.wf;
      if (tok.includes(':menu')) reachedMenu = true;
      if (seq.length === 0 || seq[seq.length - 1] !== tok) seq.push(tok);
    }
    const shape = seq.filter((t) => t !== '-').join(' → ');
    const row = shapes.get(shape) ?? {count: 0, games: new Set()};
    row.count++;
    row.games.add(g.game);
    shapes.set(shape, row);
    if (!reachedMenu && !g.reachedGen2) {
      unfinished.push({game: g.game, seat: c, last: seq[seq.length - 1], steps: saves.length, completed: g.completed});
    }
  }
  // Gaps: consecutive saves where the next save came > gapS later while a HUMAN seat held a live prompt. The wizard's
  // wait at the table's first saves is the LOBBY (a seat not yet joined, a friend away) — set aside.
  for (let i = 0; i + 1 < saves.length; i++) {
    const a = saves[i];
    const b = saves[i + 1];
    const dt = (b.t - a.t) / 1000;
    if (dt < gapS) continue;
    const asked = a.seats.filter((x) => !x.bot && x.wf !== '-');
    if (asked.length === 0) continue;
    const lobby = a.phase === 'research' && a.step <= 1;
    const after = b.seats.filter((x) => !x.bot).map((x) => `${x.c}:${x.wf}`).join(' ');
    stalls.push({game: g.game, step: a.step, dt: Math.round(dt), phase: a.phase, asked: asked.map((x) => `${x.c}:${x.wf}`).join(' '), after, active: a.active, options: g.options, lobby});
  }
}

console.log(`FIELD OPENINGS — ${games.length} games, ${humanSeats} human seats, ${shapes.size} distinct shapes`);
console.log('');
console.log('■ SHAPES (per human seat, the wizard → the menu), most common first:');
for (const [shape, row] of [...shapes.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, detail ? 200 : 40)) {
  console.log(`  ${String(row.count).padStart(4)}×  ${shape}${detail ? '   [' + [...row.games].slice(0, 3).join(', ') + ']' : ''}`);
}
console.log('');
const inPlay = stalls.filter((s) => !s.lobby);
console.log(`■ LONG WAITS on a human prompt in generation 1 PAST THE LOBBY (> ${gapS} s between saves): ${inPlay.length} (lobby waits set aside: ${stalls.length - inPlay.length})`);
for (const s of inPlay.sort((a, b) => b.dt - a.dt).slice(0, detail ? 200 : 60)) {
  console.log(`  ${String(s.dt).padStart(6)} s  ${s.game}-${String(s.step).padStart(5, '0')}  ${s.phase.padEnd(8)} active=${s.active}  ${s.asked}  → ${s.after}  (${opt(s.options)})`);
}
console.log('');
console.log(`■ OPENINGS THAT NEVER REACHED THE MENU (live games — a stall at the start, or simply unfinished): ${unfinished.length}`);
for (const u of unfinished.slice(0, detail ? 200 : 40)) {
  console.log(`  ${u.game} ${u.seat}  last «${u.last}»  ${u.steps} saves${u.completed ? '  (completed!)' : ''}`);
}
if (errors.size > 0) {
  console.log('');
  console.log('■ saves the index could not read (schema drift of old games):');
  for (const [k, n] of [...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${String(n).padStart(5)}×  ${k}`);
  }
}
