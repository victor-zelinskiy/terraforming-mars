import {ColonyName} from '../../common/colonies/ColonyName';
import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {shippingAreaFor} from '../../common/automa/ShippingBoardData';
import {GiveColonyBonus} from '../deferredActions/GiveColonyBonus';
import {IColony} from '../colonies/IColony';
import {IGame} from '../IGame';
import {AutomaResolver} from './AutomaResolver';
import {AutomaTilePlacer} from './AutomaTilePlacer';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';

/**
 * The MarsBot Colonies machinery (Adding Expansions pp.4–6): the shipping
 * board storage areas, the 5-resources → track exchange, colony building and
 * trading via the flip-count method, Europa's replacements and the 2nd trade
 * fleet unlock.
 */
export class AutomaColonies {
  /**
   * Setup (Adding Expansions p.4): "all Colony tiles (including Titan,
   * Enceladus, and Miranda) start with their tracker on the highlighted second
   * step" — every tile is active from the start, tracker on step 2 (the white
   * cube of the physical setup marks exactly this).
   */
  public static setupColonies(game: IGame): void {
    for (const colony of game.colonies) {
      colony.isActive = true;
      colony.trackPosition = 2;
    }
  }

  /** MarsBot colonies currently on a tile. */
  private static botColoniesOn(game: IGame, colony: IColony): number {
    const bot = marsBotOf(game);
    return colony.colonies.filter((id) => id === bot.id).length;
  }

  /** MarsBot colonies across the whole table (B17's "1 or 0 colonies in play"). */
  public static botColonyCount(game: IGame): number {
    return game.colonies.reduce((sum, colony) => sum + AutomaColonies.botColoniesOn(game, colony), 0);
  }

  /**
   * Add resources to a shipping-board storage area, then run the exchange:
   * "If at any point during MarsBot's Turn, MarsBot has 5 (or more) resources
   * in a storage area, remove 5 resources from that area and advance the
   * indicated track by one space." Europa (never stores) throws before here;
   * Titan (floaters) is routed to the single `automa.floaters` counter and
   * returns before the exchange (floaters never exchange to a track).
   */
  public static addToStorage(game: IGame, colonyName: ColonyName, count: number): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const area = shippingAreaFor(colonyName);
    if (area === undefined || colonyName === ColonyName.EUROPA) {
      throw new Error(`${colonyName} has no MarsBot storage area`);
    }

    // Titan's "storage area" IS the bot's single floater pool — `automa.floaters`,
    // the one the research-phase spend + Hoverlord read. Routing it to the
    // `shippingStorage` map (like the other colonies) would make these floaters
    // INERT: nothing ever reads `shippingStorage[TITAN]`. Floaters never exchange
    // to a track (Adding Expansions p.2/p.5), so we're done. Correct WITH or
    // WITHOUT Venus Next — the counter is the bot's floater pool either way.
    if (colonyName === ColonyName.TITAN) {
      automa.floaters += count;
      game.log('${0} gained ${1} ${2}', (b) =>
        b.player(marsBotOf(game)).number(count).cardResource(CardResource.FLOATER));
      return;
    }

    automa.shippingStorage[colonyName] = (automa.shippingStorage[colonyName] ?? 0) + count;
    game.log('${0} gained ${1} resource(s) in its ${2} storage area', (b) =>
      b.player(marsBotOf(game)).number(count).colony(AutomaColonies.colonyOrThrow(game, colonyName)));

