import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {TileType, isSpecialTile} from '../../../common/TileType';
import {BoardType} from '../../boards/BoardType';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {CardRenderer} from '../render/CardRenderer';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastTile} from '../EffectForecastContext';
import {grantReactionFacts} from '../../models/effectForecast';
import {payTileToCard} from '../tilePayout';
import * as placementPreviews from '../placementPreviews';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** The printed «add 2 data resources to this card» — per qualifying tile. */
export const RED_MUSEUM_DATA_PER_TILE = 2;

/** One placement, as the ONE predicate reads it — the live tile, the composer's tile, the dossier's prospective tile. */
type MuseumTile = {city: boolean, tileType: TileType | undefined, onMarsGrid: boolean};

/** The neighbours that keep the data away (rule 6): greenery TILES and ocean TILES beside the cell. */
export type MuseumBlockers = {greeneries: number, oceans: number};

/**
 * RULE 6 — the tiles beside `space` that stop the payout, read off the LIVE
 * board: every GREENERY tile (`GREENERY_TILES` — Wetlands included) and every
 * OCEAN tile (`OCEAN_TILES` — Ocean City, Ocean Farm, Wetlands included). An
 * empty ocean-reserved CELL is not an ocean, a hazard is neither, a city or a
 * special tile beside it never blocks, and the cell itself is not its own
 * neighbour (Ocean City lands ON an ocean). Wetlands is both kinds and counts
 * in both.
 */
export function museumBlockers(board: Board, space: Space): MuseumBlockers {
  let greeneries = 0;
  let oceans = 0;
  for (const neighbour of board.getAdjacentSpaces(space)) {
    if (Board.isGreenerySpace(neighbour)) {
      greeneries++;
    }
    if (Board.isOceanSpace(neighbour)) {
      oceans++;
    }
  }
  return {greeneries, oceans};
}

function blocked(blockers: MuseumBlockers): boolean {
  return blockers.greeneries > 0 || blockers.oceans > 0;
}

