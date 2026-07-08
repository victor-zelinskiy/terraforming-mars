import {CardName} from '../../common/cards/CardName';
import {ColonyName} from '../../common/colonies/ColonyName';
import {Resource} from '../../common/Resource';
import {Tag} from '../../common/cards/Tag';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {marsBotOf} from './AutomaUtil';
import {THARSIS_TRACK} from './boards/TharsisMarsBot';

/**
 * How the human's turn interacts with MarsBot (rulebook pp.4–5 + Adding
 * Expansions p.5):
 * - "Remove"/"Steal" any resources from any player → MarsBot's M€ supply, as
 *   if it were the matching resource type. With Colonies, the shipping-board
 *   storage areas hold REAL resources of their type ("you may steal/remove
 *   from them as usual") — those go first, the M€ proxy tops up the rest.
 * - "Decrease" any production → regress the mapped MarsBot track (with the
 *   no-reactivation regression marker).
 * - Counting what other/all players have → the current track positions.
 */
export class AutomaTargeting {
  /** Which storage area holds REAL resources of this type (Adding Expansions p.5). */
  private static readonly RESOURCE_STORAGE: Partial<Record<Resource, ColonyName>> = {
    [Resource.STEEL]: ColonyName.CERES,
    [Resource.TITANIUM]: ColonyName.TRITON,
    [Resource.PLANTS]: ColonyName.GANYMEDE,
    [Resource.ENERGY]: ColonyName.CALLISTO,
    [Resource.HEAT]: ColonyName.IO,
    [Resource.MEGACREDITS]: ColonyName.LUNA,
  };

  /** Decrease production → regress this track (rulebook pp.4–5). */
  private static readonly PRODUCTION_TRACK: Record<Resource, number> = {
    [Resource.STEEL]: THARSIS_TRACK.BUILDING,
    [Resource.TITANIUM]: THARSIS_TRACK.SPACE,
    [Resource.MEGACREDITS]: THARSIS_TRACK.EVENT,
    [Resource.ENERGY]: THARSIS_TRACK.ENERGY,
    [Resource.HEAT]: THARSIS_TRACK.EARTH,
    [Resource.PLANTS]: THARSIS_TRACK.BIO,
  };

  private static storageOf(game: IGame, colony: ColonyName | undefined): number {
    if (colony === undefined || !game.gameOptions.coloniesExtension) {
      return 0;
    }
    return game.automa?.shippingStorage[colony] ?? 0;
  }

  /**
   * The stock a remove/steal target effectively holds. For MarsBot: the real
   * storage resources of that type plus the M€-supply proxy. Use this wherever
   * an attack builds its target options.
   */
  public static attackableStock(target: IPlayer, resource: Resource): number {
    if (!target.isMarsBot) {
      return target.stock.get(resource);
    }
    const game = target.game;
    if (resource === Resource.MEGACREDITS) {
      return target.megaCredits + AutomaTargeting.storageOf(game, ColonyName.LUNA);
    }
    return AutomaTargeting.storageOf(game, AutomaTargeting.RESOURCE_STORAGE[resource]) + target.megaCredits;
  }

  /**
   * Apply a remove/steal of `count` resources to MarsBot: real storage
   * resources of the type first ("as usual"), the M€ supply tops up the rest
   * (the base proxy rule). For M€ itself the supply is primary, the Luna
   * storage tops up. A thief receives the full removed amount AS the stolen
   * resource type.
   */
  public static removeFromBot(bot: IPlayer, perpetrator: IPlayer, resource: Resource, count: number,
    options?: {log?: boolean, stealing?: boolean}): void {
    const game = bot.game;
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const takeFromStorage = (colony: ColonyName | undefined, upTo: number): number => {
      const available = AutomaTargeting.storageOf(game, colony);
      const taken = Math.min(available, upTo);
      if (taken > 0 && colony !== undefined) {
        automa.shippingStorage[colony] = available - taken;
        game.log('${0} lost ${1} resource(s) from its ${2} storage area', (b) =>
          b.player(bot).number(taken).string(colony));
      }
      return taken;
    };
    const takeFromSupply = (upTo: number): number => {
      const taken = Math.min(bot.megaCredits, upTo);
      if (taken > 0) {
        bot.stock.deduct(Resource.MEGACREDITS, taken, {log: options?.log ?? true, from: {player: perpetrator}});
      }
      return taken;
    };

    let removed = 0;
    if (resource === Resource.MEGACREDITS) {
      removed += takeFromSupply(count);
      removed += takeFromStorage(ColonyName.LUNA, count - removed);
    } else {
      removed += takeFromStorage(AutomaTargeting.RESOURCE_STORAGE[resource], count);
      removed += takeFromSupply(count - removed);
    }

    if (options?.stealing && removed > 0) {
      perpetrator.stock.add(resource, removed, {log: options?.log ?? true});
    }
  }

