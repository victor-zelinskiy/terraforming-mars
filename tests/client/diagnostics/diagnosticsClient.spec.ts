import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../components/getLocalVue';
import ConsoleDevNotice from '@/client/components/console/diagnostics/ConsoleDevNotice.vue';
import ConsoleDiagnostics from '@/client/components/console/diagnostics/ConsoleDiagnostics.vue';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {NOTIF_HOLD_MS} from '@/client/console/consoleNotifHold';
import {notificationState} from '@/client/components/notifications/notificationState';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {DiagEntry} from '@/common/diagnostics/DiagnosticModel';
import {DiagJournal} from '@/common/diagnostics/journal';
import {DiagHubStatus, DiagReportRequest, DiagReportResult, DiagSend} from '@/common/diagnostics/protocol';
import {
  __installDiagnosticsJournalForTesting, __resetDiagnosticsCaptureForTesting, consoleCallText, currentDiagScreen, formatConsoleArg,
  noteDiagnosticsAppScreen, noteDiagnosticsHeartbeat, onDiagnosticEntry, onDiagnosticLine, pageErrorLine,
} from '@/client/diagnostics/diagnosticsCapture';
import {__resetDiagContextForTesting, buildDiagContext, publishDiagContext} from '@/client/diagnostics/diagnosticsContext';
import {diagHubState} from '@/client/diagnostics/diagnosticsHubState';
import {acceptDiagnosticsPush, diagJournalState, mirrorsToHub, onDiagnosticsPush} from '@/client/diagnostics/diagnosticsJournalState';
import {__resetDevNoticeForTesting, devNoticeView, devNoticeVisible, installDevNotice, interceptDevNoticeIntent, NOTICE_PLATE_MS} from '@/client/diagnostics/diagnosticsNotice';
import {setDiagnosticsOverlayOpener} from '@/client/diagnostics/diagnosticsOverlayBridge';
import {devNoticeShows, devNoticeState, setDevNoticeMode} from '@/client/diagnostics/diagnosticsPrefs';
import {
  __resetDiagnosticsSurfaceForTesting, closeDiagnostics, DiagOpenTarget, diagSurfaceState, handleDiagnosticsIntent, openDiagnostics,
} from '@/client/diagnostics/diagnosticsSurface';
import {__setDiagnosticsTransportForTesting, DiagnosticsTransport} from '@/client/diagnostics/diagnosticsTransport';
import {
  DIAG_TABS, diagDelivery, diagFrameRows, diagHeadline, diagOutcome, diagScreenFacts, diagTabCounts, filterDiagEntries, reportAttachRows,
  reportDoneReading, reportSize, sendingReading, suggestedCategory,
} from '@/client/diagnostics/diagnosticsView';

/**
 * THE PAGE'S HALF OF DIAGNOSTICS (docs/claude/diagnostics.md) — the interceptor, the journal's readings, the surface's
 * controller and the developer's notice, each driven without a browser: a journal of the spec's own, a transport that
 * records, the kernel's manual clock.
 */
const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const X_DOWN: GamepadIntent = {kind: 'press', button: 'secondary'};
const X_UP: GamepadIntent = {kind: 'release', button: 'secondary'};
const DOWN: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};
const UP: GamepadIntent = {kind: 'nav', dir: 'up', repeat: false};
const RB: GamepadIntent = {kind: 'press', button: 'bumperR'};

const STALL = '[liveness] stall (unserved): 10s without progress, 0 presses; asked: or; beat: none; stranded: no; last in flight: nothing; claim: none; holds: none — rung 0: stories degraded';

function throwOne(): Error {
  try {
    throw new TypeError('boom in the hand');
  } catch (err) {
    return err as Error;
  }
}

function fakeTransport(over: Partial<{report: (r: DiagReportRequest) => Promise<DiagReportResult | undefined>}> = {}) {
  const sent: Array<DiagSend> = [];
  const asked: Array<{verb: string, request: unknown}> = [];
  const transport: DiagnosticsTransport = {
    kind: 'desktop',
    invoke: (async (verb: string, request: unknown) => {
      asked.push({verb, request});
      if (verb === 'report') {
        return over.report !== undefined ? over.report(request as DiagReportRequest) :
          {code: 'TM-ACDEFG', state: 'sent', waits: '', filesRefused: false, folder: 'C:\\reports\\TM-ACDEFG', parts: [{name: 'report.json', bytes: 2048, truncated: false}, {name: 'screen.jpg', bytes: 1024 * 1024, truncated: false}]};
      }
      if (verb === 'selftest') {
        return {tookMs: 12, rows: [
          {runtime: 'page', state: 'delivered', eventId: 'a', reason: '', limited: false},
          {runtime: 'main', state: 'failed', eventId: '', reason: 'no connection', limited: false},
          {runtime: 'server', state: 'absent', eventId: '', reason: 'not here', limited: false},
        ]};
      }
      if (verb === 'copy') {
        return true;
      }
      return undefined;
    }) as DiagnosticsTransport['invoke'],
    send: (line) => sent.push(line),
    onPush: () => undefined,
  };
  return {transport, sent, asked};
}

