/*
 * THE DIAGNOSTICS SURFACE'S CONTROLLER — its state, its input and its three flows, outside the component.
 *
 * ONE surface (`ConsoleDiagnostics.vue`, a member of the system overlay beside the system menu and the settings
 * console), ONE root crumb «ДИАГНОСТИКА», and every place the player can stand is a STEP of it — the crumb only ever
 * gains a tail:
 *
 *   ДИАГНОСТИКА                              browse: the journal under its filters, the system readout past the seam
 *   ДИАГНОСТИКА › ЗАПИСЬ                     one record in full: what the console received, the stack, the screen
 *   ДИАГНОСТИКА › ОТЧЁТ                      what happened (a category)
 *   ДИАГНОСТИКА › ОТЧЁТ › <КАТЕГОРИЯ>        what will be sent, a word from the player, the commit plate
 *   ДИАГНОСТИКА › ОТЧЁТ › ОТПРАВКА           past the commit: a beat, the pad absorbed — never a destination of B
 *   ДИАГНОСТИКА › ОТЧЁТ › ГОТОВО             the code; a finished flow LEAVES (A or B closes the whole overlay)
 *   ДИАГНОСТИКА › ПРОВЕРКА СВЯЗИ             one test event per runtime, each answered
 *
 * Input arrives from the overlay's owner (`GamepadLayer` — pad and keyboard alike) as intents; the component is a
 * template over this state. Waits are the kernel's (`consoleAppScope()` — the surface belongs to the PAGE: it opens on
 * the main menu and over a game alike, and a game that ends under it takes nothing of it away).
 */

import {reactive} from 'vue';
import {DiagEntry} from '@/common/diagnostics/DiagnosticModel';
import {DiagReportCategory, DiagReportResult, DiagSelfTestResult} from '@/common/diagnostics/protocol';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import {settled} from '@/client/console/kernel/flowScope';
import {consoleAppScope} from '@/client/console/session/consoleSession';
import {motionMs} from '@/client/components/motion/motionTokens';
import {pageJournal, reportDiagnosticError} from '@/client/diagnostics/diagnosticsCapture';
import {currentDiagContext, publishDebugIds} from '@/client/diagnostics/diagnosticsContext';
import {refreshDiagnosticsHubStatus} from '@/client/diagnostics/diagnosticsHubState';
import {diagEntries, diagEntry} from '@/client/diagnostics/diagnosticsJournalState';
import {diagnosticsTransport} from '@/client/diagnostics/diagnosticsTransport';
import {DIAG_REPORT_PLATES, DIAG_TABS, DiagResolvedFrame, filterDiagEntries, suggestedCategory} from '@/client/diagnostics/diagnosticsView';
import {resolveFrames} from '@/client/diagnostics/frameSymbols';
import {parseStack} from '@/common/diagnostics/stackFrames';

export type DiagStep =
  'browse' | 'entry' |
  /** The report: choose what happened → review and commit → the beat of sending → the code / the refusal. */
  'category' | 'review' | 'sending' | 'done' | 'failed' |
  'selftest';

/** Where a step returns to on B, when that is not fixed by the step itself. */
type ReportFrom = 'outside' | 'browse' | 'entry';

export const diagSurfaceState = reactive({
  /** The surface is the overlay's member right now. */
  shown: false,
  /** `menu` — it was opened from the system list (B at its root returns there); `direct` — B at its root closes the overlay. */
  origin: 'direct' as 'menu' | 'direct',
  step: 'browse' as DiagStep,
  /** The tab (index into `DIAG_TABS`) and the cursored row of its list. */
  tab: 0,
  cursor: 0,
  /** The record being read. */
  entryId: '',
  // ── the report's draft ──
  reportFrom: 'outside' as ReportFrom,
  /** The record the report is about ('' = none). */
  reportEntryId: '',
  categoryCursor: 0,
  category: undefined as DiagReportCategory | undefined,
  /** 0 = the comment row, 1 = the commit plate. */
  reviewCursor: 1,
  comment: '',
  /** The on-screen keyboard is up for the comment. */
  typing: false,
  result: undefined as DiagReportResult | undefined,
  /** Why the report could not be made (an i18n key). */
  failure: '',
  // ── the connection check ──
  checking: false,
  check: undefined as DiagSelfTestResult | undefined,
  /** «Скопировано» stands (a note of the foot, gone by itself). */
  copied: false,
  /** A record's frames read back to their sources (`frameSymbols.ts`), by record id — filled when the record is opened. */
  resolved: {} as Record<string, ReadonlyArray<DiagResolvedFrame>>,
});

