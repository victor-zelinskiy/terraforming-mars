import {IGame} from '../IGame';
import {colonyCardResources} from '../../common/colonies/ColonyMetadata';
import {IColony, TradeTerms} from './IColony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ICard} from '../cards/ICard';
import {SelectColony} from '../inputs/SelectColony';
import {IPlayer} from '../IPlayer';
import {inplaceRemove} from '../../common/utils/utils';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {EventSource} from '../../common/events/EventSource';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {MARSBOT_COLONY_TRACK_START} from '../../common/constants';
import {SpaceId} from '../../common/Types';
import {Space} from '../boards/Space';
import {expansionSpaceColonies} from '../../common/boards/expansionSpaceColonies';

/** Rule 3 of the roster: a tile with a colony on it (anybody's — MarsBot's cube too) cannot leave the game. */
export const COLONY_TILE_HAS_COLONIES_REASON = 'This colony tile has colonies on it';
/** …nor a tile that carries a TILE (Turmoil Redux TR22 — a city placed on the colony tile). */
export const COLONY_TILE_HAS_TILE_REASON = 'A tile stands on this colony tile';
/** …and neither can a tile a trade fleet stands on. */
export const COLONY_TILE_HAS_FLEET_REASON = 'A trade fleet stands on this colony tile';

/** A city for a colony tile, and no colony tile in the game to carry it (unreachable in Turmoil Redux — written, not assumed). */
export const NO_COLONY_TILE_IN_PLAY_REASON = 'No colony tile is in play';
/** The card's own city already stands on a colony tile — its cell is taken (a second copy of the card). */
export const CITY_ALREADY_ON_COLONY_TILE_REASON = 'This city already stands on a colony tile';

export class ColoniesHandler {
  public static getColony(game: IGame, colonyName: ColonyName, includeDiscardedColonies: boolean = false): IColony {
    let colony: IColony | undefined = game.colonies.find((c) => c.name === colonyName);
    if (colony !== undefined) {
      return colony;
    }
    if (includeDiscardedColonies === true) {
      colony = game.discardedColonies.find((c) => c.name === colonyName);
      if (colony !== undefined) {
        return colony;
      }
    }
    throw new Error(`Unknown colony '${colonyName}'`);
  }

  /** The colonies OPEN to trade at all: active, and no fleet docked. Nobody's question yet. */
  public static openColonies(game: IGame): Array<IColony> {
    return game.colonies.filter((colony) => colony.isActive && colony.visitor === undefined);
  }

  /**
   * The colonies `player` may trade with RIGHT NOW: open, and not refusing
   * this player (`IColony.tradeBlockedReason` — the Turmoil Redux Pluto with
   * no card to hold its data). `bonusTradeOffset` is the extra track step the
   * payment path in question grants (the Unity action's +1): a refusal at the
   * low positions can lift when the reach is longer, so the question is asked
   * per player AND per path — never for the table alone.
   */
  public static tradeableColonies(game: IGame, player: IPlayer, terms: number | TradeTerms = 0): Array<IColony> {
    return ColoniesHandler.openColonies(game)
      .filter((colony) => colony.tradeBlockedReason(player, terms) === undefined);
  }

  /** The open colonies that REFUSE `player` right now, each with its reason (the complement of `tradeableColonies`). */
  public static blockedColonies(game: IGame, player: IPlayer, terms: number | TradeTerms = 0): Array<{colony: IColony, reason: string}> {
    const out: Array<{colony: IColony, reason: string}> = [];
    for (const colony of ColoniesHandler.openColonies(game)) {
      const reason = colony.tradeBlockedReason(player, terms);
      if (reason !== undefined) {
        out.push({colony, reason});
      }
    }
    return out;
  }

  /**
   * A «which colony to trade with» pick for `player`: the tradeable colonies
   * selectable, the refused ones DISABLED with their reason (never dropped —
   * a tile that silently vanished from the picker is the one the player asks
   * about). The caller chains its own `andThen`. `terms` are the paying
   * path's (the extra step, the M€ fee) — a bare number is the step alone.
   */
  public static tradeColonyPick(player: IPlayer, title: string | Message, buttonLabel: string, terms: number | TradeTerms = 0): SelectColony {
    const game = player.game;
    const select = new SelectColony(title, buttonLabel, ColoniesHandler.tradeableColonies(game, player, terms));
    select.disabledColonies = ColoniesHandler.blockedColonies(game, player, terms);
    return select;
  }