describe('diagnostics · the page\'s interceptor', () => {
  let record: (level: 'warn' | 'error', args: ReadonlyArray<unknown>) => void;
  let journal: DiagJournal;

  beforeEach(() => {
    __resetDiagnosticsCaptureForTesting();
    journal = new DiagJournal({runtime: 'page', session: 't', build: 'test'});
    record = __installDiagnosticsJournalForTesting(journal);
  });
  afterEach(() => __resetDiagnosticsCaptureForTesting());

  it('prints an argument as the console would: a string as it is, an Error as its STACK, an object as JSON', () => {
    const err = throwOne();
    expect(formatConsoleArg('plain')).to.eq('plain');
    expect(formatConsoleArg(err)).to.contain('TypeError: boom in the hand');
    expect(formatConsoleArg(err), 'the frames are kept — the recorder used to keep the message alone').to.match(/\n\s+at /);
    expect(formatConsoleArg({a: 1, nested: {b: [1, 2]}})).to.eq('{"a":1,"nested":{"b":[1,2]}}');
    const loop: Record<string, unknown> = {name: 'x'};
    loop.self = loop;
    expect(formatConsoleArg(loop)).to.eq('{"name":"x","self":"[circular]"}');
    expect(formatConsoleArg(undefined)).to.eq('undefined');
    expect(formatConsoleArg(7)).to.eq('7');
  });

  it('a console call is one line with the stack of its first Error', () => {
    const err = throwOne();
    const call = consoleCallText(['[vue-error] ConsoleHand < ConsoleShell · render: TypeError: boom', err]);
    expect(call.text.startsWith('[vue-error] ConsoleHand < ConsoleShell · render: TypeError: boom TypeError: boom in the hand')).to.eq(true);
    expect(call.stack).to.match(/^TypeError: boom in the hand\n\s+at /);
    expect(consoleCallText(['[flow] nothing thrown', 3]).stack).to.eq(undefined);
  });

  it('a recorded line becomes a classified record with the screen it was born on, and reaches both kinds of listener', () => {
    const lines: Array<string> = [];
    const changes: Array<string> = [];
    onDiagnosticLine((line) => lines.push(line.text));
    onDiagnosticEntry((entry, change) => changes.push(`${entry.family}:${entry.kind}:${change}`));
    noteDiagnosticsAppScreen('player-home');
    noteDiagnosticsHeartbeat({prompt: 'or#7', accepting: false, inFlight: ['hold:card'], frames: ['hand:committed'], section: 'hand/', quietS: 11, block: 'reveal'});
    record('warn', [STALL]);
    record('warn', ['[liveness] recovered after 13s, 1 rung(s) run']);
    record('error', ['[page-error] uncaught: TypeError: boom', throwOne()]);
    expect(lines).to.have.length(3);
    expect(changes).to.deep.eq(['liveness:stall:new', 'liveness:stall:close', 'page-error:error:new']);
    const episode = journal.entries()[0];
    expect(episode.episode).to.deep.include({state: 'healed', durationMs: 13_000});
    expect(episode.screen).to.deep.include({screen: 'player-home', prompt: 'or#7', accepting: false, section: 'hand/', quietS: 11, block: 'reveal'});
    expect(journal.entries()[1].stack).to.match(/TypeError: boom in the hand/);
  });

  it('a late listener is given what was printed before it stood (the boot\'s own lines)', () => {
    record('warn', ['[flow] printed before the console was entered']);
    const replayed: Array<string> = [];
    onDiagnosticLine((line) => replayed.push(line.text), {replay: true});
    expect(replayed).to.deep.eq(['[flow] printed before the console was entered']);
  });

  it('a heartbeat that went stale describes a screen that is gone', () => {
    noteDiagnosticsHeartbeat({prompt: 'or#7', accepting: false, inFlight: [], frames: [], section: 'hand/', quietS: 3});
    expect(currentDiagScreen(Date.now()).prompt).to.eq('or#7');
    expect(currentDiagScreen(Date.now() + 60_000)).to.deep.include({prompt: '', section: '', accepting: true});
  });

  it('a recorded line never asks the window for its size: the reading forces a layout, and a line is printed mid-mount', () => {
    // `window.innerWidth` makes the browser bring the layout up to date before it answers; a line printed inside a
    // heavy mount would pay a forced layout in somebody else's frame. The size is read once (at the boot), and again
    // only on a resize — a diagnostic may not cost the frame it describes.
    const own = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    let reads = 0;
    Object.defineProperty(window, 'innerWidth', {configurable: true, get: () => {
      reads++;
      return 3840;
    }});
    try {
      record('warn', ['[long-frame] one']);
      record('warn', ['[workspace-stall] two']);
      record('error', ['[vue-error] three']);
      expect(reads, 'one reading for every line of the page').to.eq(1);
      expect(currentDiagScreen().viewport).to.match(/^3840×/);
      expect(reads).to.eq(1);
    } finally {
      if (own !== undefined) {
        Object.defineProperty(window, 'innerWidth', own);
      } else {
        delete (window as unknown as {innerWidth?: number}).innerWidth;
      }
    }
  });

  it('keeps the line an uncaught error has always been printed as', () => {
    expect(pageErrorLine('uncaught', new TypeError('x is not a function'))).to.match(/^\[page-error\] uncaught: TypeError: x is not a function @ at /);
    expect(pageErrorLine('unhandled rejection', 'a plain reason')).to.eq('[page-error] unhandled rejection: a plain reason');
  });
});

