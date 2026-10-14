import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {ActionCard} from '../ActionCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {TileType} from '../../../common/TileType';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';

/** The placement's prompt title — the rule, in the prompt's own words (the kind alone says «ocean»). */
export const PLACE_CITY_OVER_OCEAN_TITLE = 'Place a city on top of an ocean tile';
/** The printed «→ [animal] [data]*» — one animal here, and the data the player MAY add to any card. */
export const ANIMALS_PER_ACTION = 1;
export const DATA_PER_ACTION = 1;

/**
 * TR44 — AQUATIC RESEARCH STATION («Подводная исследовательская станция»), a
 * Turmoil Redux PROJECT card: the Greens' plate once more, and the set's
 * FIRST card that puts TWO TILES ON ONE CELL — an ordinary city ON TOP OF an
 * ocean in play, neither piece changing its kind (the owner's accent,
 * 2026-10-13: «this is two independent tiles, and the player must see the
 * difference from an Ocean City — on the board and in the rules»). The
 * physics is the engine's (`common/boards/cellPieces.ts` — one reading of
 * what lies on a cell; `Game.addTile` with `overOcean`, `liftTopCity`,
 * `liftOcean` — three writers), so this file is ONE DECLARATION: a tile of
 * the new placement kind, an action of two classes that already stand, and
 * the first use of the «you may» knob of an «add to any card» step
 * (`AddResource.optional`). No hook lives here.
 *
 * SCAN READING — cost 16, BLUE (ACTIVE). Three tags in the corner, in the
 * printed order: the ANIMAL (the paw), the CITY, the BUILDING. The orange MIN
 * plate beside the cost holds the GREENS' emblem (the tree) — a REQUIREMENT
 * (`{party: GREENS}`), never a tag. The upper field is the action: «→ [animal]
 * [data]*» — one arrow, no cost on its left, the animal icon and the data
 * icon with the asterisk («to ANY card») on its right, with «(Action: Add 1
 * animal resource to this card. You may also add 1 data resource to ANY
 * card.)». The lower field prints ONE composite symbol — a city hex over an
 * ocean hex with the arrow pointing down: «a city ON TOP OF an ocean», one
 * node (`b.tile(CITY, …, {over: OCEAN})`), never two tiles of the set — and
 * the text «(Requires the Greens to be ruling or that you have 2 delegates
 * there. Place a city ON TOP OF AN OCEAN TILE IN PLAY, IGNORING OTHER
 * PLACEMENT RESTRICTIONS. The ocean underneath still grants its adjacency
 * bonus when placing tiles next to it.)». The VP badge prints «1/2 [animal]»
 * (`{resourcesHere: {}, per: 2}` — Herbivores' form). Only the module's icon
 * at the bottom left (no ▲, no Venus icon): no `compatibility`. No printed
 * quote — the lore is INVENTED (`docs/claude/turmoil-redux-invented-lore.md`:
 * «Finally, an aquarium where the fish get to watch us.»). Art credit: Jacek
 * Irzykowski.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/AquaticResearchStation.spec.ts;
 * the two-tile physics by tests/game/TwoTileCell.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate (the TR43 class): the Greens rule
 *     (the STARTING RULE counts) or 2 of the player's OWN delegates on their
 *     resolution — at the play only; TR36 lowers an EFFECT's threshold, never
 *     a requirement's.
 *  2. WHERE — any PLAIN ocean tile in play with nothing on it («an ocean tile
 *     in play»): whoever placed it (an ocean has no owner — MarsBot's too),
 *     on an ocean reserve or on land (Artificial Lake). NOT a composite
 *     (Ocean City / Farm / Sanctuary / New Holland / Wetlands — a different,
 *     single tile: «occupied»), not an ocean that already carries a city of
 *     this card («occupied»), not an empty reserve or land («requires an
 *     ocean tile»). With no plain ocean the card is UNPLAYABLE with one named
 *     reason («No ocean tile to place a city on»).
 *  3. «IGNORING OTHER PLACEMENT RESTRICTIONS» — the city's own rule («not
 *     next to a city») does not apply; the kind's set is the plain ocean
 *     tops, nothing narrower.
 *  4. TWO PIECES on the cell: an ORDINARY city on top (`tile.card` = this
 *     card, the cell is the player's), the plain OCEAN under it, nobody's. The
 *     city is a city everywhere (Mayor, the greenery VP, every «a city tile
 *     was placed» trigger, a Skyscrapers tier on it, a Re-settlement move off
 *     it); the ocean is an ocean everywhere (the count toward nine — unchanged
 *     by the play; the +M€ to every tile placed beside it; the Capital's
 *     point; TR43's count; a Canyon Carving move OUT FROM UNDER the city; a
 *     Water Export / Reds' removal of the ocean alone). NOT «when you place
 *     an ocean» (no ocean was placed), NOT the cell's printed bonus (the ocean
 *     took it; the survey family reads the cover).
 *  5. WHAT THE PLAY PAYS — the ordinary cover's: no printed bonus; +2 M€ per
 *     OTHER adjacent ocean (the ocean under the city is no neighbour); the
 *     Ares neighbours, the party passives (Mars First's steel for a tile on
 *     Mars), the enacted law; a `tile-placed` of a CITY, «tiles placed» +1;
 *     the log line names the cover.
 *  6. TR14 moves this city like any city: the ocean STAYS, nobody's, still
 *     counted (`cityStandsOnOcean` is the composite's rule, not this city's).
 *  7. TR39 moves the ocean out from UNDER the city (the set's FAQ, p. 18):
 *     only the ocean goes, the city stays; the cell stops counting as an
 *     ocean; the move's own TR as always.
 *  8. RX33 / the Reds / Dry Deserts remove the ocean from under the city the
 *     same way: the city, its owner and its stack stay; the count drops by one.
 *  9. A Skyscrapers tier stands on this city as on any; the pieces are then
 *     three (the census), the ocean still the one marked.
 * 10. THE ACTION (once per generation): +1 animal HERE, always (`addResources`);
 *     «you may also add 1 data to ANY card» — any of the player's OWN data
 *     holders (the TR43 / TR48 reading), never automatic, the refusal a button
 *     inside the pick (`AddResource.optional` → `AddResourcesToCard.
 *     buildOptionalChoice`: the pick beside a `skip`-marked decline); with no
 *     holder the data is skipped BY NAME and the animal still lands — the
 *     action is never unavailable for want of a holder. ONE batch from the
 *     composer: `[activate, {or, 0, {card}}]` or `[activate, {or, 1, {option}}]`.
 * 11. VP: 1 per 2 animals here, rounded down (Herbivores' form); the badge
 *     prints the variable icon, non-negative (TR16 draws a card for it).
 * 12. The tags wake the table: the animal tag — Decomposers' microbe, TR38's
 *     data, Ecological Zone's animal; the building tag — steel pays, TR16
 *     Administration District draws; the CITY placed — Pets, Immigrant City,
 *     Tharsis Republic, TR30 Red Museum, Martian Census (a whole city, not a
 *     tier). The forecast names them before the press.
 * 13. The play is a STAGED placement (the cell is picked before the card is
 *     paid — docs/TILE_PLAY_STAGED_COMMIT.md); the staged question and the
 *     live one are the same (parity).
 * 14. MarsBot never plays it; its oceans are targets; its tiles beside the
 *     ocean under a human's city take their 2 M€ like any neighbour.
 * 15. Save / load: the cover is serialized with the tile (`Tile.covers`); the
 *     client's `under` is published from the pieces, never stored.
 */
