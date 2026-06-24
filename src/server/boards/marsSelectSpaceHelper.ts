import {IPlayer} from '../IPlayer';
import {Message} from '../../common/logs/Message';
import {Space} from './Space';
import {SelectSpace} from '../inputs/SelectSpace';
import {PlacementType} from './PlacementType';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';
import {toID} from '../../common/utils/utils';

/**
 * Construct a SelectSpace for a Mars-board placement with `illegalSpaces`
 * auto-computed via `MarsBoard.computeIllegalReasons(...)`. The resulting
 * model lets the client render native browser tooltips ("why is this
 * cell unavailable?") + a `cursor: not-allowed` cue on every dimmed
 * cell during placement.
 *
 * USAGE — basic (covers ~half the cards):
 *   return createMarsSelectSpace(player, title, spaces, {placementType: 'greenery'});
 *
 * USAGE — with card-specific reasons:
 *   return createMarsSelectSpace(player, title, spaces, {
 *     placementType: 'land',
 *     customReasoner: (space) => {
 *       if (space.tile !== undefined) return undefined; // generic 'occupied'
 *       if (countAdjacentCities(space) > 1) return 'too-many-adjacent-cities';
 *       return undefined;
 *     },
 *   });
 *
 * The customReasoner is per-cell and runs BEFORE the generic pipeline.
 * Return undefined to fall through (let generic pick reason); return a
 * specific enum value to override. Use undefined for cells where a more
 * basic reason ('occupied', 'reserved-noctis', etc.) should win.
 *
 * When to NOT use this helper:
 * - Moon board placements (`MoonBoard`, separate file) — different board
 *   type, this helper assumes `player.game.board` is MarsBoard.
 * - SelectSpace prompts whose semantics don't map to Mars cells at all
 *   (e.g. DesperateMeasures selects an already-occupied hazard to
 *   protect — the generic 'occupied' reason would be wrong there).
 *
 * `hideExistingTile`: set true for a "remove your tile, then place a new one
 * on the same cell" card (KaguyaTech). It marks EVERY legal target so the
 * client hides the doomed tile graphic and shows the placement bonus instead.
 * Leave false (default) for an overlay / pick-a-tile placement, where the
 * existing tile must stay visible.
 */
export function createMarsSelectSpace(
  player: IPlayer,
  title: string | Message,
  legalSpaces: ReadonlyArray<Space>,
  options?: {
    placementType?: PlacementType,
    customReasoner?: (space: Space) => PlacementIllegalReason | undefined,
    hideExistingTile?: boolean,
  },
): SelectSpace {
  const illegalSpaces = player.game.board.computeIllegalReasons(
    player,
    options?.placementType,
    legalSpaces,
    {customReasoner: options?.customReasoner});
  const selectSpace = new SelectSpace(title, legalSpaces, illegalSpaces);
  if (options?.hideExistingTile === true) {
    selectSpace.hiddenTiles = legalSpaces.map(toID);
  }
  return selectSpace;
}
