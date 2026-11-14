/**
 * DIAGNOSTICS PROBE — the hub's road to the collector, proven from a terminal, with no window.
 *
 * The diagnostics hub (src/server/diagnostics/hub → build/electron/diagnostics-hub.js) is a plain Node module: the
 * Electron main process is merely its host. This script is ANOTHER host — bare Node, a temp folder, Node's own fetch —
 * that makes the hub do everything it does in the game, against the REAL collector:
 *
 *   1. «Проверка связи» — one test event per runtime (page / main / server), each answered;
 *   2. an automatic error carrying a seat id and a player's name — to SEE, in the collector, that neither arrived;
 *   3. STALLS FILED BY THEIR CAUSE (docs/claude/console/freeze-zero/PLAN.md §2) — the page's records are made by the
 *      REAL journal (`src/common/diagnostics/journal.ts`, loaded from the sources: the bundle exports the hub alone),
 *      so the cause classes, the folding and the cures are the game's own:
 *        a · a liveness episode, healed, with the evidence at its declared bounds (does the collector keep it whole?);
 *        b · the SAME cause once more — another card, another duration, ended by a reload → the same issue, 2 events;
 *        c · another cause (`stranded+claim…`) → another issue;
 *        d · a PLANNED ceiling → counted, never an event;
 *        e · a wait-graph finding and its door's echo → one event that holds both lines;
 *        f · the renderer's stop, with its trace → one event with `hang_trace.json`;
 *        g · the ledger of an «earlier run» → one event of kind `session` (what `npm run diag -- trend` reads);
 *   4. «Сообщить о проблеме» — a report with its package as attachments, and its code.
 *
 * WHEN TO RUN IT: after changing the hub, the event's shape or the report package — before a release carries the change
 * to players. It needs a destination, given EXPLICITLY (nothing here reads a baked-in one, and the key is never
 * written anywhere — pass it through the environment of this process only):
 *
 *     TM_DIAG_DSN=<the project's DSN> node scripts/diag-probe.mjs            # events are filed under `development`
 *     npm run build:diagnostics && TM_DIAG_DSN=… node scripts/diag-probe.mjs  # after touching the hub's sources
 *
 * Then read what arrived:
 *     npm run diag -- classes --env development        one row per cause class (a+b = ONE row, 2 events)
 *     npm run diag -- class <the class it printed>     the cases, laid out in folders
 *     npm run diag -- trend --env development          the session ledger, by release
 *     npm run diag -- report <the printed code>
 *
 * Every event it sends is tagged environment `development` (or TM_DIAG_ENV), so it never mixes with players' or the
 * box's. The stacks are of this local, unstamped bundle — they are NOT resolved to sources (only a release is stamped).
 * It takes about half a minute: the hub sends a stall when its tick has finished speaking (`STALL_SETTLE_MS`), an
 * episode when it is known how it ended (`EPISODE_SETTLE_MS`), an earlier run's ledger 12 s after the start.
 */
import {createRequire} from 'node:module';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(root, 'build', 'electron', 'diagnostics-hub.js');

if ((process.env.TM_DIAG_DSN ?? '').trim() === '') {
  console.error('diag-probe: set TM_DIAG_DSN to the project\'s DSN — the probe sends only where it is told to.');
  process.exit(2);
}
if (!fs.existsSync(bundle)) {
  console.error(`diag-probe: ${path.relative(root, bundle)} is not built — run \`npm run build:diagnostics\` first.`);
  process.exit(2);
}

