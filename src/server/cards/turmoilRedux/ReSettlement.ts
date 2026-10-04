import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {TileType} from '../../../common/TileType';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {CardRenderer} from '../render/CardRenderer';
import {
  MOVE_CITY_TILE_CONSTRAINT, MOVE_CITY_TILE_TITLE, MoveCityTile, NO_SPACE_TO_MOVE_A_CITY_REASON,
} from '../../deferredActions/MoveCityTile';
import {cityMoveDestinations, cityMoveOffer, cityMoveReasoner, movableCities} from '../../boards/cityMove';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {NO_CITY_ON_MARS_REASON} from './AdministrationDistrict';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/**
 * TR14 — RE-SETTLEMENT («Переселение»), the fourteenth Turmoil Redux PROJECT
 * card — the set's first card that MOVES a tile: one of the player's own
 * cities on Mars is lifted and landed on an adjacent cell. The move itself is
 * the engine's (`Game.moveCityTile`), the question the shared step's
 * (`MoveCityTile`), «who may move and where» the family's one cell rule
 * (`boards/cityMove.ts` over `ignoreRestrictionsCity.ts`) — this file holds
 * the card and nothing about cells.
 *
 * SCAN READING — cost 7, green (AUTOMATED); two tags in the corner, in this
 * order: City (the white skyline), Building (the brown roof). The orange MIN
 * plate beside the cost holds the MARS FIRST emblem: the REQUIREMENT
 * («Requires Mars First to be ruling or that you have 2 delegates there»),
 * never a tag. The VP badge prints 1 on a Mars disc (the disc is the badge's
 * background). The PLAY row, one line: «− [city tile with a pink hex in its
 * corner] + [city tile]*» — the pink hex is the set's «on Mars» mark of a
 * tile (`AltSecondaryTag.MARS_TILE`, the owner's own asset), the asterisk the
 * special placement rule. The small «TR14» tab is the card's number. The
 * purple Turmoil symbol at the bottom left is the module itself (no
 * `compatibility`). The scan prints NO flavour quote: the archive entry
 * («TR14» in `lore_texts.json` — «Same neighbours. Better view.») is written
 * for the fork, to the art and the mechanics — the registry of such entries is
 * `docs/claude/turmoil-redux-invented-lore.md`.
 *
 * THE SET'S FAQ (rulebook p. 18): «Can I use "Re-settlement" on a stack of
 * cities? Yes. When you do this, remove only the top-most city from the
 * stack, and leave the city underneath in its place.»
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ReSettlement.spec.ts and,
 * at the engine, tests/boards/cityMove.spec.ts):
 *  1. The requirement is `{party: MARS}` — the TR15 class (emblem, named
 *     reason, the hand's counter). Checked at the play only.
 *  2. WHAT MAY MOVE — a city tile of the player's OWN ON MARS
 *     (`MarsBoard.getCitiesOnMars`): an ordinary city (the one on the Noctis
 *     cell, a Kaguya Tech city), the Capital. A city on a colony slot
 *     (Ganymede, Phobos, Venus) is not on Mars; a neutral or another player's
 *     city is not theirs.
 *  3. A STACK (the FAQ): ONLY the top tier leaves — the cell stands one city
 *     shorter and keeps its tile, its card and its owner; what travels is an
 *     ORDINARY city, even off a Capital.
 *  4. A SINGLE tile leaves WHOLE, with its identity: the tile (with its card —
 *     the Capital's VP are counted by the cell its card stands on), its
 *     owner, its co-owner, its Ares adjacency. The old cell is bare land with
 *     no owner; its printed bonus goes again to whoever takes it next.
 *  4-bis. A CITY OVER AN OCEAN STAYS (the owner's decision): Ocean City and
 *     New Holland are the special «city and ocean» tile that exists only on
 *     top of an ocean. The card moves «it» — that same tile — and offers only
 *     non-reserved cells, i.e. land, where the tile would still count as an
 *     ocean; a plain city may not be substituted for it. It IS the player's
 *     city on Mars (counted wherever a city is counted), with no cell to go
 *     to, ever — a source with its own ONE reason, disabled, never hidden.
 *     With no other city the card is unplayable for reason №2 below, never №1.
 *  5. WHERE — a cell ADJACENT to the city out of the family's «non-reserved
 *     space, ignoring other placement restrictions»: land, no player's tile,
 *     not an ocean cell, not Noctis, not the Nomads camp, not another
 *     player's Land Claim, the cell's price affordable (Ares). Beside any
 *     city is fine; an unprotected Ares hazard is coverable at its own price
 *     (the sisters TR16 / TR19 read «unoccupied» the same way).
 *  6. THE BONUSES — as for any placement (the card's own bracket): the new
 *     cell's printed bonus, M€ per adjacent ocean, the Ares neighbours — by
 *     the engine's `addTile`, never arithmetic of this card's.
 *  7. THE MOVE IS A PLACEMENT OF A CITY TILE (the fork's precedent — a
 *     Skyscrapers tier): everything that answers «a city was placed» answers
 *     here — Rover Construction, Pets, Immigrant City, Tharsis Republic, TR15
 *     Martian Census, the ruling Mars First's passive, the enacted law.
 *  8. THE NUMBER OF CITIES DOES NOT CHANGE (Mayor, Metropolist, Landlord); the
 *     awards of PLACE and every adjacency VP (greeneries beside the city,
 *     oceans beside the Capital, cities beside a Commercial District) recount
 *     by the new cell on their own — they read the board.
 *  9. UNPLAYABLE — ONE reason, the more fundamental first: no city of one's
 *     own on Mars; then no city of theirs with a legal cell beside it.
 * 10. NO AUTO-SELECT: a single city with a single cell is still chosen by the
 *     player's own two presses; a city that cannot move is shown disabled
 *     with its reason.
 * 11. A St. Joseph CATHEDRAL travels with a single city and stays with the
 *     base of a stack.
 * 12. ONE event `tile-moved` and one log line; «tiles placed» does not grow —
 *     the tile is not a new one.
 * 13. Tags City + Building and 1 VP: with TR16 in the tableau this play draws
 *     a card (a Building card with a non-negative VP icon).
 * 14. MarsBot never plays the card; the bot's and the neutral cities are no
 *     candidates.
 *
 * SISTERS: TR16 Administration District and TR19 Sponsored Settlement (the
 * same cell rule, placing a NEW city).
 */
