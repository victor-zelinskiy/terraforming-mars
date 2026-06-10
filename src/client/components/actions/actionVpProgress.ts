import {CardName} from '@/common/cards/CardName';
import {resourceScoring, accumulatedVp} from '@/client/components/additionalResources/additionalResources';

/**
 * The VP-threshold progress of a card-resource change, for the action
 * confirmation modal's "ПРОГРЕСС ПО" block. Pure (derives from the static
 * manifest + the before/after counts), so it's unit-testable without a DOM.
 *
 *  - `applicable` — only true for a real threshold card (1 VP per N>1 resources);
 *    a flat / non-resource VP card gets no progress UI.
 *  - `filledBefore` / `filledAfter` — count toward the NEXT VP (`count % per`),
 *    EXCEPT that landing exactly on a multiple while EARNING a VP shows the bar
 *    full (`per/per` "reached") rather than an empty `0/per`.
 *  - `beforeVp` / `afterVp` — the card's VP from this resource before / after.
 *  - `crossed` — the action earns at least one VP.
 */
export type VpProgressView = {
  // The card scores VP from this resource → show the VP context at all.
  applicable: boolean;
  // The scoring is a THRESHOLD (1 VP per N>1 resources) → show the progress bar
  // toward the next VP. When false (a per-resource multiplier like Physics
  // Complex's 2 VP each), the bar is meaningless and only the VP delta is shown.
  threshold: boolean;
  per: number;
  filledBefore: number;
  filledAfter: number;
  beforeVp: number;
  afterVp: number;
  crossed: boolean;
};

function mod(value: number, per: number): number {
  return per > 0 ? ((value % per) + per) % per : 0;
}

export function vpProgressView(cardName: CardName, before: number, after: number): VpProgressView {
  const scoring = resourceScoring(cardName);
  const per = scoring?.per ?? 1;
  const beforeVp = accumulatedVp(cardName, before);
  const afterVp = accumulatedVp(cardName, after);
  const crossed = afterVp > beforeVp;
  const afterMod = mod(after, per);
  return {
    // Applicable for ANY resource VP scorer — both thresholds (Tardigrades:
    // 1 VP / 4 microbes) and multipliers (Physics Complex: 2 VP / science).
    applicable: scoring !== undefined,
    threshold: scoring !== undefined && per > 1,
    per,
    filledBefore: mod(before, per),
    filledAfter: (crossed && afterMod === 0) ? per : afterMod,
    beforeVp,
    afterVp,
    crossed,
  };
}
