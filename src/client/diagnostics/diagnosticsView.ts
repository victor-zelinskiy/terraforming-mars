/*
 * HOW A DIAGNOSTIC RECORD READS — the pure view-model of the diagnostics surface.
 *
 * A record's own text is what a module printed for a developer: English, technical, exact — and it is shown exactly so
 * where it belongs (the record's full text, the mono line of the detail strip). Everything AROUND it speaks to a person
 * on a couch, in their language: what kind of thing happened, where, when, how it ended, whether the developer has it.
 * This module derives those readings. Every string it returns is an English i18n KEY (with its params); the component
 * translates — nothing here touches the DOM or the dictionary, so the whole reading is unit-tested.
 */

import {readLivenessLine} from '@/common/diagnostics/classify';
import {DiagEntry, DiagFrame, DiagKind, DiagRuntime} from '@/common/diagnostics/DiagnosticModel';
import {DiagHubStatus, DiagReportCategory, DiagReportPart} from '@/common/diagnostics/protocol';
import {frameLocation, parseStack, stackHead} from '@/common/diagnostics/stackFrames';

/** A reading: an English i18n key and what fills its `${n}` slots. */
export type DiagReading = {key: string, params: ReadonlyArray<string>};

const reading = (key: string, ...params: Array<string | number>): DiagReading => ({key, params: params.map(String)});

// ── The tabs: the journal's filters, then the system readout past the seam ───────────────────────────────────────────

export type DiagTabId = 'all' | 'errors' | 'stalls' | 'other' | 'system';

export type DiagTab = {id: DiagTabId, label: string, glyph: string, minor: boolean};

export const DIAG_TABS: ReadonlyArray<DiagTab> = [
  {id: 'all', label: 'All records', glyph: '≡', minor: false},
  {id: 'errors', label: 'Errors', glyph: '✕', minor: false},
  {id: 'stalls', label: 'Stalls', glyph: '◷', minor: false},
  {id: 'other', label: 'Other', glyph: '·', minor: false},
  {id: 'system', label: 'System', glyph: '⊙', minor: true},
];

/** Which tab a kind is filed under. */
export function tabOfKind(kind: DiagKind): Exclude<DiagTabId, 'all' | 'system'> {
  if (kind === 'error' || kind === 'integrity') {
    return 'errors';
  }
  return kind === 'stall' ? 'stalls' : 'other';
}

export function filterDiagEntries(entries: ReadonlyArray<DiagEntry>, tab: DiagTabId): ReadonlyArray<DiagEntry> {
  if (tab === 'all') {
    return entries;
  }
  if (tab === 'system') {
    return [];
  }
  return entries.filter((e) => tabOfKind(e.kind) === tab);
}

export function diagTabCounts(entries: ReadonlyArray<DiagEntry>): Record<DiagTabId, number> {
  const counts: Record<DiagTabId, number> = {all: entries.length, errors: 0, stalls: 0, other: 0, system: 0};
  for (const entry of entries) {
    counts[tabOfKind(entry.kind)]++;
  }
  return counts;
}

// ── One record ───────────────────────────────────────────────────────────────────────────────────────────────────────

const KIND_LABEL: Record<DiagKind, string> = {
  error: 'Error',
  stall: 'Stall',
  integrity: 'Mismatch',
  perf: 'Delay',
  note: 'Note',
};

export function diagKindLabel(kind: DiagKind): string {
  return KIND_LABEL[kind];
}

const RUNTIME_LABEL: Record<DiagRuntime, string> = {
  page: 'Game screen',
  main: 'Application',
  server: 'Game server',
};

export function diagRuntimeLabel(runtime: DiagRuntime): string {
  return RUNTIME_LABEL[runtime];
}

/** What happened, in a person's words, for the families a player can meet; a family with no line of its own reads by its kind. */
const FAMILY_HEADLINE: Readonly<Record<string, string>> = {
  'page-error': 'An unexpected error on the game screen',
  'vue-error': 'A part of the interface failed to draw',
  'main-error': 'An unexpected error in the application',
  'server-error': 'An unexpected error on the game server',
  'liveness': 'The screen stopped responding',
  'renderer-hang': 'The game window stopped answering',
  'process-gone': 'A process of the application ended unexpectedly',
  'selftest': 'Connection check',
  'workspace-stall': 'A screen did not finish by itself',
  'workspace-stale': 'A finished screen was closed for the player',
  'transport': 'An exchange with the server went wrong',
  'console': 'A message of the game',
};

const KIND_HEADLINE: Record<DiagKind, string> = {
  error: 'An error in the game',
  stall: 'The game had to recover a screen',
  integrity: 'The picture and the game state disagreed',
  perf: 'The game was slow for a moment',
  note: 'A note of the game',
};

export function diagHeadline(entry: DiagEntry): string {
  return FAMILY_HEADLINE[entry.family] ?? KIND_HEADLINE[entry.kind];
}

