/*
 * CONSOLE LEAK DETECTOR — CTS phase T0 (CONSOLE_MODE_CONCEPT.md §CTS-7).
 *
 * Makes mixed/broken input states VISIBLE instead of silent. Two checks,
 * run on a light 1 s interval while console mode is active:
 *
 * 1. STRANDED PROMPT (the production bug class behind "only the pill is
 *    visible"): the server is waiting for input, the console does NOT
 *    serve it natively, and NO surface (fallback modal / desktop overlay /
 *    console task) is actually rendered. → `state.stranded` drives the
 *    honest guard panel in ConsoleShell + a one-shot console.warn.
 *
 * 2. DESKTOP SURFACE REPORT: any desktop-era surface currently mounted in
 *    console mode is recorded (fallback modals are EXPECTED during the CTS
 *    rollout — this is telemetry that shrinks phase by phase, surfaced in
 *    the ?gpDebug readout, warn-once in dev).
 *
 * Read-only: one querySelector pass per tick, no DOM writes, no gameplay
 * effects. Stops with the shell.
 */

import {reactive} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ConsoleTask, taskFor, SHELL_NATIVE_KINDS} from '@/client/console/consoleTaskRouter';
import {inputTitleText} from '@/client/console/turnIntents';
import {translateText} from '@/client/directives/i18n';

/** Any of these rendered = SOME surface is serving the prompt. */
const SERVING_SURFACES: ReadonlyArray<string> = [
  '.mandatory-input-modal:not(.mandatory-input-modal--minimized):not(.mandatory-input-modal--suppressed)',
  'dialog[open]',
  '.start-game-flow',
  '.draw-reveal',
  '.colonies-overlay',
  '.initial-draft-pills', // the initial-draft pipeline's own chrome
  '.con-task-host', // CTS task host (T1 primitives / T2 cards / T3 payment)
  '.con-govsupport', // the dedicated Government Support (WGT) briefing panel
  '.con-banner--deferred', // a DEFERRED task's amber chip IS the surface (B returns)
];

/**
 * Kind-SPECIFIC serving surfaces (CTS T3/T4): a shell-section task is
 * served by its section — but ONLY for its own kind (a hand section open
 * over an unrelated stranded prompt must not mask the guard panel).
 */
const KIND_SURFACES: Partial<Record<string, ReadonlyArray<string>>> = {
  projectCard: ['.con-hand', '.con-sheet'],
  colony: ['.con-colonies'],
  // FREE award funding (Vitor) is served by the premium awards MA screen.
  awardFunding: ['.con-ma'],
  // T5: the full-screen start scene serves both opening kinds.
  initialDraft: ['.con-start'],
  startSequence: ['.con-start'],
  // Optional draft re-pick → the calm "waiting for others" banner.
  draftWait: ['.con-draftwait'],
};

/** Desktop-era surfaces tracked while the CTS rollout retires them. */
const DESKTOP_SURFACES: ReadonlyArray<{id: string, selector: string}> = [
  {id: 'mandatory-modal', selector: '.mandatory-input-modal'},
  {id: 'placement-banner', selector: '.placement-banner'},
  {id: 'bar-overlay', selector: '.bar-overlay'},
  {id: 'top-bar-dropdown', selector: '.top-bar-dropdown'},
  {id: 'hand-overlay', selector: '.hand-board-overlay'},
  {id: 'colonies-overlay', selector: '.colonies-overlay'},
  {id: 'legacy-ui', selector: '.legacy-ui-overlay'},
  {id: 'desktop-pill', selector: '.mandatory-input-modal-pill--visible, .hand-select-pill'},
];

export type StrandedPrompt = {
  inputType: string,
  taskKind: string,
  /** Translated prompt title (best effort — for the guard panel). */
  title: string,
};

export const leakDetectorState = reactive({
  /** A prompt with NO serving surface — drives the guard panel. */
  stranded: undefined as StrandedPrompt | undefined,
  /** Desktop surfaces currently mounted (rollout telemetry, ?gpDebug). */
  desktopSurfaces: [] as Array<string>,
});

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[console-leak-detector] ${message}`);
  }
}

/** One detection pass (exported for tests; DOM-dependent parts no-op under JSDOM). */
export function runLeakDetection(view: PlayerViewModel | undefined): void {
  if (typeof document === 'undefined') {
    return;
  }
  // 2. Desktop surface telemetry.
  const present: Array<string> = [];
  for (const s of DESKTOP_SURFACES) {
    const el = document.querySelector(s.selector);
    if (el !== null && (el as HTMLElement).getClientRects().length > 0) {
      present.push(s.id);
      warnOnce(`surface:${s.id}`, `desktop surface "${s.id}" is mounted in console mode (CTS rollout telemetry)`);
    }
  }
  leakDetectorState.desktopSurfaces = present;

  // 1. Stranded prompt.
  const wf = view?.waitingFor;
  if (view === undefined || wf === undefined) {
    leakDetectorState.stranded = undefined;
    return;
  }
  const task: ConsoleTask | undefined = taskFor(view);
  // Only the shell's OWN surfaces need no dedicated host; every task-host
  // kind must actually RENDER `.con-task-host` (checked below) — a host
  // that fails to mount is a stranded prompt, not a success.
  if (task !== undefined && SHELL_NATIVE_KINDS.has(task.kind)) {
    leakDetectorState.stranded = undefined;
    return;
  }
  const selectors = [...SERVING_SURFACES, ...(task !== undefined ? KIND_SURFACES[task.kind] ?? [] : [])];
  const served = selectors.some((sel) => {
    const el = document.querySelector(sel);
    return el !== null && (el as HTMLElement).getClientRects().length > 0;
  });
  if (served) {
    leakDetectorState.stranded = undefined;
    return;
  }
  const title = inputTitleText(wf.title);
  const stranded: StrandedPrompt = {
    inputType: wf.type,
    taskKind: task?.kind ?? 'unknown',
    title: title !== undefined && title !== '' ? translateText(title) : '',
  };
  if (leakDetectorState.stranded?.inputType !== stranded.inputType) {
    warnOnce(`stranded:${stranded.inputType}`,
      `STRANDED PROMPT: waitingFor "${stranded.inputType}" (task kind "${stranded.taskKind}") has NO serving surface in console mode`);
  }
  leakDetectorState.stranded = stranded;
}

let timer: number | undefined;

export function startConsoleLeakDetector(getView: () => PlayerViewModel | undefined): void {
  if (timer !== undefined || typeof window === 'undefined') {
    return;
  }
  runLeakDetection(getView());
  timer = window.setInterval(() => runLeakDetection(getView()), 1000);
}

export function stopConsoleLeakDetector(): void {
  if (timer !== undefined && typeof window !== 'undefined') {
    window.clearInterval(timer);
    timer = undefined;
  }
  leakDetectorState.stranded = undefined;
  leakDetectorState.desktopSurfaces = [];
}
