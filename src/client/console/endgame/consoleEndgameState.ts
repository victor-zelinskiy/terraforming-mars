/*
 * CONSOLE FINAL SCORING — the module-reactive ceremony state.
 *
 * One writer (the director / the component's own handlers), many readers
 * (the workspace template, the shell's command bar, the animation-hold
 * registry). Module-level so it survives the overlay round-trip («Обзор
 * партии» hides the workspace with v-show) and any playerkey epoch.
 *
 * RE-ENTRY CONTRACT (the ceremony must never replay uninvited):
 *  · `sawLivePhase` — this page load actually WATCHED the game before it
 *    ended (any non-END phase was observed). Only then does Phase.END mean
 *    «the game just finished in front of the player».
 *  · `ceremonyPlayed` — the ceremony ran once this load.
 *  · A reload straight into an ended game (`sawLivePhase === false`) lands on
 *    the SETTLED final state; watching the count again is an explicit action
 *    («Повторить подсчёт»), never a side effect of re-opening the page.
 */
import {reactive} from 'vue';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';

/**
 * The ceremony state machine. `executing`-style transient beats are timeline
 * territory; these are the OBSERVABLE stages the template renders.
 *
 *   idle → entering → scoring → settling → ranking → [tiebreak] → winner → actions
 *
 * `actions` is the SETTLED terminal state — fully interactive, restored on
 * re-entry, reached instantly by skip/reload.
 */
export type CeremonyPhase =
  | 'idle'
  | 'entering'
  | 'scoring'
  | 'settling'
  | 'ranking'
  | 'tiebreak'
  | 'winner'
  | 'actions';

type ChipState = {value: number, seq: number};

export const consoleEndgameUi = reactive({
  phase: 'idle' as CeremonyPhase,

  /** Active category index into `vm.categories` (-1 = none). */
  catIdx: -1,
  /** Active sub-step inside the active category (-1 = whole-category beat). */
  subIdx: -1,
  /** Categories fully SETTLED (value strip entries visible, segment locked). */
  catsSettled: 0,
  /** Per-category count of revealed sub-segments (multi-sub categories). */
  subsOn: {} as Record<string, number>,
  /** Per-category «seams faded, reads as one segment again» flag. */
  merged: {} as Record<string, boolean>,

  /** color → the running total the count-up currently shows. */
  displayTotals: {} as Record<string, number>,
  /** color → the floating «+N» chip at the bar's growth edge. */
  chips: {} as Record<string, ChipState | undefined>,

  /** Rows are displayed in FINAL RANKED order (the FLIP has happened). */
  ranked: false,
  placesShown: false,
  /** Tie-break stage: 0 announce · 1 values · 2 resolved. */
  tieStage: 0,
  winnerShown: false,
  actionsOn: false,

  /** Post-game action list focus (survives the overlay round-trip). */
  actionsFocus: 0,

  /** Bumped on every atomic jump (skip / reload-settle) — the template
   *  suppresses CSS transitions for the jump frame. */
  skipSeq: 0,

  /** This page load observed a LIVE (non-END) phase — see header. */
  sawLivePhase: false,
  /** The ceremony ran once this page load. */
  ceremonyPlayed: false,
});

/** The shell's phase watcher feeds this on every non-END phase. */
export function noteConsoleEndgameLivePhase(): void {
  consoleEndgameUi.sawLivePhase = true;
}

/** Should entering the endgame workspace PLAY the ceremony (vs land settled)? */
export function ceremonyShouldPlay(): boolean {
  return consoleEndgameUi.sawLivePhase && !consoleEndgameUi.ceremonyPlayed;
}

/** Reset for a fresh ceremony run (first play and every explicit replay). */
export function resetCeremonyProgress(): void {
  const s = consoleEndgameUi;
  s.phase = 'idle';
  s.catIdx = -1;
  s.subIdx = -1;
  s.catsSettled = 0;
  s.subsOn = {};
  s.merged = {};
  s.displayTotals = {};
  s.chips = {};
  s.ranked = false;
  s.placesShown = false;
  s.tieStage = 0;
  s.winnerShown = false;
  s.actionsOn = false;
}

/** Full reset — the endgame workspace closed (phase left END / new game). */
export function resetConsoleEndgame(): void {
  resetCeremonyProgress();
  consoleEndgameUi.actionsFocus = 0;
  consoleEndgameUi.ceremonyPlayed = false;
  consoleEndgameUi.sawLivePhase = false;
}

/**
 * ATOMIC FINALIZATION — skip, reload-into-END, and the natural end of the
 * timeline all land HERE, so «the correct final state» exists exactly once.
 * Idempotent; safe to call from any phase.
 */
export function finalizeCeremony(vm: ConsoleEndgameVm): void {
  const s = consoleEndgameUi;
  s.skipSeq++;
  s.phase = 'actions';
  s.catIdx = -1;
  s.subIdx = -1;
  s.catsSettled = vm.categories.length;
  const subsOn: Record<string, number> = {};
  const merged: Record<string, boolean> = {};
  for (const cat of vm.categories) {
    subsOn[cat.key] = cat.subs.length;
    merged[cat.key] = true;
  }
  s.subsOn = subsOn;
  s.merged = merged;
  const totals: Record<string, number> = {};
  for (const row of vm.rows) {
    totals[row.color] = row.finalTotal;
  }
  s.displayTotals = totals;
  s.chips = {};
  s.ranked = true;
  s.placesShown = true;
  s.tieStage = vm.tieBreak !== undefined ? 2 : 0;
  s.winnerShown = true;
  s.actionsOn = true;
  s.ceremonyPlayed = true;
}

// The ceremony is a first-class foreground occupant: while it runs,
// notifications queue and nothing may stand over the count. The predicate
// reads VUE-REACTIVE state (a plain module `let` would kill the registry).
// `actions` is interactive (not a hold); `idle` is nothing.
registerAnimationHoldSupplier('endgame-ceremony', () => {
  const p = consoleEndgameUi.phase;
  return p !== 'idle' && p !== 'actions';
});