  /**
   * THE PLAYER'S COLONIES — one entry per CUBE of theirs on a colony tile, in
   * the table's order (a tile holding two of their cubes appears twice). This
   * is THE ONE reading of «each colony you have»: the behavior counter
   * (`Counter` — «colonies» countables), `Player.getColoniesCount` (awards,
   * Microgravity Nutrition…) and the parliament's counted term (Jovian Tax
   * Rights — «1 M€ production per colony», explained tile by tile) all stand
   * on it, so none of them can drift from the others. A game without the
   * Colonies expansion has no colonies.
   */
  public static coloniesOf(game: IGame, player: IPlayer): Array<IColony> {
    // No extension gate: without Colonies the table is simply empty, and a gate here
    // silently zeroed every colony count in specs that seat a tile without the flag.
    const out: Array<IColony> = [];
    for (const colony of game.colonies) {
      for (const owner of colony.colonies) {
        if (owner === player.id) {
          out.push(colony);
        }
      }
    }
    return out;
  }

  public static maybeActivateColonies(game: IGame, card: ICard) {
    if (!game.gameOptions.coloniesExtension) {
      return;
    }
    game.colonies.forEach((colony) => {
      if (colony.isActive === false && ColoniesHandler.cardActivatesColony(colony, card)) {
        colony.isActive = true;
      }
    });
  }

  /*
   * Return true if the colony is active, or will be activated by this card.
   *
   * Returns `true` if the colony is already active, or becomes active from this
   * call.
   */
  public static cardActivatesColony(colony: IColony, card: ICard): boolean {
    if (colony.isActive) {
      return true;
    }
    // A card holding ANY of the tile's kinds activates it (one kind for
    // every tile but the Redux Vesta, whose three kinds each wake it).
    const kinds = colonyCardResources(colony.metadata);
    if (kinds.length > 0) {
      if (card.resourceType !== undefined && kinds.includes(card.resourceType)) {
        return true;
      }
      if (card.name === CardName.MARTIAN_EXPRESS) {
        return true;
      }
    }
    return false;
  }

  /**
   * Would this tile be ACTIVE the moment it entered play? The ONE reading —
   * the roster's writers apply it (`enterPlay`) and the roster prompt projects
   * it on every candidate (`ColonyRosterIncoming.entersActive`), so a promise
   * and an entry cannot read apart.
   */
  public static colonyTileWillEnterActive(colony: IColony, game: IGame): boolean {
    if (colony.isActive) {
      return true;
    }
    // The MarsBot table's own rule: every tile is active (Adding Expansions p.4).
    if (game.automa !== undefined) {
      return true;
    }
    for (const player of game.players) {
      for (const card of player.tableau) {
        if (ColoniesHandler.cardActivatesColony(colony, card)) {
          return true;
        }
      }
    }
    return false;
  }

  // ─────────────────────── THE COLONY ROSTER — ONE WRITER ───────────────────────
  //
  // Which tiles are in the game, and in which slot, is written by THREE
  // functions and nothing else (the dealer's setup / restore and
  // `Game.deserialize` aside — source-level guard: tests/colonies/ColonyRoster.spec.ts):
  //
  //   seatColonyTile     a reserve tile ENTERS (sorted in by name — an addition);
  //   retireColonyTile   a tile in play LEAVES for the reserve, fresh;
  //   replaceColonyTile  one leaves and another takes ITS slot, atomically.
  //
  // Each records ONE `colony-roster-changed` event (`ColonyRosterChange`), so
  // «a tile entered / left the game» is a fact for every reader — MarsBot's
  // setup included, without a single `if (bot)`. docs/COLONY_ROSTER_CEREMONY.md.

