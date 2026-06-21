/*
 * Module-level reactive state for the premium END-OF-GAME experience.
 *
 * Mounted at App level (next to DraftFlowOverlay) so it survives the
 * `:key="playerkey"` remount that fires on every server poll — the reveal /
 * results overlay must not tear down or replay when another client polls.
 * Mirrors journalState.ts / startGameFlowState.ts.
 *
 * Flow:
 *   game reaches Phase.END  → beginEndgameReveal()  → reveal cinematic
 *   reveal CTA "View results" → openEndgameResults() → full-screen overlay
 *   overlay "Minimize" / skip  → pill (persistent reopen affordance)
 *   pill click                 → restoreEndgameResults()
 *
 * There is NO destructive close: the game is over, so the results overlay is
 * the main surface. "Minimize" collapses it to a pill so the player can still
 * inspect the board; everything else is navigation away (new game / home).
 */
import {reactive} from 'vue';
import {ViewModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';

export type EndgameTab = 'overview' | 'score' | 'timeline' | 'cards' | 'parameters' | 'players';

export const ENDGAME_TABS: ReadonlyArray<EndgameTab> = ['overview', 'score', 'timeline', 'cards', 'parameters', 'players'];

type EndgameStateShape = {
  // The cinematic reveal has been handled once this page-load (so a poll can't
  // replay it). Reset only by a full page reload — which is the desired
  // "re-enter an ended game → see the reveal once" behaviour.
  revealHandled: boolean;
  // The winner reveal cinematic is currently on screen.
  revealActive: boolean;
  // The full-screen results overlay has been opened at least once.
  resultsOpen: boolean;
  // The results overlay is collapsed to its pill (board inspectable).
  minimized: boolean;
  activeTab: EndgameTab;
};

export const endgameState: EndgameStateShape = reactive({
  revealHandled: false,
  revealActive: false,
  resultsOpen: false,
  minimized: false,
  activeTab: 'overview',
});

// The endgame experience should be on screen for this view.
export function endgameAvailable(view: ViewModel | undefined): boolean {
  return view !== undefined && view.game.phase === Phase.END;
}

// Trigger the reveal once, the first time the game is seen ended this load.
export function beginEndgameReveal(): void {
  if (endgameState.revealHandled) {
    return;
  }
  endgameState.revealHandled = true;
  endgameState.revealActive = true;
}

// Reveal CTA → open the full-screen results overlay.
export function openEndgameResults(): void {
  endgameState.revealActive = false;
  endgameState.resultsOpen = true;
  endgameState.minimized = false;
}

// Reveal "skip" → dismiss the cinematic, leaving the pill as the reopen path.
export function skipEndgameReveal(): void {
  endgameState.revealActive = false;
  endgameState.resultsOpen = true;
  endgameState.minimized = true;
}

// Overlay "Minimize" → collapse to the pill so the board can be inspected.
export function minimizeEndgameResults(): void {
  endgameState.minimized = true;
}

// Pill click → expand the overlay again with the same tab.
export function restoreEndgameResults(): void {
  endgameState.minimized = false;
  endgameState.resultsOpen = true;
  endgameState.revealActive = false;
}

// Results overlay "Replay scoring" → play the cinematic reveal again on demand
// (hidden-VP mode only). Keeps `revealHandled` true so a server poll never
// auto-replays; this is an explicit, user-driven re-run.
export function replayEndgameReveal(): void {
  endgameState.revealActive = true;
  endgameState.resultsOpen = false;
  endgameState.minimized = false;
}

export function setEndgameTab(tab: EndgameTab): void {
  endgameState.activeTab = tab;
}

// Full reset (e.g. when explicitly leaving the experience) — not normally used
// since navigation tears down the whole app, but handy for the playground/tests.
export function resetEndgameState(): void {
  endgameState.revealHandled = false;
  endgameState.revealActive = false;
  endgameState.resultsOpen = false;
  endgameState.minimized = false;
  endgameState.activeTab = 'overview';
}