export class AquaticResearchStation extends ActionCard implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.AQUATIC_RESEARCH_STATION,
      type: CardType.ACTIVE,
      tags: [Tag.ANIMAL, Tag.CITY, Tag.BUILDING],
      cost: 16,
      resourceType: CardResource.ANIMAL,
      requirements: {party: PartyName.GREENS},
      // Rule 11.
      victoryPoints: {resourcesHere: {}, per: 2},

      // Rules 2–5: an ORDINARY city of the new kind — the engine keeps both pieces.
      behavior: {
        tile: {type: TileType.CITY, on: 'city-over-ocean', title: PLACE_CITY_OVER_OCEAN_TITLE},
      },

      // Rule 10.
      action: {
        addResources: ANIMALS_PER_ACTION,
        addResourcesToAnyCard: {type: CardResource.DATA, count: DATA_PER_ACTION, optional: true},
      },

      metadata: {
        cardNumber: 'TR44',
        // The printed action runs past the browser's caption budget of 52 in both languages.
        infoText: [
          {kind: 'action-short', text: '+1 animal here; may add 1 data to any card'},
          {text: 'Place a city on top of an existing ocean tile, ignoring other placement restrictions.', tokens: ['tile-city', 'tile-ocean']},
          {text: 'The ocean underneath still grants its adjacency bonus when placing tiles next to it.', tokens: ['tile-ocean']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The scan's upper field — «→ [animal] [data]*»: one arrow, the animal here, the data to ANY card.
          b.action('Add 1 animal resource to this card. You may also add 1 data resource to ANY card.', (eb) => {
            eb.empty().startAction.resource(CardResource.ANIMAL).resource(CardResource.DATA).asterix();
          }).br;
          // The lower field — ONE composite symbol: a city ON TOP OF an ocean.
          b.tile(TileType.CITY, false, false, {over: TileType.OCEAN});
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Place a city ON TOP OF AN OCEAN TILE IN PLAY, IGNORING OTHER PLACEMENT RESTRICTIONS. The ocean underneath still grants its adjacency bonus when placing tiles next to it.',
      },
    });
  }
}