/** The least time the sending beat stands: a fast answer must not flash a stage past the player. */
export const REPORT_MIN_BEAT_MS = 1100;
/** The surface's patience for the hub's answer (the hub bounds its own request; this is the net under it). */
export const REPORT_MAX_MS = 120_000;
export const SELFTEST_MAX_MS = 40_000;
const COPIED_MS = 2200;
/** How long opening waits for the frame to be held before the surface covers it. */
const HOLD_SCREEN_MAX_MS = 220;

/** How long a record's frames may take to be read back (the symbols are fetched once; a record stays readable without them). */
const RESOLVE_FRAMES_MAX_MS = 8_000;

/**
 * A RECORD IS OPENED: its minified frames are read back to `src/…:line` — on demand, never before (the symbols are
 * megabytes), and never in the way: the record stands at once as V8 printed it and its rows change their words in
 * place when the answer comes.
 */
function openEntry(id: string): void {
  const s = diagSurfaceState;
  s.entryId = id;
  s.copied = false;
  s.step = 'entry';
  const entry = diagEntry(id);
  if (entry === undefined || entry.stack === undefined || s.resolved[id] !== undefined) {
    return;
  }
  void consoleAppScope().wait(settled('a record\'s frames are read back to their sources', resolveFrames(parseStack(entry.stack))),
    {bound: {ms: RESOLVE_FRAMES_MAX_MS, quiet: 'the symbols are a nicety of the reading — the record is readable without them'}})
    .then((answer) => {
      if (answer.status === 'met' && answer.value.ok && answer.value.value.some((frame) => frame !== undefined)) {
        s.resolved = {...s.resolved, [id]: answer.value.value};
      }
    });
}

/** What the component lends the controller: a scroller for the read-only bodies, the keyboard's own input. */
type SurfaceHands = {
  scrollBy?: (dy: number) => void;
  keyboard?: (intent: GamepadIntent) => boolean;
};
let hands: SurfaceHands = {};

export function lendDiagnosticsHands(next: SurfaceHands): void {
  hands = next;
}

/** The rows of the current tab (newest first). Reactive. */
export function diagRows(): ReadonlyArray<DiagEntry> {
  return filterDiagEntries(diagEntries(), DIAG_TABS[diagSurfaceState.tab]?.id ?? 'all');
}

export function diagOnSystemTab(): boolean {
  return DIAG_TABS[diagSurfaceState.tab]?.id === 'system';
}

function resetReport(): void {
  const s = diagSurfaceState;
  s.category = undefined;
  s.categoryCursor = 0;
  s.reviewCursor = 1;
  s.comment = '';
  s.typing = false;
  s.result = undefined;
  s.failure = '';
}

export type DiagOpenTarget = {to: 'journal'} | {to: 'report'} | {to: 'entry', id: string};

/**
 * Open the surface. A report that is being SENT is never reset by an opening: the player who closed the overlay over
 * the beat comes back to it (or to its code).
 */
