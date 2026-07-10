/*
 * CARD DEAL MEMORY — module-level "already dealt" registry.
 *
 * The deal cinematic plays ONCE per distinct card set (deal key = owner +
 * prompt identity + card names). Module-level (not component data) so a
 * defer → restore cycle, a playerView re-render, or a scene remount never
 * re-deals a set the player has already seen — stepping BACK through the
 * start wizard is instant, only a genuinely NEW set gets the ceremony.
 *
 * Bounded: the set only grows within one client session and holds short
 * strings; a session sees a few dozen deals at most.
 */

const dealt = new Set<string>();

/**
 * True exactly once per key — marks the key as seen. Marked at LAUNCH (not
 * completion) so a mid-deal defer/restore doesn't replay the cinematic over
 * cards the player already watched arrive.
 */
export function shouldRunDealOnce(key: string): boolean {
  if (dealt.has(key)) {
    return false;
  }
  dealt.add(key);
  return true;
}

/** Test hook / game-switch boundary. */
export function resetCardDealMemory(): void {
  dealt.clear();
}
