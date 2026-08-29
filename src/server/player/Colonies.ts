import {MAX_FLEET_SIZE} from '../../common/constants';
import {CardName} from '../../common/cards/CardName';
import {ColoniesHandler} from '../colonies/ColoniesHandler';
import {AndOptions} from '../inputs/AndOptions';
import {CanAffordOptions, IPlayer} from '../IPlayer';
import {ENERGY_TRADE_COST, MC_TRADE_COST, TITANIUM_TRADE_COST} from '../../common/constants';
import {IColony} from '../colonies/IColony';
import {SelectPaymentDeferred} from '../deferredActions/SelectPaymentDeferred';
import {Resource} from '../../common/Resource';
import {TradeWithTitanFloatingLaunchPad} from '../cards/colonies/TitanFloatingLaunchPad';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {SelectColony} from '../inputs/SelectColony';
import {IColonyTrader} from '../colonies/IColonyTrader';
import {TradeWithCollegiumCopernicus} from '../cards/pathfinders/CollegiumCopernicus';
import {message} from '../logs/MessageBuilder';
import {SelectAmount} from '../inputs/SelectAmount';
import {InputError} from '../inputs/InputError';
import {cardEffect} from '../inputs/choiceContext';
import {DeltaWorks} from '../cards/delta/DeltaWorks';
import {TradeWithDarksideSmugglersUnion} from '../cards/moon/DarksideSmugglersUnion';
import {Payment} from '../../common/inputs/Payment';
import {TradeWithHectateSpeditions} from '../cards/underworld/HecateSpeditions';
import {ColonyName} from '../../../src/common/colonies/ColonyName';
import {DisabledOptionModel} from '../../common/models/PlayerInputModel';

export class Colonies {
  private player: IPlayer;

  /** The number of trade fleets assigned to this player. */
  private fleetSize: number = 1;
  /** The number of consumed trade fleets. When this == `fleetSize` the player has no trade fleets. */
  public usedTradeFleets: number = 0;
  // When trading you may increase the Colony track this many steps.
  public tradeOffset: number = 0;

  // When trading you many use this many fewer resources of the trading type.
  public tradeDiscount: number = 0;

  public victoryPoints: number = 0; // Titania Colony VP
  public cardDiscount: number = 0; // Iapetus Colony

  constructor(player: IPlayer) {
    this.player = player;
  }

  /**
   * Returns `true` if this player can execute a trade.
   */
  public canTrade() {
    return this.tradeBlockedReason() === undefined;
  }

  /**
   * Why `canTrade()` is false — ONE named blocker (an English i18n key), or
   * `undefined` when a trade IS possible. It lives right beside the gate ON
   * PURPOSE: `canTrade()` is now literally derived from it, so the explanation
   * and the rule are the same code and can never drift.
   *
   * The three conditions are three DIFFERENT stories and a card asking "why
   * can't I trade" must tell the right one. «Нет колонии для торговли» used to
   * absorb all of them, and the most common by far — the player's only trade
   * fleet is already out — is not about colonies at all.
   *
   * Ordered by how ABSOLUTE the blocker is: a game-wide embargo outranks the
   * player's own fleet count, which outranks the state of the board.
   */
  public tradeBlockedReason(): string | undefined {
    if (this.player.game.tradeEmbargo === true) {
      return 'Trade embargo is in effect';
    }
    if (this.getFleetSize() <= this.usedTradeFleets) {
      return 'No trade fleet available';
    }
    if (ColoniesHandler.tradeableColonies(this.player.game).length === 0) {
      return 'No colony available to trade with';
    }
    return undefined;
  }

  public coloniesTradeAction(): AndOptions | undefined {
    const game = this.player.game;
    if (game.gameOptions.coloniesExtension && this.canTrade()) {
      return this.tradeWithColony(ColoniesHandler.tradeableColonies(game));
    }
    return undefined;
  }