/** `14:07:31` in the device's own time. */
export function diagClock(at: number): string {
  const d = new Date(at);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

function seconds(ms: number): string {
  const s = ms / 1000;
  return s >= 10 ? String(Math.round(s)) : String(Math.round(s * 10) / 10);
}

/** How an episode ended — `undefined` for a record that is not one. */
export function diagOutcome(entry: DiagEntry): (DiagReading & {tone: 'ok' | 'warn' | 'bad'}) | undefined {
  const episode = entry.episode;
  if (episode === undefined) {
    return undefined;
  }
  if (episode.state === 'healed') {
    return {...reading('Recovered in ${0} s', seconds(episode.durationMs)), tone: 'ok'};
  }
  if (episode.state === 'unhealed') {
    return {...reading('Not recovered — stood for ${0} s', seconds(episode.durationMs)), tone: 'bad'};
  }
  return {...reading('Still standing — ${0} s', seconds(episode.durationMs)), tone: 'warn'};
}

/** Whether the developer has it — `undefined` where there is nothing to say (no hub, a kind never sent). */
export function diagDelivery(entry: DiagEntry): (DiagReading & {tone: 'ok' | 'warn' | 'plain'}) | undefined {
  const delivery = entry.delivery;
  if (delivery === undefined) {
    return undefined;
  }
  if (delivery.state === 'sent') {
    return {...reading('Sent to the developer'), tone: 'ok'};
  }
  if (delivery.state === 'queued') {
    return {...reading('Will be sent when the network is back'), tone: 'warn'};
  }
  switch (delivery.reason) {
  case 'consent': return {...reading('Not sent — automatic reports are off'), tone: 'plain'};
  case 'budget': return {...reading('Not sent — enough reports for this session'), tone: 'plain'};
  case 'disabled': return {...reading('Not sent — this build sends nothing'), tone: 'plain'};
  default: return undefined;
  }
}

/** The mono line under a headline: the record's own first line, with its tag. */
export function diagRawLine(entry: DiagEntry): string {
  return entry.family === 'console' ? entry.title : `[${entry.family}] ${entry.title}`;
}

export type DiagFrameRow = {fn: string, where: string, own: boolean};

/** A frame read back to its source (`frameSymbols.ts`); `undefined` where its script has no symbols. */
export type DiagResolvedFrame = {source: string, line: number, name: string} | undefined;

/**
 * The stack as rows: what threw first; ours bright, a library's dim. With `resolved` (the same frames read back to
 * their sources) a row names `src/…/file.ts:line` instead of the minified position — and its function is the name the
 * CALLER's call site carries (a map names the token at a position: the call site of frame i+1 names the function of
 * frame i), falling back to what V8 printed.
 */
export function diagFrameRows(entry: DiagEntry, resolved: ReadonlyArray<DiagResolvedFrame> = []): {head: string, frames: ReadonlyArray<DiagFrameRow>} {
  const frames = parseStack(entry.stack).map((f: DiagFrame, i: number): DiagFrameRow => {
    const at = resolved[i];
    if (at === undefined) {
      return {fn: f.fn === '' ? '(anonymous)' : f.fn, where: frameLocation(f), own: f.inApp};
    }
    const named = resolved[i + 1]?.name ?? '';
    return {
      fn: named !== '' ? named : (f.fn === '' ? '(anonymous)' : f.fn),
      where: `${at.source}:${at.line}`,
      own: !at.source.startsWith('node_modules/') && !at.source.startsWith('webpack/'),
    };
  });
  return {head: stackHead(entry.stack), frames};
}

export type DiagFactRow = {label: string, value: string, mono: boolean};

/** «The screen at that moment» — only the facts that say something (a record born before the app mounted has few). */
export function diagScreenFacts(entry: DiagEntry): ReadonlyArray<DiagFactRow> {
  const s = entry.screen;
  if (s === undefined) {
    return [];
  }
  const rows: Array<DiagFactRow> = [];
  const put = (label: string, value: string, mono = true): void => {
    if (value !== '') {
      rows.push({label, value, mono});
    }
  };
  put('Screen', s.screen);
  put('Section', s.section.replace(/\/$/, ''));
  put('Server question', s.prompt);
  if (s.prompt !== '') {
    put('Input accepted', s.accepting ? 'yes' : 'no', false);
  }
  put('In flight', s.inFlight.join(', '));
  put('Workspace stack', s.frames.join(' › '));
  if (s.quietS > 0) {
    put('Quiet for', `${s.quietS} s`);
  }
  put('Held by', s.block);
  put('Display', [s.profile, s.viewport].filter((v) => v !== '').join(' · '));
  return rows;
}

/** The liveness episode's own facts: what was asked, why it counted as a stall, what the net did. */
export function diagEpisodeFacts(entry: DiagEntry): ReadonlyArray<DiagFactRow> {
  if (entry.episode === undefined) {
    return [];
  }
  const rows: Array<DiagFactRow> = [];
  const first = readLivenessLine(entry.text.split('\n')[0]);
  if (first.is === 'stall') {
    rows.push({label: 'Stall reason', value: first.reason, mono: true});
    rows.push({label: 'Server question', value: first.asked, mono: true});
  }
  entry.episode.steps.forEach((step, i) => rows.push({label: i === 0 ? 'What the game did' : '', value: step, mono: true}));
  return rows;
}

// ── The report ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type DiagCategoryPlate = {id: DiagReportCategory, label: string, sub: string, glyph: string};

export const DIAG_REPORT_PLATES: ReadonlyArray<DiagCategoryPlate> = [
  {id: 'freeze', label: 'The game froze', sub: 'Nothing responds, or the game waits for something forever', glyph: '◷'},
  {id: 'visual', label: 'Something looks wrong', sub: 'A wrong picture, text out of place, a broken animation', glyph: '◫'},
  {id: 'rules', label: 'The rules worked incorrectly', sub: 'A card, an effect or a score did not do what it should', glyph: '⚖'},
  {id: 'crash', label: 'The game closed or restarted', sub: 'A black screen, a sudden exit, a reload in the middle of a game', glyph: '⏻'},
  {id: 'other', label: 'Something else', sub: 'Anything that does not fit the above', glyph: '✎'},
];

/** The category a report opened from a record starts on (the player may change it). */
export function suggestedCategory(entry: DiagEntry | undefined): DiagReportCategory | undefined {
  if (entry === undefined) {
    return undefined;
  }
  if (entry.kind === 'stall') {
    return 'freeze';
  }
  if (entry.family === 'renderer-gone' || entry.family === 'process-gone' || entry.family === 'main-error') {
    return 'crash';
  }
  if (entry.family === 'vue-error' || entry.kind === 'integrity') {
    return 'visual';
  }
  return 'other';
}

export type DiagAttachRow = {label: string, note: string, included: boolean};

/** What an explicit report carries — said BEFORE the press, in the words of a person (never file names). */
export function reportAttachRows(status: DiagHubStatus | undefined, inGame: boolean): ReadonlyArray<DiagAttachRow> {
  const hosted = status?.appMode === 'host' && inGame;
  return [
    {label: 'The screen as it was before this menu', note: '', included: true},
    {label: 'The error journal of the game', note: '', included: true},
    {label: 'What the screen did in the last half minute', note: '', included: true},
    {label: 'The technical log of the game', note: '', included: true},
    {
      label: 'The save of this game',
      note: hosted ? '' : (inGame ? 'The game is hosted on another device' : 'No game is open'),
      included: hosted,
    },
  ];
}

/** A package part by its human name (the done stage lists what actually went). */
const PART_LABEL: Readonly<Record<string, string>> = {
  'report.json': 'Report summary',
  'journal.json': 'The error journal of the game',
  'field_record.json': 'What the screen did in the last half minute',
  'console_export.txt': 'The technical log of the game',
  'screen.jpg': 'The screen as it was before this menu',
  'save.json': 'The save of this game',
  'hang_trace.json': 'A trace of the window that stopped answering',
};

export function reportPartLabel(part: DiagReportPart): string {
  return PART_LABEL[part.name] ?? (part.name.startsWith('log_') ? 'Application logs' : part.name);
}

/** `1.4 МБ` / `312 КБ` — params for a size reading. */
export function reportSize(parts: ReadonlyArray<DiagReportPart>): DiagReading {
  const bytes = parts.reduce((sum, p) => sum + p.bytes, 0);
  return bytes >= 1024 * 1024 ? reading('${0} MB', Math.round(bytes / (1024 * 102.4)) / 10) : reading('${0} KB', Math.max(1, Math.round(bytes / 1024)));
}

/** The done stage's one sentence. */
export function reportDoneReading(state: 'sent' | 'queued' | 'local'): {title: string, body: string, tone: 'ok' | 'warn' | 'plain'} {
  switch (state) {
  case 'sent':
    return {title: 'The report is with the developer', body: 'Nothing else is needed. The code is for reference — name it if you contact the developer yourself.', tone: 'ok'};
  case 'queued':
    return {title: 'The report will be sent when the network is back', body: 'It is kept on this device and leaves by itself — now or the next time the game starts. The code is for reference.', tone: 'warn'};
  default:
    return {title: 'The report is saved on this device', body: 'This build does not send reports. The folder below holds everything a developer needs.', tone: 'plain'};
  }
}

// ── The system readout's own group and the connection check ──────────────────────────────────────────────────────────

/** How sending stands, in one phrase. */
export function sendingReading(status: DiagHubStatus | undefined): DiagReading & {tone: 'ok' | 'warn' | 'plain'} {
  if (status === undefined) {
    return {...reading('Unavailable in this build'), tone: 'plain'};
  }
  if (status.sendingOff === 'environment') {
    return {...reading('This build sends nothing'), tone: 'plain'};
  }
  if (status.sendingOff === 'consent') {
    return {...reading('Automatic reports are off'), tone: 'warn'};
  }
  return {...reading('Sending is on'), tone: 'ok'};
}

const ENVIRONMENT_LABEL: Readonly<Record<string, string>> = {
  box: 'Developer machine',
  production: 'Release',
  development: 'Development build',
};

export function environmentLabel(environment: string): string {
  return ENVIRONMENT_LABEL[environment] ?? environment;
}

export const SELFTEST_RUNTIMES: ReadonlyArray<DiagRuntime> = ['page', 'main', 'server'];
