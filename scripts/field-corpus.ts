/*
 * A PILE OF CONSOLE EXPORTS, READ BY CAUSE CLASS (FREEZE ZERO · part C — the field as a source of classes).
 *
 *   npm run diag:corpus -- <dir with *_console_export_*.txt>
 *
 * The in-game «export the console» writes a text file: the warnings and errors of the session, a line each
 * (`[HH:MM:SS] WARN [net] …`). Dozens of them pile up on a developer's disk — every one a real session somebody
 * stopped to save. This reads them all with THE SAME classifier the diagnostics hub files a stall under
 * (`src/common/diagnostics/cause.ts` — one implementation for the page, the hub, the e2e harvest, the monkey and now
 * the old exports) and prints, by tier:
 *
 *   · every class with the exports that carry it — how many, the first and the last day it was seen, one line of it;
 *   · the tagged lines no shape knows (a net that speaks and is not classified is a net nobody counts).
 *
 * ⚠ The lines are YESTERDAY'S, the shapes are today's: a class a later build declared `planned` (or retired with its
 * net) still reads as it was printed then. «Last seen» is the day of the newest export that carries the class — a
 * class whose last day is old was either closed since, or needs a road nobody walked again; the plan's table (§4b)
 * says which, class by class.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {causeOf} from '../src/common/diagnostics/cause';

const dir = process.argv[2];
if (dir === undefined || !fs.existsSync(dir)) {
  console.error('usage: npm run diag:corpus -- <dir with *_console_export_*.txt>');
  process.exit(2);
}
const files = fs.readdirSync(dir).filter((name) => /_console_export_.*\.txt$/.test(name)).sort();

type Hit = {date: string, n: number, first: string};
const classes = new Map<string, {tier: string, hits: Map<string, Hit>}>();
const unknown = new Map<string, {n: number, files: Set<string>, sample: string}>();
const LINE = /^\[(\d\d:\d\d:\d\d)\] (ERROR|WARN|WARNING|LOG|INFO)\s+(.*)$/;

for (const name of files) {
  const date = /_console_export_(\d{4}-\d\d-\d\d)/.exec(name)?.[1] ?? '?';
  for (const raw of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
    const m = LINE.exec(raw);
    if (m === null || !m[3].startsWith('[')) {
      continue; // an untagged line (an HTTP failure, a stack's frame) is not a net's word
    }
    const text = m[3];
    // (The journal knows two levels; a net's line printed as LOG / INFO is read as a warning — the shape decides its tier.)
    const cause = causeOf(text, m[2] === 'ERROR' ? 'error' : 'warn');
    if (cause === undefined) {
      const tag = /^\[[^\]]+\]\s+\S+(\s+\S+)?/.exec(text)?.[0] ?? text.slice(0, 40);
      const entry = unknown.get(tag) ?? {n: 0, files: new Set<string>(), sample: text.slice(0, 200)};
      entry.n++;
      entry.files.add(name);
      unknown.set(tag, entry);
      continue;
    }
    const cls = classes.get(cause.cls) ?? {tier: cause.tier, hits: new Map<string, Hit>()};
    const hit = cls.hits.get(name) ?? {date, n: 0, first: text.slice(0, 260)};
    hit.n++;
    cls.hits.set(name, hit);
    classes.set(cause.cls, cls);
  }
}

const rows = [...classes.entries()].sort((a, b) => b[1].hits.size - a[1].hits.size || a[0].localeCompare(b[0]));
console.log(`THE FIELD CORPUS — ${files.length} export(s), ${rows.length} class(es)\n`);
for (const tier of ['defect', 'planned', 'info']) {
  const of = rows.filter(([, c]) => c.tier === tier);
  console.log(`── ${tier.toUpperCase()} (${of.length}) ──`);
  for (const [cls, c] of of) {
    const hits = [...c.hits.values()].sort((a, b) => b.date.localeCompare(a.date));
    console.log(`${String(hits.length).padStart(3)} export(s) · last ${hits[0].date} · first ${hits[hits.length - 1].date} · ${hits.reduce((sum, h) => sum + h.n, 0)} line(s)  ${cls}`);
    if (tier === 'defect') {
      console.log(`      ${hits[0].first}`);
    }
  }
  console.log('');
}
console.log(`── TAGGED LINES NO SHAPE KNOWS (${unknown.size}) ──`);
for (const [tag, entry] of [...unknown.entries()].sort((a, b) => b[1].files.size - a[1].files.size).slice(0, 60)) {
  console.log(`${String(entry.files.size).padStart(3)} export(s) · ${entry.n} line(s)  ${tag}\n      ${entry.sample}`);
}