  /**
   * Every way this player could pay a trade fee, in offer order. ONE list: the
   * live trade action builds its payment OrOptions from it AND
   * {@link potentialTradeCount} asks it whether any path is usable — so the
   * "can I afford a trade at all" question can never drift from the options the
   * player is actually shown. Construction is read-only (a handler only reads
   * the player's stock / cards to compute its own fee).
   */
  private tradeHandlers(): Array<IColonyTrader> {
    const player = this.player;
    return [
      new TradeWithDarksideSmugglersUnion(player),
      new TradeWithTitanFloatingLaunchPad(player),
      new TradeWithCollegiumCopernicus(player),
      new TradeWithHectateSpeditions(player),
      new TradeWithEnergy(player),
      new TradeWithTitanium(player),
      new TradeWithMegacredits(player),
    ];
  }

  /** Trade fleets in this player's supply (never negative). */
  public freeTradeFleets(): number {
    return Math.max(0, this.getFleetSize() - this.usedTradeFleets);
  }

  /**
   * TURN-INDEPENDENT PROJECTION: how many more colony trades this player could
   * execute in the current game state — `min(tradeable colonies, free fleets)`,
   * and 0 when a trade is impossible at all.
   *
   * It reuses the authoritative validators rather than restating them:
   * `tradeBlockedReason()` (embargo / fleet / an open colony) and the SAME
   * {@link tradeHandlers} list the live action offers, so special effects,
   * alternative payment paths (Titan Floating Launch-Pad, Collegium Copernicus,
   * Darkside Smugglers' Union, Hecate Speditions) and per-game discounts are all
   * already accounted for. Read-only.
   *
   * Deliberately NOT folded into `tradeBlockedReason()`: that predicate backs
   * `canTrade()`, which several cards use as their own `canAct` gate — widening
   * it would change game rules, not just the display.
   */
  public potentialTradeCount(): number {
    if (this.player.game.gameOptions.coloniesExtension !== true) {
      return 0;
    }
    if (this.tradeBlockedReason() !== undefined) {
      return 0;
    }
    if (!this.tradeHandlers().some((handler) => handler.canUse())) {
      return 0; // a free fleet and an open colony, but nothing to pay the fee with
    }
    const colonies = ColoniesHandler.tradeableColonies(this.player.game).length;
    return Math.min(colonies, this.freeTradeFleets());
  }

  private tradeWithColony(openColonies: Array<IColony>): AndOptions | undefined {
    const player = this.player;
    const handlers = this.tradeHandlers();

    let selected: IColonyTrader | undefined = undefined;

    const howToPayForTrade = new OrOptions()
      .setTitle('Pay trade fee')
      .setButtonLabel('Pay');
    const disabledPayments: Array<DisabledOptionModel> = [];
    handlers.forEach((handler) => {
      const metadata = handler.optionMetadata?.();
      if (handler.canUse()) {
        const option = new SelectOption(handler.optionText()).andThen(() => {
          selected = handler;
          return undefined;
        });
        if (metadata !== undefined) {
          option.withMetadata(metadata);
        }
        howToPayForTrade.options.push(option);
      } else {
        // Show an unusable payment path as a DISABLED option WITH its reason.
        // The gate is the REASON alone: metadata is a presentation extra (the
        // resource chip), and requiring it too hid every card trader — the
        // player owning Titan Floating Launch-Pad simply lost the option with no
        // word of why. A trader returns `undefined` only when the player does not
        // own the card at all, which is the one case with nothing to explain.
        const reason = handler.disabledReason?.();
        if (reason !== undefined) {
          disabledPayments.push({title: handler.optionText(), metadata, reason});
        }
      }
    });

    if (howToPayForTrade.options.length === 0) {
      return undefined;
    }
    howToPayForTrade.setDisabledOptions(disabledPayments);

    const selectColony = new SelectColony('Select colony tile for trade', 'trade', openColonies)
      .andThen((colony) => {
        if (selected === undefined) {
          throw new Error(`Unexpected condition: no trade funding source selected when trading with ${colony.name}.`);
        }
        // Root the chain at this TOP-LEVEL trade so the fee, reward and colony
        // bonuses group under it. (A trade triggered BY A CARD instead nests
        // under that card's scope — the card vs action distinction is preserved.)
        const events = player.game?.events;
        events?.beginAction(player, {kind: 'colony', name: colony.name}, {category: 'colony'});
        try {
          player.game.log('${0} traded with ${1}', (b) => b.player(player).colony(colony));
          selected.trade(colony);
        } finally {
          events?.endScope();
        }
        return undefined;
      });

    return new AndOptions(howToPayForTrade, selectColony)
      .setTitle('Trade with a colony tile')
      .setButtonLabel('Trade');
  }

