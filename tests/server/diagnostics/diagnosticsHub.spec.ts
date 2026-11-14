import {expect} from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import {DiagEntry, DiagEvidence} from '../../../src/common/diagnostics/DiagnosticModel';
import {DiagJournal} from '../../../src/common/diagnostics/journal';
import {DiagContext, DiagHubStatus, DiagReportRequest, DiagReportResult, DiagSelfTestResult, REPORT_CODE_PATTERN} from '../../../src/common/diagnostics/protocol';
import {OUTBOX_AUTO_MAX, readCollectorLimits} from '../../../src/server/diagnostics/hub/envelopeSender';
import {
  autoDecision, createDiagnosticsHub, EPISODE_SETTLE_MS, EPISODE_STANDING_MS, KEY_EVENTS_MAX, newPolicyState, noteSent, policyKey, SESSION_EVENTS_MAX, STALL_SETTLE_MS,
} from '../../../src/server/diagnostics/hub/hub';
import {parseDsn, resolveHubConfig} from '../../../src/server/diagnostics/hub/hubConfig';
import {HubHost} from '../../../src/server/diagnostics/hub/hubTypes';
import {tailWithin} from '../../../src/server/diagnostics/hub/reportPackage';
import {CAUSE_FINGERPRINT, classTitle, eventOf, extraLists, splitErrorHead} from '../../../src/server/diagnostics/hub/sentryEvent';
import {SessionLedger} from '../../../src/server/diagnostics/hub/sessionLedger';

/**
 * THE DIAGNOSTICS HUB (docs/claude/diagnostics.md) — the one sender. A fake host in a temp folder, a fake collector
 * that records every envelope: what leaves, when, scrubbed of what, and what never does.
 */
const DSN = 'https://abc123@o1.ingest.de.sentry.io/42';
const STACK = 'TypeError: boom at seat p1a2b3c4d5e6f\n    at fold (app://bundle/main.js:2:1834)\n    at run (app://bundle/chunks/vendors.js:9:120)';

type Sent = {url: string, items: Array<{header: Record<string, unknown>, body: string}>};

function parseEnvelope(body: Uint8Array): Array<{header: Record<string, unknown>, body: string}> {
  const bytes = zlib.gunzipSync(body);
  const items: Array<{header: Record<string, unknown>, body: string}> = [];
  let at = bytes.indexOf(0x0A) + 1; // past the envelope's own header line
  while (at < bytes.length) {
    const eol = bytes.indexOf(0x0A, at);
    const header = JSON.parse(bytes.subarray(at, eol < 0 ? bytes.length : eol).toString('utf8')) as Record<string, unknown>;
    at = (eol < 0 ? bytes.length : eol) + 1;
    // An item says its payload's length in BYTES when the payload may hold a newline (an attachment); else it is one line.
    const end = typeof header.length === 'number' ? at + header.length : (bytes.indexOf(0x0A, at) < 0 ? bytes.length : bytes.indexOf(0x0A, at));
    items.push({header, body: bytes.subarray(at, end).toString('utf8')});
    at = end + 1;
  }
  return items;
}

function harness(opts: {packaged?: boolean, dsn?: string, env?: Record<string, string>, machine?: string, appMode?: 'host' | 'remote', online?: boolean, status?: number,
  /** A data folder an earlier harness left (the «next launch» of the same device). */ dataDir?: string,
  /** The Chromium trace of the newest renderer stop. */ trace?: string,
  /** The clock's first reading (a later launch of the same device). */ startAt?: number} = {}) {
  const dataDir = opts.dataDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'tm-diag-'));
  if (opts.machine !== undefined) {
    fs.writeFileSync(path.join(dataDir, 'diagnostics.json'), JSON.stringify({environment: opts.machine}));
  }
  const sent: Array<Sent> = [];
  const pushes: Array<{kind: string, id?: string, entry?: DiagEntry, delivery?: {state: string, reason?: string, eventId?: string}}> = [];
  const timers: Array<{ms: number, run: () => void, dead: boolean}> = [];
  const logs: Array<string> = [];
  const net = {online: opts.online ?? true, status: opts.status ?? 200, headers: {} as Record<string, string>};
  let clock = opts.startAt ?? 1_700_000_000_000;
  let crashUpload: boolean | undefined;
  // (The host is built before the hub it serves: the server's answer reaches the hub through this box.)
  const made: {hub?: ReturnType<typeof createDiagnosticsHub>} = {};
  const host: HubHost = {
    version: '1.2.9', packaged: opts.packaged ?? true, head: 'abc1234', dsn: opts.dsn ?? DSN,
    platform: 'linux', osVersion: '6.1', arch: 'x64', runtimeName: 'Electron', runtimeVersion: '45.3.1',
    dataDir, env: opts.env ?? {},
    appMode: () => opts.appMode ?? 'host',
    request: async (url, init) => {
      if (!net.online) {
        throw new Error('net::ERR_INTERNET_DISCONNECTED');
      }
      if (net.status === 200) {
        sent.push({url, items: parseEnvelope(init.body)});
      }
      return {status: net.status, headers: net.headers};
    },
    push: (event) => pushes.push(event as never),
    holdScreen: async () => true,
    dropScreen: () => undefined,
    heldScreenJpeg: async () => new TextEncoder().encode('JPEGBYTES'),
    consoleDump: async () => 'console line by Zelin about gdeadbeef0001\n',
    readSave: async (participantId) => ({gameId: 'gdeadbeef0001', data: new TextEncoder().encode(JSON.stringify({id: 'gdeadbeef0001', lastSaveId: 17, players: [participantId]}))}),
    logTails: async () => [{name: 'embedded-server', text: 'server tail\n'}],
    recentHangTrace: async () => (opts.trace === undefined ? undefined : {name: 'renderer-hang-20261114-101500.trace.json', data: new TextEncoder().encode(opts.trace)}),
    serverSelfTest: async () => {
      // The server answers on its own clock: its test error arrives as a note of the `server` runtime.
      setImmediate(() => made.hub?.note('server', 'error', '[selftest] server — the connection check: Error: test\nError: test\n    at serverSelfTest (/app/embedded-server.js:5:5)', 'Error: test\n    at serverSelfTest (/app/embedded-server.js:5:5)', {'/app/embedded-server.js': 'id-server'}));
      return true;
    },
    hostSelfTestError: () => new Error('main test'),
    copyToClipboard: () => undefined,
    setCrashUpload: (enabled) => {
      crashUpload = enabled;
    },
    log: (line) => logs.push(line),
  };
  const hub = createDiagnosticsHub(host, {
    now: () => clock,
    random: () => 0.5,
    schedule: (ms, run) => {
      const timer = {ms, run, dead: false};
      timers.push(timer);
      return () => {
        timer.dead = true;
      };
    },
  });
  made.hub = hub;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 25));
  return {
    hub, host, dataDir, sent, pushes, logs, net, timers, settle,
    crashUpload: () => crashUpload,
    tick: (ms: number) => {
      clock += ms;
    },
    /** Run the timers of exactly this span that still stand (a settle of the hub's own) — the clock moves with them. */
    fire: (ms: number) => {
      clock += ms;
      for (const timer of timers.filter((t) => !t.dead && t.ms === ms)) {
        timer.dead = true;
        timer.run();
      }
    },
    now: () => clock,
    events: () => sent.flatMap((s) => s.items.filter((i) => i.header.type === 'event').map((i) => JSON.parse(i.body) as Record<string, any>)),
    status: async () => await hub.invoke('status', undefined) as DiagHubStatus,
    cleanup: () => fs.rmSync(dataDir, {recursive: true, force: true}),
  };
}

