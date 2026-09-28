import {IGame} from '../IGame';
import {IColony, TradeTerms} from './IColony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ICard} from '../cards/ICard';
import {SelectColony} from '../inputs/SelectColony';
import {IPlayer} from '../IPlayer';
import {inplaceRemove} from '../../common/utils/utils';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';

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
    if (colony.metadata.cardResource !== undefined) {
      if (colony.metadata.cardResource === card.resourceType) {
        return true;
      }
      if (card.name === CardName.MARTIAN_EXPRESS) {
        return true;
      }
    }
    return false;
  }

  /** Would this tile be ACTIVE the moment it entered play? */
  public static colonyTileWillEnterActive(colony: IColony, game: IGame): boolean {
    if (colony.isActive) {
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

  /**
   * SEAT a chosen tile into the game — the second half of «put an additional
   * Colony Tile into play», with the choice already made.
   *
   * Split out because two entities print that sentence and differ ONLY in how
   * the tile is chosen: the human Aridor asks its owner (`addColonyTile`
   * below), MarsBot's C30 never receives a prompt and takes one at seeded
   * random. Everything after the choice — the sort, the activation check, the
   * removal from the discarded pool, the journal line — is one rule and lives
   * here, so the two cannot drift.
   */
  public static seatColonyTile(game: IGame, player: IPlayer, colonyTile: IColony): void {
    game.colonies.push(colonyTile);
    game.colonies.sort((a, b) => (a.name > b.name) ? 1 : -1);
    game.log('${0} added a new Colony tile: ${1}', (b) => b.player(player).colony(colonyTile));
    if (!colonyTile.isActive && ColoniesHandler.colonyTileWillEnterActive(colonyTile, game)) {
      colonyTile.isActive = true;
    }
    inplaceRemove(game.discardedColonies, colonyTile);
  }

  /**
   * Add a discarded colony tile back into the game, e.g. with Aridor.
   */
  public static addColonyTile(player: IPlayer, options?: {
    title?: string,
    colonies?: Array<IColony>,
    activateableOnly?: boolean,
    cb?: (colony: IColony) => void,
  }): void {
    const game = player.game;
    let colonyTiles = options?.colonies ?? game.discardedColonies;
    if (options?.activateableOnly === true) {
      colonyTiles = colonyTiles.filter((colonyTile) => ColoniesHandler.colonyTileWillEnterActive(colonyTile, game));
    }
    if (colonyTiles.length === 0) {
      game.log('No available colony tiles for ${0} to choose from', (b) => b.player(player));
      return;
    }

    const title = options?.title ?? 'Select colony tile to add';

    const selectColonyTile = new SelectColony(title, 'Add colony tile', [...colonyTiles])
      .andThen((colonyTile) => {
        ColoniesHandler.seatColonyTile(game, player, colonyTile);
        options?.cb?.(colonyTile);
        return undefined;
      });
    selectColonyTile.showTileOnly = true;
    // Adding a NEW tile to the game — the picker must show ONLY the offered
    // (not-in-play) tiles, never the existing colonies. See SelectColonyModel.
    selectColonyTile.purpose = 'addNewColonyToGame';
    player.defer(selectColonyTile);
  }
}