/**
 * TR30 — RED MUSEUM («Красный музей»): the set's first card under the REDS'
 * plate (TR31–TR36 follow with the same plate) and its first card whose
 * trigger on a tile is DECIDED BY THE CELL — the tile pays the card, so the
 * board stages the payout as «ТАЙЛ ПЛАТИТ» (`cards/tilePayout.ts`, the record
 * TR21 Arboretum's scene plays, `cause: 'tile-placed'`).
 *
 * SCAN READING — cost 6; two tags in the corner, Mars (the red planet) and
 * Building (the brown disc). The orange MIN plate beside the cost holds the
 * REDS' emblem (the red flag): the REQUIREMENT («Requires the Reds to be
 * ruling or that you have 2 delegates there»), never a tag. A blue card
 * (ACTIVE) with ONE effect row: a large hex split on the diagonal — a CITY
 * silhouette and a brown half (a SPECIAL tile) — with a small orange hex at
 * its shoulder («on Mars», the set's icon language — TR15) and an asterisk,
 * a colon, two data icons. No play effect. The VP badge «1/2 [data]» — the
 * planet under it is the badge's backdrop. Only the module's icon at the
 * bottom left (no ▲, no Venus icon): no `compatibility`. The card holds data
 * (`CardResource.DATA`). Printed lore: «"No, we don't have statues of Karl
 * Marx. Stop asking!"» (the photo: St. Louis Science Center).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/RedMuseum.spec.ts):
 *  1. The requirement is `{party: REDS}`: the Reds RULE, or the player has 2
 *     delegates on their resolution in the Voting Area — checked at the PLAY
 *     only; the effect works whatever rules later. A party effect GRANTED by a
 *     card (Council Seat) is not a road (FAQ p.19 — `Parliament.access()`).
 *  2. The play does nothing but put the card on the table (a data holder at 0).
 *  3. Only the OWNER's tile fires it (`cardOwner === activePlayer`): an
 *     opponent's, MarsBot's or a resolution's world move never does.
 *  4. WHICH tile: a CITY (`CITY_TILES` — a city, the Capital, Ocean City, Red
 *     City, New Holland) or a SPECIAL tile (`isSpecialTile` — the ONE
 *     definition). A greenery, an ocean or an Ares hazard never. A city TIER
 *     (Skyscrapers) is a tile placed (FAQ p.19, the TR15 reading) and fires on
 *     a cell that qualifies; a MOVED city (TR14) lands on its new cell and is
 *     read there (the engine fans the move out as a placement on the new cell).
 *  5. WHERE: ON MARS — a cell of the Mars adjacency grid (`Board.onMarsGrid`,
 *     the ONE reading the dossier gates its adjacency facts on): never a
 *     `SpaceType.COLONY` cell (Ganymede, Phobos, Nova City on its colony tile,
 *     Aurora Station's cell beside the Venus track), never the Moon (`BoardType`).
 *  6. The CELL decides, at the placement: no neighbour carries a greenery TILE
 *     or an ocean TILE ({@link museumBlockers}). An empty ocean cell, a hazard,
 *     a neighbour's city or special tile do not block.
 *  7. The payout: exactly +2 data on THIS card — a fixed target, so it lands
 *     at once (the Pets / TR15 self-target exception), SYNCHRONOUSLY inside the
 *     hook's own `tile-placed` scope (no question stands between the tile and
 *     the data, so nothing is deferred): the journal's «effect triggered», the
 *     opponents' notification, the forecast's parity and the stats come with
 *     it. Martian Fiber (TR18) answers +2 M€ through `addResourceTo` itself.
 *  8. VP: 1 per 2 data on this card (3 data → 1 VP); data other effects put
 *     here count (TR21, Pluto, a Scientists' reward), attacks take the shared path.
 *  9. Order: the tile lands → the cell's bonuses (the engine) → +2 data — once
 *     per tile; never before the tile.
 * 10. Save / load: the count survives; the hook reads the board as loaded.
 * 11. MarsBot never plays the card; solo has nothing special.
 * 12. The journal: «${0} added 2 data to ${1}» (the shared addition line) under
 *     the placement's root; Martian Fiber's own line after it.
 *
 * THE ONE PREDICATE: {@link RedMuseum.concerns} (rules 3–5) and
 * {@link museumBlockers} (rule 6) are read by the live hook, the composer's
 * forecast and the cell dossier alike — the dossier through the context's
 * flags (the tile is not on the board yet), never through `Board.isCitySpace`.
 */