function entry(over: Partial<DiagEntry> = {}): DiagEntry {
  return {
    id: 'page-s1-1', at: 1_700_000_000_000, lastAt: 1_700_000_000_000, kind: 'error', family: 'page-error', level: 'error', runtime: 'page',
    title: 'uncaught: TypeError: boom at seat p1a2b3c4d5e6f', text: `[page-error] uncaught: TypeError: boom\n${STACK}`, stack: STACK, count: 1, build: '1.2.9',
    screen: {screen: 'player-home', section: 'board/', prompt: 'or#7', accepting: true, inFlight: [], frames: ['hand:browse'], quietS: 0, block: '', profile: 'tv', viewport: '3840×2160@1'},
    ...over,
  };
}

const FACTS = {
  eventId: 'e', release: 'r', environment: 'box', appMode: 'host' as const, head: 'h', os: 'linux', osVersion: '', arch: '', runtimeName: 'Electron', runtimeVersion: '',
  context: undefined, gameRef: '', seatRef: '', debugIds: new Map<string, string>(), trail: [], selfTest: false,
};

const CONTEXT: DiagContext = {screen: 'player-home', profile: 'tv', locale: 'ru', gameId: 'gdeadbeef0001', participantId: 'p1a2b3c4d5e6f', names: ['Zelin', 'Марсианин'], promptType: 'or'};

describe('diagnostics hub — whether this run sends anything at all', () => {
  const base = {packaged: true, dsn: DSN, version: '1.2.9', machineFile: undefined, env: {}};

  it('only a packaged release built with a destination sends', () => {
    expect(resolveHubConfig(base)).to.deep.include({sends: true, environment: 'production', release: 'terraforming-mars@1.2.9'});
    expect(resolveHubConfig({...base, packaged: false})).to.deep.include({sends: false, why: 'not a packaged release'});
    expect(resolveHubConfig({...base, dsn: ''})).to.deep.include({sends: false, why: 'this build has no destination'});
    expect(resolveHubConfig({...base, dsn: undefined}).sends).to.eq(false);
  });

  it('a test run never sends — a unit test, an e2e run, an explicit switch', () => {
    for (const env of [{NODE_ENV: 'test'}, {TM_E2E_HOST: 'steam-machine'}, {PLAYWRIGHT_TEST_BASE_URL: 'http://x'}, {TM_DIAG_OFF: '1'}]) {
      expect(resolveHubConfig({...base, env}), JSON.stringify(env)).to.deep.include({sends: false, why: 'a test run'});
      expect(resolveHubConfig({...base, env: {...env, TM_DIAG_DSN: DSN}}).sends, 'not even with a forced destination').to.eq(false);
    }
  });

  it('the environment is the MACHINE\'s: the box says so in its own file', () => {
    expect(resolveHubConfig({...base, machineFile: {environment: 'box'}}).environment).to.eq('box');
    expect(resolveHubConfig({...base, machineFile: {environment: 'Not Valid!'}}).environment).to.eq('production');
    expect(resolveHubConfig({...base, env: {TM_DIAG_ENV: 'staging'}, machineFile: {environment: 'box'}}).environment).to.eq('staging');
    expect(resolveHubConfig({...base, packaged: false, env: {TM_DIAG_DSN: DSN}})).to.deep.include({sends: true, environment: 'development'});
  });

  it('reads a DSN into its two endpoints', () => {
    expect(parseDsn(DSN)).to.deep.include({
      key: 'abc123', projectId: '42',
      envelopeUrl: 'https://o1.ingest.de.sentry.io/api/42/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=tm.diagnostics%2F1',
      minidumpUrl: 'https://o1.ingest.de.sentry.io/api/42/minidump/?sentry_key=abc123',
    });
    expect(parseDsn('not a dsn')).to.eq(undefined);
  });
});

describe('diagnostics hub — what is sent by itself (the policy)', () => {
  it('an error when it is born; a note and a perf line never; a repeat never twice', () => {
    const state = newPolicyState();
    expect(autoDecision(entry(), 'new', state)).to.eq('send');
    expect(autoDecision(entry({kind: 'integrity', family: 'transfer', stack: undefined}), 'new', state)).to.eq('send');
    expect(autoDecision(entry({kind: 'note', family: 'played-hero'}), 'new', state)).to.deep.eq({skip: 'policy'});
    expect(autoDecision(entry({kind: 'perf', family: 'long-frame'}), 'new', state)).to.deep.eq({skip: 'policy'});
    expect(autoDecision(entry({family: 'selftest'}), 'new', state), 'the connection check is sent only by its own verb').to.deep.eq({skip: 'policy'});
    expect(autoDecision(entry(), 'update', state)).to.deep.eq({skip: 'policy'});
    noteSent(entry(), state);
    expect(autoDecision(entry(), 'new', state)).to.deep.eq({skip: 'policy'});
  });

  it('a stall is ONE event: when it ends, or once it has stood half a minute', () => {
    const state = newPolicyState();
    const episode = (st: 'open' | 'healed' | 'unhealed', durationMs: number) => entry({kind: 'stall', family: 'liveness', stack: undefined, episode: {state: st, durationMs, lines: 2, steps: []}});
    expect(autoDecision(episode('open', 12_000), 'new', state)).to.eq('wait');
    expect(autoDecision(episode('open', EPISODE_STANDING_MS - 1), 'update', state)).to.eq('wait');
    expect(autoDecision(episode('open', EPISODE_STANDING_MS), 'update', state)).to.eq('send');
    expect(autoDecision(episode('healed', 14_000), 'close', state)).to.eq('send');
    expect(autoDecision(episode('unhealed', 70_000), 'close', state)).to.eq('send');
  });

  it('budgets: one defect and one session cannot spend the quota', () => {
    const state = newPolicyState();
    for (let i = 0; i < KEY_EVENTS_MAX; i++) {
      noteSent(entry({id: `a${i}`}), state);
    }
    expect(autoDecision(entry({id: 'again'}), 'new', state)).to.deep.eq({skip: 'budget'});
    const wide = newPolicyState();
    for (let i = 0; i < SESSION_EVENTS_MAX; i++) {
      noteSent(entry({id: `b${i}`, family: `f${i}`, title: `t${i}`, stack: undefined}), wide);
    }
    expect(autoDecision(entry({id: 'new', family: 'fresh', title: 'fresh', stack: undefined}), 'new', wide)).to.deep.eq({skip: 'budget'});
  });

  it('SIGNAL APART FROM NOISE: a planned wait and a net\'s echo are never events — and a hundred of them do not keep a dead end from leaving', () => {
    const page = new DiagJournal({runtime: 'page', session: 's1', build: '1.2.9'});
    const state = newPolicyState();
    const planned = (i: number) => page.ingest({at: 1_000 + i * 40_000, level: 'warn',
      text: '[wait-graph] ceiling remote-placement:watchable-board (consoleRemotePlacement) — «a board free for the landing of another seat» did not come in 12000 ms — the wait ended on its ceiling (planned: the viewer keeps the board covered)'});
    for (let i = 0; i < 100; i++) {
      const {entry: e, change} = planned(i);
      expect(e.cause?.tier).to.eq('planned');
      expect(autoDecision(e, change, state), 'a planned ceiling is counted, never sent').to.deep.eq({skip: 'policy'});
    }
    const echo = page.ingest({at: 9_000_000, level: 'warn', text: '[presentation-ledger] story «board-beat-park» degraded by the liveness arbiter after 12s'});
    expect(autoDecision(echo.entry, echo.change, state)).to.deep.eq({skip: 'policy'});
    expect(state.total, 'nothing of the budget was spent').to.eq(0);
    // …and the real defect of the SAME family, in the same session, still leaves.
    const deadEnd = page.ingest({at: 9_100_000, level: 'warn', text: '[wait-graph] dead-end question:card#12 (server: card / handPick) — nothing accepts the press — standing 3 s'});
    expect(deadEnd.entry.cause).to.deep.include({tier: 'defect', cls: 'wait-graph/dead-end/question:card'});
    expect(autoDecision(deadEnd.entry, deadEnd.change, state)).to.eq('send');
  });

  it('the budget is per CAUSE CLASS: one class cannot evict another, and a reworded line is the same class', () => {
    const page = new DiagJournal({runtime: 'page', session: 's1', build: '1.2.9'});
    const state = newPolicyState();
    const ceiling = (id: string, at: number, detail: string) => page.ingest({at, level: 'warn',
      text: `[wait-graph] ceiling ${id} (owner: ${detail}) — «x» did not come in 9000 ms — the wait ended on its ceiling`}).entry;
    const a1 = ceiling('played-hero:payback', 1_000, 'paying');
    const a2 = ceiling('played-hero:payback', 100_000, 'late');
    const a3 = ceiling('played-hero:payback', 200_000, 'other words');
    expect(policyKey(a1)).to.eq(policyKey(a2));
    noteSent(a1, state);
    noteSent(a2, state);
    expect(autoDecision(a3, 'new', state), 'the class has had its events of this run').to.deep.eq({skip: 'budget'});
    expect(autoDecision(ceiling('deck-draw:stage', 300_000, 'x'), 'new', state), 'another class of the same family is not touched by it').to.eq('send');
  });
});

