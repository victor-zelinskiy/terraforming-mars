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
import {DiagHubStatus, DiagReportCategory, DiagReportPart, DiagReportResult} from '@/common/diagnostics/protocol';
import {frameLocation, parseStack, stackHead} from '@/common/diagnostics/stackFrames';

/** A reading: an English i18n key and what fills its `${n}` slots. */
export type DiagReading = {key: string, params: ReadonlyArray<string>};

const reading = (key: string, ...params: Array<string | number>): DiagReading => ({key, params: params.map(String)});

// ── The tabs: the journal's filters, then the system readout past the seam ───────────────────────────────────────────
//
// TWO GROUPS, the PROBLEMS first and by default (the owner, 2026-11-18: «по умолчанию все информационные вещи
// фильтруются и не показываются»): «Проблемы» (every defect — what the developer receives), sliced by «Ошибки» and
// «Зависания»; past a seam the INFORMATION — «Сведения» (an expected wait, a self-check, a delay, a note, the
// connection check) and «Все записи» (the whole journal in its order, for the context around a problem); past the
// minor seam the system readout. A problems tab never hides information silently: it SAYS how many records it leaves
// out and where they are (`diagHiddenInfoCount`).

export type DiagTabId = 'problems' | 'errors' | 'stalls' | 'info' | 'all' | 'system';

/** `seam` — a hairline before the tab (a new group); `minor` — past the seam, small and dim (the system readout). */
export type DiagTab = {id: DiagTabId, label: string, glyph: string, minor: boolean, seam: boolean};

export const DIAG_TABS: ReadonlyArray<DiagTab> = [
  {id: 'problems', label: 'Problems', glyph: '!', minor: false, seam: false},
  {id: 'errors', label: 'Errors', glyph: '✕', minor: false, seam: false},
  {id: 'stalls', label: 'Stalls', glyph: '◷', minor: false, seam: false},
  {id: 'info', label: 'Information records', glyph: '·', minor: false, seam: true},
  {id: 'all', label: 'All records', glyph: '≡', minor: false, seam: false},
  {id: 'system', label: 'System', glyph: '⊙', minor: true, seam: true},
];

/** The tabs of the PROBLEMS group — what they show is what the developer receives. */
const PROBLEM_TABS: ReadonlySet<DiagTabId> = new Set(['problems', 'errors', 'stalls']);

/** Which tab a kind is filed under — for a record that IS a defect of its kind (`tabOfEntry` asks the record). */
export function tabOfKind(kind: DiagKind): 'errors' | 'stalls' | 'info' {
  if (kind === 'error' || kind === 'integrity') {
    return 'errors';
  }
  return kind === 'stall' ? 'stalls' : 'info';
}

/**
 * WHAT A RECORD WEIGHS — the tier its cause class carries (`common/diagnostics/shapes.ts`), in the journal's words.
 * `defect` is a problem and is what the developer receives; `expected` is an honest wait that reached the limit it
 * DECLARED (tier `planned` — a wait for something only the player decides the time of); `trace` is a net's own note
 * beside another record (tier `info`). The two that are not defects are COUNTED in the session's summary and never
 * sent one by one — so the journal never calls them a stall and never files them under «Зависания»: the player would
 * read a problem the developer, by design, never receives (the owner, 2026-11-18).
 */
export type DiagWeight = 'defect' | 'expected' | 'trace';

export function diagWeight(entry: DiagEntry): DiagWeight {
  switch (entry.cause?.tier) {
  case 'planned': return 'expected';
  case 'info': return 'trace';
  default: return 'defect';
  }
}

/** The narrowest tab a record is filed under: a stall / mismatch that is not a defect is information, never a problem. */
export function tabOfEntry(entry: DiagEntry): 'errors' | 'stalls' | 'info' {
  return diagWeight(entry) === 'defect' ? tabOfKind(entry.kind) : 'info';
}

/** Is it a PROBLEM — a record the developer receives (or would, budgets and consent aside)? */
export function isDiagProblem(entry: DiagEntry): boolean {
  return tabOfEntry(entry) !== 'info';
}

export function filterDiagEntries(entries: ReadonlyArray<DiagEntry>, tab: DiagTabId): ReadonlyArray<DiagEntry> {
  switch (tab) {
  case 'all': return entries;
  case 'system': return [];
  case 'problems': return entries.filter(isDiagProblem);
  default: return entries.filter((e) => tabOfEntry(e) === tab);
  }
}

export function diagTabCounts(entries: ReadonlyArray<DiagEntry>): Record<DiagTabId, number> {
  const counts: Record<DiagTabId, number> = {problems: 0, errors: 0, stalls: 0, info: 0, all: entries.length, system: 0};
  for (const entry of entries) {
    const tab = tabOfEntry(entry);
    counts[tab]++;
    if (tab !== 'info') {
      counts.problems++;
    }
  }
  return counts;
}

/** How many information records a PROBLEMS tab leaves out (0 on every other tab) — said under its list, never silent. */
export function diagHiddenInfoCount(entries: ReadonlyArray<DiagEntry>, tab: DiagTabId): number {
  return PROBLEM_TABS.has(tab) ? entries.filter((e) => !isDiagProblem(e)).length : 0;
}

