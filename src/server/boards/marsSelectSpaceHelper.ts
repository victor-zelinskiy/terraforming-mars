import {IPlayer} from '../IPlayer';
import {Message} from '../../common/logs/Message';
import {Space} from './Space';
import {SelectSpace} from '../inputs/SelectSpace';
import {PlacementType} from './PlacementType';
import {TileType} from '../../common/TileType';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';
import {PlacementContext} from '../../common/models/PlayerInputModel';
import {CardName} from '../../common/cards/CardName';
import {committedPlacement} from '../inputs/placementContext';
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
    /**
     * The TileType being placed. Lets the premium preview show a composite
     * over-ocean tile's identity-based city VP (Ocean City / New Holland count
     * as a city; Ocean Farm / Ocean Sanctuary do not — the placement type alone
     * can't tell them apart). Optional; absent → kind-derived scoring.
     */
    tileType?: TileType,
    /**
     * The card driving this placement. Threaded to the client so the placement
     * preview can ask the CARD what it will do on the hovered cell — a
     * space-dependent consequence (Solar Farm's energy production per plant
     * bonus, Mining Area's steel-or-titanium production) that the generic cell
     * explainer cannot derive from the cell + tile alone. Also fills the
     * `placementContext.source`, so the console task summary can name the card.
     */
    sourceCard?: CardName,
    /**
     * Whether this placement can be cancelled before it commits (drives the
     * PlacementBanner's cancel UI). DEFAULTS to a COMMITTED marker: by the time a
     * placement reached through this helper is shown, the action that triggered it
     * (a played card / a paid standard project) has already run, so the player
     * can't take it back without undo. A flow that genuinely hasn't committed yet
     * (the standard-project pay-on-commit refactor) passes `cancellablePlacement`.
     */
    placementContext?: PlacementContext,
    /** Cancel handler for a cancellable placement (see SelectSpace.onCancel). */
    onCancel?: () => void,
  },
): SelectSpace {
  const illegalSpaces = player.game.board.computeIllegalReasons(
    player,
    options?.placementType,
    legalSpaces,
    {customReasoner: options?.customReasoner});
  const selectSpace = new SelectSpace(title, legalSpaces, illegalSpaces);
  selectSpace.placementType = options?.placementType;
  selectSpace.tileType = options?.tileType;
  selectSpace.sourceCard = options?.sourceCard;
  // The default committed marker also NAMES the card when we know it — the
  // console task summary already reads `placementContext.source.card` and had
  // nothing to read for card placements until now.
  selectSpace.placementContext = options?.placementContext ??
    committedPlacement(
      'This placement is part of an action already underway and cannot be cancelled.',
      options?.sourceCard === undefined ? undefined : {kind: 'card', card: options.sourceCard});
  selectSpace.onCancel = options?.onCancel;
  if (options?.hideExistingTile === true) {
    selectSpace.hiddenTiles = legalSpaces.map(toID);
  }
  return selectSpace;
}
