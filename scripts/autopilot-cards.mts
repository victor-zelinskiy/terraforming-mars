/*
 * THE CARDS AXIS OF THE AUTOPILOT's COVERAGE (FREEZE ZERO, stage 6 — the owner, 2026-11-26: «покрывал АБСОЛЮТНО все
 * игровые ситуации»). The denominator is the cards in the premium scope (`common/cards/premiumScope.ts` — the same set
 * the coverage specs enumerate); the numerator, the cards the pilot played through the console in the games of a report
 * (`monkey-report.json` → `autopilot.cards`, the viewer's tableau at each game's end). What it prints is the worklist:
 * the cards no game has played yet, by module and type — what a seeded deal must bring to the pilot's hand.
 *
 *   npx tsx scripts/autopilot-cards.mts <monkey-report.json …> [--never <out.json>]
 */
import * as fs from 'fs';
import {ALL_MODULE_MANIFESTS} from '../src/server/cards/AllManifests';
import {PREMIUM_SCOPE_MODULES, inPremiumScope} from '../src/common/cards/premiumScope';

const argv = process.argv.slice(2);
const neverAt = argv.indexOf('--never');
const neverOut = neverAt >= 0 ? argv[neverAt + 1] : undefined;
const reports = argv.filter((a, i) => !a.startsWith('--') && (neverAt < 0 || i !== neverAt + 1));
if (reports.length === 0) {
  console.error('usage: npx tsx scripts/autopilot-cards.mts <monkey-report.json …> [--never <out.json>]');
  process.exit(2);
}

const played = new Map<string, number>();
for (const file of reports) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8')) as {autopilot?: {cards?: Array<{name: string, games: number}>}};
  for (const row of report.autopilot?.cards ?? []) {
    played.set(row.name, (played.get(row.name) ?? 0) + row.games);
  }
}

type Row = {name: string, module: string, family: string};
const scope: Array<Row> = [];
for (const manifest of ALL_MODULE_MANIFESTS) {
  if (!PREMIUM_SCOPE_MODULES.includes(manifest.module)) {
    continue;
  }
  for (const [family, cards] of [['project', manifest.projectCards], ['prelude', manifest.preludeCards], ['corporation', manifest.corporationCards]] as const) {
    for (const [name, entry] of Object.entries(cards as Record<string, {instantiate?: boolean}>)) {
      // (A card no deck holds is no card to deal — `instantiate: false`: the Delta Project prelude names the Hydronetwork
      // track's own action, offered to every seat of the expansion as a standard action, never dealt nor played.)
      if (inPremiumScope({module: manifest.module, name}) && entry.instantiate !== false) {
        scope.push({name, module: manifest.module, family});
      }
    }
  }
}

const never = scope.filter((row) => !played.has(row.name));
const seen = scope.length - never.length;
// THE LEDGER's REASONS (stage 6 — «walked or declared», the kernel ledger's rule for the cards axis): a card no whole game
// plays keeps the `why` the ledger already gave it (a requirement no game of the pilot reaches, a card the console plays
// through another road …); '' is the debt. Read from the file `--never` writes.
const reasons = new Map<string, string>();
if (neverOut !== undefined && fs.existsSync(neverOut)) {
  for (const row of JSON.parse(fs.readFileSync(neverOut, 'utf8')) as Array<{name: string, why?: string}>) {
    if (row.why !== undefined && row.why !== '') {
      reasons.set(row.name, row.why);
    }
  }
}
const declared = never.filter((row) => reasons.has(row.name)).length;
console.log(`cards in scope ${scope.length} · played through the console ${seen} (${(100 * seen / Math.max(1, scope.length)).toFixed(1)} %) · never ${never.length}` +
  ` — declared with a reason ${declared} · THE DEBT ${never.length - declared} · walked or declared ${(100 * (seen + declared) / Math.max(1, scope.length)).toFixed(1)} %`);
const by = new Map<string, Array<string>>();
for (const row of never) {
  const key = `${row.module} · ${row.family}`;
  by.set(key, [...(by.get(key) ?? []), row.name]);
}
for (const [key, names] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${String(names.length).padStart(4)}  ${key}: ${names.slice(0, 12).join(', ')}${names.length > 12 ? ', …' : ''}`);
}
if (neverOut !== undefined) {
  fs.writeFileSync(neverOut, JSON.stringify(never.map((row) => ({...row, why: reasons.get(row.name) ?? ''})), null, 1));
  console.log(`→ ${neverOut}`);
}