    if (area.exchangeTag === undefined) {
      return; // Defensive: any other non-exchanging area (none today besides Titan/Europa).
    }
    const trackIndex = automa.board.getTrackIndexForTag(area.exchangeTag);
    if (trackIndex === undefined) {
      return;
    }
    while ((automa.shippingStorage[colonyName] ?? 0) >= 5) {
      automa.shippingStorage[colonyName] = (automa.shippingStorage[colonyName] ?? 0) - 5;
      game.log('${0} exchanged 5 resources from its ${1} storage area to advance a track', (b) =>
        b.player(marsBotOf(game)).colony(AutomaColonies.colonyOrThrow(game, colonyName)));
      AutomaResolver.advanceTrack(game, trackIndex);
    }
  }

  private static colonyOrThrow(game: IGame, name: ColonyName): IColony {
    const colony = game.colonies.find((c) => c.name === name);
    if (colony === undefined) {
      throw new Error(`Colony ${name} is not in this game`);
    }
    return colony;
  }

  /**
   * The flip-count random pick (Adding Expansions p.4, Expedited Construction):
   * flip a project card, count through the eligible items up to the card's
   * cost (looping), take the final one, discard the flip. A cost of 0
   * normalizes to the first item (OQ-5).
   */
  public static flipToPick<T>(game: IGame, items: ReadonlyArray<T>): T {
    if (items.length === 0) {
      throw new Error('flipToPick requires at least one item');
    }
    const flipped = game.projectDeck.draw(game);
    if (flipped === undefined) {
      return items[0]; // Deck + discard exhausted — stay deterministic.
    }
    const cost = flipped.cost;
    game.projectDeck.discard(flipped);
    game.log('${0} flipped ${1} (cost ${2}) to pick a colony tile', (b) =>
      b.player(marsBotOf(game)).card(flipped).number(cost));
    return items[cost <= 0 ? 0 : (cost - 1) % items.length];
  }

  /**
   * "MarsBot places a colony on a randomly selected colony tile where it
   * doesn't yet have one" + 2 resources into the matching storage area —
   * Europa places an ocean (+TR) instead, a Failed Action when impossible.
   * Returns false when no tile is eligible.
   */
  public static botBuildColony(game: IGame): boolean {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);
    const eligible = game.colonies.filter((colony) =>
      colony.isActive && !colony.isFull() && AutomaColonies.botColoniesOn(game, colony) === 0);
    if (eligible.length === 0) {
      return false;
    }
    const colony = AutomaColonies.flipToPick(game, eligible);
    game.log('${0} built a colony on ${1}', (b) => b.player(bot).colony(colony));
    colony.colonies.push(bot.id);
    // The ordinary "the marker never sits below the colony count" rule applies.
    if (colony.trackPosition < colony.colonies.length) {
      colony.trackPosition = colony.colonies.length;
    }
    // "Any player built a colony" effects (Poseidon) fire — the official
    // precedent: the human's any-player effects react to MarsBot's actions.
    for (const cardOwner of game.players) {
      for (const card of cardOwner.tableau) {
        if (card.onColonyAddedByAnyPlayer === undefined) {
          continue;
        }
        game.events.withEffect(cardOwner, card, 'colony-added', () => card.onColonyAddedByAnyPlayer?.(cardOwner, bot));
      }
    }
    // "It ignores the printed reward of the tile, and instead it gains 2
    // resources into the storage area" — Europa: an ocean (+TR) instead.
    if (colony.name === ColonyName.EUROPA) {
      AutomaTilePlacer.placeOcean(game); // A Failed Action inside when impossible.
    } else {
      AutomaColonies.addToStorage(game, colony.name, 2);
    }
    return true;
  }

  /**
   * B19/B20 (Adding Expansions p.5): "Select the colony tile with the
   * most-advanced track. If multiple options are tied, select one where
   * MarsBot has a colony. If still multiple options are available, select
   * randomly (the flip method). MarsBot loses 1 MC and then trades."
   * Trade income is replaced by 2 storage resources (+1 with its own colony
   * there; Europa: +1 TR); colony owners receive their bonuses per the core
   * rules; the One-Trade-Fleet-per-Tile rule holds (visitor). Returns false
   * when no tile is tradable (all visited / no M€).
   */
  public static botTrade(game: IGame): boolean {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);
    if (bot.megaCredits < 1) {
      return false;
    }
    let candidates = game.colonies.filter((colony) => colony.isActive && colony.visitor === undefined);
    if (candidates.length === 0) {
      return false;
    }
    const top = Math.max(...candidates.map((c) => c.trackPosition));
    candidates = candidates.filter((c) => c.trackPosition === top);
    if (candidates.length > 1) {
      const withColony = candidates.filter((c) => AutomaColonies.botColoniesOn(game, c) > 0);
      if (withColony.length > 0) {
        candidates = withColony;
      }
    }
    const colony = candidates.length === 1 ? candidates[0] : AutomaColonies.flipToPick(game, candidates);

    // Phase B: the trade's log lines (the −1 M€ fee, the storage income) belong
    // to their own 'colony' chain, not the generic bonus-card effect.
    AutomaTurnLog.setCause(game, {kind: 'colony'});
    bot.stock.deduct(Resource.MEGACREDITS, 1, {log: true});
    game.log('${0} trades with ${1}', (b) => b.player(bot).colony(colony));

    // Trade income replacement.
    if (colony.name === ColonyName.EUROPA) {
      bot.increaseTerraformRating(1, {log: true});
    } else {
      const own = AutomaColonies.botColoniesOn(game, colony) > 0 ? 1 : 0;
      AutomaColonies.addToStorage(game, colony.name, 2 + own);
    }

    // Colony owners receive their bonuses per the core rules (the bot's own
    // colonies route through the automa branch in GiveColonyBonus).
    if (colony.colonies.length > 0) {
      game.defer(new GiveColonyBonus(bot, colony));
    }

    colony.visitor = bot.id;
    // The ordinary post-trade reset: the marker returns to the colony count.
    colony.trackPosition = colony.colonies.length;
    return true;
  }
}
