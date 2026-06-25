import {PlacementContext, ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {Message} from '../../common/logs/Message';

/**
 * Factory helpers for the OPTIONAL {@link PlacementContext} attached to a
 * tile-placement `SelectSpace` (see `BasePlayerInput.markPlacementContext`).
 * They keep the deferred placement actions terse + co-located: the action
 * declares whether the placement can be taken back before it commits.
 *
 * - `cancellablePlacement` — nothing has been committed server-side yet (the
 *   player is constructing the response; the client can abandon it). The
 *   PlacementBanner shows "Отменить размещение".
 * - `committedPlacement` — payment / effects already applied; the placement is
 *   mandatory. The banner shows the honest `reason` instead of a cancel button.
 *
 * `reason` is an English i18n key (translated client-side).
 */
export function cancellablePlacement(source?: ChoiceContextSource): PlacementContext {
  return {cancellable: true, source};
}

export function committedPlacement(reason: string | Message, source?: ChoiceContextSource): PlacementContext {
  return {cancellable: false, reason, source};
}
