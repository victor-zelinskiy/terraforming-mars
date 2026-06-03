import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {PLACEMENT_REASON_LABEL, PlacementIllegalReason} from '@/common/inputs/PlacementIllegalReason';

/**
 * Bridges the board's per-cell `PlacementIllegalReason` (+ optional M€
 * `deficit` from the server) into the SAME `UnplayableReason` shape the hand
 * overlay uses — so the placement popover and the card popover are literally
 * one rendering path / one visual system.
 *
 * Accent mapping mirrors the hand popover's palette: affordability → gold
 * (`megacredits`, shown as "Need X more M€" when the server sent a deficit,
 * else the generic afford label), the catch-all `unavailable` → grey
 * (`generic`), every concrete placement rule → orange (`placement`).
 */
export function placementReasonToUnplayable(
  reason: PlacementIllegalReason,
  deficit?: number,
): UnplayableReason {
  if (reason === 'cannot-afford' || reason === 'cannot-afford-bonus') {
    if (deficit !== undefined && deficit > 0) {
      return {type: 'megacredits', message: 'Need ${0} more M€', params: [String(deficit)]};
    }
    return {type: 'megacredits', message: PLACEMENT_REASON_LABEL[reason]};
  }
  if (reason === 'unavailable') {
    return {type: 'generic', message: PLACEMENT_REASON_LABEL[reason]};
  }
  return {type: 'placement', message: PLACEMENT_REASON_LABEL[reason]};
}
