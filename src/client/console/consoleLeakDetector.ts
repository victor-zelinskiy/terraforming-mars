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
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';

/** Any of these rendered = SOME surface is serving the prompt. */
const SERVING_SURFACES: ReadonlyArray<string> = [
  '.mandatory-input-modal:not(.mandatory-input-modal--minimized):not(.mandatory-input-modal--suppressed)',
  'dialog[open]',
  '.start-game-flow',
  '.draw-reveal',
  // The CONSOLE-native reveal overlay (drawn cards / deck-check result / another
  // player's reveal). While it is up it OWNS the foreground — any pending prompt
  // is legitimately held BEHIND it (e.g. the Pluto draw+discard: the reveal
  // shows the drawn card, then the hand section serves the discard). The console
  // reveal is `.con-reveal` (the desktop `.draw-reveal` above is a separate DOM).
  '.con-reveal',
  // The full-screen START SCENE owns the foreground for the whole opening. It
  // can stay up while the underlying prompt is already the NEXT step held behind
  // it — the corp-bonus reveal running over the action menu (Polyphemos, no
  // preludes) or over Merger's 42 M€ payment. Any such prompt is legitimately
  // served behind the scene (mirrors `.con-reveal`).
  '.con-start',
  '.colonies-overlay',
  '.initial-draft-pills', // the initial-draft pipeline's own chrome
  '.con-task-host', // CTS task host (T1 primitives / T2 cards / T3 payment)
  '.con-govsupport', // the dedicated Government Support (WGT) briefing panel
  '.con-banner--deferred', // a DEFERRED task's amber chip IS the surface (B returns)
  // PRESENTATION FLOW: while the compact AI-turn card / the «Разбор хода»
  // review is the foreground item, the mandatory task surfaces intentionally
  // hold off — the holding card / review IS the serving surface for that beat.
  '.con-notif--holding',
  '.con-bot-review',
  // The PLAYED-CARD HERO scene: a follow-up prompt committed at the landing
  // stays intentionally held through the short result beat — the hero stage
  // (mounted for the whole transaction) is the serving surface for it.
  '.con-played-hero',
  // The PATENT-SALE trade-terminal scene: the follow-up prompt committed at
  // the payout chip's touchdown stays held through the short settle — the
  // sale stage (mounted for the whole transaction) serves it.
  '.con-sale-hero',
  // The TILE-PLACEMENT hero: a follow-up prompt committed at the landing
  // stays held through the reward beat (printed bonuses paying out) — the
  // placement stage serves it for that window.
  '.con-tileplace',
];

/**
 * Kind-SPECIFIC serving surfaces (CTS T3/T4): a shell-section task is
 * served by its section — but ONLY for its own kind (a hand section open
 * over an unrelated stranded prompt must not mask the guard panel).
 */
const KIND_SURFACES: Partial<Record<string, ReadonlyArray<string>>> = {
  // '.con-composer--play' = the native play-card pre-select composer, which
  // serves the projectCard prompt on top of the hand while it is open.
  projectCard: ['.con-hand', '.con-sheet', '.con-composer--play'],
  // A MANDATORY hand pick (discard / reveal / place) is served by the hand
  // section in select mode — the same `.con-hand` root as play-from-hand.
  handSelect: ['.con-hand'],
  colony: ['.con-colonies'],
  // FREE award funding (Vitor) is served by the premium awards MA screen.
  awardFunding: ['.con-ma'],
  // The corporation's mandatory FIRST ACTION (the player's first turn) is
  // served by the «Разыграно» table in action mode.
  corpFirstAction: ['.con-played'],
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

/**
 * A prompt must be detected unserved on THIS MANY CONSECUTIVE passes before the
 * guard is actually shown — the guard is a DEV safety net for a GENUINELY stuck
 * prompt, and a WORKING console case can momentarily have no serving surface
 * during a hand-off (a drawn-cards reveal dismissing while the hand section
 * mounts, a section switch, a modal swap). Those transitions resolve in well
 * under one tick, so they never accumulate consecutive unserved passes; a truly
 * stranded prompt stays unserved every pass and still surfaces (~1 extra tick
 * later). The player must NEVER see the guard flash for a supported case.
 */
const STRANDED_CONFIRM_TICKS = 2;
/** The prompt key we've been counting unserved passes for + the streak. */
let unservedKey = '';
let unservedStreak = 0;

/** Reset the stranded state + the debounce streak (a served / absent prompt). */
function clearStranded(): void {
  leakDetectorState.stranded = undefined;
  unservedKey = '';
  unservedStreak = 0;
}

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
    clearStranded();
    return;
  }
  // The Government Support scale-focus choreography intentionally shows NO
  // surface for a beat — the panel closes (`closing`, WGT prompt still live)
  // then the board scale animates while the next modal is held (`holding`).
  // Never a stranded prompt during either.
  if (govScaleFocusState.holding || govScaleFocusState.closing) {
    clearStranded();
    return;
  }
  const task: ConsoleTask | undefined = taskFor(view);
  // Only the shell's OWN surfaces need no dedicated host; every task-host
  // kind must actually RENDER `.con-task-host` (checked below) — a host
  // that fails to mount is a stranded prompt, not a success.
  if (task !== undefined && SHELL_NATIVE_KINDS.has(task.kind)) {
    clearStranded();
    return;
  }
  const selectors = [...SERVING_SURFACES, ...(task !== undefined ? KIND_SURFACES[task.kind] ?? [] : [])];
  const served = selectors.some((sel) => {
    const el = document.querySelector(sel);
    return el !== null && (el as HTMLElement).getClientRects().length > 0;
  });
  if (served) {
    clearStranded();
    return;
  }
  // Unserved — but a supported case can transiently have no surface mid-hand-off
  // (reveal→hand section, section switch). DEBOUNCE: only show the guard once
  // the SAME prompt has been unserved for several consecutive passes; a real
  // transition resolves before the next pass, so its streak never builds up.
  const key = `${wf.type}|${inputTitleText(wf.title) ?? ''}`;
  unservedStreak = key === unservedKey ? unservedStreak + 1 : 1;
  unservedKey = key;
  if (unservedStreak < STRANDED_CONFIRM_TICKS) {
    // Not yet confirmed — keep the guard hidden (clear any stale one) and wait.
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
  clearStranded();
  leakDetectorState.desktopSurfaces = [];
}
