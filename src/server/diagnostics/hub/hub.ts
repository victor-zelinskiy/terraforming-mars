/*
 * THE DIAGNOSTICS HUB — the one place a diagnostic signal leaves the device from.
 *
 *   the page ──(records, as they are made)──┐
 *   the host process (`note('main', …)`) ───┼─→ MIRROR (this app run's journal, every runtime) ──→ the page adopts it
 *   the game server (`note('server', …)`) ──┘         │
 *                                                     ├─→ POLICY (kind · consent · budgets) → SCRUB → the collector
 *   «Сообщить о проблеме» ──→ the PACKAGE (a folder on the device + the same files as attachments, unscrubbed)
 *   «Проверка связи» ──→ one test event per runtime, each answered «доставлено» / why not
 *
 * What it guarantees:
 *
 *  · NOTHING IS SENT FROM A BUILD WITH NO DESTINATION (`hubConfig.ts`) — a development run, a test, a fork's build.
 *  · NOTHING AUTOMATIC IS SENT AGAINST THE PLAYER'S CHOICE — the consent is kept HERE (a file of the app's data), so it
 *    also governs what the host process and the crash uploader send before any page exists.
 *  · NOTHING AUTOMATIC CARRIES A KEY OR A NAME — the finished event is scrubbed (`privacy.ts`) with what the page said
 *    is on its table; only an explicit report carries the full package.
 *  · ONE INCIDENT — ONE EVENT. A record is sent once; a liveness episode once, when it ends (or when it has stood half
 *    a minute); a session and a day have budgets, so a loop cannot spend the collector's quota.
 *
 * It runs in the Electron main process today (`electron/diagnosticsMain.ts` is its host); the same module is what a
 * hosted server will run. Contract: `docs/claude/diagnostics.md`.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {debugIdsOf} from '@/common/diagnostics/debugIds';
import {DiagDelivery, DiagEntry} from '@/common/diagnostics/DiagnosticModel';
import {DiagChange, DiagJournal} from '@/common/diagnostics/journal';
import {fingerprintId, scrubDeep, ScrubContext} from '@/common/diagnostics/privacy';
import {
  DiagContext, DiagHubStatus, DiagPush, DiagReportRequest, DiagReportResult, DiagSelfTestResult, DiagSelfTestRow, DiagSend, reportCodeFrom,
} from '@/common/diagnostics/protocol';
import {normalizeMessage, parseStack} from '@/common/diagnostics/stackFrames';
import {EnvelopeAttachment, EnvelopeSender, eventEnvelope, SendOutcome} from './envelopeSender';
import {HubConfig, parseDsn, resolveHubConfig} from './hubConfig';
import {DiagnosticsHub, HubHost} from './hubTypes';
import {describeParts, gatherReportParts, ReportPart, tailWithin, writeReportFolder} from './reportPackage';
import {EventFacts, eventOf, reportEventOf} from './sentryEvent';

/** Records the mirror keeps for the app run (every runtime together). */
export const MIRROR_MAX = 400;
/** Automatic events one app run may send, one fingerprint may send, one family may send. */
export const SESSION_EVENTS_MAX = 40;
export const KEY_EVENTS_MAX = 2;
export const FAMILY_EVENTS_MAX = 8;
/** …and one device in one day (kept on disk: a crash loop relaunching the app must not spend the quota). */
export const DAILY_EVENTS_MAX = 200;
/** An episode still open after this long is sent as «standing» — the player may never see it end. */
export const EPISODE_STANDING_MS = 30_000;
/** On the owner's machine an automatic event carries the console's dump — at most this often. */
export const BOX_DUMP_EVERY_MS = 10 * 60_000;

export type HubDeps = {
  now?: () => number;
  random?: () => number;
  schedule?: (ms: number, run: () => void) => () => void;
};

/** What the policy does with a record that just changed. */
export type AutoDecision =
  /** Send it now. */
  'send' |
  /** Not yet — an episode that is still young. */
  'wait' |
  /** Never: this kind is not sent, it was sent already, or a budget is spent. */
  {skip: 'policy' | 'budget'};