  /**
   * «NO COLONIES, TILES, OR TRADE FLEETS ON IT» (Turmoil Redux TR10) — the ONE
   * predicate of a tile that may leave the game: `undefined` when it may, else
   * the ONE reason, the more permanent thing first (a colony outlasts a fleet,
   * which goes home at the end of the generation).
   *
   * THE PRINTED ORDER IS THE ORDER OF THE REASONS: colonies → tiles → fleets.
   * «TILES» is a tile that lies ON the colony tile (`IColony.tiles` — Turmoil
   * Redux TR22 Nova City's city): as permanent as a colony. The track and the
   * activity do not matter (an inactive Titan with nobody on it may leave),
   * and MarsBot's stock on its Shipping Board is on the bot's board, not on
   * the tile.
   */
  public static colonyTileOccupiedReason(colony: IColony): string | undefined {
    if (colony.colonies.length > 0) {
      return COLONY_TILE_HAS_COLONIES_REASON;
    }
    if (colony.tiles.length > 0) {
      return COLONY_TILE_HAS_TILE_REASON;
    }
    if (colony.visitor !== undefined) {
      return COLONY_TILE_HAS_FLEET_REASON;
    }
    return undefined;
  }

  /** May this tile leave the game? See {@link colonyTileOccupiedReason}. */
  public static colonyTileIsVacant(colony: IColony): boolean {
    return ColoniesHandler.colonyTileOccupiedReason(colony) === undefined;
  }

  /** The tile's state the moment it ENTERS play — the engine's activation rule, or the MarsBot table's. */
  private static enterPlay(game: IGame, colonyTile: IColony): void {
    if (game.automa !== undefined) {
      // A tile that joins a MarsBot table sits by the table's rule, exactly as
      // the tiles dealt at setup did (`AutomaColonies.setupColonies`).
      colonyTile.isActive = true;
      colonyTile.trackPosition = MARSBOT_COLONY_TRACK_START;
      return;
    }
    if (!colonyTile.isActive && ColoniesHandler.colonyTileWillEnterActive(colonyTile, game)) {
      colonyTile.isActive = true;
    }
  }

  /**
   * A tile as it lies IN THE BOX: a new instance of its own class — the track
   * on its start, the class's own activity, nobody on it. Exactly what a load
   * rebuilds the reserve from (`ColonyDealer.restore`), so a tile retired live
   * and a tile found in the reserve after a save/load are the same tile.
   * (Every colony class has a zero-argument constructor — `IColonyFactory`.)
   */
  private static boxed(colonyTile: IColony): IColony {
    return new (colonyTile.constructor as new () => IColony)();
  }

  private static toReserve(game: IGame, colonyTile: IColony): void {
    game.discardedColonies.push(ColoniesHandler.boxed(colonyTile));
    game.discardedColonies.sort((a, b) => (a.name > b.name) ? 1 : -1);
  }

  /**
   * SEAT a chosen tile into the game — the second half of «put an additional
   * Colony Tile into play», with the choice already made.
   *
   * Split out because two entities print that sentence and differ ONLY in how
   * the tile is chosen: the human Aridor asks its owner (`addColonyTile`
   * below), MarsBot's C30 never receives a prompt and takes one at seeded
   * random. Everything after the choice — the sort, the activation check, the
   * removal from the discarded pool, the journal line, the roster event — is
   * one rule and lives here, so the two cannot drift.
   *
   * `cause` names the giver for the event where no scope is live.
   */
  public static seatColonyTile(game: IGame, player: IPlayer, colonyTile: IColony, cause?: EventSource): void {
    game.colonies.push(colonyTile);
    game.colonies.sort((a, b) => (a.name > b.name) ? 1 : -1);
    game.log('${0} added a new Colony tile: ${1}', (b) => b.player(player).colony(colonyTile));
    ColoniesHandler.enterPlay(game, colonyTile);
    inplaceRemove(game.discardedColonies, colonyTile);
    game.events.recordColonyRosterChanged(player, {kind: 'add', added: colonyTile.name, slot: game.colonies.indexOf(colonyTile)}, cause);
  }

