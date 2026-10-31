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
import {PlayerInput} from '../PlayerInput';
import {TileMoveOffer, findTileMove, tileMovePromptModel} from '../boards/tileMove';

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

  /** See `SelectSpaceModel.printedBonusMultiplier` — the commit's own multiple, announced to the preview. */
  public printedBonusMultiplier?: number;
  /** See `SelectSpaceModel.printedBonusTimes` — the whole count the board marks on its candidates. */
  public printedBonusTimes?: number;

  /**
   * LATER placements the SAME action will ask for after this one commits (the
   * multi-ocean cards: the FIRST prompt announces the second, so the player
   * can plan both cells during the first pick). Set by the producer that
   * knows the sequence (the executor's two-ocean defer); serialized on this
   * input's own `toModel` so it survives nesting, like every placement marker.
   */
  public followUpPlacements?: ReadonlyArray<{tileType?: TileType}>;

  /**
   * A MOVE prompt (Turmoil Redux TR14 Re-settlement, TR39 Canyon Carving —
   * `placementEffect: 'move'`): which tiles may travel and where each may go
   * (`boards/tileMove.ts` — the city's set or the ocean's). `spaces` is the
   * union of every source's destinations; the marker rides this input's own
   * `toModel` (nesting-safe, like every placement marker). The answer must
   * name BOTH cells (`movedFrom` + `spaceId`) and is handed to {@link onMove}
   * — the plain `cb(space)` is never called for a move, because one cell does
   * not say which tile came to it.
   */
  public tileMove?: TileMoveOffer;

  /** The move's own answer handler — see {@link tileMove}. */
  public onMove?: (from: Space, to: Space) => PlayerInput | undefined;

  /**
   * Optional cancel handler for a CANCELLABLE placement (see `placementContext`).
   * When the client submits a `CancelResponse` AND this prompt is cancellable,
   * `process` invokes this instead of placing — the pay-on-commit standard
   * projects set it to flag the action as cancelled (no cost applied, the player
   * returns to the action menu). Absent → a cancel response is rejected.
   */
  public onCancel?: () => void;

  /**
   * THE LEGAL SET IS LIVE (state delivery, 2026-10-28 — `docs/claude/console/state-delivery-and-handoff.md`).
   *
   * A placement prompt STANDS while the table moves: the start-of-game deployments run concurrently (every seat
   * plays its corporation and preludes the moment it presses, in no fixed order), a bot turn resolves on a timer,
   * another seat answers a law's question. The set of legal cells was computed ONCE, at the prompt's creation, so
   * a cell another seat built on meanwhile stayed in `spaces`: the client lit it, the player chose it, and
   * `addTile` threw «occupied» as an opaque 400 — the owner's «игра предложит эту клетку … серверная ошибка».
   *
   * So the set is RE-DERIVED against the live board whenever it is read — at every model serialization (the mid-prompt
   * refresh then carries the shrunken set under the SAME `promptId`, and the board binder re-hangs its highlights on
   * it) and at the answer (a cell no longer legal is refused by name, never applied). Two sources, in order:
   *  · `liveSpaces` — the producer's own derivation (`createMarsSelectSpace({liveSpaces})`: the `Place*Tile` actions
   *    hand over the exact call `execute` made), with the per-cell reasons re-derived beside it (`liveIllegalSpaces`);
   *  · the GENERIC occupancy rule — a cell offered EMPTY that carries a tile now is gone. Exact for every prompt
   *    shape: a cover over an ocean (TR44, an Ares Ocean City), a move's destinations and a marker all target cells
   *    that were offered as they stand, and the rule only ever removes a cell whose emptiness was part of the offer.
   * `spaces` keeps naming the CURRENT set (every server reader sees what the client sees).
   */
  public liveSpaces?: () => ReadonlyArray<Space>;
  /** The per-cell reasons re-derived beside `liveSpaces` (the generic rule marks a taken cell `occupied` itself). */
  public liveIllegalSpaces?: (legal: ReadonlyArray<Space>) => ReadonlyArray<PlacementIllegalSpace>;
  /** The cells offered EMPTY at creation — the generic occupancy rule's witness. */
  private readonly offeredEmpty: ReadonlySet<SpaceId>;

  constructor(
    title: string | Message,
    public spaces: ReadonlyArray<Space>,
    illegalSpaces?: ReadonlyArray<PlacementIllegalSpace>) {
    super('space', title);
    if (spaces.length === 0) {
      throw new InputError('No available spaces');
    }
    this.illegalSpaces = illegalSpaces;
    this.offeredEmpty = new Set(spaces.filter((space) => space.tile === undefined).map(toID));
  }

  /**
   * The legal set AS THE BOARD STANDS NOW (see `liveSpaces`). Re-derives, records the result on `spaces` /
   * `illegalSpaces`, and returns it. A producer's derivation that comes back EMPTY (every cell taken) is honoured:
   * the model then offers nothing, and the answer is refused — the chain's own «no cell» path is the engine's to
   * run on the next input, never a silent pick.
   */
  public currentSpaces(): ReadonlyArray<Space> {
    let legal: ReadonlyArray<Space>;
    if (this.liveSpaces !== undefined) {
      legal = this.liveSpaces();
      if (this.liveIllegalSpaces !== undefined) {
        this.illegalSpaces = this.liveIllegalSpaces(legal);
      }
    } else {
      legal = this.spaces.filter((space) => !(this.offeredEmpty.has(space.id) && space.tile !== undefined));
    }
    if (legal.length !== this.spaces.length || legal.some((space, i) => space !== this.spaces[i])) {
      const taken = this.spaces.filter((space) => !legal.includes(space));
      this.spaces = legal;
      if (this.liveIllegalSpaces === undefined && taken.length > 0) {
        // The generic rule names its own reason: the cell is occupied now.
        const known = new Set((this.illegalSpaces ?? []).map((entry) => entry.spaceId));
        this.illegalSpaces = [
          ...(this.illegalSpaces ?? []),
          ...taken.filter((space) => !known.has(space.id)).map((space) => ({spaceId: space.id, reason: 'occupied' as const})),
        ];
      }
    }
    return this.spaces;
  }

  public override toModel(): SelectSpaceModel {
    const model: SelectSpaceModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'space',
      // LIVE — the set as the board stands at THIS serialization (see `currentSpaces`).
      spaces: this.currentSpaces().map(toID),
      illegalSpaces: this.illegalSpaces,
      hiddenTiles: this.hiddenTiles,
      placementType: this.placementType,
      tileType: this.tileType,
      sourceCard: this.sourceCard,
      placementEffect: this.placementEffect,
      followUpPlacements: this.followUpPlacements,
    };
    if (this.printedBonusMultiplier !== undefined && this.printedBonusMultiplier !== 1) {
      model.printedBonusMultiplier = this.printedBonusMultiplier;
      if (this.printedBonusTimes !== undefined) {
        model.printedBonusTimes = this.printedBonusTimes;
      }
    }
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
    if (this.tileMove !== undefined) {
      model.tileMove = tileMovePromptModel(this.tileMove);
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
    if (this.tileMove !== undefined) {
      // A MOVE names both cells, and the pair must be one the offer holds:
      // the tile among those that may travel, the cell among ITS destinations.
      // The refusal names the object by the prompt's own kind (the marker, never a title).
      const ocean = this.placementType === 'ocean-move';
      if (input.movedFrom === undefined) {
        throw new InputError(ocean ? 'A move must name the ocean tile that moves' : 'A move must name the city that moves');
      }
      const move = findTileMove(this.tileMove, input.movedFrom, input.spaceId);
      if (move === undefined || this.onMove === undefined) {
        throw new InputError(ocean ? 'This ocean tile cannot be moved to that space' : 'This city cannot be moved to that space');
      }
      return this.onMove(move.source.from, move.to);
    }
    if (input.movedFrom !== undefined) {
      throw new InputError('This placement does not move a tile');
    }
    // Validated against the board AS IT STANDS — a cell another seat took while this prompt stood is refused by
    // name (the client's refresh has already dimmed it; a race past that refresh lands here, never in `addTile`).
    const live = this.currentSpaces();
    const space = live.find((space) => space.id === input.spaceId);
    if (space === undefined) {
      const offered = this.offeredEmpty.has(input.spaceId as SpaceId);
      throw new InputError(offered ? 'This space is no longer available — the board changed' : 'Space not available');
    }
    return this.cb(space);
  }
}
