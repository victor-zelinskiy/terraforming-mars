/*
 * "Private score" — a LOCAL-ONLY display preference (NOT a game option).
 *
 * Hides the VIEWER'S OWN victory points on PASSIVE surfaces of the main screen
 * (the Victory Points bottom-bar button, the player-panel VP chip, compact VP
 * indicators) so a person sitting next to the player at the same physical
 * screen can't glance the running score. It does NOT touch the VP overlay
 * itself, the final reveal, the end-game screen, server data or scoring — the
 * player can always open the overlay to see their own score.
 *
 * Module-level reactive (survives the PlayerHome `:key` remount, like
 * journalState) AND persisted per-browser to localStorage so a refresh keeps
 * the choice. Distinct from the game-level "hide VP until final scoring"
 * (`gameOptions.showOtherPlayersVP`) — that hides OTHER players' VP by the
 * rules of the match; THIS hides only MY OWN VP, only on my screen.
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm.privateScoreDisplay.enabled';

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function load(): boolean {
  if (!storageAvailable()) {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch (_e) {
    return false;
  }
}

export const privateScoreState = reactive({enabled: load()});

export function setPrivateScore(enabled: boolean): void {
  privateScoreState.enabled = enabled;
  if (storageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch (_e) {
      // localStorage write may throw (private mode / quota) — the in-memory
      // reactive value still works for this session.
    }
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