  /**
   * RETIRE a tile in play: it leaves `game.colonies` (the others keep their
   * order and close the gap) and returns to the reserve AS IT LIES IN THE BOX
   * — a later effect may bring it back, fresh. Writes no journal line of its
   * own (the caller's sentence names the rule that removed it); records the
   * roster event. `player` is absent for a change nobody made.
   */
  public static retireColonyTile(game: IGame, player: IPlayer | undefined, colonyTile: IColony, cause?: EventSource): void {
    const slot = game.colonies.indexOf(colonyTile);
    if (slot < 0) {
      throw new Error(`Colony tile ${colonyTile.name} is not in the game`);
    }
    game.colonies.splice(slot, 1);
    ColoniesHandler.toReserve(game, colonyTile);
    game.events.recordColonyRosterChanged(player, {kind: 'remove', removed: colonyTile.name, slot}, cause);
  }

  /**
   * REPLACE a tile in play with a reserve tile — «remove from play a colony
   * tile… replace it with a new colony tile» (Turmoil Redux TR10).
   *
   * ATOMIC: there is no state of the table with a hole in it, so no prompt can
   * ever be asked between the removal and the arrival. `incoming` takes
   * `outgoing`'s SLOT (the same index — no re-sort, no other tile moves: the
   * grid does not shift and MarsBot's count through the list keeps its order),
   * enters by the table's rule (`enterPlay`) and leaves the reserve; `outgoing`
   * returns to the reserve as it lies in the box. ONE journal line, ONE event.
   */
  public static replaceColonyTile(game: IGame, player: IPlayer, outgoing: IColony, incoming: IColony, cause?: EventSource): void {
    const slot = game.colonies.indexOf(outgoing);
    if (slot < 0) {
      throw new Error(`Colony tile ${outgoing.name} is not in the game`);
    }
    if (!game.discardedColonies.includes(incoming)) {
      throw new Error(`Colony tile ${incoming.name} is not in the reserve`);
    }
    game.colonies[slot] = incoming;
    inplaceRemove(game.discardedColonies, incoming);
    ColoniesHandler.enterPlay(game, incoming);
    ColoniesHandler.toReserve(game, outgoing);
    game.log('${0} replaced the ${1} colony tile with ${2}', (b) => b.player(player).colony(outgoing).colony(incoming));
    game.events.recordColonyRosterChanged(player, {kind: 'replace', removed: outgoing.name, added: incoming.name, slot}, cause);
  }

  // ─────────────────── A TILE ON A COLONY TILE — ONE WRITER ───────────────────
  //
  // «Place a city ON A COLONY TILE in play» (Turmoil Redux TR22 Nova City).
  // The city is a REAL city tile of the player on a cell of the board's list
  // (a `SpaceType.COLONY` cell the builder lays for the card —
  // `expansionSpaceColonies`), so every counter of cities reads it with no
  // help; the colony tile only records WHERE it lies (`IColony.tiles`). That
  // link has ONE writer — `placeCityOnColonyTile` — and (de)serialization
  // (source-level guard: tests/colonies/ColonyCity.spec.ts).
  // docs/TURMOIL_REDUX_NOVA_CITY.md.

  /** The colony tile `spaceId`'s tile lies on, when it lies on one. */
  public static colonyTileHosting(game: IGame, spaceId: SpaceId): IColony | undefined {
    return game.colonies.find((colony) => colony.tiles.includes(spaceId));
  }

  /**
   * THE CELL a card's city on a colony tile occupies — the card's own row of
   * the builder's table. `undefined` when the card has no such cell or the
   * game's board does not carry it.
   */
  public static colonyTileCitySpace(game: IGame, card: CardName): Space | undefined {
    const entry = expansionSpaceColonies.find((row) => row.card === card);
    return entry === undefined ? undefined : game.board.spaces.find((space) => space.id === entry.name);
  }

  /**
   * Why `card`'s city cannot be placed on ANY colony tile right now — ONE
   * reason, in order: the city's own cell is taken (the card was already
   * played — a fixed cell answers silently in the engine, `Executor`; here it
   * is named), then «no colony tile is in play». `undefined` when a tile can
   * be chosen. Read by the card's `canPlay` / `unplayableReason` and
   * re-asked by the writer.
   */
  public static cityOnColonyTileBlockedReason(game: IGame, card: CardName): string | undefined {
    const space = ColoniesHandler.colonyTileCitySpace(game, card);
    if (space === undefined || space.tile !== undefined) {
      return CITY_ALREADY_ON_COLONY_TILE_REASON;
    }
    if (game.colonies.length === 0) {
      return NO_COLONY_TILE_IN_PLAY_REASON;
    }
    return undefined;
  }