export type PolicyState = {
  sent: Set<string>;
  perKey: Map<string, number>;
  perFamily: Map<string, number>;
  total: number;
};

export function newPolicyState(): PolicyState {
  return {sent: new Set(), perKey: new Map(), perFamily: new Map(), total: 0};
}

/** The key two records of one defect share (the budget's unit). */
export function policyKey(entry: DiagEntry): string {
  const frames = parseStack(entry.stack);
  const own = frames.find((f) => f.inApp) ?? frames[0];
  return `${entry.runtime}|${entry.kind}|${entry.family}|${own !== undefined ? `${own.fn}@${own.file}` : normalizeMessage(entry.title)}`;
}

/**
 * WHAT IS SENT BY ITSELF. Errors and integrity warnings when they are born; a stall when it is over (or has stood
 * `EPISODE_STANDING_MS`); a performance line and a module's note never — they ride the next event as its trail.
 * Pure: the budgets are in `state`, which `noteSent` moves.
 */
export function autoDecision(entry: DiagEntry, change: DiagChange, state: PolicyState): AutoDecision {
  if (entry.kind === 'perf' || entry.kind === 'note' || entry.family === 'selftest' || state.sent.has(entry.id)) {
    return {skip: 'policy'};
  }
  if (entry.episode !== undefined && entry.episode.state === 'open') {
    if (entry.episode.durationMs < EPISODE_STANDING_MS) {
      return 'wait';
    }
  } else if (change === 'update') {
    // A repeat of a record that was already judged when it was born.
    return {skip: 'policy'};
  }
  if (state.total >= SESSION_EVENTS_MAX || (state.perKey.get(policyKey(entry)) ?? 0) >= KEY_EVENTS_MAX ||
      (state.perFamily.get(entry.family) ?? 0) >= FAMILY_EVENTS_MAX) {
    return {skip: 'budget'};
  }
  return 'send';
}

export function noteSent(entry: DiagEntry, state: PolicyState): void {
  state.sent.add(entry.id);
  state.total++;
  const key = policyKey(entry);
  state.perKey.set(key, (state.perKey.get(key) ?? 0) + 1);
  state.perFamily.set(entry.family, (state.perFamily.get(entry.family) ?? 0) + 1);
}

type StoredState = {consent?: boolean, day?: string, sentToday?: number};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