  public getPlayableColonies(allowDuplicate: boolean = false, canAffordOptions: number | CanAffordOptions = 0) {
    const options: CanAffordOptions = typeof canAffordOptions === 'number' ? {cost: canAffordOptions} : canAffordOptions;

    return this.player.game.colonies
      .filter((colony) => {
        if (colony.isActive === false) {
          return false;
        }
        if (colony.isFull()) {
          return false;
        }
        if (!allowDuplicate && colony.colonies.includes(this.player.id)) {
          return false;
        }
        if (colony.name === ColonyName.VENUS && !this.player.canAfford({...options, tr: {venus: 1}})) {
          return false;
        }
        if (colony.name === ColonyName.EUROPA && !this.player.canAfford({...options, tr: {oceans: 1}})) {
          return false;
        }
        if (colony.name === ColonyName.LEAVITT) {
          const pharmacyUnion = this.player.tableau.get(CardName.PHARMACY_UNION);
          if ((pharmacyUnion?.resourceCount ?? 0) > 0 && !this.player.canAfford({...options, tr: {tr: 1}})) {
            return false;
          }
        }
        return true;
      });
  }

  public getVictoryPoints(): number {
    return this.player.colonies.victoryPoints;
  }

  public getFleetSize(): number {
    return this.fleetSize;
  }

  public increaseFleetSize(): void {
    if (this.fleetSize < MAX_FLEET_SIZE) {
      this.fleetSize++;
    }
  }

  public decreaseFleetSize(): void {
    // This fleet size management is a little tricky, because with The Moon, it's possible to
    // have more fleets than MAX_FLEET_SIZE which are then discarded.
    if (this.fleetSize > 0) {
      this.fleetSize--;
    }
  }

  public setFleetSize(fleetSize: number) {
    this.fleetSize = fleetSize;
  }

  public returnTradeFleets(): void {
    const syndicatePirateRaider = this.player.game.syndicatePirateRaider;
    // Syndicate Pirate Raids hook. If it is in effect, then only the syndicate pirate raider will
    // retrieve their fleets.
    // See Colony.ts for the other half of this effect, and Game.ts which disables it.
    if (syndicatePirateRaider === undefined) {
      this.usedTradeFleets = 0;
    } else if (syndicatePirateRaider === this.player.id) {
      // CEO effect: Disable all other players from trading next gen,
      // but free up all colonies (don't leave their trade fleets stuck there)
      if (this.player.tableau.has(CardName.HUAN)) {
        for (const player of this.player.opponents) {
          // Magic number high enough to disable other players' trading
          player.colonies.usedTradeFleets = 50;
        }
      }
      this.usedTradeFleets = 0;
    }
  }
}

/**
 * Record (analytics only) the trade resources a TRADE-DISCOUNT effect (Cryo-Sleep /
 * Rim Freighters — `behavior.colonies.tradeDiscount`) saved on this trade, attributed
 * to the owning card(s). Saved units = `min(tradeDiscount, baseCost)` of the trade
 * resource (the cost can't go below 0); split sequentially when several cards apply.
 * The Adhai card-resource discount (MC trader) is a separate mechanism and stays
 * unattributed here. The trade was already paid by the caller.
 */
function recordTradeDiscountSaving(player: IPlayer, colony: IColony, resource: 'energy' | 'titanium' | 'megacredits', baseCost: number): void {
  const events = player.game.events;
  const discount = player.colonies.tradeDiscount;
  if (events === undefined || discount <= 0) {
    return;
  }
  let remaining = Math.min(discount, baseCost);
  if (remaining <= 0) {
    return;
  }
  const sources = player.tableau.asArray().filter((c) => (c.behavior?.colonies?.tradeDiscount ?? 0) > 0);
  for (const card of sources) {
    if (remaining <= 0) {
      break;
    }
    const take = Math.min(card.behavior?.colonies?.tradeDiscount ?? 0, remaining);
    if (take <= 0) {
      continue;
    }
    events.recordTradeDiscount(player, card, colony.name, resource, take);
    remaining -= take;
  }
}

