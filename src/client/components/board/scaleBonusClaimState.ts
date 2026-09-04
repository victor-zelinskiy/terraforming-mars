import {reactive} from 'vue';

/**
 * Tracks which scale-bonus CLAIMS this client has already seen, so the premium
 * "capture" animation plays exactly ONCE per claim. Chips SEED this ledger
 * silently at mount (hydration of an existing game is board ADOPTION, never a
 * capture — the same first-view contract as the tile/cube/marker baselines)
 * and consume it from their claim-identity watcher, which is the only path
 * that ignites. A module-level store survives component recreation, so a
 * claim can never replay.
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

/** Reset the seen set — the in-session new-game boundary (and tests). */
export function resetScaleBonusClaimsSeen(): void {
  state.seen.clear();
}