export function openDiagnostics(origin: 'menu' | 'direct', target: DiagOpenTarget): void {
  const s = diagSurfaceState;
  s.shown = true;
  s.origin = origin;
  void refreshDiagnosticsHubStatus();
  if (s.step === 'sending' || (s.step === 'done' && target.to === 'report')) {
    return;
  }
  s.copied = false;
  if (target.to === 'report') {
    resetReport();
    s.reportFrom = 'outside';
    s.reportEntryId = '';
    s.step = 'category';
    return;
  }
  if (target.to === 'entry' && diagEntry(target.id) !== undefined) {
    s.tab = 0;
    s.cursor = Math.max(0, diagRows().findIndex((e) => e.id === target.id));
    openEntry(target.id);
    return;
  }
  s.step = 'browse';
  s.cursor = Math.min(s.cursor, Math.max(0, diagRows().length - 1));
}

/** The frame on screen is kept for a report that may follow — asked BEFORE the overlay covers it; bounded. */
export async function holdDiagnosticsScreen(): Promise<void> {
  const transport = diagnosticsTransport();
  if (transport.kind === 'none') {
    return;
  }
  await consoleAppScope().wait(settled('the frame on screen is held for a report', transport.invoke('hold-screen', undefined)),
    {bound: {ms: HOLD_SCREEN_MAX_MS, quiet: 'the frame is a nicety of the report — the overlay does not wait for it'}});
}

/** The overlay let the surface go (B at its root, the Menu key, a finished report). */
export function closeDiagnostics(): void {
  const s = diagSurfaceState;
  s.shown = false;
  s.typing = false;
  if (s.step !== 'sending') {
    // The held frame was for a report nobody is making any more.
    void diagnosticsTransport().invoke('drop-screen', undefined);
    if (s.step === 'done' || s.step === 'failed') {
      resetReport();
      s.step = 'browse';
    }
  }
}

function startReport(from: ReportFrom, entryId: string): void {
  const s = diagSurfaceState;
  resetReport();
  s.reportFrom = from;
  s.reportEntryId = entryId;
  const suggested = suggestedCategory(entryId === '' ? undefined : diagEntry(entryId));
  s.categoryCursor = Math.max(0, DIAG_REPORT_PLATES.findIndex((p) => p.id === suggested));
  s.step = 'category';
}

/** THE COMMIT. One press: the draft is sealed, the beat stands, the answer decides the last step. */
export async function sendDiagnosticsReport(): Promise<void> {
  const s = diagSurfaceState;
  if (s.category === undefined || s.step === 'sending') {
    return;
  }
  s.step = 'sending';
  s.failure = '';
  s.result = undefined;
  const scope = consoleAppScope();
  const startedAt = Date.now();
  const fieldRecord = (window as unknown as {__conFieldRecorder?: () => unknown}).__conFieldRecorder?.();
  publishDebugIds();
  const answer = await scope.wait(settled('the diagnostics hub answers a report', diagnosticsTransport().invoke('report', {
    category: s.category,
    comment: s.comment.trim(),
    entryId: s.reportEntryId,
    context: currentDiagContext(),
    journal: [...(pageJournal()?.entries() ?? [])],
    fieldRecord: fieldRecord ?? null,
  })), {bound: {ms: REPORT_MAX_MS}});
  // The beat has a minimum: the code is revealed, never flashed.
  const rest = motionMs(REPORT_MIN_BEAT_MS) - (Date.now() - startedAt);
  if (rest > 0) {
    await scope.sleep(rest);
  }
  if (s.step !== 'sending') {
    return;
  }
  const result = answer.status === 'met' && answer.value.ok ? answer.value.value : undefined;
  if (result === undefined) {
    s.failure = diagnosticsTransport().kind === 'none' ? 'Reports can be sent from the game application only' :
      (answer.status === 'bound' ? 'The report took too long to assemble' : 'The report could not be assembled');
    s.step = 'failed';
    return;
  }
  s.result = result;
  s.step = 'done';
}

