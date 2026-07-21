/*
 * "Private score" — a LOCAL-ONLY display preference (NOT a game option).
 *
 * Hides the VIEWER'S OWN victory points on PASSIVE surfaces of the main screen
 * (the console score cap / the desktop VP button + player-panel VP chip) so a
 * person sitting next to the player at the same physical screen can't glance
 * the running score. It does NOT touch the VP overlay itself, the final reveal,
 * the end-game screen, server data or scoring — the player can always open the
 * overlay to see their own score.
 *
 * PER-GAME persistence: the choice is scoped to THIS game (keyed by the viewer's
 * participant id, `playerView.id`), so each партия remembers its own setting and
 * turning it on in one game never leaks into the next. `bindPrivateScoreGame`
 * (called from App's central playerView watch) loads the bound game's stored
 * value into the reactive flag whenever the active game changes, and resets to
 * OFF when no game is active (the main menu). Only games where the player turned
 * it ON leave a localStorage entry (disabled clears its key), so the store stays
 * bounded. `privateScoreState` stays a module-level reactive singleton (survives
 * the PlayerHome `:key` remount, like journalState) that every masking surface
 * reads synchronously.
 *
 * Distinct from the game-level "hide VP until final scoring"
 * (`gameOptions.showOtherPlayersVP`) — that hides OTHER players' VP by the rules
 * of the match; THIS hides only MY OWN VP, only on my screen.
 */
import {reactive} from 'vue';

/** localStorage key prefix; the bound game's participant id is appended. */
const KEY_PREFIX = 'tm.privateScoreDisplay.';

/** The game (viewer participant id) the flag is currently bound to, if any. */
let currentGameKey: string | undefined;

export const privateScoreState = reactive({enabled: false});

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function storageKey(gameKey: string): string {
  return KEY_PREFIX + gameKey;
}

function loadFor(gameKey: string): boolean {
  if (!storageAvailable()) {
    return false;
  }
  try {
    return localStorage.getItem(storageKey(gameKey)) === '1';
  } catch (_e) {
    return false;
  }
}

/**
 * Bind the flag to a game (the viewer's participant id) and load that game's
 * stored value; `undefined` (no game / main menu) unbinds and resets to OFF.
 * Idempotent — a repeat with the same key is a no-op, so it is safe to call from
 * a watch that fires on every playerView commit. Structural sharing keeps the
 * id stable for the whole game, so a real game switch is the only re-load.
 */
export function bindPrivateScoreGame(gameKey: string | undefined): void {
  if (gameKey === currentGameKey) {
    return;
  }
  currentGameKey = gameKey;
  privateScoreState.enabled = gameKey !== undefined ? loadFor(gameKey) : false;
}

export function setPrivateScore(enabled: boolean): void {
  privateScoreState.enabled = enabled;
  // Persist ONLY against the bound game (a toggle only ever appears in-game, so
  // a game is bound whenever this is called). No game bound → session-only.
  if (currentGameKey === undefined || !storageAvailable()) {
    return;
  }
  try {
    if (enabled) {
      localStorage.setItem(storageKey(currentGameKey), '1');
    } else {
      // Only ON games leave an entry — keeps the per-game store bounded.
      localStorage.removeItem(storageKey(currentGameKey));
    }
  } catch (_e) {
    // localStorage write may throw (private mode / quota) — the in-memory
    // reactive value still works for this session.
  }
}

export function togglePrivateScore(): void {
  setPrivateScore(!privateScoreState.enabled);
}

/**
 * Whether to mask a VP value on a PASSIVE surface. True only when the private
 * toggle is on AND the value belongs to the viewer themselves (`isOwn`).
 * Opponents' VP (and overlay/reveal/endgame VP) are never masked by this.
 */
export function shouldMaskOwnPassiveVp(isOwn: boolean): boolean {
  return privateScoreState.enabled && isOwn === true;
}