export class TradeWithEnergy implements IColonyTrader {
  private tradeCost: number;

  constructor(private player: IPlayer) {
    this.tradeCost = ENERGY_TRADE_COST - player.colonies.tradeDiscount;
  }

  /** The effective energy-equivalent trade fee (discounts applied) — read by
   *  the trade preview (`colonyTradePreview.ts`) so the cost math never forks. */
  public get cost(): number {
    return this.tradeCost;
  }

  /** Steel usable 1:1 for energy in THIS payment (Delta Works live), else 0. */
  private steelSubstitute(): number {
    return DeltaWorks.steelSubstituteAvailable(this.player);
  }

  public canUse() {
    // The family stays energy-DENOMINATED; Delta Works only widens its
    // SOURCES, so affordability is the combined pool — never a fourth option.
    return this.player.energy + this.steelSubstitute() >= this.tradeCost;
  }
  public optionText() {
    return message('Pay ${0} energy', (b) => b.number(this.tradeCost));
  }
  public optionMetadata() {
    // The chip previews the energy-first DEFAULT; a chosen steel mix is the
    // composer's own mix row (fed by the preview's `energyMix`), never this.
    return {kind: 'resourceRemoval' as const, icon: 'energy', amount: this.tradeCost,
      resource: {current: this.player.energy, resulting: Math.max(0, this.player.energy - this.tradeCost)}};
  }
  public disabledReason() {
    return this.steelSubstitute() > 0 ? 'Not enough energy and steel' : 'Not enough energy';
  }

  /** Deduct the ACTUAL chosen mix and run the trade. Substitution, never
   *  conversion: no energy is added anywhere, the steel leaves as steel. */
  private pay(colony: IColony, steel: number) {
    const energy = this.tradeCost - steel;
    // The trade FEE is a payment, not a colony benefit — attribute it to the
    // `payment` source so the journal reads "Оплата → −N", distinct from the
    // colony's trade reward / bonus rows. (The reward comes from colony.trade.)
    this.player.game.events.withSource({kind: 'payment'}, () => {
      this.player.stock.deduct(Resource.ENERGY, energy);
      if (steel > 0) {
        // The substitution is Delta Works's effect — source the steel spend
        // to the card so the journal/event stream names the modifier.
        this.player.stock.deduct(Resource.STEEL, steel, {log: false, from: {card: CardName.DELTA_WORKS}});
      }
      if (steel === 0) {
        this.player.game.log('${0} spent ${1} energy to trade with ${2}', (b) => b.player(this.player).number(this.tradeCost).colony(colony));
      } else if (energy === 0) {
        this.player.game.log('${0} spent ${1} steel to trade with ${2}', (b) => b.player(this.player).number(steel).colony(colony));
      } else {
        this.player.game.log('${0} spent ${1} energy and ${2} steel to trade with ${3}', (b) => b.player(this.player).number(energy).number(steel).colony(colony));
      }
    });
    recordTradeDiscountSaving(this.player, colony, 'energy', ENERGY_TRADE_COST);
    colony.trade(this.player);
  }

