import {expect} from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import {DiagEntry} from '../../../src/common/diagnostics/DiagnosticModel';
import {DiagContext, DiagHubStatus, DiagReportRequest, DiagReportResult, DiagSelfTestResult, REPORT_CODE_PATTERN} from '../../../src/common/diagnostics/protocol';
import {OUTBOX_AUTO_MAX, readCollectorLimits} from '../../../src/server/diagnostics/hub/envelopeSender';
import {autoDecision, createDiagnosticsHub, EPISODE_STANDING_MS, KEY_EVENTS_MAX, newPolicyState, noteSent, SESSION_EVENTS_MAX} from '../../../src/server/diagnostics/hub/hub';
import {parseDsn, resolveHubConfig} from '../../../src/server/diagnostics/hub/hubConfig';
import {HubHost} from '../../../src/server/diagnostics/hub/hubTypes';
import {tailWithin} from '../../../src/server/diagnostics/hub/reportPackage';
import {eventOf, splitErrorHead} from '../../../src/server/diagnostics/hub/sentryEvent';

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

function harness(opts: {packaged?: boolean, dsn?: string, env?: Record<string, string>, machine?: string, appMode?: 'host' | 'remote', online?: boolean, status?: number} = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-diag-'));
  if (opts.machine !== undefined) {
    fs.writeFileSync(path.join(dataDir, 'diagnostics.json'), JSON.stringify({environment: opts.machine}));
  }
  const sent: Array<Sent> = [];
  const pushes: Array<{kind: string, id?: string, entry?: DiagEntry, delivery?: {state: string, reason?: string, eventId?: string}}> = [];
  const timers: Array<{ms: number, run: () => void, dead: boolean}> = [];
  const logs: Array<string> = [];
  const net = {online: opts.online ?? true, status: opts.status ?? 200, headers: {} as Record<string, string>};
  let clock = 1_700_000_000_000;
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
    readSave: async (participantId) => ({gameId: 'gdeadbeef0001', data: new TextEncoder().encode(JSON.stringify({id: 'gdeadbeef0001', players: [participantId]}))}),
    logTails: async () => [{name: 'embedded-server', text: 'server tail\n'}],
    recentHangTrace: async () => undefined,
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

  it('budgets: one defect, one family and one session cannot spend the quota', () => {
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
    const facts = {eventId: 'e', release: 'r', environment: 'box', appMode: 'host' as const, head: 'h', os: 'linux', osVersion: '', arch: '', runtimeName: 'Electron', runtimeVersion: '', context: undefined, gameRef: '', seatRef: '', debugIds: new Map<string, string>(), trail: [], selfTest: false};
    const text = '[liveness] stall (unserved): 10s without progress, 0 presses; asked: or; beat: none; stranded: no; last in flight: nothing; claim: none; holds: none — rung 0: x';
    const event = eventOf(entry({kind: 'stall', family: 'liveness', level: 'warn', stack: undefined, title: 'stall', text, episode: {state: 'healed', durationMs: 16_000, lines: 4, steps: ['rung 0: x']}}), facts);
    expect(event.message).to.deep.eq({formatted: '[liveness] the screen stood still (unserved, asked or) — cured after 16s'});
    expect(event.fingerprint).to.deep.eq(['stall', 'liveness', 'unserved', 'or', 'healed']);
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