/** «Проверка связи»: one test event from each runtime; the hub answers what arrived. */
export async function runDiagnosticsSelfTest(): Promise<void> {
  const s = diagSurfaceState;
  if (s.checking) {
    return;
  }
  s.step = 'selftest';
  s.checking = true;
  s.check = undefined;
  // The page's own test error goes through the page's own interceptor — the road every real error takes.
  reportDiagnosticError('[selftest] page — the connection check', new Error('the connection check — a test error of the game screen (not a defect)'));
  const mine = [...(pageJournal()?.entries() ?? [])].reverse().find((e) => e.family === 'selftest' && e.runtime === 'page');
  publishDebugIds();
  const answer = await consoleAppScope().wait(
    settled('the diagnostics hub answers the connection check', diagnosticsTransport().invoke('selftest', {pageEntryId: mine?.id ?? ''})),
    {bound: {ms: SELFTEST_MAX_MS}});
  s.checking = false;
  s.check = answer.status === 'met' && answer.value.ok && answer.value.value !== undefined ? answer.value.value : {
    // Nobody answered: every runtime is «not delivered», with the one reason there is.
    rows: (['page', 'main', 'server'] as const).map((runtime) => ({
      runtime, state: 'failed' as const, eventId: '',
      reason: diagnosticsTransport().kind === 'none' ? 'this build has no diagnostics service' : 'the diagnostics service did not answer',
    })),
    tookMs: 0,
  };
  void refreshDiagnosticsHubStatus();
}

async function copyEntry(id: string): Promise<void> {
  const entry = diagEntry(id);
  if (entry === undefined) {
    return;
  }
  // The main process owns the clipboard in the app (a sandboxed page's own write needs a user gesture the pad is not).
  let done = await diagnosticsTransport().invoke('copy', id) === true;
  if (!done) {
    try {
      await navigator.clipboard.writeText(entry.text);
      done = true;
    } catch {
      done = false;
    }
  }
  if (done) {
    diagSurfaceState.copied = true;
    // PACING: the note is the surface's own; a page that left has nothing to clear.
    consoleAppScope().after(COPIED_MS, 'the «copied» note of the diagnostics surface fades', () => {
      diagSurfaceState.copied = false;
    });
  }
}

/** The comment came back from the keyboard. */
export function commitDiagnosticsComment(text: string | undefined): void {
  const s = diagSurfaceState;
  if (text !== undefined) {
    s.comment = text.trim().slice(0, 600);
  }
  s.typing = false;
}

/**
 * One intent of the pad or the keyboard. `leave` — the surface is done with the overlay (the owner returns to the
 * system list or closes, by `origin`); `stay` — consumed here.
 */
export function handleDiagnosticsIntent(intent: GamepadIntent): 'stay' | 'leave' {
  const s = diagSurfaceState;
  if (s.typing) {
    hands.keyboard?.(intent);
    return 'stay';
  }
  const action = consoleActionOf(intent);
  const vertical = intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down') ? (intent.dir === 'down' ? 1 : -1) : 0;
  switch (s.step) {
  case 'browse': {
    if (vertical !== 0) {
      if (diagOnSystemTab()) {
        hands.scrollBy?.(vertical * 60);
      } else {
        s.cursor = stepIndex(s.cursor, vertical, diagRows().length);
      }
    } else if (action === 'prevSection' || action === 'nextSection') {
      s.tab = stepIndex(s.tab, action === 'nextSection' ? 1 : -1, DIAG_TABS.length);
      s.cursor = 0;
    } else if (action === 'primary') {
      if (diagOnSystemTab()) {
        void runDiagnosticsSelfTest();
      } else {
        const row = diagRows()[s.cursor];
        if (row !== undefined) {
          openEntry(row.id);
        } else {
          // An empty journal still has one thing to offer: the report.
          startReport('browse', '');
        }
      }
    } else if (action === 'back') {
      return 'leave';
    }
    return 'stay';
  }
  case 'entry':
    if (vertical !== 0) {
      hands.scrollBy?.(vertical * 120);
    } else if (action === 'primary') {
      startReport('entry', s.entryId);
    } else if (action === 'inspect') {
      void copyEntry(s.entryId);
    } else if (action === 'back') {
      s.step = 'browse';
    }
    return 'stay';
  case 'category':
    if (vertical !== 0) {
      s.categoryCursor = stepIndex(s.categoryCursor, vertical, DIAG_REPORT_PLATES.length);
    } else if (action === 'primary') {
      s.category = DIAG_REPORT_PLATES[s.categoryCursor]?.id;
      s.reviewCursor = 1;
      s.step = 'review';
    } else if (action === 'back') {
      if (s.reportFrom === 'outside') {
        return 'leave';
      }
      s.step = s.reportFrom;
    }
    return 'stay';
  case 'review':
    if (vertical !== 0) {
      s.reviewCursor = stepIndex(s.reviewCursor, vertical, 2);
    } else if (action === 'primary') {
      if (s.reviewCursor === 0) {
        s.typing = true;
      } else {
        void sendDiagnosticsReport();
      }
    } else if (action === 'back') {
      s.step = 'category';
    }
    return 'stay';
  case 'sending':
    // A beat in flight: the pad is absorbed, so a second press cannot send a second report.
    return 'stay';
  case 'done':
    // A finished flow leaves — it never folds back to the list it was opened from.
    if (action === 'primary' || action === 'back') {
      s.origin = 'direct';
      return 'leave';
    }
    return 'stay';
  case 'failed':
    if (action === 'primary') {
      void sendDiagnosticsReport();
    } else if (action === 'back') {
      s.step = 'review';
    }
    return 'stay';
  case 'selftest':
    if (action === 'primary' && !s.checking) {
      void runDiagnosticsSelfTest();
    } else if (action === 'back') {
      s.step = 'browse';
    }
    return 'stay';
  }
}

