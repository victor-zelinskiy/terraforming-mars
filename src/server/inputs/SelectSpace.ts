import {Message} from '../../common/logs/Message';
import {Space} from '../boards/Space';
import {InputResponse, isCancelResponse, isSelectSpaceResponse} from '../../common/inputs/InputResponse';
import {PlacementEffect, SelectSpaceModel} from '../../common/models/PlayerInputModel';
import {BasePlayerInput} from '../PlayerInput';
import {InputError} from './InputError';
import {toID} from '../../common/utils/utils';
import {PlacementIllegalSpace} from '../../common/inputs/PlacementIllegalReason';
import {SpaceId} from '../../common/Types';
import {PlacementType} from '../boards/PlacementType';
import {TileType} from '../../common/TileType';
import {CardName} from '../../common/cards/CardName';

export class SelectSpace extends BasePlayerInput<Space> {
  /**
   * Per-cell illegality reasons for cells NOT in `spaces` (the legal
   * targets). Optional — callers that don't compute these get the
   * default "no tooltip" UX on the client.
   *
   * The main board-placement deferred actions
   * (`PlaceTile` / `PlaceCityTile` / `PlaceOceanTile` / `PlaceGreeneryTile`)
   * fill this via `MarsBoard.computeIllegalReasons()`; smaller custom
   * SelectSpace paths (LandClaim, Eris, Mining, Moon, …) can stay
   * silent without breaking anything.
   */
  public illegalSpaces?: ReadonlyArray<PlacementIllegalSpace>;

  /**
   * Target spaces whose CURRENT tile will be REMOVED before the new tile is
   * placed on the same cell (KaguyaTech, LunarMineUrbanization — the "remove
   * your X, place a Y there regardless of placement rules" cards). The client
   * hides the doomed tile graphic and shows the placement bonus instead, so
   * the player reads what they GAIN rather than a tile that's about to vanish.
   *
   * Leave undefined for an OVERLAY placement (St. Joseph's cathedral over a
   * city) or any "pick an existing tile" prompt — there the base tile must
   * stay visible. Set via `createMarsSelectSpace({hideExistingTile: true})`
   * or assigned directly.
   */
  public hiddenTiles?: ReadonlyArray<SpaceId>;

  /**
   * The kind of placement this prompt represents (city / greenery / ocean / …).
   * Set by `createMarsSelectSpace`. Lets the client fetch a kind-accurate
   * {@link BoardPlacementPreview} (cost / gains / endgame VP / who-gets-what) for
   * the hovered cell. Absent on custom SelectSpace paths → the client falls back
   * to the kind-less cell info.
   */
  public placementType?: PlacementType;

  /**
   * The TileType being placed, when known. Lets the client preview show a
   * composite over-ocean tile's identity-based scoring (Ocean City / New Holland
   * count as a CITY → "+VP per adjacent greenery"; Ocean Farm / Ocean Sanctuary
   * do not). The placement `placementType` alone can't tell them apart (they
   * share `upgradeable-ocean`). Absent → the preview uses the kind-derived
   * scoring. Set by `createMarsSelectSpace({tileType})` (PlaceTile threads it
   * from `behavior.tile.type`).
   */
  public tileType?: TileType;

  /**
   * The card this placement belongs to, when there is one. It is the KEY that
   * lets the placement preview ask the card what it will do on the cell the
   * player is hovering — a card's own space-dependent consequence (Solar Farm's
   * energy production per plant bonus, Mining Area's steel-or-titanium
   * production) is invisible to the generic board explainer, which only knows
   * the cell and the tile.
   *
   * Set by `createMarsSelectSpace({sourceCard})`; `PlaceTile` threads it from
   * `tile.card` automatically, so a card that already records itself on the tile
   * needs no change. Absent → the preview shows only the generic cell facts.
   */
  public sourceCard?: CardName;

  /**
   * What choosing a cell here actually DOES. Defaults to `'tile'` — a normal
   * placement. The two marker shapes exist because the board has prompts that
   * pick a cell WITHOUT placing a tile:
   *   - `'bonus-only'` — Mars Nomads moving its camp: the destination's
   *     placement bonuses are granted, but no tile lands, so no Ares adjacency,
   *     no endgame VP, no milestone/award tile count and no "when a tile is
   *     placed" trigger fires (the tabletop ruling this card documents:
   *     "Mining Guild and Philares cannot take advantage of it").
   *   - `'marker'` — Land Claim / Arcadian Communities / a St. Joseph cathedral:
   *     nothing at all is granted, the cell is merely claimed or marked.
   * The preview reads it so it can never promise a bonus the commit suppresses.
   */
  public placementEffect?: PlacementEffect;

  /**
   * Optional cancel handler for a CANCELLABLE placement (see `placementContext`).
   * When the client submits a `CancelResponse` AND this prompt is cancellable,
   * `process` invokes this instead of placing — the pay-on-commit standard
   * projects set it to flag the action as cancelled (no cost applied, the player
   * returns to the action menu). Absent → a cancel response is rejected.
   */
  public onCancel?: () => void;

  constructor(
    title: string | Message,
    public spaces: ReadonlyArray<Space>,
    illegalSpaces?: ReadonlyArray<PlacementIllegalSpace>) {
    super('space', title);
    if (spaces.length === 0) {
      throw new InputError('No available spaces');
    }
    this.illegalSpaces = illegalSpaces;
  }

  public override toModel(): SelectSpaceModel {
    const model: SelectSpaceModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'space',
      spaces: this.spaces.map(toID),
      illegalSpaces: this.illegalSpaces,
      hiddenTiles: this.hiddenTiles,
      placementType: this.placementType,
      tileType: this.tileType,
      sourceCard: this.sourceCard,
      placementEffect: this.placementEffect,
    };
    // The PLACEMENT marker is serialized HERE, not only in
    // `ServerModel.getWaitingFor`. That function decorates the TOP-LEVEL prompt
    // alone, and a placement is very often NESTED: converting plants is one
    // branch of the action-menu `OrOptions`, and so is a task's own space
    // option (the World Government ocean). Serialized centrally, those branches
    // reached the client stripped of their marker — so the board's context
    // panel could not name what was placing the tile, and its cancellability
    // had to be guessed client-side. Riding the input's own `toModel` makes it
    // survive ANY depth. Exactly the trap `discardPrompt` already paid for —
    // see `SelectCard.toModel`.
    if (this.placementContext !== undefined) {
      model.placementContext = this.placementContext;
    }
    return model;
  }

  public process(input: InputResponse) {
    // Cancel a pending, not-yet-committed placement (pay-on-commit standard
    // projects). Only honoured when the placement declared itself cancellable
    // AND supplied a cancel handler; otherwise the placement is mandatory.
    if (isCancelResponse(input)) {
      if (this.placementContext?.cancellable === true && this.onCancel !== undefined) {
        this.onCancel();
        return undefined;
      }
      throw new InputError('This placement cannot be cancelled');
    }
    if (!isSelectSpaceResponse(input)) {
      throw new InputError('Not a valid SelectSpaceResponse');
    }
    const space = this.spaces.find((space) => space.id === input.spaceId);
    if (space === undefined) {
      throw new InputError('Space not available');
    }
    return this.cb(space);
  }
}