export class RedMuseum extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.RED_MUSEUM,
      type: CardType.ACTIVE,
      tags: [Tag.MARS, Tag.BUILDING],
      cost: 6,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.REDS},
      victoryPoints: {resourcesHere: {}, per: 2},

      metadata: {
        cardNumber: 'TR30',
        // The printed effect is 118 (RU ≈ 140) — over the browser's caption budget of 52 (RU «… не у озеленения/океана» 51).
        infoText: [{kind: 'effect-short', text: 'City/special tile, no greenery/ocean near: +2 data'}],
        // The small orange hex «on Mars» at the tile's shoulder has no DSL item (TR15 does not draw it
        // either) — the effect's text carries it; the asterisk points at it.
        renderData: CardRenderer.builder((b) => {
          b.effect('After you place a city or special tile on Mars ADJACENT TO NO GREENERIES OR OCEANS, add 2 data resources to this card.', (eb) => {
            eb.cityorSpecialTile().asterix().startEffect.resource(CardResource.DATA, RED_MUSEUM_DATA_PER_TILE);
          }).br;
          b.vpText('1 VP per 2 data resources here.');
        }),
      },
    });
  }

  /** Rules 3–5 — the owner's own city or special tile, on the Mars grid. */
  private concerns(cardOwner: IPlayer, activePlayer: IPlayer, tile: MuseumTile): boolean {
    return cardOwner.id === activePlayer.id && tile.onMarsGrid && (tile.city || isSpecialTile(tile.tileType));
  }

  /** The live hook: rules 3–7 on the tile that has just landed — +2 data here, synchronously, recorded for the scene. */
  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, boardType: BoardType) {
    if (boardType !== BoardType.MARS) {
      return;
    }
    const board = cardOwner.game.board;
    const tile: MuseumTile = {city: Board.isCitySpace(space), tileType: space.tile?.tileType, onMarsGrid: board.onMarsGrid(space)};
    if (!this.concerns(cardOwner, activePlayer, tile) || blocked(museumBlockers(board, space))) {
      return;
    }
    payTileToCard(cardOwner, this, space, this, CardResource.DATA, RED_MUSEUM_DATA_PER_TILE, {cause: 'tile-placed'}, {log: true});
  }

  /**
   * The forecast mirror — the cell is unknown in the composer, so the honest
   * answer is cell-dependent with NO number (Mining Guild's form, owner's
   * decision 6): the museum is named, the dossier states the +2 per cell.
   */
  public tilePlacedForecast(cardOwner: IPlayer, activePlayer: IPlayer, tile: EffectForecastTile): ReadonlyArray<EffectForecastFact> {
    if (!this.concerns(cardOwner, activePlayer, {city: tile.countsAsCity, tileType: tile.tileType, onMarsGrid: !tile.offMars})) {
      return [];
    }
    return [forecast.deferred(forecast.sourceOf(this, cardOwner, 'tile-placed'), [],
      'You place a city or special tile on Mars', {
        note: 'Depends on the cell — the cell dossier will show the details',
      })];
  }

  /**
   * The dossier mirror — the SAME predicate on the cell under the cursor: the
   * tile is hypothetical (its kind comes from the context's flags), its
   * neighbours are not (read off the live board). A qualifying cell reads
   * «+2 data» and what the table answers (Martian Fiber); a cell beside a
   * greenery or an ocean says NO with the kind and the count of what stops it
   * (owner's decision 5) — never an empty block. Not the owner's tile, not a
   * city or special tile, off the grid: the card is silent (Pets beside a
   * greenery).
   */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!ctx.placesTile) {
      return [];
    }
    const board = cardOwner.game.board;
    if (!this.concerns(cardOwner, activePlayer, {city: ctx.countsAsCity, tileType: ctx.tileType, onMarsGrid: board.onMarsGrid(space)})) {
      return [];
    }
    const blockers = museumBlockers(board, space);
    if (blocked(blockers)) {
      const named = blockedTitle(blockers);
      return [placementPreviews.noEffectHere(this, named.title, {
        id: `card-${this.name}-blocked`,
        params: named.params,
        description: 'Red Museum pays only for a city or special tile with no greenery and no ocean beside it.',
      })];
    }
    const out: Array<BoardFact> = [placementPreviews.cardResourceGain(this, CardResource.DATA, RED_MUSEUM_DATA_PER_TILE,
      'No greenery or ocean beside', {id: `card-${this.name}-pays`})];
    const chip = actionPreviews.cardResourceGain(CardResource.DATA, RED_MUSEUM_DATA_PER_TILE);
    for (const fact of grantReactionFacts(cardOwner, this, [chip])) {
      const reaction = placementPreviews.forecastReaction(fact, out[0].id);
      if (reaction !== undefined) {
        out.push(reaction);
      }
    }
    return out;
  }
}

/** The named NO (owner's decision 5): the KIND of what stops the payout and how many. */
export function blockedTitle(blockers: MuseumBlockers): {title: string, params: ReadonlyArray<string>} {
  if (blockers.oceans > 0 && blockers.greeneries > 0) {
    return {title: 'Beside ${0} {ocean|oceans} and ${1} {greenery|greeneries} — no data', params: [String(blockers.oceans), String(blockers.greeneries)]};
  }
  if (blockers.oceans > 0) {
    return {title: 'Beside ${0} {ocean|oceans} — no data', params: [String(blockers.oceans)]};
  }
  return {title: 'Beside ${0} {greenery|greeneries} — no data', params: [String(blockers.greeneries)]};
}