/**
 * `window.__conDiagnostics` — the page's diagnostics, readable and drivable from OUTSIDE the page (the console's other
 * hooks of this kind: `__conFieldRecorder`, `__conFlow`, `__conReady`). The main process's probe
 * (`TM_DIAG_PROBE=1` — electron/diagnosticsMain.ts) proves the whole road with it, with no hand on a pad: the
 * connection check through the real pipes, and a report through the real package.
 */
export function installDiagnosticsProbe(): void {
  if (typeof window === 'undefined') {
    return;
  }
  // What leaves the page is a PLAIN copy: the surface's state is reactive, and a reactive proxy cannot cross a
  // process boundary (`executeJavaScript` answered «An object could not be cloned» to the first probe).
  const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null)) as T;
  (window as unknown as {__conDiagnostics?: unknown}).__conDiagnostics = {
    journal: () => plain([...(pageJournal()?.entries() ?? [])]),
    surface: () => plain({...diagSurfaceState}),
    selfTest: async () => {
      await runDiagnosticsSelfTest();
      diagSurfaceState.step = 'browse';
      return plain(diagSurfaceState.check);
    },
    report: async (category: DiagReportCategory, comment: string) => {
      // As the Menu press does before the overlay rises: the frame on screen is held for the package. The press waits
      // for it only a moment (the menu must not lag; a player spends seconds on the steps before the send, so a late
      // frame is in the package anyway) — the probe sends AT ONCE, so it waits for the frame itself.
      await diagnosticsTransport().invoke('hold-screen', undefined);
      diagSurfaceState.reportEntryId = '';
      diagSurfaceState.category = category;
      diagSurfaceState.comment = comment;
      await sendDiagnosticsReport();
      const answer = diagSurfaceState.result ?? {failure: diagSurfaceState.failure};
      // The probe drove the flow without the surface: nothing of it is left for the next real opening.
      const copy = plain(answer);
      resetReport();
      diagSurfaceState.step = 'browse';
      return copy;
    },
  };
}

/** Spec seam: the state as a fresh page has it. */
export function __resetDiagnosticsSurfaceForTesting(): void {
  const s = diagSurfaceState;
  s.shown = false;
  s.origin = 'direct';
  s.step = 'browse';
  s.tab = 0;
  s.cursor = 0;
  s.entryId = '';
  s.reportFrom = 'outside';
  s.reportEntryId = '';
  s.checking = false;
  s.check = undefined;
  s.copied = false;
  s.resolved = {};
  resetReport();
  hands = {};
}
