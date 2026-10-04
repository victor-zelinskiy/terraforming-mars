import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {PlaceCityOnColonyTile} from '../../deferredActions/PlaceCityOnColonyTile';
import {ColoniesHandler} from '../../colonies/ColoniesHandler';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/**
 * TR22 — NOVA CITY («Нова-Сити»), a Turmoil Redux PROJECT card — the set's
 * first city that is placed ON A COLONY TILE, and its first card under
 * Unity's plate.
 *
 * A green (AUTOMATED) card: «Requires Unity to be ruling or that you have 2
 * delegates there. Place a city ON A COLONY TILE in play. 2 VP per space city
 * you own. (Any city that's not on Mars.)» The colony tile is chosen in the
 * colony grid hosted by the hand, the play is committed on the tile's stage,
 * and the answer rides the play batch as its ADDRESSED `colony` tail (the
 * staged colony door of TR07, whole). The card defers the shared step
 * `PlaceCityOnColonyTile` and holds no `SelectColony`, no `addCity` and no
 * write of `colony.tiles` of its own: a tile on a colony tile has ONE writer
 * (`ColoniesHandler.placeCityOnColonyTile`, docs/TURMOIL_REDUX_NOVA_CITY.md).
 *
 * SCAN READING — cost 18; three tags in the corner, in this order: the
 * striped planet (Jovian), the city (City), the yellow star on dark (Space).
 * The orange MIN plate beside the cost holds Unity's emblem: the REQUIREMENT
 * (`{party: UNITY}`), not a tag. The graphic is one row: «[city tile]*» — a
 * PLAIN city, no corner bubble; the asterisk is the placement's special rule.
 * The VP badge prints «2 / [city tile with the round SPACE-tag bubble in its
 * corner]» on a Mars disc (the disc is the badge's background): 2 VP per
 * SPACE CITY — the bubble is the existing `secondaryTag: Tag.SPACE` (as on
 * Venera Base's city), never a new `AltSecondaryTag`. The grey ▲ at the bottom
 * left is the Colonies symbol (`compatibility: 'colonies'` in the manifest);
 * the purple Turmoil hexagon below it is the module itself (never
 * `compatibility: 'turmoil'`, see TR02). Flavour (printed): «Space is what you
 * make of it.» (`lore_texts.json` «TR22»).
 *
 * THE RULEBOOK'S FAQ (p. 18): «Do Venus cities count towards "Nova City"?
 * Yes. Any city that is not on Mars counts.»
 *
 * RULE READINGS (the card's text + the FAQ + the engine — pinned by
 * tests/cards/turmoilRedux/NovaCity.spec.ts):
 *  1. The requirement is Unity's plate (`{party: UNITY}` — the class of TR15):
 *     Unity rules, or 2 of the player's delegates stand on its resolution.
 *  2. «A COLONY TILE IN PLAY» — any tile of `game.colonies`: anybody's, with
 *     colonies or with none, with a docked fleet, active or INACTIVE (TR10's
 *     precedent: activity and the track do not matter). A tile of the reserve
 *     is not in play.
 *  3. THE CITY IS A REAL CITY TILE of the player's (`{tileType: CITY, card:
 *     NOVA_CITY}`) on a `SpaceType.COLONY` cell — a space city by the engine's
 *     own definition (`MarsBoard.getCitiesOffMars`). Everything that counts
 *     cities «everywhere» counts it (Mayor, Metropolist, Constructor, the
 *     cities requirement), everything that counts them «off Mars» too (Cosmic
 *     Settler, RX08 Colonization Funding and its quest), and nothing that
 *     counts them «on Mars» (Martian Rails, TR15, RX21 …).
 *  4. IT IS A PLACEMENT OF A CITY TILE: whatever reads `Board.isCitySpace`
 *     with no filter of the cell answers — Pets, Immigrant City, Rover
 *     Construction, Hospitals, Vermin; Tharsis Republic pays its 3 M€ for the
 *     player's own city but NOT the production step (off Mars). What reads «on
 *     Mars» does not: the ruling Mars First's passive, TR15, Development
 *     Craze, Forestry Support. Nothing of it is programmed here — it is the
 *     engine's `addTile`.
 *  5. NO PLACEMENT BONUS — the cell prints none and has no neighbours. IT IS
 *     NOT A COLONY: the player's number of colonies, the tile's berths, its
 *     track, its trade income and its owners' bonus do not change; a fleet
 *     stands and arrives as before.
 *  6. A TILE CARRYING THE CITY CANNOT LEAVE THE GAME (TR10: «no colonies,
 *     TILES, or trade fleets on it») — the third clause of the one predicate
 *     (`ColoniesHandler.colonyTileOccupiedReason`), in the printed order.
 *  7. VP = 2 × the player's OWN space cities, this one included. A rival's
 *     space city does not count; a city of Venus does (the FAQ); the Moon is
 *     another board and does not (as for RX08). `all: false` is LOAD-BEARING:
 *     without it the `Counter` counts every player's cities.
 *  8. UNPLAYABLE — ONE reason, in order: the requirement → the city's own
 *     cell is taken (a second copy of the card; a fixed cell answers silently
 *     in the engine, here it is named) → no colony tile in play (unreachable
 *     in Redux, written anyway).
 *  9. A SINGLE tile in play is still CHOSEN by a press (no auto-select).
 * 10. THE JOURNAL: `addTile` writes no line for an off-board cell, so the
 *     placement's own sentence is the writer's — «placed a city on the X
 *     colony tile» — plus the existing `tile-placed` event (the tile is NEW:
 *     «tiles placed» grows) carrying the colony tile.
 * 11. MarsBot never plays the card; at a MarsBot table a human plays it as
 *     usual (the bot's cube is a colony, not a tile).
 * 12. The link «colony tile ↔ city» survives a save / load, and a save made
 *     BEFORE this card existed stays playable (the cell is restored by the
 *     builder's own table — `restoreExpansionSpaceColonies`).
 *
 * SISTERS: TR27 Aurora Station («a city NEXT TO THE VENUS TRACK») — the set's
 * second space city with a place off the board: it adds its ROW to the two
 * tables (`expansionSpaceColonies`, `hostedSpaces`), not a second mechanism.
 */
