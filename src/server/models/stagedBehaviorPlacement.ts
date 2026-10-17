import {CanAffordOptions, IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {Behavior} from '../behavior/Behavior';
import {TileType} from '../../common/TileType';
import {ActionPreviewStep, StagedPlacementModel} from '../../common/models/ActionPreviewModel';
import {stagedMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {message} from '../logs/MessageBuilder';

/**
 * THE STAGED PAYLOAD OF A DECLARED TILE (docs/TILE_PLAY_STAGED_COMMIT.md) — ONE
 * derivation for both doors of a declaration: a card's PLAY (`cardPlayPreview`
 * — D1, the unpaid card's price folded into the legal set through
 * `canAffordOptions`) and a blue card's ACTION (`actionPreview` — D5, no price
 * to fold: an action's own cost is spent before its placement resolves, and
 * the live `SelectSpace` reads the live bank). The board data of the
 * behavior's FIRST Mars placement, mirroring `Executor.execute`'s placement
 * block (the fixed ocean → city → greenery → tile order and the exact
 * `Place*Tile` args) — guarded by `tests/boards/stagedPlacementParity.spec.ts`.
 * `undefined` when the live path raises no placement prompt (oceans maxed, a
 * fixed off-grid city, no legal cell) or cannot honestly end on it (a
 * colony-coupled behavior — the colony prompt comes FIRST at runtime). Read-only.
 */
export function stagedPlacementForBehavior(
  player: IPlayer,
  card: ICard,
  behavior: Behavior,
  canAffordOptions?: CanAffordOptions,
): StagedPlacementModel | undefined {
  if (behavior.colonies?.buildColony !== undefined) {
    return undefined;
  }
  if (behavior.ocean !== undefined) {
    if (!player.game.canAddOcean()) {
      return undefined;
    }
    // `count: 2` defers two independent PlaceOceanTile prompts; the staged cell
    // answers the FIRST (D2 — the first cell is the commit boundary). Titles
    // mirror PlaceOceanTile / Executor exactly.
    const on = behavior.ocean.count === 2 ? 'ocean' : (behavior.ocean.on ?? 'ocean');
    return stagedMarsSelectSpace(player, {
      title: behavior.ocean.count === 2 ? 'Select space for first ocean' :
        (on === 'land' ? 'Select a land space to place an ocean tile' : 'Select space for ocean tile'),
      on,
      tileType: TileType.OCEAN,
      sourceCard: card.name,
      canAffordOptions,
      // The dossier's PLAN line during the staged first pick — mirror of the
      // live first-ocean prompt's own marker (Executor's two-ocean defer).
      followUpPlacements: behavior.ocean.count === 2 ? [{tileType: TileType.OCEAN}] : undefined,
    });
  }
  if (behavior.city !== undefined && behavior.city.space === undefined) {
    const on = behavior.city.on ?? 'city';
    return stagedMarsSelectSpace(player, {
      title: on === 'isolated' ? 'Select place next to no other tile for city' : 'Select space for city tile',
      on,
      tileType: TileType.CITY,
      sourceCard: card.name,
      canAffordOptions,
    });
  }
  if (behavior.greenery !== undefined) {
    const on = behavior.greenery.on ?? 'greenery';
    return stagedMarsSelectSpace(player, {
      title: on === 'ocean' ? 'Select space reserved for ocean to place greenery tile' : 'Select space for greenery tile',
      on,
      tileType: TileType.GREENERY,
      sourceCard: card.name,
      redCityFilter: true,
      canAffordOptions,
    });
  }
  if (behavior.tile !== undefined) {
    return stagedMarsSelectSpace(player, {
      title: behavior.tile.title ?? message('Select space for ${0} tile', (b) => b.cardName(card.name)),
      on: behavior.tile.on,
      tileType: behavior.tile.type,
      sourceCard: card.name,
      canAffordOptions,
    });
  }
  return undefined;
}

/** `steps` with `staged` attached to the FIRST Mars `boardPlacement` step (a colony step is never staged). */
export function attachStagedPlacement(
  steps: ReadonlyArray<ActionPreviewStep>,
  staged: StagedPlacementModel | undefined,
): ReadonlyArray<ActionPreviewStep> {
  if (staged === undefined) {
    return steps;
  }
  let attached = false;
  return steps.map((step) => {
    if (!attached && step.kind === 'boardPlacement' && step.placementType !== 'colony') {
      attached = true;
      return {...step, staged};
    }
    return step;
  });
}