export class ReSettlement extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.RE_SETTLEMENT,
      type: CardType.AUTOMATED,
      tags: [Tag.CITY, Tag.BUILDING],
      cost: 7,
      requirements: {party: PartyName.MARS},
      victoryPoints: 1,

      metadata: {
        cardNumber: 'TR14',
        // The move, and its bracket as a note — one block per statement, both tethered to the city glyphs.
        infoText: [
          {text: 'Remove a city tile you own on Mars and place it in an ADJACENT, NON-RESERVED, unoccupied space, ignoring other placement restrictions.', tokens: ['city']},
          {kind: 'note', text: 'You gain the placement bonus of that space, including adjacency bonuses.', tokens: ['city']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.minus().city({secondaryTag: AltSecondaryTag.MARS_TILE}).plus().city().asterix();
        }),
        description: 'Requires Mars First to be ruling or that you have 2 delegates there. Remove a city tile you own on Mars and place it in an ADJACENT, NON-RESERVED, unoccupied space, ignoring other placement restrictions. (You gain the placement bonus of that space, including adjacency bonuses.)',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return movableCities(player, canAffordOptions).length > 0;
  }

  /** Rule 9 — ONE reason, the more fundamental first. */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.board.getCitiesOnMars(player).length === 0) {
      return reason.placementReason(NO_CITY_ON_MARS_REASON);
    }
    if (movableCities(player).length === 0) {
      return reason.placementReason(NO_SPACE_TO_MOVE_A_CITY_REASON);
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    // The step's `cause` is the prompt's `sourceCard` — the dossier's source and
    // the address of the staged tail (docs/TILE_PLAY_STAGED_COMMIT.md §9-quater).
    player.game.defer(new MoveCityTile(player, {kind: 'card', card: this.name}));
    return undefined;
  }

  /**
   * The staged play: the SAME offer the live step raises (`cityMoveOffer`),
   * with the unpaid card's price folded in — its destinations, its per-city
   * reach, its per-cell reason. The staged pick is two cells of one decision
   * (`staged.move`); the play's one POST carries `{spaceId, movedFrom}`.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {
      tile: TileType.CITY,
      constraint: MOVE_CITY_TILE_CONSTRAINT,
      staged: {
        title: MOVE_CITY_TILE_TITLE,
        spaces: (canAffordOptions) => cityMoveDestinations(cityMoveOffer(player, canAffordOptions)),
        placementType: 'city-move',
        reasoner: cityMoveReasoner(player, cityMoveOffer(player)),
        move: (canAffordOptions) => cityMoveOffer(player, canAffordOptions),
      },
    });
  }
}