  /**
   * The composite removal for CARD-resource attacks on MarsBot (Virus's
   * animals): the matching storage area (Miranda / Enceladus) first, then the
   * M€ proxy. Returns the amount removed.
   */
  public static removeCardResourceLikeFromBot(game: IGame, count: number, storageColony: ColonyName | undefined): number {
    const bot = marsBotOf(game);
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    let removed = 0;
    const available = AutomaTargeting.storageOf(game, storageColony);
    const fromStorage = Math.min(available, count);
    if (fromStorage > 0 && storageColony !== undefined) {
      automa.shippingStorage[storageColony] = available - fromStorage;
      game.log('${0} lost ${1} resource(s) from its ${2} storage area', (b) =>
        b.player(bot).number(fromStorage).string(storageColony));
      removed += fromStorage;
    }
    const fromSupply = Math.min(bot.megaCredits, count - removed);
    if (fromSupply > 0) {
      bot.stock.deduct(Resource.MEGACREDITS, fromSupply, {log: true});
      removed += fromSupply;
    }
    return removed;
  }

  /** How many card-resource-like units MarsBot can lose (for building the option). */
  public static cardResourceLikeStock(game: IGame, storageColony: ColonyName | undefined): number {
    return AutomaTargeting.storageOf(game, storageColony) + marsBotOf(game).megaCredits;
  }

  /**
   * "Decrease any player's production" → the mapped tracker regresses (one
   * space per production step), leaving the no-reactivation marker.
   */
  public static regressForProduction(game: IGame, resource: Resource, steps: number): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const track = automa.board.tracks[AutomaTargeting.PRODUCTION_TRACK[resource]];
    let regressed = 0;
    for (let i = 0; i < steps && track.position > 0; i++) {
      track.regress();
      regressed++;
    }
    if (regressed > 0) {
      game.log('${0} track for ${1} production regressed ${2} step(s)', (b) =>
        b.player(marsBotOf(game)).string(resource).number(regressed));
    }
  }

  /**
   * READ-ONLY preview of a decrease-production attack on MarsBot — which TRACK
   * regresses, its `from → to`, and how many steps actually apply (capped by the
   * track position). Mirrors `regressForProduction` WITHOUT mutating. Used to
   * build the target-selection preview (`targetImpact.ts`); `tag` is the track's
   * identity tag so the row can show WHICH track is hit.
   */
  public static previewProductionRegression(game: IGame, resource: Resource, steps: number): {tag: Tag, from: number, to: number, steps: number} | undefined {
    const automa = game.automa;
    if (automa === undefined) {
      return undefined;
    }
    const track = automa.board.tracks[AutomaTargeting.PRODUCTION_TRACK[resource]];
    const applied = Math.min(steps, track.position);
    return {tag: track.definition.tags[0], from: track.position, to: track.position - applied, steps: applied};
  }

  /**
   * READ-ONLY preview of a remove/steal attack on MarsBot — the SAME order
   * `removeFromBot` drains: real Colonies storage of the type first (M€ itself:
   * supply first, Luna tops up), then the M€ supply. So the picker can show the
   * ACTUAL loss (storage row + the M€-supply row) instead of the static
   * placeholder field. Non-mutating.
   */
  public static previewStockLoss(target: IPlayer, resource: Resource, amount: number): {
    storageColony: ColonyName | undefined, storageFrom: number, storageLost: number, supplyFrom: number, supplyLost: number,
  } {
    const game = target.game;
    const supplyFrom = target.megaCredits;
    if (resource === Resource.MEGACREDITS) {
      const supplyLost = Math.min(amount, supplyFrom);
      const storageFrom = AutomaTargeting.storageOf(game, ColonyName.LUNA);
      const storageLost = Math.min(amount - supplyLost, storageFrom);
      return {storageColony: ColonyName.LUNA, storageFrom, storageLost, supplyFrom, supplyLost};
    }
    const storageColony = AutomaTargeting.RESOURCE_STORAGE[resource];
    const storageFrom = AutomaTargeting.storageOf(game, storageColony);
    const storageLost = Math.min(amount, storageFrom);
    const supplyLost = Math.min(amount - storageLost, supplyFrom);
    return {storageColony, storageFrom, storageLost, supplyFrom, supplyLost};
  }

  /** A decrease-production target is valid while the mapped track can regress that far. */
  public static botCanHaveProductionReduced(game: IGame, resource: Resource, minQuantity: number): boolean {
    const automa = game.automa;
    if (automa === undefined) {
      return false;
    }
    return automa.board.tracks[AutomaTargeting.PRODUCTION_TRACK[resource]].position >= minQuantity;
  }

  /**
   * "If an effect requires you to count the number of something other or all
   * players have, use the respective tracks on MarsBot's board instead of its
   * played cards" — always the CURRENT position, even after a regression.
   * FAQ exception (rulebook p.11): Galilean Waystation counts HALF the
   * respective (Jovian) track position, rounded down.
   */
  public static automaTagCount(game: IGame, tag: Tag, forCard?: CardName): number {
    const automa = game.automa;
    if (automa === undefined) {
      return 0;
    }
    const trackIndex = automa.board.getTrackIndexForTag(tag);
    if (trackIndex === undefined) {
      return 0;
    }
    const position = automa.board.tracks[trackIndex].position;
    if (forCard === CardName.GALILEAN_WAYSTATION) {
      return Math.floor(position / 2);
    }
    return position;
  }

  /** Tag count for target filters: MarsBot's tags ARE its track positions. */
  public static effectiveTagCount(player: IPlayer, tag: Tag): number {
    if (player.isMarsBot) {
      return AutomaTargeting.automaTagCount(player.game, tag);
    }
    return player.tags.count(tag, 'raw');
  }
}