  public trade(colony: IColony) {
    const cost = this.tradeCost;
    const substitute = this.steelSubstitute();
    const maxSteel = Math.min(substitute, cost);
    const minSteel = Math.max(0, cost - this.player.energy);
    if (cost > 0 && maxSteel > minSteel) {
      // Delta Works: the fee stays energy-denominated, the SOURCE mix is the
      // player's. ONE linked dial — the steel share; energy is the remainder,
      // so the total can never disagree with the cost. Deferred exactly like
      // the M€ path's payment prompt, so the console pre-collects the answer
      // in the same batch; the default (min) is energy-first.
      const input = new SelectAmount(
        message('Use steel as energy for this trade (1 steel = 1 energy, ${0} to pay)', (b) => b.number(cost)),
        'Pay', minSteel, maxSteel)
        .andThen((steel) => {
          // Re-validated at commit: the mix must still be payable NOW (the
          // stock or the tableau may have moved since the prompt was built).
          if (steel > this.steelSubstitute() || cost - steel > this.player.energy) {
            throw new InputError('Cannot afford that energy and steel mix');
          }
          this.pay(colony, steel);
          return undefined;
        });
      const deltaWorks = this.player.tableau.get(CardName.DELTA_WORKS);
      if (deltaWorks !== undefined) {
        // Name WHO turned one payment into a mix (the premium fallback surface
        // shows the source card when the batch diverges).
        input.markChoiceContext(cardEffect(deltaWorks, undefined, 'effect-choice'));
      }
      this.player.defer(() => input);
    } else {
      // No choice to make: energy-only (no Delta Works / no steel), or the one
      // forced mix (the deficit dictates the steel share). Shown, never asked.
      this.pay(colony, minSteel);
    }
  }
}

export class TradeWithTitanium implements IColonyTrader {
  private tradeCost: number;

  constructor(private player: IPlayer) {
    this.tradeCost = TITANIUM_TRADE_COST - player.colonies.tradeDiscount;
  }

  public canUse() {
    return this.player.titanium >= this.tradeCost;
  }
  public optionText() {
    return message('Pay ${0} titanium', (b) => b.number(this.tradeCost));
  }
  public optionMetadata() {
    return {kind: 'resourceRemoval' as const, icon: 'titanium', amount: this.tradeCost,
      resource: {current: this.player.titanium, resulting: Math.max(0, this.player.titanium - this.tradeCost)}};
  }
  public disabledReason() {
    return 'Not enough titanium';
  }

  public trade(colony: IColony) {
    // The trade FEE is a payment — see TradeWithEnergy.trade.
    this.player.game.events.withSource({kind: 'payment'}, () => {
      this.player.pay(Payment.of({titanium: this.tradeCost}));
      this.player.game.log('${0} spent ${1} titanium to trade with ${2}', (b) => b.player(this.player).number(this.tradeCost).colony(colony));
    });
    recordTradeDiscountSaving(this.player, colony, 'titanium', TITANIUM_TRADE_COST);
    colony.trade(this.player);
  }
}


export class TradeWithMegacredits implements IColonyTrader {
  private tradeCost: number;

  constructor(private player: IPlayer) {
    this.tradeCost = MC_TRADE_COST- player.colonies.tradeDiscount;
    const adhai = player.tableau.get(CardName.ADHAI_HIGH_ORBIT_CONSTRUCTIONS);
    if (adhai !== undefined) {
      const adhaiDiscount = Math.floor(adhai.resourceCount / 2);
      this.tradeCost = Math.max(0, this.tradeCost - adhaiDiscount);
    }
  }

  /** The effective M€ trade fee (discounts applied) — read by the trade
   *  preview (`colonyTradePreview.ts`) so the cost math never forks. */
  public get cost(): number {
    return this.tradeCost;
  }

  public canUse() {
    return this.player.canAfford(this.tradeCost);
  }
  public optionText() {
    return message('Pay ${0} M€', (b) => b.number(this.tradeCost));
  }
  public optionMetadata() {
    const current = this.player.spendableMegacredits();
    return {kind: 'resourceRemoval' as const, icon: 'megacredits', amount: this.tradeCost,
      resource: {current, resulting: Math.max(0, current - this.tradeCost)}};
  }
  public disabledReason() {
    return 'Not enough M€';
  }

  public trade(colony: IColony) {
    this.player.game.defer(new SelectPaymentDeferred(this.player, this.tradeCost,
      {title: message('Select how to pay ${0} for colony trade', (b) => b.number(this.tradeCost))}))
      .andThen(() => {
        this.player.game.log('${0} spent ${1} M€ to trade with ${2}', (b) => b.player(this.player).number(this.tradeCost).colony(colony));
        recordTradeDiscountSaving(this.player, colony, 'megacredits', MC_TRADE_COST);
        colony.trade(this.player);
      });
  }
}
