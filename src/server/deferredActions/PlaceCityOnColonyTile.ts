import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {IColony} from '../colonies/IColony';
import {ColoniesHandler, NO_COLONY_TILE_IN_PLAY_REASON} from '../colonies/ColoniesHandler';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {recordSkippedEffect} from './skippedEffect';
import {SelectColony} from '../inputs/SelectColony';
import {InputError} from '../inputs/InputError';
import {Counter} from '../behavior/Counter';
import {cardVictoryPointsAtPlay} from '../game/calculateVictoryPoints';
import type {SkippedEffect} from '../cards/actionPreviews';
import {EffectForecastTile} from '../cards/EffectForecastContext';
import {ChoiceContextSource, SelectColonyModel} from '../../common/models/PlayerInputModel';
import {ColonyTileSite} from '../../common/colonies/ColonyTileSite';
import {TileType} from '../../common/TileType';
import {Space} from '../boards/Space';

/** The prompt's title — an English i18n key (the journal text; the console reads the marker, never this). */
export const PLACE_CITY_ON_COLONY_TILE_TITLE = 'Select a colony tile for the city';

/** The skip label — the effect a lost «place a city on a colony tile» is NAMED by. */
export const CITY_ON_COLONY_TILE_LABEL = 'City on a colony tile';

/** The answer named a tile that left the game between the question and the answer (TR10 replaced it). */
export const COLONY_TILE_LEFT_PLAY_REASON = 'This colony tile is no longer in play';

/**
 * What a lost «place a city on a colony tile» is NAMED by — the one
 * description the play preview's warning (`actionPreviews.colonyPickStep`) and
 * the after-the-fact record share. No magnitude: a tile is not an amount.
 */
export function skippedCityOnColonyTile(reason: string = NO_COLONY_TILE_IN_PLAY_REASON): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: CITY_ON_COLONY_TILE_LABEL}};
}

/**
 * «PLACE A CITY ON A COLONY TILE IN PLAY.» (Turmoil Redux TR22 Nova City) —
 * the shared step a card that puts its city on a colony tile inherits.
 *
 * WHO IS ASKED ABOUT WHAT:
 *  · any colony TILE in play — anybody's, with colonies on it or with none,
 *    with a docked fleet, active or INACTIVE (the precedent is TR10's reading:
 *    «activity and the track do not matter»). A tile of the reserve is not in
 *    play. Nothing is disabled today — no rule refuses a tile, and no reason
 *    is invented for one;
 *  · a SINGLE tile in play is still asked (no auto-select: the player sees
 *    which tile carries the city).
 *
 * WHAT THE PICK DOES is the marker's (`tileSite`): the city tile, the hosted
 * cell it lands on, and the server's projection — the player's space cities
 * now and after, and what the placing card will score (the `Counter` and the
 * play's own VP projection, never the client).
 *
 * THE CITY IS THE CARD'S — `card` gives the cell (its row of the builder's
 * table), the tile's `card`, the giver of the prompt and the rule the VP
 * projection reads. The placement itself is the ONE writer's
 * (`ColoniesHandler.placeCityOnColonyTile`): this file holds no `addCity` and
 * no write of `colony.tiles`.
 *
 * NO TILE TO CHOOSE (or the card's cell already taken) is a NAMED skip — the
 * card guards both in its own `canPlay`, so the skip is the engine's floor,
 * not a path a player meets.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and
 * `previewSelectColony()` describes it without touching anything — the play
 * preview's staged door (`actionPreviews.colonyPickStep`) shows the very
 * prompt the commit will ask.
 *
 * Priority: `DEFAULT` — a card's own on-play input (an effect the same play
 * triggers can be asked first; the staged tail is ADDRESSED for exactly that,
 * `deferredInputBatch`). A tile that TR10 replaced while the tail was parked
 * is no longer among the candidates: `SelectColony.process` refuses it, the
 * tail is dropped as stale and the question stands live.
 */