describe('diagnostics · what travels to the hub, and when', () => {
  const entry = (over: Partial<DiagEntry> = {}): DiagEntry => ({
    id: 'page-t-1', at: 1, lastAt: 1, kind: 'error', family: 'page-error', level: 'error', runtime: 'page', title: 't', text: 't', count: 1, build: 'b', ...over,
  });

  it('a new record and a closed episode always; a plain repeat only when its count doubles', () => {
    expect(mirrorsToHub(entry(), 'new')).to.eq(true);
    expect(mirrorsToHub(entry({episode: {state: 'healed', durationMs: 1, lines: 2, steps: []}}), 'close')).to.eq(true);
    expect(mirrorsToHub(entry({episode: {state: 'open', durationMs: 1, lines: 2, steps: []}, count: 3}), 'update')).to.eq(true);
    const sentAt = [1, 2, 3, 4, 5, 6, 7, 8, 9, 16, 17, 64].filter((count) => mirrorsToHub(entry({count}), 'update'));
    expect(sentAt, 'an exception thrown on every frame is not sixty messages a second').to.deep.eq([1, 2, 4, 8, 16, 64]);
  });

  it('what the hub says about itself is kept — the settings read the choice of the player from it — and wakes no surface', () => {
    const heard: Array<string> = [];
    const off = onDiagnosticsPush((push) => heard.push(push.kind));
    const before = {status: diagHubState.status, known: diagHubState.known};
    try {
      const status = {
        environment: 'box', release: 'terraforming-mars@1.2.3', appMode: 'host', sendingOff: 'consent', consent: false,
        queued: 2, lastDeliveredAt: 0, lastError: '', reportsDir: '/r',
      } as DiagHubStatus;
      acceptDiagnosticsPush({kind: 'status', status});
      expect(diagHubState.status).to.deep.eq(status);
      expect(diagHubState.known).to.eq(true);
      expect(heard, 'a status belongs to the hub state: no surface is woken for it').to.deep.eq([]);
      acceptDiagnosticsPush({kind: 'open-journal'});
      expect(heard).to.deep.eq(['open-journal']);
    } finally {
      off();
      diagHubState.status = before.status;
      diagHubState.known = before.known;
    }
  });

  it('the context names what must never leave by itself, and is told only when it changed', () => {
    const {transport, sent} = fakeTransport();
    __setDiagnosticsTransportForTesting(transport);
    __resetDiagContextForTesting();
    try {
      const facts = {screen: 'player-home', profile: 'tv', locale: 'ru', participantId: 'p1a2b3c4d5e6f', playerNames: ['Zelin', 'Бот', 'Zelin'], profileNames: ['Виктор', ''], promptType: 'or'};
      expect(buildDiagContext(facts)).to.deep.eq({screen: 'player-home', profile: 'tv', locale: 'ru', gameId: '', participantId: 'p1a2b3c4d5e6f', names: ['Zelin', 'Бот', 'Виктор'], promptType: 'or'});
      publishDiagContext(facts);
      publishDiagContext(facts);
      publishDiagContext({...facts, promptType: 'card'});
      expect(sent.map((s) => s.kind)).to.deep.eq(['context', 'context']);
    } finally {
      __setDiagnosticsTransportForTesting(undefined);
      __resetDiagContextForTesting();
    }
  });
});

