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
  committed?: number,
): UnplayableReason {
  if (reason === 'cannot-afford' || reason === 'cannot-afford-bonus') {
    if (deficit !== undefined && deficit > 0) {
      // NAME the money that is already spoken for. A pay-on-commit standard
      // project charges its own price the moment a space is picked, so the gap
      // is otherwise unreadable: the cell's cost row says 16 M€, the bank says
      // 40 M€, and the refusal says «need 1 more» with nothing tying the three
      // numbers together.
      if (committed !== undefined && committed > 0) {
        return {
          type: 'megacredits',
          message: 'Need ${0} more M€ — ${1} M€ goes to the project itself',
          params: [String(deficit), String(committed)],
        };
      }
      return {type: 'megacredits', message: 'Need ${0} more M€', params: [String(deficit)]};
    }
    return {type: 'megacredits', message: PLACEMENT_REASON_LABEL[reason]};
  }
  if (reason === 'unavailable') {
    return {type: 'generic', message: PLACEMENT_REASON_LABEL[reason]};
  }
  return {type: 'placement', message: PLACEMENT_REASON_LABEL[reason]};
}
