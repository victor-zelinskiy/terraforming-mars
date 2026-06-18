import {reactive} from 'vue';

/**
 * Tracks which scale-bonus CLAIMS this client has already seen, so the premium
 * "capture" animation plays exactly ONCE per claim — even though the board
 * (inside PlayerHome) remounts on every server response. A module-level store
 * survives that remount, so a node only animates the first time its claim is
 * observed; thereafter it renders the static claimed state.
 */
const state = reactive({seen: new Set<string>()});

/**
 * Returns true the FIRST time a given claim identity is observed (and records
 * it); false afterwards. The identity includes the owner so a re-claim (should
 * it ever happen) animates again.
 */
export function consumeNewScaleBonusClaim(identity: string): boolean {
  if (state.seen.has(identity)) {
    return false;
  }
  state.seen.add(identity);
  return true;
}

/** Test helper — reset the seen set. */
export function resetScaleBonusClaimsSeen(): void {
  state.seen.clear();
}