  /**
   * PLACE `cause.card`'s CITY ON A COLONY TILE — the ONE place a tile comes to
   * lie on a colony tile.
   *
   * THE ORDER IS LOAD-BEARING: the link (`colony.tiles`) is written BEFORE the
   * tile lands, so everything the landing sets off — the `tile-placed` event
   * (it names the colony tile), every `onTilePlaced` hook, the chairman quest
   * — already knows WHERE the city is. The city itself is the engine's
   * (`game.addCity`): a new city tile of the player's, off Mars, with the card
   * on it from the start (a fixed cell's `behavior.city.space` sets the card
   * only AFTER the hooks). No placement bonus exists: the cell prints none and
   * has no neighbours.
   *
   * IT IS NOT A COLONY: no cube, no berth, no track step, no build bonus —
   * the tile's trade and its owners' bonus are untouched.
   *
   * `addTile` writes no journal line for an off-board cell
   * (`LogHelper.logBoardTileAction`), so the placement's own sentence is
   * written here, after the landing.
   */
  public static placeCityOnColonyTile(game: IGame, player: IPlayer, colony: IColony, cause: {card: CardName}): void {
    if (!game.colonies.includes(colony)) {
      throw new Error(`Colony tile ${colony.name} is not in the game`);
    }
    const space = ColoniesHandler.colonyTileCitySpace(game, cause.card);
    if (space === undefined) {
      throw new Error(`${cause.card} has no city cell in this game`);
    }
    if (space.tile !== undefined) {
      throw new Error(`The city cell of ${cause.card} is occupied`);
    }
    colony.tiles.push(space.id);
    game.addCity(player, space, cause.card);
    game.log('${0} placed a city on the ${1} colony tile', (b) => b.player(player).colony(colony));
  }

  /**
   * Add a discarded colony tile back into the game, e.g. with Aridor.
   *
   * `cause` is the GIVER (the card or corporation whose effect asks) — the
   * prompt's `choiceContext.source`; the prompt carries the roster marker
   * (`rosterChange: {kind: 'add'}`) with the server's «will it enter active»
   * for every tile of the catalog.
   */
  public static addColonyTile(player: IPlayer, options: {
    cause: ChoiceContextSource,
    title?: string,
    colonies?: Array<IColony>,
    activateableOnly?: boolean,
    cb?: (colony: IColony) => void,
  }): void {
    const game = player.game;
    let colonyTiles = options.colonies ?? game.discardedColonies;
    if (options.activateableOnly === true) {
      colonyTiles = colonyTiles.filter((colonyTile) => ColoniesHandler.colonyTileWillEnterActive(colonyTile, game));
    }
    if (colonyTiles.length === 0) {
      game.log('No available colony tiles for ${0} to choose from', (b) => b.player(player));
      return;
    }

    const title = options.title ?? 'Select colony tile to add';

    const selectColonyTile = new SelectColony(title, 'Add colony tile', [...colonyTiles])
      .andThen((colonyTile) => {
        ColoniesHandler.seatColonyTile(game, player, colonyTile);
        options.cb?.(colonyTile);
        return undefined;
      });
    selectColonyTile.showTileOnly = true;
    // Adding a NEW tile to the game — the picker must show ONLY the offered
    // (not-in-play) tiles, never the existing colonies. See SelectColonyModel.
    selectColonyTile.purpose = 'addNewColonyToGame';
    selectColonyTile.rosterChange = {
      kind: 'add',
      incoming: colonyTiles.map((colonyTile) => ({
        colony: colonyTile.name,
        entersActive: ColoniesHandler.colonyTileWillEnterActive(colonyTile, game),
      })),
    };
    selectColonyTile.markChoiceContext({source: options.cause, mode: 'effect-choice'});
    player.defer(selectColonyTile);
  }
}
