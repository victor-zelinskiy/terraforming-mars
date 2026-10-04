import {CanAffordOptions, IPlayer} from '../IPlayer';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {recordSkippedEffect} from './skippedEffect';
import {SelectSpace} from '../inputs/SelectSpace';
import {createMarsSelectSpace} from '../boards/marsSelectSpaceHelper';
import {CityMoveOffer, cityMoveDestinations, cityMoveOffer, cityMoveReasoner} from '../boards/cityMove';
import type {SkippedEffect} from '../cards/actionPreviews';
import {CardName} from '../../common/cards/CardName';
import {TileType} from '../../common/TileType';

/**
 * The prompt's title — an English i18n key, mirrored by the staged preview. It
 * names the LIFTED rule too (the family's voice — TR16): the board lights
 * cells beside other cities, and the placement panel prints this title as its
 * action line.
 */
export const MOVE_CITY_TILE_TITLE = 'Move your city to an adjacent non-reserved space — other placement restrictions do not apply';

/** The muted constraint tail of the play preview's «then: place it on the board» line. */
export const MOVE_CITY_TILE_CONSTRAINT = 'to an adjacent non-reserved space, ignoring other placement restrictions';

/** Why no move exists — no city of the player's own has a legal cell beside it. */
export const NO_SPACE_TO_MOVE_A_CITY_REASON = 'None of your cities has a free adjacent space to move to';

/** The skip label — the effect a lost «move one of your cities» is NAMED by. */
export const CITY_MOVE_LABEL = 'Move a city';

/** What a lost move is named by — no magnitude: a tile is not an amount. */
export function skippedCityMove(): {reason: string, skipped: SkippedEffect} {
  return {reason: NO_SPACE_TO_MOVE_A_CITY_REASON, skipped: {label: CITY_MOVE_LABEL}};
}

/**
 * «REMOVE A CITY TILE YOU OWN ON MARS AND PLACE IT IN AN ADJACENT,
 * NON-RESERVED, UNOCCUPIED SPACE, IGNORING OTHER PLACEMENT RESTRICTIONS»
 * (Turmoil Redux TR14 Re-settlement) — the shared step any card that moves a
 * city inherits.
 *
 * ONE QUESTION, ONE ANSWER. The prompt offers every cell SOME city may travel
 * to and carries the move marker (`SelectSpace.tileMove`): each city that may
 * move with ITS destinations, each city that may not with its one reason. The
 * answer names BOTH cells (`{spaceId, movedFrom}`) and `Game.moveCityTile`
 * lifts and lands atomically — the state «the city is lifted, the cell is not
 * chosen» does not exist, so no other prompt can be asked inside the move.
 *
 * NO AUTO-SELECT: a single movable city with a single destination is still
 * asked — the player sees which city goes where before it goes.
 *
 * WHO / WHERE / WHO STAYS — `boards/cityMove.ts`, the one reading the play
 * gate, this prompt, its staged twin and the commit share.
 *
 * NO MOVE AT ALL is a NAMED skip. The card's own gate (`bespokeCanPlay`)
 * makes the card unplayable in that state, so this is the degrade of a board
 * that moved between the play and the step, never the ordinary path.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it; the staged twin
 * is `actionPreviews.placementPreview({staged: {move}})`, which builds the
 * same offer through `cityMoveOffer` with the UNPAID card's affordability plan
 * folded in (`canAffordOptions` — before the play the card is not paid yet;
 * the live step is built without it, the price being paid by then).
 *
 * Priority: `DEFAULT` — a card's own on-play input (the staged tail is
 * ADDRESSED by `sourceCard` for the prompts the same play may trigger first).
 */
export class MoveCityTile extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The giver — the card being played (the prompt's `sourceCard`: the dossier's source and the staged tail's address). */
    public readonly cause: {kind: 'card', card: CardName},
    private readonly options: {canAffordOptions?: CanAffordOptions} = {},
  ) {
    super(player, Priority.DEFAULT);
  }

  /** Who may move and where — read off the live board every time it is asked. */
  public offer(): CityMoveOffer {
    return cityMoveOffer(this.player, this.options.canAffordOptions);
  }

  /** The marked prompt — the one construction of the live ask. */
  private prompt(offer: CityMoveOffer): SelectSpace {
    return createMarsSelectSpace(this.player, MOVE_CITY_TILE_TITLE, cityMoveDestinations(offer), {
      placementType: 'city-move',
      tileType: TileType.CITY,
      sourceCard: this.cause.card,
      placementEffect: 'move',
      customReasoner: cityMoveReasoner(this.player, offer),
      canAffordOptions: this.options.canAffordOptions,
      tileMove: offer,
    });
  }

  public execute(): SelectSpace | undefined {
    const player = this.player;
    const offer = this.offer();
    if (offer.sources.length === 0) {
      const lost = skippedCityMove();
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return undefined;
    }
    const select = this.prompt(offer);
    select.onMove = (from, to) => {
      // `SelectSpace.process` matched the pair against the offer it was asked
      // with; `moveCityTile` re-reads the rule against the board as it stands.
      player.game.moveCityTile(player, from, to);
      this.cb(undefined);
      return undefined;
    };
    return select;
  }
}
