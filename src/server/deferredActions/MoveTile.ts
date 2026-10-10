import {CanAffordOptions, IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {recordSkippedEffect} from './skippedEffect';
import {SelectSpace} from '../inputs/SelectSpace';
import {Space} from '../boards/Space';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {TileMoveOffer, tileMoveDestinations} from '../boards/tileMove';
import type {SkippedEffect} from '../cards/actionPreviews';
import {CardName} from '../../common/cards/CardName';
import {TileType} from '../../common/TileType';
import {PlacementIllegalReason} from '../../common/inputs/PlacementIllegalReason';
import {PlacementType} from '../boards/PlacementType';

/**
 * THE RULE OF ONE KIND OF MOVE — what the shared step needs of a tile's own
 * set to ask its question and commit its answer. Two stand today: the city's
 * (`MoveCityTile.CITY_MOVE_RULE`, TR14 Re-settlement) and the ocean's
 * (`MoveOceanTile.OCEAN_MOVE_RULE`, TR39 Canyon Carving). The texts are i18n
 * keys; the sets are `boards/cityMove.ts` and `boards/oceanMove.ts`.
 */
export type TileMoveRule = {
  /** The placement type the prompt (and its staged twin) names itself by. */
  placementType: Extract<PlacementType, 'city-move' | 'ocean-move'>;
  /** The tile family that travels — the prompt's `tileType`. */
  tileType: TileType;
  /** Who may move and where — read off the live board every time it is asked. */
  offer(player: IPlayer, canAffordOptions?: CanAffordOptions): TileMoveOffer;
  /** The prompt-level «why not» the move adds (a far cell of the family). */
  reasoner(player: IPlayer, offer: TileMoveOffer): (space: Space) => PlacementIllegalReason | undefined;
  /** THE ONE WRITER of the move — the engine's own `moveXTile`. */
  move(game: IGame, player: IPlayer, from: Space, to: Space): void;
  /** The prompt's title — it names the LIFTED rule too (the family's voice, TR16). */
  title: string;
  /** The muted constraint tail of the play preview's «then: place it on the board» line. */
  constraint: string;
  /** Why no move exists — the card's unplayable reason and the named skip's. */
  noMoveReason: string;
  /** What a lost move is named by — no magnitude: a tile is not an amount. */
  skipLabel: string;
};

/** What a lost move is named by. */
export function skippedTileMove(rule: TileMoveRule): {reason: string, skipped: SkippedEffect} {
  return {reason: rule.noMoveReason, skipped: {label: rule.skipLabel}};
}

/**
 * A TILE MOVES — the shared step any card that moves a tile inherits
 * (Turmoil Redux TR14 Re-settlement: a city of the player's own; TR39 Canyon
 * Carving: any plain ocean). The kind is the RULE handed in; the step knows
 * nothing about cities or oceans.
 *
 * ONE QUESTION, ONE ANSWER. The prompt offers every cell SOME source may
 * travel to and carries the move marker (`SelectSpace.tileMove`): each tile
 * that may move with ITS destinations, each that may not with its one
 * reason. The answer names BOTH cells (`{spaceId, movedFrom}`) and the rule's
 * writer lifts and lands atomically — the state «the tile is lifted, the cell
 * is not chosen» does not exist, so no other prompt can be asked inside the
 * move.
 *
 * NO AUTO-SELECT: a single movable tile with a single destination is still
 * asked — the player sees which tile goes where before it goes.
 *
 * NO MOVE AT ALL is a NAMED skip. The card's own gate (`bespokeCanPlay`)
 * makes the card unplayable in that state, so this is the degrade of a board
 * that moved between the play and the step, never the ordinary path.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it; the staged twin
 * is `actionPreviews.placementPreview({staged: {move}})`, which builds the
 * same offer through the rule's `offer` with the UNPAID card's affordability
 * plan folded in (`canAffordOptions` — before the play the card is not paid
 * yet; the live step is built without it, the price being paid by then).
 *
 * Priority: `DEFAULT` — a card's own on-play input (the staged tail is
 * ADDRESSED by `sourceCard` for the prompts the same play may trigger first).
 */
export class MoveTile extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The giver — the card being played (the prompt's `sourceCard`: the dossier's source and the staged tail's address). */
    public readonly cause: {kind: 'card', card: CardName},
    public readonly rule: TileMoveRule,
    private readonly options: {canAffordOptions?: CanAffordOptions} = {},
  ) {
    super(player, Priority.DEFAULT);
  }

  /** Who may move and where — read off the live board every time it is asked. */
  public offer(): TileMoveOffer {
    return this.rule.offer(this.player, this.options.canAffordOptions);
  }

  /** The marked prompt — the one construction of the live ask. */
  private prompt(offer: TileMoveOffer): SelectSpace {
    return createMarsSelectSpace(this.player, this.rule.title, tileMoveDestinations(offer), {
      placementType: this.rule.placementType,
      tileType: this.rule.tileType,
      sourceCard: this.cause.card,
      placementEffect: 'move',
      customReasoner: this.rule.reasoner(this.player, offer),
      canAffordOptions: this.options.canAffordOptions,
      tileMove: offer,
    });
  }

  public execute(): SelectSpace | undefined {
    const player = this.player;
    const offer = this.offer();
    if (offer.sources.length === 0) {
      const lost = skippedTileMove(this.rule);
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return undefined;
    }
    const select = this.prompt(offer);
    select.onMove = (from, to) => {
      // `SelectSpace.process` matched the pair against the offer it was asked
      // with; the writer re-reads the rule against the board as it stands.
      this.rule.move(player.game, player, from, to);
      this.cb(undefined);
      return undefined;
    };
    return select;
  }
}
