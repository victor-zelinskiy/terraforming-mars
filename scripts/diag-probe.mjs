/**
 * DIAGNOSTICS PROBE — the hub's road to the collector, proven from a terminal, with no window.
 *
 * The diagnostics hub (src/server/diagnostics/hub → build/electron/diagnostics-hub.js) is a plain Node module: the
 * Electron main process is merely its host. This script is ANOTHER host — bare Node, a temp folder, Node's own fetch —
 * that makes the hub do everything it does in the game, against the REAL collector:
 *
 *   1. «Проверка связи» — one test event per runtime (page / main / server), each answered;
 *   2. an automatic error carrying a seat id and a player's name — to SEE, in the collector, that neither arrived;
 *   3. a liveness episode — one event for the whole episode;
 *   4. «Сообщить о проблеме» — a report with its package as attachments, and its code.
 *
 * WHEN TO RUN IT: after changing the hub, the event's shape or the report package — before a release carries the change
 * to players. It needs a destination, given EXPLICITLY (nothing here reads a baked-in one):
 *
 *     TM_DIAG_DSN=<the project's DSN> node scripts/diag-probe.mjs            # events are filed under `development`
 *     npm run build:diagnostics && TM_DIAG_DSN=… node scripts/diag-probe.mjs  # after touching the hub's sources
 *
 * Then read what arrived:  npm run diag -- issues --env development   ·   npm run diag -- report <the printed code>
 *
 * Every event it sends is tagged environment `development` (or TM_DIAG_ENV), so it never mixes with players' or the
 * box's. The stacks are of this local, unstamped bundle — they are NOT resolved to sources (only a release is stamped).
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
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-diag-probe-'));

const SEAT = 'p1a2b3c4d5e6f';
const NAME = 'ProbePlayerName';
let hub;

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
  env: {TM_DIAG_DSN: process.env.TM_DIAG_DSN, TM_DIAG_ENV: process.env.TM_DIAG_ENV ?? 'development'},
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
  readSave: async (participantId) => ({gameId: 'gprobe00000001', data: Buffer.from(JSON.stringify({id: 'gprobe00000001', players: [{id: participantId, name: NAME}]}))}),
  logTails: async () => [{name: 'main', text: 'probe main log tail\n'}, {name: 'embedded-server', text: 'probe server log tail\n'}],
  recentHangTrace: async () => undefined,
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
const entry = (over) => ({
  id: `page-probe-${crypto.randomBytes(3).toString('hex')}`, at: now, lastAt: now, level: 'error', runtime: 'page', count: 1, build: pkg.version,
  screen: {screen: 'player-home', section: 'hand/', prompt: 'card#12', accepting: false, inFlight: [], frames: ['hand:committed'], quietS: 12, block: 'reveal', profile: 'tv', viewport: '3840×2160@1'},
  ...over,
});
const context = {screen: 'player-home', profile: 'tv', locale: 'ru', gameId: '', participantId: SEAT, names: [NAME], promptType: 'card'};
hub.line({kind: 'context', context});

console.log(`diag-probe · ${pkg.name}@${pkg.version} → environment ${host.env.TM_DIAG_ENV}`);

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

// 3 · a liveness episode, cured
const stall = '[liveness] stall (unserved): 10s without progress, 0 presses; asked: card; beat: executing; stranded: no; last in flight: nothing; claim: none; holds: none — rung 0: presentation stories degraded';
hub.line({kind: 'entry', change: 'close', entry: entry({
  kind: 'stall', family: 'liveness', level: 'warn', title: 'stall (unserved): 10s without progress', stack: undefined,
  text: `${stall}\n[liveness] recovered after 13s, 1 rung(s) run`,
  episode: {state: 'healed', durationMs: 13_000, lines: 2, steps: ['rung 0: presentation stories degraded']},
})});
await sleep(2500);
console.log('\n2 · an automatic error (scrubbed) and 3 · a liveness episode — sent; check them with `npm run diag -- issues --env development`');

// 4 · a report
const report = await hub.invoke('report', {
  category: 'freeze', comment: 'Проба: отчёт из scripts/diag-probe.mjs', entryId: leakEntry.id, context,
  journal: [pageEntry, leakEntry], fieldRecord: {lines: [{at: now, text: stall}], heartbeats: [{at: now, prompt: 'card#12', accepting: false, quietS: 12}]},
});
console.log(`\n4 · report ${report.code} — ${report.state}`);
for (const part of report.parts) {
  console.log(`  ${part.name.padEnd(24)} ${String(part.bytes).padStart(8)} B${part.truncated ? ' (cut)' : ''}`);
}
console.log(`  folder: ${report.folder}`);
await sleep(3000);
const status = await hub.invoke('status', undefined);
console.log(`\nstatus: environment ${status.environment} · ${status.release} · queued ${status.queued} · last error «${status.lastError}»`);
await hub.shutdown();
console.log(`\nread it:  npm run diag -- report ${report.code}   ·   npm run diag -- selftest   ·   npm run diag -- issues --env ${status.environment}`);
process.exit(check.rows.every((row) => row.state === 'delivered') && report.state === 'sent' ? 0 : 1);