describe('diagnostics · how a record reads', () => {
  const journal = new DiagJournal({runtime: 'page', session: 'v', build: '1.2.9'});
  const error = journal.ingest({at: 1000, level: 'error', text: '[vue-error] A < B · render: TypeError: x', stack: 'TypeError: x\n    at mine (app://bundle/main.js:1:2)\n    at theirs (app://bundle/chunks/vendors.js:3:4)',
    screen: {screen: 'player-home', section: 'hand/', prompt: 'or#7', accepting: false, inFlight: ['a', 'b'], frames: ['hand:browse'], quietS: 0, block: '', profile: 'tv', viewport: '3840×2160@1'}}).entry;
  const stall = journal.ingest({at: 2000, level: 'warn', text: STALL}).entry;
  const note = journal.ingest({at: 3000, level: 'warn', text: '[played-hero] the safety fired'}).entry;

  it('files a record under its tab and counts them', () => {
    const all = [...journal.entries()];
    expect(DIAG_TABS.map((t) => t.id)).to.deep.eq(['all', 'errors', 'stalls', 'other', 'system']);
    expect(filterDiagEntries(all, 'errors')).to.deep.eq([error]);
    expect(filterDiagEntries(all, 'stalls')).to.deep.eq([stall]);
    expect(filterDiagEntries(all, 'other')).to.deep.eq([note]);
    expect(filterDiagEntries(all, 'system')).to.deep.eq([]);
    expect(diagTabCounts(all)).to.deep.eq({all: 3, errors: 1, stalls: 1, other: 1, system: 0});
  });

  it('speaks to a person: a headline, how it ended, whether the developer has it', () => {
    expect(diagHeadline(error)).to.eq('A part of the interface failed to draw');
    expect(diagHeadline(stall)).to.eq('The screen stopped responding');
    expect(diagHeadline(note)).to.eq('A note of the game');
    expect(diagOutcome(error)).to.eq(undefined);
    expect(diagOutcome(stall)).to.deep.include({key: 'Still standing — ${0} s', params: ['10'], tone: 'warn'});
    expect(diagOutcome({...stall, episode: {state: 'healed', durationMs: 4200, lines: 2, steps: []}})).to.deep.include({key: 'Recovered in ${0} s', params: ['4.2'], tone: 'ok'});
    expect(diagOutcome({...stall, episode: {state: 'unhealed', durationMs: 70_000, lines: 2, steps: []}})).to.deep.include({tone: 'bad', params: ['70']});
    expect(diagDelivery(error)).to.eq(undefined);
    expect(diagDelivery({...error, delivery: {state: 'sent', eventId: 'e'}})).to.deep.include({key: 'Sent to the developer', tone: 'ok'});
    expect(diagDelivery({...error, delivery: {state: 'held', reason: 'consent'}})?.key).to.eq('Not sent — automatic reports are off');
    // A record that waits says what is true whether it waits for the network or for the collector's limit.
    expect(diagDelivery({...error, delivery: {state: 'queued', eventId: 'e'}})).to.deep.include({key: 'Kept on this device — will be sent later', tone: 'warn'});
    expect(diagDelivery({...error, delivery: {state: 'held', reason: 'policy'}})).to.eq(undefined);
  });

  it('the stack reads ours first-class and a library\'s stepped back; the screen is a short table', () => {
    expect(diagFrameRows(error)).to.deep.eq({head: 'TypeError: x', frames: [
      {fn: 'mine', where: 'bundle/main.js:1:2', own: true},
      {fn: 'theirs', where: 'chunks/vendors.js:3:4', own: false},
    ]});
    expect(diagScreenFacts(error).map((f) => `${f.label}=${f.value}`)).to.deep.eq([
      'Screen=player-home', 'Section=hand', 'Server question=or#7', 'Input accepted=no', 'In flight=a, b', 'Workspace stack=hand:browse', 'Display=tv · 3840×2160@1',
    ]);
    expect(diagScreenFacts(note)).to.deep.eq([]);
  });

  it('the report says BEFORE the press what leaves — and what does not, with its reason', () => {
    const status = {environment: 'box', release: 'r', appMode: 'host' as const, sendingOff: '' as const, consent: true, queued: 0, lastDeliveredAt: 0, lastError: '', limitedWhat: '' as const, limitedReason: '', reportsDir: ''};
    expect(reportAttachRows(status, true).every((r) => r.included)).to.eq(true);
    const remote = reportAttachRows({...status, appMode: 'remote'}, true).find((r) => r.label === 'The save of this game');
    expect(remote).to.deep.include({included: false, note: 'The game is hosted on another device'});
    expect(reportAttachRows(status, false).find((r) => !r.included)?.note).to.eq('No game is open');
    expect(suggestedCategory(stall)).to.eq('freeze');
    expect(suggestedCategory(error)).to.eq('visual');
    expect(suggestedCategory(undefined)).to.eq(undefined);
    expect(reportDoneReading({state: 'sent', waits: '', filesRefused: false}).title).to.eq('The report is with the developer');
    expect(reportDoneReading({state: 'queued', waits: 'network', filesRefused: false})).to.deep.include({title: 'The report will be sent when the network is back', tone: 'warn'});
    // THE TRUTH OF A WAIT: the receiving service's limit is not the player's network — the screen never says «сеть».
    const limited = reportDoneReading({state: 'queued', waits: 'limit', filesRefused: false});
    expect(limited).to.deep.include({title: 'The report is saved and will be sent later', tone: 'warn'});
    expect(limited.body).to.contain('Your internet is fine');
    // …and a report that went without its files says so, and where they are.
    expect(reportDoneReading({state: 'sent', waits: '', filesRefused: true})).to.deep.include({title: 'The report is with the developer — without its files', tone: 'warn'});
    // The system readout's one phrase follows the same truth.
    expect(sendingReading(status)).to.deep.include({key: 'Sending is on', tone: 'ok'});
    expect(sendingReading({...status, limitedWhat: 'events', limitedReason: 'usage_exceeded'})).to.deep.include({key: 'The receiving service is full', tone: 'warn'});
    expect(sendingReading({...status, limitedWhat: 'attachments'})).to.deep.include({key: 'Reports go without their files', tone: 'warn'});
    expect(sendingReading({...status, sendingOff: 'consent', limitedWhat: 'events'}).key, 'the switch of the player is said first').to.eq('Automatic reports are off');
    expect(reportSize([{name: 'a', bytes: 1024 * 1024 * 1.44, truncated: false}])).to.deep.eq({key: '${0} MB', params: ['1.4']});
    expect(reportSize([{name: 'a', bytes: 300, truncated: false}])).to.deep.eq({key: '${0} KB', params: ['1']});
  });
});

