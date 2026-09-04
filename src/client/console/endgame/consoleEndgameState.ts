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
 *
 * COLLAPSE CONTRACT (B = «Свернуть», the post-game board inspection):
 *  · `collapsed` hides the scene (v-show — the workspace stays MOUNTED, its
 *    frame stays in the stack) and shows the final board + HUD behind it.
 *  · A collapse DURING the ceremony pauses the director's timeline; the
 *    return resumes it from the same beat — never a restart, never a skip.
 *  · While collapsed the ceremony's animation hold releases (the player is
 *    deliberately elsewhere; a hidden scene may not hold the foreground).
 */
import {reactive} from 'vue';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {resetConsoleOverview} from '@/client/console/endgame/consoleOverviewState';

/**
 * The ceremony state machine. `executing`-style transient beats are timeline
 * territory; these are the OBSERVABLE stages the template renders.
 *
 *   idle → entering → scoring → settling → ranking → [tiebreak] → winner →
 *   [champion] → actions
 *
 * `champion` exists ONLY on a campaign's final mission (vm.campaignFinale):
 * the mandatory champion ceremony — the workspace publishes no commands and
 * absorbs every press for its ~5s, so it can never be skipped, collapsed or
 * broken by mashing (the animation-hold supplier already covers it as a
 * pre-`actions` stage). `actions` is the SETTLED terminal state — fully
 * interactive, restored on re-entry, reached instantly by skip/reload.
 */
export type CeremonyPhase =
  | 'idle'
  | 'entering'
  | 'scoring'
  | 'settling'
  | 'ranking'
  | 'tiebreak'
  | 'winner'
  | 'champion'
  | 'actions';

/** Where inside the champion beat the ceremony stands (0 while the fixed
 *  result holds still; each step is a MEANING — see consoleEndgameScript). */
export type ChampionStage = 0 | 1 | 2 | 3 | 4;

/** The inner stage of the active category's four-part phrase. */
export type CeremonyBeatStage = '' | 'focus' | 'grow' | 'settle';

type ChipState = {value: number, seq: number};

export const consoleEndgameUi = reactive({
  phase: 'idle' as CeremonyPhase,

  /** Active category index into `vm.categories` (-1 = none). */
  catIdx: -1,
  /** Active sub-step inside the active category (-1 = whole-category beat). */
  subIdx: -1,
  /** Where inside the four-part category phrase the beat is right now. */
  beatStage: '' as CeremonyBeatStage,
  /** Categories fully SETTLED (value label visible, segment locked). */
  catsSettled: 0,
  /** Per-category count of revealed sub-segments (multi-sub categories). */
  subsOn: {} as Record<string, number>,
  /** Per-category «seams faded, reads as one segment again» flag. */
  merged: {} as Record<string, boolean>,

  /**
   * color → the running total at the LAST SETTLED boundary. Written per beat,
   * never per frame — the live count-up goes through the component's direct
   * DOM sink (`onCount`), so a reactive write can't re-lay the row 60×/s.
   */
  displayTotals: {} as Record<string, number>,
  /** color → the floating «+N» chip at the bar's growth edge. */
  chips: {} as Record<string, ChipState | undefined>,

  /** Rows are displayed in FINAL RANKED order (the FLIP has happened). */
  ranked: false,
  placesShown: false,
  /** Tie-break stage: 0 announce · 1 values · 2 resolved. */
  tieStage: 0,
  winnerShown: false,
  /** Champion beat stage: 0 pause · 1 seal (header) · 2 sweep (row frame) ·
   *  3 plate («ЧЕМПИОН КАМПАНИИ» + mission pips) · 4 fix (the VP accent). */
  championStage: 0 as ChampionStage,
  /** TERMINAL campaign-final fact: the settled screen keeps the champion
   *  state («Кампания завершена» header, the champion plate) — set by the
   *  natural ending, skip AND reload alike (finalizeCeremony). */
  championShown: false,
  actionsOn: false,

  /** Post-game action list focus (survives the overlay round-trip). */
  actionsFocus: 0,

  /** B = «Свернуть»: the scene is hidden, the final board is on show. */
  collapsed: false,

  /** Bumped on every atomic jump (skip / reload-settle) — the template
   *  suppresses CSS TRANSITIONS for the jump frame (never animations: a
   *  re-enabled keyframe animation RESTARTS, which is exactly the final
   *  flash this workspace once shipped). */
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
  s.beatStage = '';
  s.catsSettled = 0;
  s.subsOn = {};
  s.merged = {};
  s.displayTotals = {};
  s.chips = {};
  s.ranked = false;
  s.placesShown = false;
  s.tieStage = 0;
  s.winnerShown = false;
  s.championStage = 0;
  s.championShown = false;
  s.actionsOn = false;
  s.actionsFocus = 0;
}

/** Full reset — the endgame workspace closed (phase left END / new game). */
export function resetConsoleEndgame(): void {
  resetCeremonyProgress();
  consoleEndgameUi.ceremonyPlayed = false;
  consoleEndgameUi.sawLivePhase = false;
  consoleEndgameUi.collapsed = false;
  // The overview scene belongs to this workspace — its tab/focus/reveal
  // memory dies with the party (the next game is a fresh story).
  resetConsoleOverview();
}

/**
 * ATOMIC FINALIZATION — skip, reload-into-END, and the natural end of the
 * timeline all land HERE, so «the correct final state» exists exactly once.
 * Idempotent; safe to call from any phase. `collapsed` is deliberately
 * untouched: finalizing behind a collapsed scene must not yank the player
 * off the board they chose to inspect.
 */
export function finalizeCeremony(vm: ConsoleEndgameVm): void {
  const s = consoleEndgameUi;
  s.skipSeq++;
  s.phase = 'actions';
  s.catIdx = -1;
  s.subIdx = -1;
  s.beatStage = '';
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
  // The campaign finale's terminal state exists exactly once too: the header
  // stays «Кампания завершена», the plate stays «Чемпион кампании» — for the
  // natural ending, the scoring skip and a reload into the ended game alike.
  s.championStage = vm.campaignFinale !== undefined ? 4 : 0;
  s.championShown = vm.campaignFinale !== undefined;
  s.actionsOn = true;
  s.actionsFocus = 0;
  s.ceremonyPlayed = true;
}

// The ceremony is a first-class foreground occupant: while it runs,
// notifications queue and nothing may stand over the count. The predicate
// reads VUE-REACTIVE state (a plain module `let` would kill the registry).
// `actions` is interactive (not a hold); `idle` is nothing; a COLLAPSED
// scene is hidden by the player's own hand and may not hold the foreground.
registerAnimationHoldSupplier('endgame-ceremony', () => {
  const p = consoleEndgameUi.phase;
  return p !== 'idle' && p !== 'actions' && !consoleEndgameUi.collapsed;
});