export function createDiagnosticsHub(host: HubHost, deps: HubDeps = {}): DiagnosticsHub {
  const now = deps.now ?? (() => Date.now());
  const random = deps.random ?? Math.random;
  const schedule = deps.schedule ?? ((ms: number, run: () => void) => {
    const t = setTimeout(run, ms);
    return () => clearTimeout(t);
  });

  const dir = path.join(host.dataDir, 'diagnostics');
  const reportsDir = path.join(dir, 'reports');
  const stateFile = path.join(dir, 'state.json');
  const config: HubConfig = resolveHubConfig({
    packaged: host.packaged, dsn: host.dsn, version: host.version,
    machineFile: readJson<{environment?: unknown}>(path.join(host.dataDir, 'diagnostics.json')),
    env: host.env,
  });
  const dsn = config.sends ? parseDsn(config.dsn) : undefined;
  const sends = config.sends && dsn !== undefined;

  const stored: StoredState = readJson<StoredState>(stateFile) ?? {};
  let consent = stored.consent !== false;
  const saveState = (): void => {
    try {
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(stateFile, JSON.stringify(stored));
    } catch {
      // The choice still holds for this run.
    }
  };
  const today = (): string => new Date(now()).toISOString().slice(0, 10);
  const dailyRoom = (): boolean => (stored.day === today() ? (stored.sentToday ?? 0) : 0) < DAILY_EVENTS_MAX;
  const noteDaily = (): void => {
    if (stored.day !== today()) {
      stored.day = today();
      stored.sentToday = 0;
    }
    stored.sentToday = (stored.sentToday ?? 0) + 1;
    saveState();
  };

  const mirror = new Map<string, DiagEntry>();
  const session = `${now().toString(36)}${Math.floor(random() * 1296).toString(36)}`;
  const journals = {
    main: new DiagJournal({runtime: 'main', session, build: host.version}),
    server: new DiagJournal({runtime: 'server', session, build: host.version}),
  };
  const policy = newPolicyState();
  const debugIds = new Map<string, string>();
  let context: DiagContext | undefined;
  let lastBoxDumpAt = 0;
  const waiters: Array<{test: (entry: DiagEntry) => boolean, resolve: (entry: DiagEntry) => void}> = [];

  const status = (): DiagHubStatus => ({
    environment: config.environment,
    release: config.release,
    appMode: host.appMode(),
    sendingOff: !sends ? 'environment' : (consent ? '' : 'consent'),
    consent,
    queued: sender.queued(),
    lastDeliveredAt: sender.lastDeliveredAt,
    lastError: sender.lastError,
    limitedWhat: sender.limited().what,
    limitedReason: sender.limited().reason,
    reportsDir,
  });
  const pushStatus = (): void => host.push({kind: 'status', status: status()} satisfies DiagPush);

  const sender = new EnvelopeSender({
    url: sends ? dsn?.envelopeUrl : undefined,
    outboxDir: path.join(dir, 'outbox'),
    request: host.request,
    now, schedule,
    onChange: () => pushStatus(),
    mayFlush: (klass) => klass === 'report' || consent,
  });
  if (sends) {
    // What an earlier run could not deliver leaves once the app has settled.
    sender.arm(8_000);
  }
  host.setCrashUpload(sends && consent);
  host.log(`[diagnostics] ${sends ? `sending as ${config.environment} · ${config.release}${consent ? '' : ' · automatic reports OFF (the player\'s choice)'}` : `not sending — ${config.why === '' ? 'the destination is unreadable' : config.why}`}`);

  function scrubContext(): ScrubContext {
    const ids = [context?.gameId ?? '', context?.participantId ?? ''].filter((id) => id !== '');
    let account = '';
    try {
      account = os.userInfo().username;
    } catch {
      account = '';
    }
    return {ids, names: [...(context?.names ?? []), account, os.hostname()].filter((n) => n !== '')};
  }

  function facts(eventId: string, entry: DiagEntry | undefined, selfTest: boolean): EventFacts {
    const trail = [...mirror.values()].filter((e) => entry === undefined || (e.id !== entry.id && e.at <= entry.at)).sort((a, b) => a.at - b.at);
    return {
      eventId,
      release: config.release, environment: config.environment, appMode: host.appMode(), head: host.head,
      os: host.platform, osVersion: host.osVersion, arch: host.arch,
      runtimeName: host.runtimeName, runtimeVersion: host.runtimeVersion,
      context,
      gameRef: context !== undefined && context.gameId !== '' ? fingerprintId(context.gameId, sha256) : '',
      seatRef: context !== undefined && context.participantId !== '' ? fingerprintId(context.participantId, sha256) : '',
      debugIds, trail, selfTest,
    };
  }

  function setDelivery(entry: DiagEntry, delivery: DiagDelivery): void {
    entry.delivery = delivery;
    host.push({kind: 'delivery', id: entry.id, delivery} satisfies DiagPush);
  }

  /** One record as one event, scrubbed, to the collector. `force` = «Проверка связи» (no consent, no budget asked). */
  async function sendEntry(entry: DiagEntry, force: boolean): Promise<DiagDelivery> {
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const scrub = scrubContext();
    const event = scrubDeep(eventOf(entry, facts(eventId, entry, force)), scrub, sha256);
    const attachments: Array<EnvelopeAttachment> = [];
    // The owner's machine: the event arrives with the console around it (scrubbed like the event), not more often
    // than `BOX_DUMP_EVERY_MS` — an agent reads the incident without asking for a report.
    if (!force && config.environment === 'box' && now() - lastBoxDumpAt >= BOX_DUMP_EVERY_MS) {
      lastBoxDumpAt = now();
      try {
        const dump = await host.consoleDump();
        if (dump !== undefined && dump !== '') {
          attachments.push({filename: 'console_export.txt', data: tailWithin(scrubDeep(dump, scrub, sha256), 2 * 1024 * 1024).text, contentType: 'text/plain'});
        }
      } catch {
        // The event leaves without it.
      }
    }
    const outcome = await sender.send(eventEnvelope(event, attachments, now()), 'auto', eventId);
    const delivery: DiagDelivery = outcome.state === 'sent' ? {state: 'sent', eventId} :
      (outcome.state === 'queued' ? {state: 'queued', eventId} : {state: 'held', reason: 'disabled'});
    setDelivery(entry, delivery);
    return delivery;
  }

  /** A record entered or changed: mirror it, and let the policy decide. */
  function accept(entry: DiagEntry, change: DiagChange): void {
    const known = mirror.get(entry.id);
    if (known !== undefined && known.delivery !== undefined && entry.delivery === undefined) {
      entry.delivery = known.delivery;
    }
    mirror.delete(entry.id);
    mirror.set(entry.id, entry);
    while (mirror.size > MIRROR_MAX) {
      const oldest = mirror.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      mirror.delete(oldest);
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].test(entry)) {
        waiters.splice(i, 1)[0].resolve(entry);
      }
    }
    const decision = autoDecision(entry, change, policy);
    if (decision === 'wait') {
      return;
    }
    if (decision !== 'send') {
      if (entry.delivery === undefined && decision.skip === 'budget') {
        setDelivery(entry, {state: 'held', reason: 'budget'});
      }
      return;
    }
    if (!sends) {
      setDelivery(entry, {state: 'held', reason: 'disabled'});
      policy.sent.add(entry.id);
      return;
    }
    if (!consent) {
      setDelivery(entry, {state: 'held', reason: 'consent'});
      policy.sent.add(entry.id);
      return;
    }
    if (!dailyRoom()) {
      setDelivery(entry, {state: 'held', reason: 'budget'});
      policy.sent.add(entry.id);
      return;
    }
    noteSent(entry, policy);
    noteDaily();
    void sendEntry(entry, false);
  }

  function waitFor(test: (entry: DiagEntry) => boolean, ms: number): Promise<DiagEntry | undefined> {
    const standing = [...mirror.values()].find(test);
    if (standing !== undefined) {
      return Promise.resolve(standing);
    }
    return new Promise((resolve) => {
      const waiter = {test, resolve: (entry: DiagEntry) => {
        cancel();
        resolve(entry);
      }};
      const cancel = schedule(ms, () => {
        const at = waiters.indexOf(waiter);
        if (at >= 0) {
          waiters.splice(at, 1);
        }
        resolve(undefined);
      });
      waiters.push(waiter);
    });
  }

  function note(runtime: 'main' | 'server', level: 'warn' | 'error', text: string, stack?: string, ids?: Readonly<Record<string, string>>): void {
    // The host process is THIS process: its scripts' debug ids are read off the global registry itself.
    for (const [file, id] of Object.entries(ids ?? (runtime === 'main' ? debugIdsOf(globalThis) : {}))) {
      debugIds.set(file, id);
    }
    const {entry, change} = journals[runtime].ingest({at: now(), level, text, ...(stack !== undefined ? {stack} : {})});
    accept(entry, change);
    host.push({kind: 'entry', entry} satisfies DiagPush);
  }

  async function report(request: DiagReportRequest): Promise<DiagReportResult> {
    const code = reportCodeFrom([random(), random(), random(), random(), random(), random()]);
    const at = now();
    const entry = request.entryId === '' ? undefined : (mirror.get(request.entryId) ?? request.journal.find((e) => e.id === request.entryId));
    const meta: Record<string, unknown> = {
      code,
      createdAt: new Date(at).toISOString(),
      category: request.category,
      comment: request.comment,
      release: config.release,
      environment: config.environment,
      appMode: host.appMode(),
      head: host.head,
      platform: host.platform, osVersion: host.osVersion, arch: host.arch,
      runtime: `${host.runtimeName} ${host.runtimeVersion}`,
      context: request.context,
      // What an agent needs to find this table's save on a machine it can read: the same fingerprints automatic events carry.
      gameRef: request.context.gameId === '' ? '' : fingerprintId(request.context.gameId, sha256),
      seatRef: request.context.participantId === '' ? '' : fingerprintId(request.context.participantId, sha256),
      entry: entry ?? null,
      sending: status(),
    };
    const parts = await gatherReportParts(host, request, meta, at);
    const folder = writeReportFolder(reportsDir, code, parts);
    host.dropScreen();
    const result = (state: DiagReportResult['state'], outcome?: SendOutcome): DiagReportResult => ({
      code, state, folder, parts: describeParts(parts),
      // The truth of a wait: the network, or the collector's own limit — and a report that went without its files.
      waits: state !== 'queued' ? '' : (outcome?.state === 'queued' && outcome.limited === true ? 'limit' : 'network'),
      filesRefused: state === 'sent' && outcome?.state === 'sent' && outcome.attachmentsRefused === true,
    });
    if (!sends) {
      return result('local');
    }
    context = request.context;
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const event = reportEventOf({code, category: request.category, comment: request.comment, at, entry}, facts(eventId, entry, false));
    const attach = (list: ReadonlyArray<ReportPart>): Array<EnvelopeAttachment> =>
      list.map((p) => ({filename: p.name, data: p.data, contentType: p.contentType}));
    let outcome = await sender.send(eventEnvelope(event, attach(parts), at), 'report', code);
    if (outcome.state === 'dropped') {
      // The collector refused the whole package (its size, most likely): the report still reaches the developer with
      // its small parts; the rest is in the folder on the device, and `report.json` lists it.
      const light = parts.filter((p) => ['report.json', 'journal.json', 'field_record.json', 'screen.jpg'].includes(p.name));
      host.log(`[diagnostics] report ${code}: the full package was refused (${outcome.reason}) — sending its light parts`);
      outcome = await sender.send(eventEnvelope(event, attach(light), at), 'report', code);
    }
    if (outcome.state === 'dropped') {
      host.log(`[diagnostics] report ${code} stays on this device: ${outcome.reason}`);
      return result('local');
    }
    // (The player's words ride the report's own event — its message and `extra.comment`. They are NOT sent a second
    // time as a «User Feedback» item: the collector files that as an issue of its own, i.e. two issues and two mails
    // per report — measured with the probe, 2026-11-14.)
    if (outcome.state === 'sent' && outcome.attachmentsRefused === true) {
      host.log(`[diagnostics] report ${code}: the collector took the summary and refused the files (its limit for attachments) — they are in ${folder}`);
    }
    return result(outcome.state === 'sent' ? 'sent' : 'queued', outcome);
  }

  async function selfTest(pageEntryId: string): Promise<DiagSelfTestResult> {
    const started = now();
    const row = async (runtime: DiagSelfTestRow['runtime'], entry: DiagEntry | undefined, absent: string): Promise<DiagSelfTestRow> => {
      if (entry === undefined) {
        return {runtime, state: absent === '' ? 'failed' : 'absent', eventId: '', reason: absent === '' ? 'the test record never arrived' : absent, limited: false};
      }
      if (!sends) {
        return {runtime, state: 'failed', eventId: '', reason: config.why === '' ? 'this build has no destination' : config.why, limited: false};
      }
      const delivery = await sendEntry(entry, true);
      if (delivery.state === 'sent') {
        return {runtime, state: 'delivered', eventId: delivery.eventId, reason: '', limited: false};
      }
      return {runtime, state: 'failed', eventId: delivery.state === 'queued' ? delivery.eventId : '', reason: sender.lastError === '' ? 'not delivered' : sender.lastError, limited: sender.limited().what === 'events'};
    };
    const page = waitFor((e) => e.id === pageEntryId, 3_000);
    // The host's own test error: thrown in the host's code, so its stack proves the host's source maps.
    const hostError = host.hostSelfTestError();
    for (const [file, id] of Object.entries(debugIdsOf(globalThis))) {
      debugIds.set(file, id);
    }
    const main = journals.main.ingest({at: now(), level: 'error', text: `[selftest] main — the connection check\n${hostError.stack ?? hostError.message}`, stack: hostError.stack ?? `${hostError.name}: ${hostError.message}`});
    accept(main.entry, main.change);
    host.push({kind: 'entry', entry: main.entry} satisfies DiagPush);
    let serverEntry: Promise<DiagEntry | undefined> = Promise.resolve(undefined);
    let serverAbsent = 'the game server does not run on this device';
    if (host.appMode() === 'host') {
      const asked = await host.serverSelfTest().catch(() => false);
      if (asked) {
        serverAbsent = '';
        const since = now();
        serverEntry = waitFor((e) => e.runtime === 'server' && e.family === 'selftest' && e.at >= since - 1_000, 10_000);
      }
    }
    const rows = await Promise.all([
      page.then((e) => row('page', e, '')),
      row('main', main.entry, ''),
      serverEntry.then((e) => row('server', e, serverAbsent)),
    ]);
    return {rows, tookMs: now() - started};
  }

  function line(payload: unknown): void {
    const message = payload as DiagSend | undefined;
    if (message === undefined || message === null || typeof message !== 'object') {
      return;
    }
    if (message.kind === 'entry' && message.entry !== undefined && typeof message.entry.id === 'string') {
      accept(message.entry, message.change);
    } else if (message.kind === 'context' && message.context !== undefined) {
      context = message.context;
    } else if (message.kind === 'debug-ids' && message.ids !== undefined) {
      for (const [file, id] of Object.entries(message.ids)) {
        debugIds.set(file, String(id));
      }
    }
  }

  function invoke(verb: string, payload: unknown): Promise<unknown> {
    return Promise.resolve(answer(verb, payload));
  }

  function answer(verb: string, payload: unknown): unknown {
    switch (verb) {
    case 'journal':
      return [...mirror.values()].sort((a, b) => a.at - b.at);
    case 'status':
      return status();
    case 'set-consent':
      consent = payload === true;
      stored.consent = consent;
      saveState();
      host.setCrashUpload(sends && consent);
      if (consent) {
        void sender.flush();
      } else {
        // What was queued by itself is taken back with the choice.
        sender.dropQueued('auto');
      }
      return status();
    case 'hold-screen':
      return host.holdScreen().catch(() => false);
    case 'drop-screen':
      host.dropScreen();
      return true;
    case 'report':
      return report(payload as DiagReportRequest);
    case 'selftest':
      return selfTest(String((payload as {pageEntryId?: unknown} | undefined)?.pageEntryId ?? ''));
    case 'copy': {
      const entry = mirror.get(String(payload));
      if (entry === undefined) {
        return false;
      }
      host.copyToClipboard(entry.text);
      return true;
    }
    default:
      return undefined;
    }
  }

  return {
    invoke, line, note,
    crashSubmitUrl: () => (sends ? dsn?.minidumpUrl : undefined),
    crashUploadAllowed: () => sends && consent,
    crashExtra: () => ({
      'sentry[release]': config.release,
      'sentry[environment]': config.environment,
      'sentry[tags][kind]': 'crash',
      'sentry[tags][runtime]': 'native',
      'sentry[tags][head]': host.head,
    }),
    openJournal: () => host.push({kind: 'open-journal'} satisfies DiagPush),
    shutdown: () => {
      sender.stop();
      for (const journal of [journals.main, journals.server]) {
        for (const entry of journal.closeOpenEpisodes()) {
          accept(entry, 'close');
        }
      }
      return Promise.resolve();
    },
  };
}