const require = createRequire(import.meta.url);
const {createDiagnosticsHub} = require(bundle);
// The page's journal, from the sources (it imports only its own folder): a hand-made record would prove the probe.
let DiagJournal;
try {
  const {tsImport} = await import('tsx/esm/api');
  ({DiagJournal} = await tsImport('../src/common/diagnostics/journal.ts', import.meta.url));
} catch (err) {
  console.error(`diag-probe: the page's journal could not be loaded from src/common/diagnostics/journal.ts (tsx): ${err?.message ?? err}`);
  process.exit(2);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-diag-probe-'));
const ENVIRONMENT = process.env.TM_DIAG_ENV ?? 'development';

// The hub's own delays (`hub.ts` — the bundle exports the hub alone, so they are repeated here).
const STALL_SETTLE_MS = 1_500;
const EPISODE_SETTLE_MS = 4_000;
const EARLIER_SESSION_MS = 12_000;

const SEAT = 'p1a2b3c4d5e6f';
const NAME = 'ProbePlayerName';
const GAME = 'g0123456789ab';
const TRACE = JSON.stringify({
  traceEvents: [{name: 'Layout', cat: 'devtools.timeline', ph: 'X', ts: 1, dur: 4_200_000, pid: 1, tid: 1}, {name: 'UpdateLayoutTree', cat: 'blink', ph: 'X', ts: 2, dur: 600_000, pid: 1, tid: 1}],
  metadata: {'command_line': '/home/deck/Applications/TM.AppImage --user-data-dir=/home/deck/.config/terraforming-mars', 'probe': true},
});
let hub;

// g · THE LEDGER OF AN EARLIER RUN, as that run would have left it (`sessionLedger.ts` `SessionLedger`): the hub reads
// the file when it starts and sends it as the run's one `session` event.
const startedAt = Date.now();
const STALL_CLASS = 'liveness/stall/unserved/handpick/hand:committed/block:reveal';
const HANG_CLASS = 'renderer-hang/unresponsive/hand/hand:committed';
const frames = (n, worstMs, native, pressWaited, totalMs, scriptMs, forcedLayoutMs, styleLayoutMs, renderMs) =>
  ({n, worstMs, native, pressWaited, totalMs, scriptMs, forcedLayoutMs, styleLayoutMs, renderMs});
const earlier = {
  run: `probe${crypto.randomBytes(3).toString('hex')}`, release: `terraforming-mars@${pkg.version}`, environment: ENVIRONMENT, appMode: 'host',
  startedAt: startedAt - 3 * 3_600_000, lastAt: startedAt - 2 * 3_600_000, playMs: 42 * 60_000, games: 1, pages: 2,
  classes: {
    [STALL_CLASS]: {tier: 'defect', n: 2, lines: 5, sent: 2},
    'wait-graph/dead-end/question:card': {tier: 'defect', n: 1, lines: 2, sent: 1},
    [HANG_CLASS]: {tier: 'defect', n: 1, lines: 3, sent: 1},
    'wait-graph/ceiling/remote-placement:watchable-board': {tier: 'planned', n: 6, lines: 6, sent: 0},
    'presentation-ledger/story-degraded-by/board-beat-park': {tier: 'info', n: 2, lines: 2, sent: 0},
  },
  kinds: {error: 1, perf: 4, note: 3},
  episodes: [
    {cls: STALL_CLASS, outcome: 'healed', stoodS: 18, cure: 'presentation-ledger', atPlayS: 600},
    {cls: STALL_CLASS, outcome: 'reload', stoodS: 27, cure: '', atPlayS: 1500},
    {cls: HANG_CLASS, outcome: 'healed', stoodS: 5, cure: '', atPlayS: 2000},
  ],
  stood: {'5-10s': 1, '10-20s': 1, '20-40s': 1},
  outcomes: {healed: 2, reload: 1},
  longFrames: {'hand/': frames(3, 812, 2, 1, 2100, 600, 180, 500, 1000), 'parliament/': frames(1, 640, 0, 0, 640, 480, 60, 100, 60)},
  rendererStops: 1,
};
fs.mkdirSync(path.join(dataDir, 'diagnostics'), {recursive: true});
fs.writeFileSync(path.join(dataDir, 'diagnostics', 'session.json'), JSON.stringify(earlier));

const host = {
  version: pkg.version,
  packaged: false,
  head: 'probe',
  dsn: '',
  platform: process.platform,
  osVersion: os.release(),
  arch: process.arch,
  runtimeName: 'Node (probe)',
  runtimeVersion: process.versions.node,
  dataDir,
  env: {TM_DIAG_DSN: process.env.TM_DIAG_DSN, TM_DIAG_ENV: ENVIRONMENT},
  appMode: () => 'host',
  request: async (url, init) => {
    const response = await fetch(url, {method: init.method, headers: init.headers, body: init.body});
    const text = await response.text();
    if (response.status >= 300) {
      console.log(`  ↳ the collector answered ${response.status}: ${text.slice(0, 300)}`);
    }
    return {status: response.status, headers: Object.fromEntries(response.headers.entries())};
  },
  push: () => undefined,
  holdScreen: async () => false,
  dropScreen: () => undefined,
  heldScreenJpeg: async () => undefined,
  consoleDump: async () => `=== probe console export ===\nERRORS: 1\n[00:00:01] [page-error] uncaught: TypeError: a probe line that names ${NAME} and ${SEAT}\n`,
  // (`lastSaveId` is what an episode's event names as the save it began on — `contexts.save`.)
  readSave: async (participantId) => ({gameId: GAME, data: Buffer.from(JSON.stringify({id: GAME, lastSaveId: 17, players: [{id: participantId, name: NAME}]}))}),
  logTails: async () => [{name: 'main', text: 'probe main log tail\n'}, {name: 'embedded-server', text: 'probe server log tail\n'}],
  recentHangTrace: async () => ({name: 'renderer-hang-probe.trace.json', data: Buffer.from(TRACE)}),
  serverSelfTest: async () => {
    setImmediate(() => {
      const err = new Error('the connection check — a test error of the game server (probe)');
      hub.note('server', 'error', `[selftest] server — the connection check: Error: ${err.message}\n${err.stack}`, err.stack, {});
    });
    return true;
  },
  hostSelfTestError: () => new Error('the connection check — a test error of the main process (probe)'),
  copyToClipboard: () => undefined,
  setCrashUpload: () => undefined,
  log: (line) => console.log(`  ${line}`),
};

hub = createDiagnosticsHub(host);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const now = Date.now();
const SCREEN = {screen: 'player-home', section: 'hand/', prompt: 'card#12', accepting: false, inFlight: [], frames: ['hand:committed'], quietS: 12, block: 'reveal', profile: 'tv', viewport: '3840×2160@1'};
const entry = (over) => ({
  // (`x…`: never the shape of a journal's own id, so the hub does not read a page session out of it.)
  id: `page-probe-x${crypto.randomBytes(3).toString('hex')}`, at: now, lastAt: now, level: 'error', runtime: 'page', count: 1, build: pkg.version,
  screen: SCREEN,
  ...over,
});
const context = {screen: 'player-home', profile: 'tv', locale: 'ru', gameId: '', participantId: SEAT, names: [NAME], promptType: 'card'};
hub.line({kind: 'context', context});

console.log(`diag-probe · ${pkg.name}@${pkg.version} → environment ${ENVIRONMENT}`);

// 1 · the connection check
const pageError = new Error('the connection check — a test error of the game screen (probe)');
const pageEntry = entry({kind: 'error', family: 'selftest', title: 'page — the connection check', text: `[selftest] page — the connection check\n${pageError.stack}`, stack: pageError.stack});
hub.line({kind: 'entry', entry: pageEntry, change: 'new'});
const check = await hub.invoke('selftest', {pageEntryId: pageEntry.id});
console.log('\n1 · connection check');
for (const row of check.rows) {
  console.log(`  ${row.runtime.padEnd(6)} ${row.state.padEnd(9)} ${row.eventId} ${row.reason}`);
}

// 2 · an automatic error with a key and a name in it
const leak = new TypeError(`the probe's automatic error — seat ${SEAT} of ${NAME} must NOT arrive`);
const leakEntry = entry({kind: 'error', family: 'page-error', title: `uncaught: TypeError: seat ${SEAT} of ${NAME}`, text: `[page-error] uncaught: ${leak.message}\n${leak.stack}`, stack: leak.stack});
hub.line({kind: 'entry', entry: leakEntry, change: 'new'});
console.log('\n2 · an automatic error (scrubbed) — sent');

// 3 · stalls, filed by their cause
const HELD = 'asked: card; task: handPick; top: hand:committed; holder: block:reveal; beat: none; stranded: no; last in flight: nothing; ' +
  'claim: hand/Ganymede Colony [draw] awaiting (zone up, beat pending, arrival pending, task card); holds: card-receive[blocking]';
const STRANDED = 'asked: card; task: deckPick; top: board; holder: stranded+claim:card-actions:awaiting; beat: none; stranded: card; last in flight: nothing; ' +
  'claim: card-actions/Hi-Tech Lab [draw,pick] awaiting (zone -, beat pending, arrival pending, task -); holds: none';
const stallText = (fields, rung, quiet) => `[liveness] stall (unserved): ${quiet}s without progress, 0 presses; ${fields} — ${rung}`;
const fill = (n, make) => Array.from({length: n}, (_, i) => make(i));
/** What stood — `full` = every list at its declared bound (`DiagnosticModel.ts` `DIAG_EVIDENCE_*`), 200+ characters a line. */
const evidence = (at, full) => {
  const long = full ? ` — ${'the long tail of a line that names a wait, its owner and its age; '.repeat(3)}` : '';
  return {
    at,
    question: `asked card#12 · task handPick · may serve: hand · serving frame: hand:committed · seat ${SEAT}`,
    holders: ['holder: block:reveal', 'hold card-receive [blocking] 11.2s of 35s', ...(full ? fill(6, (i) => `hold story:owed:board-beat-park#${i} [blocking] ${i}.0s of 35s`) : [])],
    tree: ['session:game#1 120.0s', '  frame:hand#3 40.1s committed', '    claim:hand#7 12.0s awaiting  ⟵ waits «the claimed answer» 12.0s/20s',
      ...(full ? fill(87, (i) => `      scene:hold:played-hero#${i} ${i}.0s open${long}`) : [])],
    waits: ['claim:hand#7 [server] waits «the claimed answer» 12.0s of 20s', ...(full ? fill(39, (i) => `step:commit-fold-owed#${i} [reactive] waits «the fold» ${i}.0s of 8s${long}`) : [])],
    graph: ['question:card#12 (server: card / handPick) → admission:host:reveal 12.0s', ...(full ? fill(39, (i) => `admission:host:reveal#${i} (consolePromptAdmission) → scene:hold:card-receive ${i}.0s${long}`) : [])],
    trace: ['-12.0s state claim:hand#7 awaiting', '-0.1s wait frame:hand#3 «submit#31 ends»', ...(full ? fill(78, (i) => `-${i}.0s open scene:hold:played-hero#${i}${long}`) : [])],
    input: 'A/B presses 3 (no handler took 0, B taken 0), absorbed 0',
  };
};
const say = (journal, line) => {
  const made = journal.ingest({level: 'warn', screen: SCREEN, ...line});
  hub.line({kind: 'entry', entry: made.entry, change: made.change});
  return made.entry;
};
const rand = crypto.randomBytes(2).toString('hex');
const pageA = new DiagJournal({runtime: 'page', session: `probe${rand}a`, build: pkg.version});
const pageB = new DiagJournal({runtime: 'page', session: `probe${rand}b`, build: pkg.version});

// a · healed, with the evidence at its bounds; a second rung and a net that spoke inside it
const t0 = Date.now() - 30_000;
const a = say(pageA, {at: t0, text: stallText(HELD, 'rung 0: presentation-ledger: 2 stories degraded', 12), evidence: evidence(t0, true)});
say(pageA, {at: t0 + 1, text: '[presentation-ledger] story «board-beat-park» degraded by the liveness arbiter after 12s'});
say(pageA, {at: t0 + 2_000, text: stallText(HELD, 'rung 1: workspace-outcome: the claim released with force', 14)});
say(pageA, {at: t0 + 6_000, text: '[liveness] recovered after 18s, 2 rung(s) run',
  evidence: {...evidence(t0 + 6_000, false), holders: ['holder: none'], tree: ['session:game#1 126.0s', '  frame:hand#3 46.1s committed']}});
console.log(`\n3a · a liveness episode, healed — class ${a.cause?.cls}`);

// b · the SAME cause: another card, another duration, and the page is reloaded under it
const t1 = Date.now() - 8_000;
const b = say(pageA, {at: t1, text: stallText(HELD.replace('Ganymede Colony', 'Pets').replace('awaiting (', 'presenting ('), 'rung 0: nothing to release', 25), evidence: evidence(t1, false)});
say(pageA, {at: t1 + 2_000, text: stallText(HELD.replace('Ganymede Colony', 'Pets').replace('awaiting (', 'presenting ('), 'rung 1: the ladder is spent', 27)});
// (The next page's first question is what tells the hub the earlier page is gone.)
await hub.invoke('journal', {session: pageB.session});
console.log(`3b · the same cause again, ended by a reload — class ${b.cause?.cls}${b.cause?.cls === a.cause?.cls ? ' (the same: ONE issue, 2 events)' : ' ⚠ NOT the same class'}`);

// d · a planned ceiling: counted, never an event
const planned = say(pageB, {at: Date.now() - 7_000, text: '[wait-graph] ceiling remote-placement:watchable-board (consoleRemotePlacement) — «a board» did not come in 12000 ms — the wait ended on its ceiling (planned: the viewer keeps the board covered)'});
console.log(`3d · a planned ceiling — class ${planned.cause?.cls}, tier ${planned.cause?.tier} (no event)`);

// e · a finding and its door's echo: one record, one event
const t2 = Date.now() - 6_000;
const finding = say(pageB, {at: t2, text: '[wait-graph] dead-end question:card#12 (server: card / handPick) — nothing accepts the press — standing 3 s', evidence: evidence(t2, false)});
const echo = say(pageB, {at: t2 + 1, text: '[wait-graph] cure dead-end at question:card#12 through «question-open» — reopened the «handPick» question in «hand»'});
console.log(`3e · a wait-graph finding + its cure — class ${finding.cause?.cls}${echo.id === finding.id ? ' (the cure is a line of the same record)' : ' ⚠ the cure became a record of its own'}`);
await sleep(STALL_SETTLE_MS + 500);

// c · another cause, healed
const t3 = Date.now() - 5_000;
const c = say(pageB, {at: t3, text: stallText(STRANDED, 'rung 0: workspace-outcome: the claim released', 11), evidence: evidence(t3, false)});
say(pageB, {at: t3 + 4_000, text: '[liveness] recovered after 15s, 1 rung(s) run', evidence: {...evidence(t3 + 4_000, false), holders: ['holder: none']}});
console.log(`3c · another cause — class ${c.cause?.cls}`);

// f · the renderer's stop: the main process's own lines, the trace of the stop rides the event
hub.note('main', 'warn', '[renderer-hang] the page stopped answering — the last screen (read 3s before: prompt card#12, accepting, frames hand:committed, section hand/, quiet 2s, flows frame:hand#3 committed)');
await sleep(1_200);
hub.note('main', 'warn', '[renderer-hang] the page answers again after 5s');
hub.note('main', 'warn', '[renderer-hang] trace of the stop (5s, the page answered again): /home/deck/Applications/renderer-hang-probe.trace.json — open it in chrome://tracing / ui.perfetto.dev');
const closedAt = Date.now();
console.log(`3f · a renderer stop with its trace — class ${HANG_CLASS}`);

// 4 · a report
const stall = stallText(HELD, 'rung 0: presentation-ledger: 2 stories degraded', 12);
const report = await hub.invoke('report', {
  category: 'freeze', comment: 'Проба: отчёт из scripts/diag-probe.mjs', entryId: leakEntry.id, context,
  journal: [pageEntry, leakEntry], fieldRecord: {lines: [{at: now, text: stall}], heartbeats: [{at: now, prompt: 'card#12', accepting: false, quietS: 12}]},
});
console.log(`\n4 · report ${report.code} — ${report.state}`);
for (const part of report.parts) {
  console.log(`  ${part.name.padEnd(24)} ${String(part.bytes).padStart(8)} B${part.truncated ? ' (cut)' : ''}`);
}
console.log(`  folder: ${report.folder}`);

// Every event has left before the hub is shut: the episodes' settle, and the earlier run's ledger (g).
const until = Math.max(closedAt + EPISODE_SETTLE_MS + 3_000, startedAt + EARLIER_SESSION_MS + 3_000);
console.log(`\n3g · waiting ${Math.max(0, Math.round((until - Date.now()) / 1000))}s for the episodes to settle and for the earlier run's ledger (run ${earlier.run}) to leave…`);
await sleep(Math.max(0, until - Date.now()));

const ledger = await hub.invoke('ledger', undefined);
console.log('\nthis run\'s ledger — what was COUNTED, and what of it was sent:');
for (const [cls, row] of Object.entries(ledger.classes)) {
  console.log(`  ${row.tier.padEnd(7)} n ${row.n} · lines ${row.lines} · sent ${row.sent}  ${cls}`);
}
console.log(`  episodes: ${JSON.stringify(ledger.outcomes)} · stood ${JSON.stringify(ledger.stood)} · renderer stops ${ledger.rendererStops}`);
const sentOf = (cls) => ledger.classes[cls ?? '']?.sent ?? -1;
const expected = [
  [a.cause?.cls, 2, 'a + b: one cause, two events'],
  [c.cause?.cls, 1, 'c: another cause'],
  [finding.cause?.cls, 1, 'e: the finding'],
  [HANG_CLASS, 1, 'f: the renderer\'s stop'],
  [planned.cause?.cls, 0, 'd: the planned ceiling'],
];
const wrong = expected.filter(([cls, n]) => sentOf(cls) !== n);
for (const [cls, n, what] of wrong) {
  console.log(`  ⚠ ${what}: expected ${n} event(s) of ${cls}, the hub sent ${sentOf(cls)}`);
}
const status = await hub.invoke('status', undefined);
console.log(`\nstatus: environment ${status.environment} · ${status.release} · queued ${status.queued} · last error «${status.lastError}»`);
await hub.shutdown();
console.log(`\nread it:  npm run diag -- classes --env ${status.environment}   ·   npm run diag -- class ${a.cause?.cls} --env ${status.environment}`);
console.log(`          npm run diag -- trend --env ${status.environment}   ·   npm run diag -- report ${report.code}   ·   npm run diag -- selftest`);
process.exit(check.rows.every((row) => row.state === 'delivered') && report.state === 'sent' && wrong.length === 0 && status.queued === 0 ? 0 : 1);