describe('diagnostics · the surface\'s controller', () => {
  let journal: DiagJournal;
  let record: (level: 'warn' | 'error', args: ReadonlyArray<unknown>) => void;
  let fake: ReturnType<typeof fakeTransport>;
  const clock = createManualClock(0);

  beforeEach(() => {
    setFlowClock(clock);
    __resetDiagnosticsCaptureForTesting();
    __resetDiagnosticsSurfaceForTesting();
    journal = new DiagJournal({runtime: 'page', session: 's', build: 'test'});
    record = __installDiagnosticsJournalForTesting(journal);
    onDiagnosticEntry(() => diagJournalState.revision++);
    fake = fakeTransport();
    __setDiagnosticsTransportForTesting(fake.transport);
    record('error', ['[page-error] uncaught: TypeError: boom', throwOne()]);
    record('warn', [STALL]);
  });
  afterEach(() => {
    __resetDiagnosticsSurfaceForTesting();
    __resetDiagnosticsCaptureForTesting();
    __setDiagnosticsTransportForTesting(undefined);
    setFlowClock(undefined);
  });

  /** Let the hub's (resolved) promise and the kernel's wait settle, then let the beat's sleep run out. */
  async function settleBeat(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    clock.advance(5000);
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  }

  it('browse: the cursor walks the tab\'s rows and clamps; LB/RB step the filters; B leaves', () => {
    openDiagnostics('menu', {to: 'journal'});
    expect(diagSurfaceState).to.deep.include({shown: true, step: 'browse', tab: 0, cursor: 0});
    handleDiagnosticsIntent(DOWN);
    handleDiagnosticsIntent(DOWN);
    expect(diagSurfaceState.cursor, 'two records — the cursor stops at the last').to.eq(1);
    handleDiagnosticsIntent(RB);
    expect(diagSurfaceState).to.deep.include({tab: 1, cursor: 0});
    expect(handleDiagnosticsIntent(B)).to.eq('leave');
  });

  it('a record opens in full, copies through the hub, and B is one level back', async () => {
    openDiagnostics('direct', {to: 'journal'});
    handleDiagnosticsIntent(A);
    // Newest first: the stall.
    expect(diagSurfaceState).to.deep.include({step: 'entry', entryId: 'page-s-2'});
    handleDiagnosticsIntent(X_DOWN);
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
    expect(fake.asked.find((a) => a.verb === 'copy')?.request).to.eq('page-s-2');
    expect(diagSurfaceState.copied).to.eq(true);
    // …and the note goes by itself.
    clock.advance(5000);
    expect(diagSurfaceState.copied).to.eq(false);
    expect(handleDiagnosticsIntent(B)).to.eq('stay');
    expect(diagSurfaceState.step).to.eq('browse');
  });

  it('the report: category → review → ONE commit → the beat absorbs the pad → the code; a finished flow leaves', async () => {
    openDiagnostics('menu', {to: 'report'});
    expect(diagSurfaceState.step).to.eq('category');
    handleDiagnosticsIntent(DOWN);
    handleDiagnosticsIntent(A);
    expect(diagSurfaceState).to.deep.include({step: 'review', category: 'visual', reviewCursor: 1});
    handleDiagnosticsIntent(UP);
    handleDiagnosticsIntent(A);
    expect(diagSurfaceState.typing, 'A on the comment row raises the keyboard').to.eq(true);
    diagSurfaceState.typing = false;
    diagSurfaceState.comment = 'после розыгрыша карты';
    handleDiagnosticsIntent(DOWN);
    handleDiagnosticsIntent(A);
    expect(diagSurfaceState.step).to.eq('sending');
    // A beat in flight: a second A sends nothing, B goes nowhere.
    handleDiagnosticsIntent(A);
    expect(handleDiagnosticsIntent(B)).to.eq('stay');
    expect(diagSurfaceState.step).to.eq('sending');
    await settleBeat();
    expect(fake.asked.filter((a) => a.verb === 'report'), 'one press — one report').to.have.length(1);
    const request = fake.asked.find((a) => a.verb === 'report')?.request as DiagReportRequest;
    expect(request).to.deep.include({category: 'visual', comment: 'после розыгрыша карты', entryId: ''});
    expect(request.journal.map((e) => e.family)).to.deep.eq(['page-error', 'liveness']);
    expect(diagSurfaceState.step).to.eq('done');
    expect(diagSurfaceState.result?.code).to.eq('TM-ACDEFG');
    expect(handleDiagnosticsIntent(A), 'a finished flow leaves — it never folds back to the list').to.eq('leave');
    expect(diagSurfaceState.origin).to.eq('direct');
  });

  it('a report opened from a record carries it, starts on the suggested category, and B walks back to the record', () => {
    openDiagnostics('direct', {to: 'entry', id: 'page-s-2'});
    expect(diagSurfaceState.step).to.eq('entry');
    handleDiagnosticsIntent(A);
    expect(diagSurfaceState).to.deep.include({step: 'category', reportEntryId: 'page-s-2', categoryCursor: 0});
    expect(handleDiagnosticsIntent(B)).to.eq('stay');
    expect(diagSurfaceState.step).to.eq('entry');
  });

  it('a hub that does not answer is a refusal that speaks — and the draft survives it', async () => {
    fake = fakeTransport({report: async () => undefined});
    __setDiagnosticsTransportForTesting(fake.transport);
    openDiagnostics('menu', {to: 'report'});
    handleDiagnosticsIntent(A);
    diagSurfaceState.comment = 'мой текст';
    handleDiagnosticsIntent(A);
    await settleBeat();
    expect(diagSurfaceState).to.deep.include({step: 'failed', failure: 'The report could not be assembled', comment: 'мой текст'});
    expect(handleDiagnosticsIntent(B)).to.eq('stay');
    expect(diagSurfaceState.step).to.eq('review');
  });

  it('an empty journal offers the one thing it can: the report', () => {
    journal.clear();
    diagJournalState.revision++;
    openDiagnostics('menu', {to: 'journal'});
    handleDiagnosticsIntent(A);
    expect(diagSurfaceState).to.deep.include({step: 'category', reportFrom: 'browse'});
    handleDiagnosticsIntent(B);
    expect(diagSurfaceState.step).to.eq('browse');
  });

  it('the connection check: A on the system tab, one row per runtime', async () => {
    openDiagnostics('menu', {to: 'journal'});
    for (let i = 0; i < 4; i++) {
      handleDiagnosticsIntent(RB);
    }
    expect(DIAG_TABS[diagSurfaceState.tab].id).to.eq('system');
    handleDiagnosticsIntent(A);
    expect(diagSurfaceState).to.deep.include({step: 'selftest', checking: true});
    await settleBeat();
    expect(diagSurfaceState.checking).to.eq(false);
    expect(diagSurfaceState.check?.rows.map((r) => r.state)).to.deep.eq(['delivered', 'failed', 'absent']);
    const asked = fake.asked.find((a) => a.verb === 'selftest')?.request as {pageEntryId: string};
    expect(journal.find(asked.pageEntryId)?.family, 'the page\'s own test record went through the interceptor').to.eq('selftest');
    handleDiagnosticsIntent(B);
    expect(diagSurfaceState.step).to.eq('browse');
  });

  it('closing drops the held frame — except over a report that is on its way', () => {
    openDiagnostics('menu', {to: 'journal'});
    closeDiagnostics();
    expect(fake.asked.some((a) => a.verb === 'drop-screen')).to.eq(true);
    expect(diagSurfaceState.shown).to.eq(false);
  });
});