describe('diagnostics hub — an automatic event', () => {
  it('leaves as one exception, with its tags, its frames and its debug ids — and with no key and no name', async () => {
    const h = harness({machine: 'box'});
    try {
      h.hub.line({kind: 'context', context: CONTEXT});
      h.hub.line({kind: 'debug-ids', ids: {'app://bundle/main.js': 'id-main'}});
      h.hub.line({kind: 'entry', entry: entry(), change: 'new'});
      await h.settle();
      const events = h.events();
      expect(events).to.have.length(1);
      const event = events[0];
      expect(event).to.deep.include({release: 'terraforming-mars@1.2.9', environment: 'box', platform: 'javascript', level: 'error'});
      expect(event.tags).to.deep.include({kind: 'error', family: 'page-error', runtime: 'page', app_mode: 'host', screen: 'player-home', profile: 'tv', prompt_type: 'or', head: 'abc1234'});
      // The collector derives tags from the contexts it knows: `runtime` is OURS (page · main · server), so the host's
      // own runtime travels under another name; and the sender's address is never inferred.
      expect(Object.keys(event.contexts)).to.include.members(['os', 'device', 'host_runtime', 'screen']);
      expect(Object.keys(event.contexts)).to.not.include('runtime');
      expect(event.sdk.settings).to.deep.eq({infer_ip: 'never'});
      // …nor a city: the collector derives a geo only for an event that brings none.
      expect(event.user).to.deep.eq({geo: {region: 'not collected'}});
      expect(event.tags.game_ref).to.match(/^g#[0-9a-f]{10}$/);
      expect(event.tags.seat_ref).to.match(/^p#[0-9a-f]{10}$/);
      const exception = event.exception.values[0];
      expect(exception.type).to.eq('TypeError');
      expect(exception.stacktrace.frames.map((f: {function: string}) => f.function), 'oldest frame first').to.deep.eq(['run', 'fold']);
      expect(exception.stacktrace.frames[1]).to.deep.include({filename: 'app://bundle/main.js', lineno: 2, colno: 1834, in_app: true});
      expect(event.debug_meta.images).to.deep.eq([{type: 'sourcemap', code_file: 'app://bundle/main.js', debug_id: 'id-main'}]);
      const whole = JSON.stringify(h.sent);
      expect(whole, 'no id of the table, no name of a player, anywhere in what left').to.not.match(/p1a2b3c4d5e6f|gdeadbeef0001|Zelin|Марсианин/);
      // The owner's machine: the event carries the console around it — scrubbed like the event.
      const attachment = h.sent[0].items.find((i) => i.header.type === 'attachment');
      expect(attachment?.header.filename).to.eq('console_export.txt');
      expect(attachment?.body).to.contain('console line by <player> about g#');
      // The page is told what happened to its record.
      expect(h.pushes.find((p) => p.kind === 'delivery')).to.deep.include({id: 'page-s1-1'});
      expect(h.pushes.find((p) => p.kind === 'delivery')?.delivery?.state).to.eq('sent');
    } finally {
      h.cleanup();
    }
  });

  it('a player\'s release attaches nothing to an automatic event', async () => {
    const h = harness();
    try {
      h.hub.line({kind: 'entry', entry: entry(), change: 'new'});
      await h.settle();
      expect(h.sent).to.have.length(1);
      expect(h.sent[0].items.map((i) => i.header.type)).to.deep.eq(['event']);
      expect(h.events()[0].environment).to.eq('production');
    } finally {
      h.cleanup();
    }
  });

  it('a liveness episode is one message with how it ended', () => {
    const text = '[liveness] stall (unserved): 10s without progress, 0 presses; asked: or; beat: none; stranded: no; last in flight: nothing; claim: none; holds: none — rung 0: x';
    const event = eventOf(entry({kind: 'stall', family: 'liveness', level: 'warn', stack: undefined, title: 'stall', text, episode: {state: 'healed', durationMs: 16_000, lines: 4, steps: ['rung 0: x']}}), FACTS);
    // The FIRST line is what the collector titles the issue by — the class's own words; how THIS episode ended is the second.
    expect(event.message).to.deep.eq({formatted: '[liveness] the screen stood still (unserved · asked or)\ncured after 16s'});
    expect((event.extra as Record<string, any>).ending).to.eq('cured after 16s');
    // (A record written before the cause class existed — an older page's, adopted from the mirror — keeps a key of its own.)
    expect(event.fingerprint).to.deep.eq(['stall', 'liveness', 'unserved', 'or']);
    expect(event.level).to.eq('warning');
    expect((event.contexts as Record<string, any>).episode).to.deep.include({state: 'healed', duration_s: 16, lines: 4});
    expect(splitErrorHead('TypeError: x is not a function')).to.deep.eq({type: 'TypeError', value: 'x is not a function'});
    expect(splitErrorHead('a plain sentence: with a colon')).to.deep.eq({type: 'Error', value: 'a plain sentence: with a colon'});
  });
});

describe('diagnostics hub — nothing is sent that should not be', () => {
  it('a build with no destination sends nothing, and says why', async () => {
    for (const opts of [{packaged: false}, {dsn: ''}, {env: {NODE_ENV: 'test'}}]) {
      const h = harness(opts);
      try {
        h.hub.line({kind: 'entry', entry: entry(), change: 'new'});
        const result = await h.hub.invoke('selftest', {pageEntryId: 'page-s1-1'}) as DiagSelfTestResult;
        await h.settle();
        expect(h.sent, JSON.stringify(opts)).to.have.length(0);
        expect((await h.status()).sendingOff).to.eq('environment');
        expect(result.rows.every((r) => r.state !== 'delivered')).to.eq(true);
        expect(h.hub.crashSubmitUrl()).to.eq(undefined);
        expect(h.logs.join('\n')).to.contain('not sending');
      } finally {
        h.cleanup();
      }
    }
  });

  it('the player\'s choice stops everything automatic — the main process\'s lines and the crash upload too — and is kept', async () => {
    const h = harness();
    try {
      expect(h.crashUpload()).to.eq(true);
      const off = await h.hub.invoke('set-consent', false) as DiagHubStatus;
      expect(off).to.deep.include({consent: false, sendingOff: 'consent'});
      expect(h.crashUpload()).to.eq(false);
      h.hub.line({kind: 'entry', entry: entry(), change: 'new'});
      h.hub.note('main', 'error', '[main-error] uncaught exception: Error: x\nError: x\n    at a (/app/main.js:1:1)', 'Error: x\n    at a (/app/main.js:1:1)');
      await h.settle();
      expect(h.sent).to.have.length(0);
      expect(h.pushes.find((p) => p.kind === 'delivery')?.delivery).to.deep.eq({state: 'held', reason: 'consent'});
      // Kept across a restart of the app.
      const again = createDiagnosticsHub(h.host, {now: h.now, schedule: () => () => undefined});
      expect((await again.invoke('status', undefined) as DiagHubStatus).consent).to.eq(false);
    } finally {
      h.cleanup();
    }
  });
});

describe('diagnostics hub — nothing is lost to a missing network', () => {
  it('an event that cannot leave waits in the outbox and leaves when the network returns', async () => {
    const h = harness({online: false});
    try {
      h.hub.line({kind: 'entry', entry: entry(), change: 'new'});
      await h.settle();
      expect(h.sent).to.have.length(0);
      expect((await h.status()).queued).to.eq(1);
      expect((await h.status()).lastError).to.contain('no connection');
      expect(h.pushes.filter((p) => p.kind === 'delivery').pop()?.delivery?.state).to.eq('queued');
      h.net.online = true;
      // The outbox's own timer comes due.
      h.timers.filter((t) => !t.dead).forEach((t) => t.run());
      await h.settle();
      expect(h.events()).to.have.length(1);
      expect((await h.status()).queued).to.eq(0);
    } finally {
      h.cleanup();
    }
  });

  it('automatic events share a bounded number of places; switching them off takes the queue back', async () => {
    const h = harness({online: false});
    try {
      for (let i = 0; i < OUTBOX_AUTO_MAX + 5; i++) {
        h.hub.line({kind: 'entry', entry: entry({id: `e${i}`, family: `fam${i}`, title: `line ${i}`, stack: undefined, kind: 'integrity'}), change: 'new'});
      }
      await h.settle();
      expect((await h.status()).queued).to.be.at.most(OUTBOX_AUTO_MAX);
      await h.hub.invoke('set-consent', false);
      expect((await h.status()).queued).to.eq(0);
    } finally {
      h.cleanup();
    }
  });
});

describe('diagnostics hub — an explicit report', () => {
  const request: DiagReportRequest = {
    category: 'freeze', comment: 'Экран завис после розыгрыша карты', entryId: 'page-s1-1', context: CONTEXT,
    journal: [entry()], fieldRecord: {lines: [], heartbeats: [{at: 1, prompt: 'or#7'}]},
  };

  it('is a folder on the device and the same files as attachments, under one code', async () => {
    const h = harness();
    try {
      const result = await h.hub.invoke('report', request) as DiagReportResult;
      await h.settle();
      expect(result.code).to.match(REPORT_CODE_PATTERN);
      expect(result.state).to.eq('sent');
      const names = result.parts.map((p) => p.name);
      expect(names).to.deep.eq(['report.json', 'journal.json', 'field_record.json', 'console_export.txt', 'screen.jpg', 'save.json', 'log_embedded-server.txt']);
      expect(fs.readdirSync(result.folder).sort()).to.deep.eq([...names].sort());
      const meta = JSON.parse(fs.readFileSync(path.join(result.folder, 'report.json'), 'utf8')) as Record<string, any>;
      expect(meta).to.deep.include({code: result.code, category: 'freeze', comment: request.comment, appMode: 'host', environment: 'production'});
      expect(meta.context.participantId, 'the explicit package carries the real ids — the player pressed «Отправить»').to.eq('p1a2b3c4d5e6f');
      expect(meta.saveGameId, 'the save is found by the SEAT (a page never knows its game id)').to.eq('gdeadbeef0001');
      expect(meta.parts.map((p: {name: string}) => p.name)).to.deep.eq(names.slice(1));
      const report = h.sent.find((s) => s.items.some((i) => i.header.type === 'event'));
      const event = JSON.parse(report?.items[0].body ?? '{}') as Record<string, any>;
      expect(event.tags).to.deep.include({kind: 'report', report_code: result.code, report_category: 'freeze', family: 'page-error'});
      expect(event.fingerprint).to.deep.eq(['report', result.code]);
      expect(event.level).to.eq('info');
      expect(report?.items.filter((i) => i.header.type === 'attachment').map((i) => i.header.filename)).to.deep.eq(names);
      // The player's words ride the report's own event — never a second item (the collector would file it as an issue
      // of its own: two issues and two mails per report).
      expect(event.message.formatted).to.contain(request.comment);
      expect(event.extra.comment).to.eq(request.comment);
      expect(h.sent.flatMap((s) => s.items).map((i) => i.header.type).filter((t) => t !== 'event' && t !== 'attachment')).to.deep.eq([]);
      expect({waits: result.waits, filesRefused: result.filesRefused}, 'it does not wait, and its files went with it').to.deep.eq({waits: '', filesRefused: false});
    } finally {
      h.cleanup();
    }
  });

  it('without a network it is queued — never lost — and the folder is there', async () => {
    const h = harness({online: false});
    try {
      await h.hub.invoke('set-consent', false);
      const result = await h.hub.invoke('report', {...request, comment: ''}) as DiagReportResult;
      expect(result.state).to.eq('queued');
      expect(result.waits, 'it waits for the NETWORK').to.eq('network');
      expect(fs.existsSync(path.join(result.folder, 'report.json'))).to.eq(true);
      expect((await h.status()).queued).to.eq(1);
      h.net.online = true;
      h.timers.filter((t) => !t.dead).forEach((t) => t.run());
      await h.settle();
      expect(h.events().map((e) => e.tags.kind), 'an explicit report leaves even with automatic reports off').to.deep.eq(['report']);
    } finally {
      h.cleanup();
    }
  });

  it('a thin client attaches no save; a build with no destination keeps the report on the device', async () => {
    const remote = harness({appMode: 'remote'});
    const local = harness({dsn: ''});
    try {
      expect((await remote.hub.invoke('report', request) as DiagReportResult).parts.map((p) => p.name)).to.not.include('save.json');
      const kept = await local.hub.invoke('report', request) as DiagReportResult;
      expect(kept.state).to.eq('local');
      expect(fs.existsSync(path.join(kept.folder, 'journal.json'))).to.eq(true);
      expect(local.sent).to.have.length(0);
    } finally {
      remote.cleanup();
      local.cleanup();
    }
  });

  it('a part over its budget keeps its END and says what was cut', () => {
    const cut = tailWithin('HEAD' + 'я'.repeat(4000) + 'TAIL', 1000);
    expect(cut.truncated).to.eq(true);
    expect(new TextEncoder().encode(cut.text).length).to.be.at.most(1000);
    expect(cut.text.endsWith('TAIL')).to.eq(true);
    expect(cut.text).to.contain('were cut to fit the report');
    expect(tailWithin('short', 1000)).to.deep.eq({text: 'short', truncated: false});
  });
});

describe('diagnostics hub — the collector\'s own limit is never «no network»', () => {
  const request: DiagReportRequest = {
    category: 'freeze', comment: '', entryId: '', context: CONTEXT,
    journal: [entry()], fieldRecord: {lines: [], heartbeats: []},
  };
  const NOW = 1_700_000_000_000;

  it('reads what is refused, for how long and why — from the collector\'s own header', () => {
    // A month's quota of events is gone: nothing of the envelope is taken.
    expect(readCollectorLimits(429, {'x-sentry-rate-limits': '2700:error;default;security:organization:usage_exceeded'}, NOW))
      .to.deep.eq({eventsUntil: NOW + 2_700_000, attachmentsUntil: 0, reason: 'usage_exceeded'});
    // The event is taken (200) and its files are not: the quota of attachments is a separate one.
    expect(readCollectorLimits(200, {'x-sentry-rate-limits': '60:attachment:organization:usage_exceeded'}, NOW))
      .to.deep.eq({eventsUntil: 0, attachmentsUntil: NOW + 60_000, reason: 'usage_exceeded'});
    // No category = every category (a key's rate limit); several quotas in one header.
    expect(readCollectorLimits(429, {'x-sentry-rate-limits': '30::key:key_quota, 3600:attachment:organization:usage_exceeded'}, NOW))
      .to.deep.eq({eventsUntil: NOW + 30_000, attachmentsUntil: NOW + 3_600_000, reason: 'key_quota'});
    // A category of somebody else's (transactions) limits nothing of ours.
    expect(readCollectorLimits(200, {'x-sentry-rate-limits': '60:transaction:organization'}, NOW)).to.deep.eq({eventsUntil: 0, attachmentsUntil: 0, reason: ''});
    // A bare 429: for as long as it asked — a minute when it did not say.
    expect(readCollectorLimits(429, {'retry-after': '120'}, NOW).eventsUntil).to.eq(NOW + 120_000);
    expect(readCollectorLimits(429, {}, NOW).eventsUntil).to.eq(NOW + 60_000);
    expect(readCollectorLimits(200, {}, NOW)).to.deep.eq({eventsUntil: 0, attachmentsUntil: 0, reason: ''});
  });

  it('a quota that is used up: the report WAITS FOR THE LIMIT, the status and the connection check say so — and it leaves when the limit renews', async () => {
    const h = harness({status: 429});
    h.net.headers = {'x-sentry-rate-limits': '2700:error;default:organization:usage_exceeded', 'retry-after': '2700'};
    try {
      const result = await h.hub.invoke('report', request) as DiagReportResult;
      expect(result.state).to.eq('queued');
      expect(result.waits, 'not the player\'s network — nothing of theirs to fix').to.eq('limit');
      expect(fs.existsSync(path.join(result.folder, 'report.json')), 'the package is on the device meanwhile').to.eq(true);
      const limited = await h.status();
      expect({what: limited.limitedWhat, reason: limited.limitedReason, queued: limited.queued}).to.deep.eq({what: 'events', reason: 'usage_exceeded', queued: 1});
      expect(limited.lastError).to.contain('its limit is reached (usage_exceeded)');
      h.hub.line({kind: 'entry', entry: entry({id: 'page-s1-9', family: 'selftest'}), change: 'new'});
      const check = await h.hub.invoke('selftest', {pageEntryId: 'page-s1-9'}) as DiagSelfTestResult;
      expect(check.rows.filter((r) => r.state === 'failed').every((r) => r.limited), 'every failed row names the limit').to.eq(true);
      expect(h.sent, 'while it says «wait», it is not asked again').to.have.length(0);
      // The limit renews: the collector takes events again, and what waited leaves by itself.
      h.net.status = 200;
      h.net.headers = {};
      h.tick(2_700_001);
      h.timers.filter((t) => !t.dead).forEach((t) => t.run());
      await h.settle();
      expect(h.events().map((e) => e.tags.kind)).to.include('report');
      const open = await h.status();
      expect({what: open.limitedWhat, lastError: open.lastError}).to.deep.eq({what: '', lastError: ''});
    } finally {
      h.cleanup();
    }
  });

  it('the limit for FILES alone: the report arrives as a summary, says so, and the files stay in the folder', async () => {
    const h = harness();
    h.net.headers = {'x-sentry-rate-limits': '600:attachment:organization:usage_exceeded'};
    try {
      const result = await h.hub.invoke('report', request) as DiagReportResult;
      expect({state: result.state, waits: result.waits, filesRefused: result.filesRefused}).to.deep.eq({state: 'sent', waits: '', filesRefused: true});
      expect(fs.existsSync(path.join(result.folder, 'journal.json')), 'the files are on the device').to.eq(true);
      expect(h.logs.some((line) => line.includes(result.code) && line.includes('refused the files'))).to.eq(true);
      const status = await h.status();
      expect({what: status.limitedWhat, reason: status.limitedReason}).to.deep.eq({what: 'attachments', reason: 'usage_exceeded'});
      // It runs out by itself: nothing but time opens it.
      h.net.headers = {};
      h.tick(600_001);
      expect((await h.status()).limitedWhat).to.eq('');
    } finally {
      h.cleanup();
    }
  });
});

describe('diagnostics hub — «Проверка связи»', () => {
  it('one test event per runtime, each answered', async () => {
    const h = harness();
    try {
      h.hub.line({kind: 'entry', entry: entry({id: 'page-s1-9', family: 'selftest', title: 'page — the connection check'}), change: 'new'});
      const result = await h.hub.invoke('selftest', {pageEntryId: 'page-s1-9'}) as DiagSelfTestResult;
      expect(result.rows.map((r) => `${r.runtime}:${r.state}`)).to.deep.eq(['page:delivered', 'main:delivered', 'server:delivered']);
      expect(result.rows.every((r) => /^[0-9a-f]{32}$/.test(r.eventId))).to.eq(true);
      const events = h.events();
      expect(events).to.have.length(3);
      expect(events.every((e) => e.tags.selftest === 'true')).to.eq(true);
      expect(events.map((e) => e.tags.runtime).sort()).to.deep.eq(['main', 'page', 'server']);
      const server = events.find((e) => e.tags.runtime === 'server');
      expect(server?.debug_meta.images).to.deep.eq([{type: 'sourcemap', code_file: '/app/embedded-server.js', debug_id: 'id-server'}]);
    } finally {
      h.cleanup();
    }
  });

  it('a thin client has no server on the device; a dead network says so', async () => {
    const h = harness({appMode: 'remote', online: false});
    try {
      h.hub.line({kind: 'entry', entry: entry({id: 'page-s1-9', family: 'selftest'}), change: 'new'});
      const result = await h.hub.invoke('selftest', {pageEntryId: 'page-s1-9'}) as DiagSelfTestResult;
      expect(result.rows.map((r) => `${r.runtime}:${r.state}`)).to.deep.eq(['page:failed', 'main:failed', 'server:absent']);
      expect(result.rows[0].reason).to.contain('no connection');
    } finally {
      h.cleanup();
    }
  });
});

describe('diagnostics hub — the mirror', () => {
  it('keeps every runtime\'s records for the next page, and pushes the host\'s own to the page', async () => {
    const h = harness();
    try {
      h.hub.line({kind: 'entry', entry: entry({kind: 'note', family: 'played-hero', stack: undefined}), change: 'new'});
      h.hub.note('main', 'warn', '[renderer-hang] the page stopped answering — the last screen (x)');
      const mirrored = await h.hub.invoke('journal', undefined) as Array<DiagEntry>;
      expect(mirrored.map((e) => `${e.runtime}:${e.family}:${e.kind}`).sort()).to.deep.eq(['main:renderer-hang:stall', 'page:played-hero:note']);
      expect(h.pushes.some((p) => p.kind === 'entry' && p.entry?.family === 'renderer-hang')).to.eq(true);
      expect(await h.hub.invoke('copy', 'page-s1-1')).to.eq(true);
      expect(await h.hub.invoke('copy', 'nope')).to.eq(false);
      expect(await h.hub.invoke('unknown-verb', 1)).to.eq(undefined);
    } finally {
      h.cleanup();
    }
  });
});

/*
 * FREEZE ZERO · PART A (docs/claude/console/freeze-zero/PLAN.md §2) — a stall's event names its CAUSE, is filed under
 * its cause class, says how it ended for the player, and the run is counted whatever was sent of it.
 */
const STALL_FIELDS = 'asked: card; task: handPick; top: hand:committed; holder: block:reveal; beat: none; stranded: no; last in flight: nothing; ' +
  'claim: hand/Ganymede Colony [draw] awaiting (zone up, beat pending, arrival pending, task card); holds: card-receive[blocking]';
const stallText = (fields: string = STALL_FIELDS, rung = 'rung 0: presentation-ledger: 2 stories degraded', quiet = 12) =>
  `[liveness] stall (unserved): ${quiet}s without progress, 0 presses; ${fields} — ${rung}`;
const EVIDENCE: DiagEvidence = {
  at: 1_700_000_000_000,
  question: 'asked card#12 · task handPick · may serve: hand · serving frame: hand:committed · seat p1a2b3c4d5e6f',
  holders: ['holder: block:reveal', 'hold card-receive [blocking] 11.2s of 35s'],
  tree: ['session:game#1 120.0s', '  frame:hand#3 40.1s committed', '    claim:hand#7 12.0s awaiting  ⟵ waits «the claimed answer» 12.0s/20s'],
  waits: ['claim:hand#7 [server] waits «the claimed answer» 12.0s of 20s'],
  graph: ['question:card#12 (server: card / handPick) → admission:host:reveal 12.0s'],
  trace: ['-12.0s state claim:hand#7 awaiting', '-0.1s wait frame:hand#3 «submit#31 ends»'],
  input: 'A/B presses 3 (no handler took 0, B taken 0), absorbed 0',
};

describe('diagnostics hub — a stall is filed under its CAUSE, with what stood', () => {
  const pageJournal = (session = 's1') => new DiagJournal({runtime: 'page', session, build: '1.2.9'});

  it('two causes are two issues; one cause in three sessions is one — whatever its duration, its card, its outcome', () => {
    const fingerprintOf = (session: string, fields: string, healed: boolean): unknown => {
      const page = pageJournal(session);
      page.ingest({at: 1_000, level: 'warn', text: stallText(fields, undefined, 10 + session.length)});
      const closed = healed ? page.ingest({at: 9_000, level: 'warn', text: '[liveness] recovered after 18s, 2 rung(s) run'}).entry : page.closeOpenEpisodes()[0];
      return eventOf(closed, FACTS).fingerprint;
    };
    const a = fingerprintOf('s1', STALL_FIELDS, true);
    const b = fingerprintOf('session-two', STALL_FIELDS.replace('Ganymede Colony', 'Pets').replace('awaiting', 'presenting'), false);
    const c = fingerprintOf('s3', STALL_FIELDS, false);
    expect(a).to.deep.eq([CAUSE_FINGERPRINT, 'liveness/stall/unserved/handpick/hand:committed/block:reveal']);
    expect(b, 'another session, another card, never cured — the same cause').to.deep.eq(a);
    expect(c).to.deep.eq(a);
    const other = fingerprintOf('s4', 'asked: card; task: deckPick; top: board; holder: stranded+claim:card-actions:awaiting; beat: none; stranded: card; last in flight: nothing; claim: card-actions/Hi-Tech Lab [draw,pick] awaiting (zone -, beat pending, arrival pending, task -); holds: none', true);
    expect(other, '«unserved, asked card» held by something else is another issue').to.not.deep.eq(a);
  });

  it('the event NAMES the cause: the holder and who cured it as tags, what stood and what changed as its body — scrubbed like the rest', async () => {
    const h = harness({machine: 'box'});
    try {
      const page = pageJournal();
      h.hub.line({kind: 'context', context: CONTEXT});
      const open = page.ingest({at: h.now(), level: 'warn', text: stallText(), evidence: EVIDENCE});
      h.hub.line({kind: 'entry', entry: open.entry, change: open.change});
      const healed = page.ingest({at: h.now() + 6_000, level: 'warn', text: '[liveness] recovered after 18s, 1 rung(s) run',
        evidence: {...EVIDENCE, holders: ['holder: none'], tree: ['session:game#1 126.0s', '  frame:hand#3 46.1s committed']}});
      h.hub.line({kind: 'entry', entry: healed.entry, change: healed.change});
      await h.settle();
      expect(h.events(), 'an episode leaves once it is known how it ended for the player').to.have.length(0);
      h.fire(EPISODE_SETTLE_MS);
      await h.settle();
      const event = h.events()[0];
      expect(event.fingerprint).to.deep.eq([CAUSE_FINGERPRINT, 'liveness/stall/unserved/handpick/hand:committed/block:reveal']);
      expect(event.message.formatted).to.eq('[liveness] the screen stood still (unserved · asked handPick · hand:committed · held by block:reveal)\ncured after 18s by presentation-ledger');
      expect(event.tags).to.deep.include({
        cause: 'liveness/stall/unserved/handpick/hand:committed/block:reveal', shape: 'liveness/stall', tier: 'defect',
        reason: 'unserved', task: 'handPick', where: 'hand:committed', holder: 'block:reveal', source: 'Ganymede Colony',
        outcome: 'healed', stood: '10-20s', cure: 'presentation-ledger',
      });
      expect(event.contexts.episode).to.deep.include({outcome: 'healed', cured_by: 'presentation-ledger'});
      expect(event.contexts.episode.changed).to.include('ended: claim:hand#7 12.0s awaiting  ⟵ waits «the claimed answer» 12.0s/20s');
      expect(event.contexts.episode.changed).to.include('let go: holder: block:reveal');
      expect(event.contexts.evidence.holders[0]).to.eq('holder: block:reveal');
      expect(event.extra.flow_tree).to.have.length(3);
      expect(event.extra.waits[0]).to.contain('waits «the claimed answer»');
      expect(event.extra.flow_trace).to.have.length(2);
      // The evidence is a string of the event: scrubbed by construction.
      expect(event.contexts.evidence.question).to.match(/seat p#[0-9a-f]{10}$/);
      expect(JSON.stringify(h.sent)).to.not.match(/p1a2b3c4d5e6f/);
      // A hosting device says where the game's save stood when the episode began — a reference, never the save.
      expect(event.contexts.save).to.deep.include({save_id: 17});
      expect(event.contexts.save.game_ref).to.match(/^g#[0-9a-f]{10}$/);
      expect(h.sent[0].items.some((i) => i.header.filename === 'save.json'), 'a save never rides an automatic event').to.eq(false);
    } finally {
      h.cleanup();
    }
  });

  it('a finding leaves with what its door did: the cure of the same tick is a line of the same event', async () => {
    const h = harness();
    try {
      const page = pageJournal();
      h.hub.line({kind: 'context', context: CONTEXT});
      const finding = page.ingest({at: h.now(), level: 'warn', text: '[wait-graph] dead-end question:card#12 (server: card / handPick) — nothing accepts the press — standing 3 s', evidence: EVIDENCE});
      h.hub.line({kind: 'entry', entry: finding.entry, change: finding.change});
      const cure = page.ingest({at: h.now() + 1, level: 'warn', text: '[wait-graph] cure dead-end at question:card#12 through «question-open» — reopened the «handPick» question in «hand»'});
      h.hub.line({kind: 'entry', entry: cure.entry, change: cure.change});
      await h.settle();
      expect(h.events()).to.have.length(0);
      h.fire(STALL_SETTLE_MS);
      await h.settle();
      expect(h.events(), 'ONE event for the finding and its cure').to.have.length(1);
      const event = h.events()[0];
      expect(event.fingerprint).to.deep.eq([CAUSE_FINGERPRINT, 'wait-graph/dead-end/question:card']);
      expect(event.extra.text).to.contain('through «question-open» — reopened');
      // The issue's title is the CLASS's (the first line); the occurrence's own words follow it.
      expect(event.message.formatted.split('\n')).to.deep.eq([
        '[wait-graph] dead-end (question:card)',
        '[wait-graph] dead-end question:card#12 (server: card / handPick) — nothing accepts the press — standing 3 s',
      ]);
      // A FINDING is a defect like an episode: it too says where the game's save stood (the case nobody reproduces by hand).
      expect(event.contexts.save).to.deep.include({save_id: 17});
      // …and the fire of the door that answered it is COUNTED in the run's ledger (it has no record of its own).
      const ledger = await h.hub.invoke('ledger', undefined) as SessionLedger;
      expect(ledger.classes['wait-graph/dead-end/question:card']).to.deep.include({n: 1, lines: 2});
    } finally {
      h.cleanup();
    }
  });

  it('a long list of the evidence leaves in PARTS the collector keeps whole; an episode\'s tags are its own, never a folded line\'s', () => {
    // (The collector keeps ~16 KB of one `extra` value — measured: 69 of the tree's 90 lines arrived.)
    const line = (i: number) => `  frame:hand#${i} ${'·'.repeat(120)} «${'x'.repeat(100)}»`;
    const tree = Array.from({length: 90}, (_, i) => line(i));
    const parts = extraLists('flow_tree', tree);
    expect(Object.keys(parts).length, 'more than one part').to.be.greaterThan(1);
    expect(Object.keys(parts)[1]).to.eq('flow_tree_2');
    for (const part of Object.values(parts)) {
      expect(Buffer.byteLength(JSON.stringify(part)), 'each part under the collector\'s limit, with a margin').to.be.lessThan(14_000);
    }
    expect(Object.values(parts).flat(), 'nothing lost, in order').to.deep.eq(tree);
    expect(extraLists('waits', ['a'])).to.deep.eq({waits: ['a']});
    expect(extraLists('waits', [])).to.deep.eq({waits: []});
    expect(classTitle('workspace-outcome/host-gone/card-actions/draw-pick')).to.eq('[workspace-outcome] host-gone (card-actions · draw-pick)');
    expect(classTitle('flow/unshaped')).to.eq('[flow] unshaped');

    const page = pageJournal();
    page.ingest({at: 1_000, level: 'warn', text: stallText()});
    page.ingest({at: 1_500, level: 'warn', text: '[presentation-ledger] story «board-beat-park» degraded by the liveness arbiter after 12s'});
    const closed = page.ingest({at: 9_000, level: 'warn', text: '[liveness] recovered after 18s, 1 rung(s) run'}).entry;
    const event = eventOf(closed, FACTS) as Record<string, any>;
    expect(event.tags.by, 'the author of a line folded into the episode is not the episode\'s').to.eq(undefined);
    expect(event.tags.cure).to.eq('presentation-ledger');
  });

  it('an episode the page left under: a RELOAD when another page comes, a QUIT when the app closes — kept in the outbox, never lost', async () => {
    const reloaded = harness();
    try {
      const page = pageJournal('s1');
      const open = page.ingest({at: reloaded.now(), level: 'warn', text: stallText(), evidence: EVIDENCE});
      reloaded.hub.line({kind: 'entry', entry: open.entry, change: open.change});
      // The page dies without a word (a renderer restarted by the hang watch): the NEXT page's first question says so.
      await reloaded.hub.invoke('journal', {session: 's2'});
      reloaded.fire(EPISODE_SETTLE_MS);
      await reloaded.settle();
      const event = reloaded.events()[0];
      expect(event.tags).to.deep.include({outcome: 'reload', episode: 'unhealed'});
      expect(event.message.formatted).to.contain('NOT cured — the page was reloaded under it');
      expect(event.contexts.evidence.holders[0], 'with what stood at its START').to.eq('holder: block:reveal');
    } finally {
      reloaded.cleanup();
    }
    // THE LAST LINE replaced the page: the episode it ended is `rebuilt` — never mistaken for the player's own reload.
    const rebuilt = harness();
    try {
      const page = pageJournal('s1');
      const open = page.ingest({at: rebuilt.now(), level: 'warn', text: stallText()});
      rebuilt.hub.line({kind: 'entry', entry: open.entry, change: open.change});
      const line = page.ingest({at: rebuilt.now() + 4_000, level: 'warn', text: '[session-rebuild] page — «handPick» (card#12) — by liveness: the ladder is spent and the screen stood 16s'});
      rebuilt.hub.line({kind: 'entry', entry: line.entry, change: line.change});
      await rebuilt.hub.invoke('journal', {session: 's2'});
      rebuilt.fire(EPISODE_SETTLE_MS);
      await rebuilt.settle();
      const event = rebuilt.events()[0];
      expect(event.tags).to.deep.include({outcome: 'rebuilt', episode: 'unhealed'});
      expect(event.message.formatted).to.contain('the console session was REBUILT');
      expect(event.contexts.episode.nets).to.deep.eq(['session-rebuild/page/handpick ×1 (defect)']);
      const ledger = await rebuilt.hub.invoke('ledger', undefined) as SessionLedger;
      expect(ledger.outcomes).to.deep.eq({rebuilt: 1});
      expect(ledger.classes['session-rebuild/page/handpick'], 'the last line is counted like every net').to.deep.include({tier: 'defect', n: 1});
    } finally {
      rebuilt.cleanup();
    }
    const closed = harness();
    try {
      const page = pageJournal('s1');
      const open = page.ingest({at: closed.now(), level: 'warn', text: stallText()});
      closed.hub.line({kind: 'entry', entry: open.entry, change: open.change});
      // The window closes: the page's `pagehide` says «reload» (it cannot know), the app's shutdown says what it was.
      for (const left of page.closeOpenEpisodes()) {
        closed.hub.line({kind: 'entry', entry: left, change: 'close'});
      }
      await closed.hub.shutdown();
      await closed.settle();
      expect(closed.events(), 'no request is awaited while the app closes').to.have.length(0);
      const outbox = fs.readdirSync(path.join(closed.dataDir, 'diagnostics', 'outbox'));
      expect(outbox, 'the event waits for the next launch').to.have.length(1);
      const parked = parseEnvelope(fs.readFileSync(path.join(closed.dataDir, 'diagnostics', 'outbox', outbox[0])));
      const event = JSON.parse(parked.find((i) => i.header.type === 'event')?.body ?? '{}') as Record<string, any>;
      expect(event.tags.outcome).to.eq('quit');
      expect(event.message.formatted).to.contain('the game was closed under it');
    } finally {
      closed.cleanup();
    }
  });

  it('A RENDERER\'S STOP arrives as one event with its trace — scrubbed — and the last screen in its class', async () => {
    const trace = JSON.stringify({traceEvents: [{name: 'Layout', ph: 'X', dur: 4_200_000}], metadata: {'command_line': '/home/deck/Applications/TM.AppImage --user-data-dir=/home/deck/.config'}});
    const h = harness({machine: 'box', trace});
    try {
      h.hub.note('main', 'warn', '[renderer-hang] the page stopped answering — the last screen (read 3s before: prompt card#12, accepting, frames hand:committed, section hand/, quiet 2s, flows frame:hand#3 committed)');
      h.tick(5_000);
      h.hub.note('main', 'warn', '[renderer-hang] the page answers again after 5s');
      h.hub.note('main', 'warn', '[renderer-hang] trace of the stop (5s, the page answered again): /home/deck/Applications/renderer-hang-20261114-101500.trace.json — open it in chrome://tracing / ui.perfetto.dev');
      await h.settle();
      expect(h.events()).to.have.length(0);
      h.fire(EPISODE_SETTLE_MS);
      await h.settle();
      expect(h.events(), 'the stop, its end and its trace are ONE event').to.have.length(1);
      const event = h.events()[0];
      expect(event.fingerprint).to.deep.eq([CAUSE_FINGERPRINT, 'renderer-hang/unresponsive/hand/hand:committed']);
      expect(event.tags).to.deep.include({kind: 'stall', family: 'renderer-hang', runtime: 'main', outcome: 'healed', where: 'hand:committed'});
      const file = h.sent[0].items.find((i) => i.header.filename === 'hang_trace.json');
      expect(file?.body, 'the trace rides the event').to.contain('"Layout"');
      expect(file?.body, 'the OS account is not in it').to.contain('/home/<user>/Applications');
    } finally {
      h.cleanup();
    }
  });

  it('a player\'s device sends the trace of a stop only within its day\'s budget of files', async () => {
    const h = harness({trace: '{"traceEvents":[]}'});
    try {
      // (Four stops on four different screens: four classes — the budget in question is the day's FILES, not a class's events.)
      for (const where of ['hand', 'colonies', 'parliament', 'hydro']) {
        h.hub.note('main', 'warn', `[renderer-hang] the page stopped answering — the last screen (read 3s before: prompt card#12, accepting, frames ${where}:committed, section ${where}/, quiet 2s)`);
        h.tick(2_000);
        h.hub.note('main', 'warn', '[renderer-hang] the page answers again after 2s');
        h.fire(EPISODE_SETTLE_MS);
        await h.settle();
        h.tick(60_000);
      }
      expect(h.events()).to.have.length(4);
      const traces = h.sent.filter((s) => s.items.some((i) => i.header.filename === 'hang_trace.json')).length;
      expect(traces, 'two files a day from a player\'s device').to.eq(2);
    } finally {
      h.cleanup();
    }
  });
});

describe('diagnostics hub — the session is COUNTED, whatever was sent of it', () => {
  it('every record is counted by its cause class and tier — repeats, what spoke inside an episode, and what the budget kept back', async () => {
    const h = harness();
    try {
      const page = new DiagJournal({runtime: 'page', session: 's1', build: '1.2.9'});
      const say = (text: string, at: number, level: 'warn' | 'error' = 'warn') => {
        const {entry: e, change} = page.ingest({at, level, text});
        h.hub.line({kind: 'entry', entry: e, change});
      };
      h.hub.line({kind: 'context', context: CONTEXT});
      const planned = '[wait-graph] ceiling remote-placement:watchable-board (consoleRemotePlacement) — «a board» did not come in 12000 ms — the wait ended on its ceiling (planned: the viewer keeps the board covered)';
      for (let i = 0; i < 5; i++) {
        say(planned, h.now() + i * 40_000);
      }
      const base = h.now() + 400_000;
      say(stallText(), base);
      say('[presentation-ledger] story «board-beat-park» degraded by the liveness arbiter after 12s', base + 1);
      say('[liveness] recovered after 14s, 1 rung(s) run', base + 2_000);
      say('[long-frame] 812ms — native 700ms (render 500 · style+layout 200) · script 112ms (forced layout 30): 90 event-listener «keydown» @ main.js:onKey · a press waited in it · +2 long frame(s) since the last line — NATIVE', base + 3_000);
      const ledger = await h.hub.invoke('ledger', undefined) as SessionLedger;
      expect(ledger.classes['wait-graph/ceiling/remote-placement:watchable-board']).to.deep.include({tier: 'planned', n: 5, sent: 0});
      expect(ledger.classes['liveness/stall/unserved/handpick/hand:committed/block:reveal']).to.deep.include({tier: 'defect', n: 1, sent: 1});
      expect(ledger.classes['presentation-ledger/story-degraded-by/board-beat-park'], 'what spoke inside the episode is counted under its own class').to.deep.include({tier: 'info', n: 1});
      expect(ledger.outcomes).to.deep.eq({healed: 1});
      expect(ledger.stood).to.deep.eq({'10-20s': 1});
      expect(ledger.episodes[0]).to.deep.include({cls: 'liveness/stall/unserved/handpick/hand:committed/block:reveal', outcome: 'healed', stoodS: 14, cure: 'presentation-ledger'});
      expect(ledger.kinds.perf).to.eq(1);
      expect(ledger.longFrames.unknown, 'long frames by the screen they were printed on (this record carried none), with where the time went')
        .to.deep.eq({n: 3, worstMs: 812, native: 1, pressWaited: 1, totalMs: 812, scriptMs: 112, forcedLayoutMs: 30, styleLayoutMs: 200, renderMs: 500});
      expect(ledger.pages).to.eq(1);
    } finally {
      h.cleanup();
    }
  });

  it('play time is counted from the page\'s signs of life — a silence longer than three minutes is not play', async () => {
    const h = harness();
    try {
      h.hub.line({kind: 'context', context: CONTEXT});
      for (let i = 0; i < 10; i++) {
        h.tick(60_000);
        h.hub.line({kind: 'pulse', inGame: true});
      }
      h.tick(20 * 60_000); // the page hung, or the player went away
      h.hub.line({kind: 'pulse', inGame: true});
      h.tick(60_000);
      h.hub.line({kind: 'pulse', inGame: false}); // back in the menu
      h.tick(30 * 60_000);
      h.hub.line({kind: 'pulse', inGame: false});
      const ledger = await h.hub.invoke('ledger', undefined) as SessionLedger;
      expect(Math.round(ledger.playMs / 60_000), '10 minutes + the capped silence (3) + the last minute').to.eq(14);
      expect(ledger.games).to.eq(1);
    } finally {
      h.cleanup();
    }
  });

  it('the run\'s ledger leaves as ONE event at the NEXT launch — the denominator of «are freezes fewer?»', async () => {
    const first = harness();
    const dataDir = first.dataDir;
    try {
      const page = new DiagJournal({runtime: 'page', session: 's1', build: '1.2.9'});
      first.hub.line({kind: 'context', context: CONTEXT});
      for (let i = 0; i < 5; i++) {
        first.tick(60_000);
        first.hub.line({kind: 'pulse', inGame: true});
      }
      const open = page.ingest({at: first.now(), level: 'warn', text: stallText()});
      first.hub.line({kind: 'entry', entry: open.entry, change: open.change});
      await first.hub.shutdown();
      expect(fs.existsSync(path.join(dataDir, 'diagnostics', 'session.json')), 'written by the run itself').to.eq(true);
      const second = harness({dataDir, startAt: first.now() + 3_600_000});
      second.fire(12_000);
      await second.settle();
      const session = second.events().find((e) => e.tags.kind === 'session');
      expect(session, 'the earlier run, sent by the next one').to.not.eq(undefined);
      expect(session?.fingerprint).to.deep.eq(['tm-session']);
      expect(session?.level).to.eq('info');
      expect(session?.tags).to.deep.include({played: '1-10m', defects: '1-2', unhealed: '1'});
      expect(session?.contexts.session).to.deep.include({play_min: 5, episodes: 1});
      expect(session?.contexts.session.outcomes).to.deep.eq({quit: 1});
      expect(session?.extra.ledger.classes['liveness/stall/unserved/handpick/hand:committed/block:reveal']).to.deep.include({n: 1});
      expect(JSON.stringify(session), 'no key of the table in it').to.not.match(/p1a2b3c4d5e6f|gdeadbeef0001/);
      // A run nobody played and nothing failed in is not worth an event.
      await second.hub.shutdown();
      const third = harness({dataDir, startAt: second.now() + 3_600_000});
      third.fire(12_000);
      await third.settle();
      expect(third.events().filter((e) => e.tags.kind === 'session')).to.have.length(0);
    } finally {
      first.cleanup();
    }
  });
});