/** The tab a record opened from outside stands in: a problem on the default tab, information on its own. */
export function diagHomeTabIndex(entry: DiagEntry): number {
  return Math.max(0, DIAG_TABS.findIndex((t) => t.id === (isDiagProblem(entry) ? 'problems' : 'info')));
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

const WEIGHT_LABEL: Record<Exclude<DiagWeight, 'defect'>, string> = {
  expected: 'Expected wait',
  trace: 'Self-check',
};

/** The list's kind column is as wide as its longest KIND word — a weight's label there is a short one. */
const WEIGHT_SHORT_LABEL: Record<Exclude<DiagWeight, 'defect'>, string> = {
  expected: 'Wait',
  trace: 'Self-check',
};

/**
 * The kicker of a RECORD: its kind — or, for a record that is not a defect, what it is instead (never «Stall»).
 * `short` — for the list's fixed kind column (the record's head and the detail strip have room for the whole label).
 */
export function diagEntryKindLabel(entry: DiagEntry, short = false): string {
  const weight = diagWeight(entry);
  if (weight === 'defect') {
    return KIND_LABEL[entry.kind];
  }
  return short ? WEIGHT_SHORT_LABEL[weight] : WEIGHT_LABEL[weight];
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

/** What a record that is not a defect says first — its family's line («The screen stopped responding») would be a lie. */
const WEIGHT_HEADLINE: Record<Exclude<DiagWeight, 'defect'>, string> = {
  expected: 'A wait reached its planned limit — the game went on',
  trace: 'A self-check note — not a problem by itself',
};

export function diagHeadline(entry: DiagEntry): string {
  const weight = diagWeight(entry);
  if (weight !== 'defect') {
    return WEIGHT_HEADLINE[weight];
  }
  return FAMILY_HEADLINE[entry.family] ?? KIND_HEADLINE[entry.kind];
}

/**
 * WHY A RECORD THAT IS NOT A DEFECT IS NOT ONE — `undefined` for a defect: the sentence in the player's language, and
 * the wait's own declared reason (`(planned: …)` — the line's words, shown as they are) when the line carries one.
 */
export function diagNotADefect(entry: DiagEntry): {reason: string, declared: string} | undefined {
  const weight = diagWeight(entry);
  if (weight === 'defect') {
    return undefined;
  }
  const declared = /\(planned: ([^)]*)\)/.exec(entry.text)?.[1]?.trim() ?? '';
  return {
    reason: weight === 'expected' ?
      'The game waited for something only the player decides the time of and went on by itself at the limit this wait declares. The developer receives the count of such waits in the session summary, not each one.' :
      'One of the game\'s own safety checks noted this beside another record. On its own it is not a problem: the developer receives the count in the session summary.',
    declared,
  };
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
    // Why it waits — the network, or the collector's limit — is the hub's status to say (the system readout); a record
    // says only what is true in both cases.
    return {...reading('Kept on this device — will be sent later'), tone: 'warn'};
  }
  switch (delivery.reason) {
  case 'consent': return {...reading('Not sent — automatic reports are off'), tone: 'plain'};
  case 'budget': return {...reading('Not sent — enough reports for this session'), tone: 'plain'};
  case 'disabled': return {...reading('Not sent — this build sends nothing'), tone: 'plain'};
  // Never offered BY DESIGN (the hub says so for exactly these — `hub.ts` `accept`): a delay or a note rides the next
  // event as its trail; a stall / mismatch that is not a defect is counted in the session's summary.
  case 'policy':
    if (entry.kind === 'perf' || entry.kind === 'note') {
      return {...reading('Not sent on its own — goes with the next report as context'), tone: 'plain'};
    }
    return diagWeight(entry) === 'defect' ? undefined : {...reading('Not sent — expected, counted in the session summary'), tone: 'plain'};
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
export function reportDoneReading(result: Pick<DiagReportResult, 'state' | 'waits' | 'filesRefused'>): {title: string, body: string, tone: 'ok' | 'warn' | 'plain'} {
  switch (result.state) {
  case 'sent':
    // THE TRUTH OF WHAT ARRIVED: the collector's limit for files can be used up while it still takes events.
    if (result.filesRefused) {
      return {title: 'The report is with the developer — without its files', body: 'The receiving service is out of room for attached files, so only the summary went. The files are in the folder below — keep it until the developer asks.', tone: 'warn'};
    }
    return {title: 'The report is with the developer', body: 'Nothing else is needed. The code is for reference — name it if you contact the developer yourself.', tone: 'ok'};
  case 'queued':
    // THE TRUTH OF THE WAIT: a limit of the receiving service is not the player's network — nothing of theirs to fix.
    if (result.waits === 'limit') {
      return {title: 'The report is saved and will be sent later', body: 'The receiving service is not taking new reports right now — its limit is used up. Your internet is fine. The report is kept on this device and leaves by itself when the limit renews.', tone: 'warn'};
    }
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
  // The collector's own limit (the plan's quota, a key's rate limit, the spike protection) — never «no network».
  // ONE LINE, like every other value of this row (the count of what waits stands in the row below; the reason — in
  // the group's note): a longer phrase wrapped and made the row taller than it stands in every other state.
  if (status.limitedWhat === 'events') {
    return {...reading('The receiving service is full'), tone: 'warn'};
  }
  if (status.limitedWhat === 'attachments') {
    return {...reading('Reports go without their files'), tone: 'warn'};
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