describe('diagnostics · the developer\'s notice', () => {
  let record: (level: 'warn' | 'error', args: ReadonlyArray<unknown>) => void;
  const clock = createManualClock(0);
  const opened: Array<DiagOpenTarget> = [];
  const modeBefore = devNoticeState.mode;

  beforeEach(() => {
    setFlowClock(clock);
    __resetDiagnosticsCaptureForTesting();
    __resetDiagnosticsSurfaceForTesting();
    __resetDevNoticeForTesting();
    opened.length = 0;
    record = __installDiagnosticsJournalForTesting(new DiagJournal({runtime: 'page', session: 'n', build: 'test'}));
    onDiagnosticEntry(() => diagJournalState.revision++);
    installDevNotice();
    setDiagnosticsOverlayOpener((target) => opened.push(target));
    __setDiagnosticsTransportForTesting(fakeTransport().transport);
    notificationState.transient.splice(0, notificationState.transient.length);
  });
  afterEach(() => {
    setDevNoticeMode(modeBefore);
    __resetDevNoticeForTesting();
    __resetDiagnosticsCaptureForTesting();
    setDiagnosticsOverlayOpener(undefined);
    __setDiagnosticsTransportForTesting(undefined);
    setFlowClock(undefined);
  });

  it('off by default: nothing is shown, whatever is recorded', () => {
    setDevNoticeMode('off');
    record('error', ['[page-error] uncaught: TypeError: boom', throwOne()]);
    expect(devNoticeVisible()).to.eq(false);
    expect(devNoticeShows('off', 'error')).to.eq(false);
    expect(devNoticeShows('errors', 'stall')).to.eq(false);
    expect(devNoticeShows('all', 'stall')).to.eq(true);
    expect(devNoticeShows('all', 'note')).to.eq(false);
  });

  it('a record raises the plate; the plate folds into a chip that keeps the count', () => {
    setDevNoticeMode('all');
    record('error', ['[page-error] uncaught: TypeError: boom', throwOne()]);
    record('warn', [STALL]);
    record('warn', ['[played-hero] a note raises nothing']);
    expect(devNoticeVisible()).to.eq(true);
    expect(devNoticeView).to.deep.include({entryId: 'page-n-2', folded: false, unseenErrors: 1, unseenStalls: 1});
    clock.advance(NOTICE_PLATE_MS + 10);
    expect(devNoticeView.folded).to.eq(true);
    // The episode's cure brings the plate back, in place — and counts nothing twice.
    record('warn', ['[liveness] recovered after 13s, 1 rung(s) run']);
    expect(devNoticeView).to.deep.include({entryId: 'page-n-2', folded: false, unseenStalls: 1});
  });

  it('HOLD X opens the record; a TAP is replayed to the screen below; a feed card comes first', async () => {
    setDevNoticeMode('errors');
    record('error', ['[page-error] uncaught: TypeError: boom', throwOne()]);
    const replayed: Array<string> = [];
    const replay = (intent: GamepadIntent): void => {
      replayed.push(`${intent.kind}:${'button' in intent ? intent.button : ''}`);
    };
    // A tap: taken, then given back whole.
    expect(interceptDevNoticeIntent(X_DOWN, replay)).to.eq(true);
    expect(devNoticeView.holding).to.eq(true);
    clock.advance(NOTIF_HOLD_MS - 50);
    expect(interceptDevNoticeIntent(X_UP, replay)).to.eq(true);
    expect(replayed).to.deep.eq(['press:secondary', 'release:secondary']);
    expect(opened).to.deep.eq([]);
    // A hold: the record opens, and the release that follows is consumed once.
    expect(interceptDevNoticeIntent(X_DOWN, replay)).to.eq(true);
    clock.advance(NOTIF_HOLD_MS + 10);
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    clock.advance(1000);
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    expect(opened).to.deep.eq([{to: 'entry', id: 'page-n-1'}]);
    expect(interceptDevNoticeIntent(X_UP, replay)).to.eq(true);
    expect(interceptDevNoticeIntent(X_UP, replay), 'only once').to.eq(false);
    // A card of the game's feed on screen: its own hold-X comes first.
    notificationState.transient.push({id: 'n1'} as never);
    expect(interceptDevNoticeIntent(X_DOWN, replay)).to.eq(false);
    notificationState.transient.splice(0, 1);
    // Other buttons are never the notice's.
    expect(interceptDevNoticeIntent(A, replay)).to.eq(false);
  });
});