export class PlaceCityOnColonyTile extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The card whose city it is — the cell, the tile's card, the giver and the VP rule. */
    public readonly card: ICard,
  ) {
    super(player, Priority.DEFAULT);
  }

  /** The giver — the prompt's `choiceContext.source`, the staged tail's address. */
  public get cause(): ChoiceContextSource {
    return {kind: 'card', card: this.card.name};
  }

  /** The candidates — every colony tile in play, the table's order. */
  private candidates(): Array<IColony> {
    return [...this.player.game.colonies];
  }

  /** Why the step cannot ask at all — the writer's own reason function (`undefined` when it can). */
  private blockedReason(): string | undefined {
    return ColoniesHandler.cityOnColonyTileBlockedReason(this.player.game, this.card.name);
  }

  /** The projection the marker carries — counted by the engine, for the tile on `space`. */
  private site(space: Space): ColonyTileSite {
    const player = this.player;
    const before = new Counter(player, this.card).count({cities: {where: 'offmars'}, all: false});
    // The tile exactly as the effect forecast reads it off this marker (`tilesOfBranch`).
    const landing: EffectForecastTile = {
      tileType: TileType.CITY,
      count: 1,
      countsAsCity: true,
      countsAsOcean: false,
      countsAsGreenery: false,
      placementType: 'city',
      offMars: true,
      space: space.id,
    };
    const site: ColonyTileSite = {
      tile: TileType.CITY,
      space: space.id,
      color: player.color,
      card: this.card.name,
      spaceCities: {before, after: before + 1},
    };
    const scored = cardVictoryPointsAtPlay(player, this.card, [landing]);
    if (scored !== undefined) {
      site.victoryPoints = scored.victoryPoint;
    }
    return site;
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(space: Space): SelectColony {
    const select = new SelectColony(PLACE_CITY_ON_COLONY_TILE_TITLE, 'Select', this.candidates());
    select.tileSite = this.site(space);
    select.markChoiceContext({source: this.cause, mode: 'effect-choice'});
    return select;
  }

  /**
   * READ-ONLY: the `SelectColonyModel` the live path WOULD raise — the same
   * title, candidates, `tileSite` projection and giver — or `undefined`
   * exactly where `execute()` records the skip. Nothing is mutated, logged or
   * queued. `choiceContext` is decorated centrally on a live prompt
   * (`ServerModel.getWaitingFor`), so it is attached here by hand.
   */
  public previewSelectColony(): SelectColonyModel | undefined {
    const space = ColoniesHandler.colonyTileCitySpace(this.player.game, this.card.name);
    if (space === undefined || this.blockedReason() !== undefined) {
      return undefined;
    }
    const select = this.prompt(space);
    const model = select.toModel(this.player);
    model.choiceContext = select.choiceContext;
    return model;
  }

  /** The named skip the preview promises where `previewSelectColony()` has no prompt — the cause `execute()` records. */
  public previewSkip(): {reason: string, skipped: SkippedEffect} {
    return skippedCityOnColonyTile(this.blockedReason());
  }

  public execute(): SelectColony | undefined {
    const player = this.player;
    const game = player.game;
    const space = ColoniesHandler.colonyTileCitySpace(game, this.card.name);
    const blocked = this.blockedReason();
    if (space === undefined || blocked !== undefined) {
      const lost = skippedCityOnColonyTile(blocked);
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return undefined;
    }
    return this.prompt(space).andThen((colony) => {
      // Re-read at the answer: the world may have moved between the question
      // and the answer. A tile that left the game is refused — the question
      // stands; a cell taken meanwhile is the named skip.
      if (!game.colonies.includes(colony)) {
        throw new InputError(COLONY_TILE_LEFT_PLAY_REASON);
      }
      const taken = this.blockedReason();
      if (taken !== undefined) {
        const lost = skippedCityOnColonyTile(taken);
        recordSkippedEffect(player, lost.reason, lost.skipped);
        return undefined;
      }
      ColoniesHandler.placeCityOnColonyTile(game, player, colony, {card: this.card.name});
      return undefined;
    });
  }
}