export class NovaCity extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.NOVA_CITY,
      type: CardType.AUTOMATED,
      tags: [Tag.JOVIAN, Tag.CITY, Tag.SPACE],
      cost: 18,
      requirements: {party: PartyName.UNITY},
      // ⚠ `all: false` — the player's OWN cities (rule 7).
      victoryPoints: {cities: {where: 'offmars'}, all: false, each: 2},

      metadata: {
        cardNumber: 'TR22',
        infoText: [
          {text: 'Place a city ON A COLONY TILE in play.', tokens: ['city']},
          {kind: 'victory-points', text: '2 VP per space city you own (any city that is not on Mars).'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.city().asterix();
        }),
        description: 'Requires Unity to be ruling or that you have 2 delegates there. Place a city ON A COLONY TILE in play. 2 VP per space city you own. (Any city that\'s not on Mars.)',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return ColoniesHandler.cityOnColonyTileBlockedReason(player.game, this.name) === undefined;
  }

  /** Rule 8 — ONE reason (the requirement's own comes first, from the card's requirement). */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const blocked = ColoniesHandler.cityOnColonyTileBlockedReason(player.game, this.name);
    return blocked === undefined ? undefined : reason.placementReason(blocked);
  }

  /** THE step `bespokePlay` defers — built once, asked by the preview (its read-only twin) and queued by the play. */
  private step(player: IPlayer): PlaceCityOnColonyTile {
    return new PlaceCityOnColonyTile(player, this);
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(this.step(player));
    return undefined;
  }

  /**
   * One branch, no chips: where the city lands is the player's pick, so the
   * branch carries the DOOR — the colony tile is chosen in the colony grid,
   * where every tile wears the city's ghost. The step's `tileSite` marker
   * tells the forecast which tile lands (a city, off Mars) and the play's VP
   * projection which city to count.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, [], [actionPreviews.colonyPickStep(this, this.step(player))]);
  }
}