describe('diagnostics · the surface and the notice, mounted', () => {
  let record: (level: 'warn' | 'error', args: ReadonlyArray<unknown>) => void;
  const modeBefore = devNoticeState.mode;
  const stubs = {GamepadGlyph: true, ConsoleVirtualKeyboard: true};

  beforeEach(() => {
    __resetDiagnosticsCaptureForTesting();
    __resetDiagnosticsSurfaceForTesting();
    __resetDevNoticeForTesting();
    record = __installDiagnosticsJournalForTesting(new DiagJournal({runtime: 'page', session: 'm', build: 'test'}));
    onDiagnosticEntry(() => diagJournalState.revision++);
    installDevNotice();
    __setDiagnosticsTransportForTesting(fakeTransport().transport);
    record('error', ['[vue-error] ConsoleHand < ConsoleShell · render: TypeError: boom', throwOne()]);
    record('warn', [STALL]);
  });
  afterEach(() => {
    setDevNoticeMode(modeBefore);
    __resetDevNoticeForTesting();
    __resetDiagnosticsSurfaceForTesting();
    __resetDiagnosticsCaptureForTesting();
    __setDiagnosticsTransportForTesting(undefined);
  });

  it('browse draws one row per record with its kind, and the cursored one in the detail strip', async () => {
    openDiagnostics('menu', {to: 'journal'});
    const wrapper = mount(ConsoleDiagnostics, {global: {...globalConfig.global, stubs}});
    await nextTick();
    expect(wrapper.attributes('data-diag-step')).to.eq('browse');
    const rows = wrapper.findAll('.con-diag__row');
    expect(rows.map((r) => r.attributes('data-diag-row'))).to.deep.eq(['liveness', 'vue-error']);
    expect(rows[0].classes()).to.include.members(['con-diag__row--stall', 'con-diag__row--cursor']);
    expect(wrapper.find('.con-diag__detail-raw').text()).to.contain('[liveness] stall (unserved)');
    expect(wrapper.findAll('[data-diag-tab]').map((t) => t.attributes('data-diag-tab'))).to.deep.eq(['all', 'errors', 'stalls', 'other', 'system']);
    expect(wrapper.findAll('[data-diag-crumb]')).to.have.length(0);
    handleDiagnosticsIntent(DOWN);
    await nextTick();
    expect(wrapper.find('.con-diag__detail-raw').text()).to.contain('[vue-error] ConsoleHand < ConsoleShell');
  });

  it('a record in full: the message, the frames, the full text — and the crumb gains its tail', async () => {
    openDiagnostics('menu', {to: 'entry', id: 'page-m-1'});
    const wrapper = mount(ConsoleDiagnostics, {global: {...globalConfig.global, stubs}});
    await nextTick();
    expect(wrapper.attributes('data-diag-step')).to.eq('entry');
    expect(wrapper.findAll('[data-diag-crumb]').map((c) => c.attributes('data-diag-crumb'))).to.deep.eq(['entry']);
    expect(wrapper.find('.con-diagentry__message').text()).to.eq('TypeError: boom in the hand');
    expect(wrapper.findAll('.con-diagentry__frame').length).to.be.greaterThan(0);
    expect(wrapper.find('[data-diag-text]').text()).to.contain('[vue-error] ConsoleHand < ConsoleShell · render: TypeError: boom');
    expect(wrapper.find('[data-diag-text]').text(), 'verbatim: the stack is in the full text').to.match(/at throwOne/);
  });

  it('the report\'s crumb only ever GAINS a segment; the review lists what leaves', async () => {
    openDiagnostics('menu', {to: 'report'});
    const wrapper = mount(ConsoleDiagnostics, {global: {...globalConfig.global, stubs}});
    await nextTick();
    const crumb = () => wrapper.findAll('[data-diag-crumb]').map((c) => c.attributes('data-diag-crumb'));
    expect(crumb()).to.deep.eq(['report']);
    expect(wrapper.findAll('[data-diag-category]')).to.have.length(5);
    handleDiagnosticsIntent(A);
    await nextTick();
    expect(crumb()).to.deep.eq(['report', 'category-freeze']);
    expect(wrapper.findAll('.con-diagrep__attach').length).to.eq(5);
    expect(wrapper.find('[data-diag-commit]').exists()).to.eq(true);
  });

  it('an empty tab says what to do next', async () => {
    openDiagnostics('menu', {to: 'journal'});
    diagSurfaceState.tab = 3;
    const wrapper = mount(ConsoleDiagnostics, {global: {...globalConfig.global, stubs}});
    await nextTick();
    expect(wrapper.find('[data-diag-empty]').exists()).to.eq(true);
    expect(wrapper.findAll('.con-diag__row')).to.have.length(0);
  });

  it('the notice: nothing while off; a plate with its kind and its hold hint while on', async () => {
    setDevNoticeMode('off');
    const off = mount(ConsoleDevNotice, {global: {...globalConfig.global, stubs}});
    await nextTick();
    expect(off.find('.con-devnote').exists()).to.eq(false);
    off.unmount();
    setDevNoticeMode('all');
    record('error', ['[page-error] uncaught: TypeError: again', throwOne()]);
    const on = mount(ConsoleDevNotice, {global: {...globalConfig.global, stubs}});
    await nextTick();
    const plate = on.find('.con-devnote');
    expect(plate.exists()).to.eq(true);
    expect(plate.attributes('data-dev-notice')).to.eq('plate');
    expect(plate.attributes('data-dev-notice-kind')).to.eq('error');
    expect(plate.find('.con-devnote__raw').text()).to.contain('[page-error] uncaught: TypeError: again');
  });
});
