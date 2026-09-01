import {AddResourcesToCard} from '../deferredActions/AddResourcesToCard';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {DeferredAction, SimpleDeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {DiscardCards} from '../deferredActions/DiscardCards';
import {DrawCards} from '../deferredActions/DrawCards';
import {GiveColonyBonus} from '../deferredActions/GiveColonyBonus';
import {IncreaseColonyTrack} from '../deferredActions/IncreaseColonyTrack';
import {LogHelper} from '../LogHelper';
import {MAX_COLONIES_PER_TILE, MAX_COLONY_TRACK_POSITION} from '../../common/constants';
import {PlaceOceanTile} from '../deferredActions/PlaceOceanTile';
import {IPlayer} from '../IPlayer';
import {PlayerId} from '../../common/Types';
import {PlayerInput} from '../PlayerInput';
import {Resource} from '../../common/Resource';
import {ScienceTagCard} from '../cards/community/ScienceTagCard';
import {AutomaCorporations} from '../automa/corps/AutomaCorporations';
import {SelectColony} from '../inputs/SelectColony';
import {SelectOption} from '../inputs/SelectOption';
import {SelectPlayer} from '../inputs/SelectPlayer';
import {StealResources} from '../deferredActions/StealResources';
import {Tag} from '../../common/cards/Tag';
import {SendDelegateToArea} from '../deferredActions/SendDelegateToArea';
import {IGame} from '../IGame';
import {Turmoil} from '../turmoil/Turmoil';
import {SerializedColony} from '../SerializedColony';
import {ColonyBonusOrdinal, IColony, TradeOptions} from './IColony';
import {ColonyMetadata, colonyMetadata, InputColonyMetadata} from '../../common/colonies/ColonyMetadata';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyBenefitRole} from '../../common/events/EventSource';
import {CardDrawRevealSource, ColonyTradeRevealTag} from '../../common/models/CardDrawRevealModel';
import {ColonyTradeBonusRecipientModel, ColonyTradeGrantModel} from '../../common/models/ColonyTradeManifestModel';
import {sum} from '../../common/utils/utils';
import {message} from '../logs/MessageBuilder';
import {PlaceHazardTile} from '../deferredActions/PlaceHazardTile';
import {TileType} from '../../../src/common/TileType';
import {ErodeSpacesDeferred} from '../underworld/ErodeSpacesDeferred';
import {CardName} from '../../common/cards/CardName';
import {GlobalParameter} from '@/common/GlobalParameter';
import {colonySource} from '../inputs/choiceContext';

export abstract class Colony implements IColony {
  // Players can't build colonies on Miranda until someone has played an Animal card.
  // isActive is the gateway for that action and any other card with that type of constraint
  // also isActive represents when the colony is part of the game, or "back in the box", as it were.
  public isActive: boolean = true;
  public visitor: undefined | PlayerId = undefined;
  public colonies: Array<PlayerId> = [];
  public trackPosition: number = 1;
  /**
   * Transient (NOT serialized): the tradeId of the trade currently resolving
   * on THIS colony — from `handleTrade` until the finalize deferred that
   * resets the track. Every card draw granted inside that window (the trade
   * income, the per-cube colony bonuses) stamps it onto its reveal source so
   * the client can bind all of a trade's draws to one transaction. Lost on a
   * server restart mid-trade — the draws then degrade to plain colony-sourced
   * reveals, which is the honest fallback.
   */
  private activeTradeId: string | undefined = undefined;

  public metadata: ColonyMetadata;

  protected constructor(metadata: InputColonyMetadata) {
    this.metadata = colonyMetadata(metadata);
  }

  public get name(): ColonyName {
    return this.metadata.name;
  }

  public endGeneration(game: IGame): void {
    if (this.isActive) {
      this.increaseTrack();
    }
    // Syndicate Pirate Raids hook. If it is in effect, then only the syndicate pirate raider will
    // retrieve their fleets.
    // See Player.ts for the other half of this effect, and Game.ts which disables it.
    if (game.syndicatePirateRaider) {
      if (game.syndicatePirateRaider === this.visitor) {
        this.visitor = undefined;
      } else {
        const raider = game.getPlayerById(game.syndicatePirateRaider);
        if (raider.tableau.has(CardName.HUAN)) {
          this.visitor = undefined;
        }
      }
    } else {
      this.visitor = undefined;
    }
  }

  public increaseTrack(value: number = 1): void {
    this.trackPosition = Math.min(this.trackPosition + value, MAX_COLONY_TRACK_POSITION);
  }

  public decreaseTrack(value: number = 1): void {
    this.trackPosition = Math.max(this.trackPosition - value, this.colonies.length);
  }

  public isFull(): boolean {
    return this.colonies.length >= MAX_COLONIES_PER_TILE;
  }

  public addColony(player: IPlayer, options?: {giveBonusTwice: boolean}): void {
    player.game.log('${0} built a colony on ${1}', (b) => b.player(player).colony(this));

    this.giveBonus(player, this.metadata.build.type, this.metadata.build.quantity[this.colonies.length], this.metadata.build.resource, false, 'build');
    if (options?.giveBonusTwice === true) { // Vital Colony hook.
      this.giveBonus(player, this.metadata.build.type, this.metadata.build.quantity[this.colonies.length], this.metadata.build.resource, false, 'build');
    }

    this.colonies.push(player.id);
    if (this.trackPosition < this.colonies.length) {
      this.trackPosition = this.colonies.length;
    }

    for (const cardOwner of player.game.players) {
      for (const card of cardOwner.tableau) {
        if (card.onColonyAddedByAnyPlayer === undefined) {
          continue;
        }
        player.game.events.withEffect(cardOwner, card, 'colony-added', () => card.onColonyAddedByAnyPlayer?.(cardOwner, player));
      }
    }
    // … and the BOT's own corporation, which is not a card in a tableau (C33
    // Poseidon prints the same «when you or MarsBot build a colony» sentence
    // the loop above serves for the human Poseidon).
    AutomaCorporations.onColonyBuilt(player.game, player);

    if (this.name === ColonyName.LEAVITT) {
      player.triggerOnNonCardTagAdded(Tag.SCIENCE);
    }
  }

  /*
    * Trade with this colony.
    *
    * Before passing off the trade, this determines whether the track should advance prior to trading, and then
    * hands off the real work to `handleTrade`.
    *
    * @param bonusTradeOffset an offset that allows a player to increase the colony tile track marker before trading.
    * @param usesTradeFleet when false, the player can trade without an available trade fleet.
    * @param decreaseTrackAfterTrade when false, the track does not decrease after trading.
    */
  public trade(player: IPlayer, tradeOptions: TradeOptions = {}, bonusTradeOffset = 0): void {
    const tradeOffset = player.colonies.tradeOffset + bonusTradeOffset;
    const maxPossibleTrackPosition = Math.min(this.trackPosition + tradeOffset, MAX_COLONY_TRACK_POSITION);
    const steps = maxPossibleTrackPosition - this.trackPosition;

    if (steps === 0 ||
        this.metadata.shouldIncreaseTrack === 'no' ||
        tradeOptions.selfishTrade === true) {
      // Don't increase
      this.handleTrade(player, tradeOptions);
      return;
    }

    if (this.metadata.shouldIncreaseTrack === 'yes' || (this.metadata.trade.resource !== undefined && this.metadata.trade.resource[this.trackPosition] === this.metadata.trade.resource[maxPossibleTrackPosition])) {
      // No point in asking the player, just increase it
      const oldPosition = this.trackPosition;
      this.increaseTrack(steps);
      LogHelper.logColonyTrackIncrease(player, this, steps);
      this.recordTradeTrackBonus(player, oldPosition, this.trackPosition - oldPosition);
      this.handleTrade(player, tradeOptions);
      return;
    }

    // Ask the player if they want to increase the track
    player.game.defer(new IncreaseColonyTrack(player, this, steps))
      .andThen(() => this.handleTrade(player, tradeOptions));
  }

  /**
   * Record (analytics only) a trade-offset effect advancing this colony's track
   * BEFORE a trade — the whole value of Trading Colony's "+1 step when you trade
   * here". Attributes the `appliedSteps` + the EXACT extra trade-reward units to the
   * owning card(s): the track steps come from declarative `behavior.colonies.tradeOffset`
   * cards (Trading Colony; any future card is covered automatically). With several
   * such cards the steps are split sequentially so EACH card's extra reward is exact
   * (`quantity[after] − quantity[before]` over its own slice). Any portion from a
   * non-card `bonusTradeOffset` stays honestly unattributed. The track was already
   * advanced by the caller — this only writes the stat event.
   */
  public recordTradeTrackBonus(player: IPlayer, oldPosition: number, appliedSteps: number): void {
    const events = player.game.events;
    if (events === undefined || appliedSteps <= 0) {
      return;
    }
    const sources = player.tableau.asArray().filter((c) => (c.behavior?.colonies?.tradeOffset ?? 0) > 0);
    if (sources.length === 0) {
      return;
    }
    const quantity = this.metadata.trade.quantity;
    const rewardAt = (pos: number): number => quantity[pos] ?? quantity[quantity.length - 1] ?? 0;
    let pos = oldPosition;
    let remaining = appliedSteps;
    for (const card of sources) {
      if (remaining <= 0) {
        break;
      }
      const take = Math.min(card.behavior?.colonies?.tradeOffset ?? 0, remaining);
      if (take <= 0) {
        continue;
      }
      const extraReward = Math.max(0, rewardAt(pos + take) - rewardAt(pos));
      events.recordColonyTrackBonus(player, card, this.name, take, extraReward);
      pos += take;
      remaining -= take;
    }
  }

  private handleTrade(player: IPlayer, options: TradeOptions) {
    const resource = Array.isArray(this.metadata.trade.resource) ? this.metadata.trade.resource[this.trackPosition] : this.metadata.trade.resource;

    // Build the ATOMIC reward manifest of this trade BEFORE granting anything.
    // Every value is the authoritative plan the grants execute against: the
    // income read at the CURRENT (not-yet-reset) position, the per-cube colony
    // bonus from this colony's own metadata, the cube owners in slot order,
    // and the track positions before/after the reset. Card COUNTS stay a plan
    // (the deck can run short) — the actual drawn cards ride the tradeId-
    // stamped reveal batches. Skipped for partial trades that give no colony
    // bonuses (COPY_TRADE's nested handleTrade) so a nested grant can never
    // overwrite the real trade's manifest mid-resolution.
    const givesBonuses = options.giveColonyBonuses !== false;
    const willDecrease = options.decreaseTrackAfterTrade !== false;
    if (givesBonuses) {
      const game = player.game;
      const tradeId = `${this.name}:g${game.generation}:a${game.gameAge}`;
      const recipients: Array<ColonyTradeBonusRecipientModel> = [];
      for (const id of this.colonies) {
        const color = options.selfishTrade === true ? player.color : game.getPlayerById(id).color;
        const existing = recipients.find((r) => r.color === color);
        if (existing !== undefined) {
          existing.cubes++;
        } else {
          recipients.push({color, cubes: 1});
        }
      }
      player.colonyTradeManifest = {
        tradeId,
        colonyName: this.name,
        trader: player.color,
        generation: game.generation,
        preTradeTrackPosition: this.trackPosition,
        postTradeTrackPosition: willDecrease ? this.colonies.length : this.trackPosition,
        tradeIncome: this.tradeGrantModel(this.metadata.trade.type, this.metadata.trade.quantity[this.trackPosition] ?? 0, resource),
        colonyBonus: this.colonies.length > 0 ?
          this.tradeGrantModel(this.metadata.colony.type, this.metadata.colony.quantity, this.metadata.colony.resource) :
          undefined,
        bonusRecipients: recipients,
      };
      this.activeTradeId = tradeId;
    }

    this.giveBonus(player, this.metadata.trade.type, this.metadata.trade.quantity[this.trackPosition], resource, false, 'trade');

    // !== false because default is true.
    if (options.giveColonyBonuses !== false) {
      player.game.defer(new GiveColonyBonus(player, this, options.selfishTrade));
    }

    // !== false because default is true.
    if (options.usesTradeFleet !== false) {
      this.visitor = player.id;
      player.colonies.usedTradeFleets++;
    }

    if (player.tableau.has(CardName.VENUS_TRADE_HUB)) {
      player.stock.add(Resource.MEGACREDITS, 3, {log: true});
    }

    // The trade FINALIZER: reset the track (Colonies rules — the marker
    // returns to the number of built colonies) and close the trade-stamping
    // window. Runs at DECREASE_COLONY_TRACK_AFTER_TRADE, i.e. AFTER the trade
    // income and the TRADER's own colony bonuses (including their interactive
    // follow-ups) — the server itself guarantees rewards are granted at the
    // pre-reset position and the reset ends the trader's own chain. Bonuses
    // owed to OTHER players are DETACHED DELIVERIES at BACK_OF_THE_LINE
    // (`isDetachedBonusDelivery`) and resolve after this finalizer: the
    // trader's client observes the committed reset — its transaction's end —
    // without waiting on anybody else's click.
    if (willDecrease || givesBonuses) {
      player.defer(() => {
        if (willDecrease) {
          this.trackPosition = this.colonies.length;
        }
        this.activeTradeId = undefined;
      }, Priority.DECREASE_COLONY_TRACK_AFTER_TRADE);
    }
  }

  /** The manifest's grant descriptor for one benefit, from this colony's metadata. */
  private tradeGrantModel(benefit: ColonyBenefit, quantity: number, resource: Resource | undefined): ColonyTradeGrantModel {
    const wantsCardResource = benefit === ColonyBenefit.ADD_RESOURCES_TO_CARD || benefit === ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD;
    const grant: ColonyTradeGrantModel = {benefit, quantity};
    if (resource !== undefined) {
      grant.resource = resource;
    }
    if (wantsCardResource && this.metadata.cardResource !== undefined) {
      grant.cardResource = this.metadata.cardResource;
    }
    return grant;
  }

  /**
   * The reveal tag binding a draw to the trade currently resolving on this
   * colony — `undefined` outside a trade window and for BUILD bonuses (a
   * build is never part of a trade transaction).
   */
  private tradeRevealTag(benefit: ColonyBenefitRole): ColonyTradeRevealTag | undefined {
    if (this.activeTradeId === undefined || benefit === 'build') {
      return undefined;
    }
    return {tradeId: this.activeTradeId, role: benefit === 'trade' ? 'income' : 'bonus'};
  }

  /** The colony reveal source for a card draw, trade-stamped inside a trade window. */
  private colonyRevealSource(benefit: ColonyBenefitRole): CardDrawRevealSource {
    const trade = this.tradeRevealTag(benefit);
    return trade !== undefined ?
      {type: 'colony', colonyName: this.name, trade} :
      {type: 'colony', colonyName: this.name};
  }

  /**
   * `ordinal` is WHICH of this recipient's cubes on this colony is resolving
   * (1-based) and how many they own. Each cube resolves separately and in full
   * — the rules never merge them — so an INTERACTIVE bonus (Pluto's "draw 1,
   * then discard 1") uses it to tell the player which colony is paying out.
   */
  public giveColonyBonus(player: IPlayer, isGiveColonyBonus: boolean = false, ordinal?: ColonyBonusOrdinal, trader?: IPlayer): undefined | PlayerInput {
    return this.giveBonus(player, this.metadata.colony.type, this.metadata.colony.quantity, this.metadata.colony.resource, isGiveColonyBonus, 'colonyBonus', ordinal, trader);
  }

  /**
   * THE TRADER NEVER WAITS FOR SOMEBODY ELSE'S CLICK. A colony bonus paid to
   * a player OTHER than the trader is a DETACHED DELIVERY: resolved inside
   * `GiveColonyBonus`'s drain it would hold the whole deferred queue — the
   * trader's own remaining prompts, their trade income and the track reset
   * (`Priority.DECREASE_COLONY_TRACK_AFTER_TRADE`) would all freeze behind an
   * opponent's answer, and the trader's client would stand in a finished
   * interface waiting for someone else. The two are independent by the rules
   * (tabletop resolves these simultaneously, active player first), so the
   * recipient's bonus is queued at `Priority.BACK_OF_THE_LINE` — after the
   * trade's own finalizer. The trader's own cube resolves inline in the
   * trade's chain (they are already watching the payout), a bot never prompts
   * (handled before this is asked), and the self-directed grants
   * (ProductiveOutpost / selfish trades) have no foreign trader.
   */
  private isDetachedBonusDelivery(player: IPlayer, isGiveColonyBonus: boolean, trader: IPlayer | undefined): trader is IPlayer {
    return isGiveColonyBonus && trader !== undefined && trader.id !== player.id && !player.isMarsBot;
  }

  /**
   * Attribute EVERY colony bonus (build / trade reward / colony-to-owner) to the
   * COLONY itself in the structured event stream — so a row reads "Luna → +2 M€"
   * instead of inheriting the SURROUNDING scope's source. Without this, a colony
   * bonus triggered BY A CARD (a card that builds a colony, ProductiveOutpost
   * gaining all colony bonuses, …) is attributed to that card and reads as one of
   * the card's OWN effects — indistinguishable, and at the same level. `withSource`
   * keeps the SAME correlation chain (the bonus still GROUPS under the card/action
   * that triggered it) and flows through `game.defer` (captured eventContext), so
   * deferred build bonuses (draw / add-resource) are covered too. A top-level trade
   * is already a `colony` root, so re-sourcing there is a harmless no-op.
   */
  private giveBonus(player: IPlayer, bonusType: ColonyBenefit, quantity: number, resource: Resource | undefined, isGiveColonyBonus: boolean = false, benefit: ColonyBenefitRole = 'colonyBonus', ordinal?: ColonyBonusOrdinal, trader?: IPlayer): undefined | PlayerInput {
    return player.game.events.withSource({kind: 'colony', name: this.name, benefit}, () =>
      this.giveBonusImpl(player, bonusType, quantity, resource, isGiveColonyBonus, benefit, ordinal, trader));
  }

  private giveBonusImpl(player: IPlayer, bonusType: ColonyBenefit, quantity: number, resource: Resource | undefined, isGiveColonyBonus: boolean = false, benefit: ColonyBenefitRole = 'colonyBonus', ordinal?: ColonyBonusOrdinal, trader?: IPlayer): undefined | PlayerInput {
    const game = player.game;

    let action: undefined | DeferredAction<any> = undefined;
    switch (bonusType) {
    case ColonyBenefit.ADD_RESOURCES_TO_CARD:
      const cardResource = this.metadata.cardResource;
      // A colony bonus has no CARD to show, so it names itself instead
      // («КОЛОНИЯ · Ганимед»). The colony was already known one call up (the
      // event source) and dropped here, leaving the player with a card picker
      // and no idea which of their colonies paid.
      action = new AddResourcesToCard(player, cardResource, {count: quantity, cause: colonySource(this.name)});
      break;

    case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD:
      action = new AddResourcesToCard(
        player,
        undefined,
        {
          count: quantity,
          restrictedTag: Tag.VENUS,
          title: message('Select Venus card to add ${0} resource(s)', (b) => b.number(quantity)),
          cause: colonySource(this.name),
        });
      break;

    case ColonyBenefit.COPY_TRADE:
      const openColonies = game.colonies.filter((colony) => colony.isActive);
      action = new SimpleDeferredAction(
        player,
        () => new SelectColony('Select colony to gain trade income from', 'Select', openColonies)
          .markChoiceContext({source: colonySource(this.name), mode: 'reward'})
          .andThen((colony) => {
            game.log('${0} gained ${1} trade bonus', (b) => b.player(player).colony(colony));
            (colony as Colony).handleTrade(player, {
              usesTradeFleet: false,
              decreaseTrackAfterTrade: false,
              giveColonyBonuses: false,
            });
            return undefined;
          }),
      );
      break;

    case ColonyBenefit.DRAW_CARDS: {
      // Attribute the reveal to THIS colony (Pluto, …) so the "cards received"
      // modal shows a hoverable colony chip as the source — plus the tradeId
      // when the draw is part of a resolving trade, so the client binds it to
      // that trade's transaction (and same-trade batches merge into one).
      const drawSource = this.colonyRevealSource(benefit);
      /*
       * A BONUS PAID TO SOMEONE ELSE IS DELIVERED, NOT POSTED. When another
       * player's trade pays this owner their card, the draw used to happen
       * silently: the card appeared in a hand nobody had looked at and the
       * client threw a full-bleed reveal over whatever screen its owner was
       * on, mid-someone-else's-turn. So the recipient COLLECTS it — the cards
       * are drawn inside the answer, and the marked prompt is what lets the
       * console announce the delivery and walk the player to the colony that
       * paid it (the same door Pluto's discard uses).
       *
       * The TRADER's own bonus stays inline: they are already watching the
       * payout resolve on their own colony stage, and a prompt there would be
       * a click asking them to confirm what they just did. Same for a bot
       * (never prompted) and for the self-directed grants
       * (ProductiveOutpost / Yvonne — no trader, `isGiveColonyBonus` false).
       */
      const seat = ordinal ?? {index: 1, total: 1};
      if (this.isDetachedBonusDelivery(player, isGiveColonyBonus, trader)) {
        /*
         * A DETACHED DELIVERY (see `isDetachedBonusDelivery`): the recipient
         * COLLECTS the card behind the trade's finalizer instead of freezing
         * the queue. (`drawSource` is captured NOW — by the time it is
         * answered the colony's trade window has closed.)
         */
        player.defer(
          () => new SelectOption(
            message('Collect ${0} card(s) from ${1}', (b) => b.number(quantity).colony(this)),
            'Collect')
            .markColonyBonusPrompt({
              colonyName: this.name,
              cards: quantity,
              index: seat.index,
              total: seat.total,
              trader: trader.color,
            })
            .andThen(() => {
              player.drawCard(quantity, {source: drawSource});
              return undefined;
            }),
          Priority.BACK_OF_THE_LINE);
        return undefined;
      }
      action = DrawCards.keepAll(player, quantity, {source: drawSource});
      break;
    }

    case ColonyBenefit.DRAW_CARDS_AND_BUY_ONE:
      // The pick names the COLONY that paid it out — the console anchors the
      // whole draw-and-choose flow on that source (Leavitt's colony bonus).
      action = DrawCards.keepSome(player, 1, {
        paying: true, logDrawnCard: true, promptSource: colonySource(this.name),
      });
      break;

    case ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE: {
      // Capture the trade-stamped source NOW — the deferred callback runs
      // later, when the trade-stamping window may have moved on.
      const drawAndDiscardSource = this.colonyRevealSource(benefit);
      // ONE CUBE, ONE PAYOUT: draw 1, then discard 1, and only then does the
      // recipient's NEXT cube start (Priority.SUPERPOWER puts this discard
      // ahead of every other pending pair of this payout — for the trader
      // that also means ahead of the trade's own track reset). The ordinal
      // rides onto the prompt so the console reveal modal can lay out one
      // zone per colony and show which one is resolving.
      //
      // A recipient OTHER than the trader is a DETACHED DELIVERY
      // (`isDetachedBonusDelivery`): their pair queues at BACK_OF_THE_LINE so
      // the trader's own chain — bonus draw, mandatory discard, track reset —
      // never waits on an opponent's answer. The SUPERPOWER discard inside
      // the pair still runs before the next detached pair, so per-cube
      // sequencing (draw → discard → next cube) holds for every recipient.
      const seat = ordinal ?? {index: 1, total: 1};
      player.defer(() => {
        player.drawCard(1, {source: drawAndDiscardSource});
        // ONE COLONY, ONE BATCH. The pair below blocks on the player's answer,
        // and by the rules the NEXT cube's card is not revealed until this one
        // is finished — so this batch is closed here rather than left to be
        // separated by whenever the client's acknowledgement happens to land
        // (see IPlayer.CardDrawReveal.sealed).
        player.sealCardDrawReveal();
        player.game.defer(
          new DiscardCards(player, 1, 1, this.name + ' colony bonus. Select a card to discard', {
            source: {kind: 'colony'},
            colonyBonus: {colonyName: this.name, index: seat.index, total: seat.total},
          }),
          Priority.SUPERPOWER);
      }, this.isDetachedBonusDelivery(player, isGiveColonyBonus, trader) ? Priority.BACK_OF_THE_LINE : Priority.DEFAULT);
      break;
    }

    case ColonyBenefit.DRAW_CARDS_AND_KEEP_ONE:
      action = DrawCards.keepSome(player, quantity, {
        keepMax: 1, promptSource: colonySource(this.name),
      });
      break;

    case ColonyBenefit.GAIN_CARD_DISCOUNT:
      player.colonies.cardDiscount += 1;
      game.log('Cards played by ${0} cost 1 M€ less this generation', (b) => b.player(player));
      break;

    case ColonyBenefit.GAIN_PRODUCTION:
      if (resource === undefined) {
        throw new Error('Resource cannot be undefined');
      }
      player.production.add(resource, quantity, {log: true});
      break;

    case ColonyBenefit.GAIN_RESOURCES:
      if (resource === undefined) {
        throw new Error('Resource cannot be undefined');
      }
      player.stock.add(resource, quantity, {log: true});
      break;

    case ColonyBenefit.GAIN_SCIENCE_TAG:
      player.tags.extraScienceTags += 1;
      player.playCard(new ScienceTagCard(), undefined, 'nothing');
      game.log('${0} gained 1 Science tag', (b) => b.player(player));
      break;

    case ColonyBenefit.GAIN_SCIENCE_TAGS_AND_CLONE_TAG:
      player.tags.extraScienceTags += 2;
      player.playCard(new ScienceTagCard(), undefined, 'nothing');
      game.log('${0} gained 2 Science tags', (b) => b.player(player));
      break;

    case ColonyBenefit.GAIN_INFLUENCE:
      Turmoil.ifTurmoil(game, (turmoil) => {
        turmoil.addInfluenceBonus(player);
        game.log('${0} gained 1 influence', (b) => b.player(player));
      });
      break;

    case ColonyBenefit.PLACE_DELEGATES:
      Turmoil.ifTurmoil(game, (turmoil) => {
        const availablePlayerDelegates = turmoil.getAvailableDelegateCount(player);
        const qty = Math.min(quantity, availablePlayerDelegates);
        for (let i = 0; i < qty; i++) {
          game.defer(new SendDelegateToArea(player));
        }
      });
      break;

    case ColonyBenefit.GIVE_MC_PER_DELEGATE:
      Turmoil.ifTurmoil(game, (turmoil) => {
        const partyDelegateCount = sum(turmoil.parties.map((party) => party.delegates.get(player)));
        player.stock.add(Resource.MEGACREDITS, partyDelegateCount, {log: true});
      });
      break;

    case ColonyBenefit.PLACE_HAZARD_TILE:
      const spaces = game.board.getAvailableSpacesOnLand(player)
        .filter(((space) => space.tile === undefined))
        .filter((space) => {
          const adjacentSpaces = game.board.getAdjacentSpaces(space);
          return adjacentSpaces.filter((space) => space.tile !== undefined).length === 0;
        });

      game.defer(new PlaceHazardTile(player, TileType.EROSION_MILD, {title: 'Select space next to no other tile for hazard', spaces}));
      break;

    case ColonyBenefit.ERODE_SPACES_ADJACENT_TO_HAZARDS:
      game.defer(new ErodeSpacesDeferred(player, quantity));
      break;

    case ColonyBenefit.GAIN_MC_PER_HAZARD_TILE:
      player.stock.megacredits += game.board.getHazards().length;
      break;

    case ColonyBenefit.GAIN_TR:
      if (quantity > 0) {
        player.increaseTerraformRating(quantity, {log: true});
      }
      break;

    case ColonyBenefit.GAIN_VP:
      if (quantity > 0) {
        player.colonies.victoryPoints += quantity;
        game.log('${0} gained ${1} VP', (b) => b.player(player).number(quantity));
      }
      break;

    case ColonyBenefit.INCREASE_VENUS_SCALE:
      game.increaseVenusScaleLevel(player, quantity as 3|2|1);
      game.log('${0} raised ${1} ${2} {step|steps}', (b) => b.player(player).globalParameter(GlobalParameter.VENUS).number(quantity));
      break;

    case ColonyBenefit.LOSE_RESOURCES:
      if (resource === undefined) {
        throw new Error('Resource cannot be undefined');
      }
      player.stock.deduct(resource, Math.min(player.stock.get(resource), quantity), {log: true});
      break;

    case ColonyBenefit.OPPONENT_DISCARD:
      if (game.isSoloMode()) {
        break;
      }
      action = new SimpleDeferredAction(
        player,
        () => {
          const playersWithCards = game.players.filter((p) => p.cardsInHand.length > 0);
          if (playersWithCards.length === 0) {
            return undefined;
          }
          return new SelectPlayer(playersWithCards, 'Select player to discard a card', 'Select')
            .markChoiceContext({source: colonySource(this.name), mode: 'attack'})
            .andThen((selectedPlayer) => {
              game.defer(new DiscardCards(selectedPlayer, 1, 1, this.name + ' colony effect. Select a card to discard', {
                source: colonySource(this.name),
              }));
              return undefined;
            });
        });
      break;

    case ColonyBenefit.PLACE_OCEAN_TILE:
      action = new PlaceOceanTile(player);
      break;

    case ColonyBenefit.STEAL_RESOURCES:
      if (resource === undefined) {
        throw new Error('Resource cannot be undefined');
      }
      action = new StealResources(player, resource, quantity);
      break;

    case ColonyBenefit.DRAW_EARTH_CARD:
      player.drawCard(quantity, {tag: Tag.EARTH});
      break;

    case ColonyBenefit.WGT_RAISE_GLOBAL_PARAMETER:
      const globalParameters = [GlobalParameter.TEMPERATURE, GlobalParameter.OXYGEN, GlobalParameter.OCEANS];
      const annotation = globalParameters[quantity];
      const wgt = game.worldGovernmentTerraformingInput(player);
      const option = wgt.options.find((option) => option.annotation === annotation);
      if (option !== undefined) {
        game.defer(new SimpleDeferredAction(player, () => {
          game.temporarySolarPhase(player, () => {
            // Placing an ocean requires the player to select a space, so it is
            // deferred as a player input. Temperature and oxygen apply directly.
            if (annotation === GlobalParameter.OCEANS) {
              player.defer(option);
            } else {
              option.cb();
            }
          });
        }));
      }
      break;

    case ColonyBenefit.GAIN_MC_FOR_EARTH_TAGS:
      const tagCount = sum(game.players.map((p) => p.tags.count(Tag.EARTH, p.id === player.id ? 'default' : 'raw')));
      const mc = Math.floor(tagCount / 3);
      if (mc > 0) {
        player.stock.add(Resource.MEGACREDITS, mc, {log: true});
      }
      break;

    default:
      throw new Error('Unsupported benefit type');
    }

    if (action !== undefined) {
      if (isGiveColonyBonus) {
        if (this.isDetachedBonusDelivery(player, isGiveColonyBonus, trader)) {
          /*
           * A DETACHED DELIVERY: an opponent's interactive bonus (Titan's
           * floater target, Enceladus' microbes, a keep-one pick, …) queues at
           * the BACK OF THE LINE for its OWN recipient instead of being
           * executed inline. Inline, its prompt froze the whole deferred
           * queue — the trader's own trade-income prompt (prio
           * GAIN_RESOURCE_OR_PRODUCTION) and the track reset both sat behind
           * an opponent's click, the trader's pre-collected batch answers
           * were silently dropped, and the dropped prompts came back minutes
           * later as detached modals.
           */
          game.defer(action, Priority.BACK_OF_THE_LINE);
          return undefined;
        }
        /*
         * The TRADER's own interactive bonus is returned directly instead of
         * deferred: `GiveColonyBonus` hands it to `setWaitingFor` with the
         * drain as its continuation, so it resolves inside the trader's own
         * request chain (the pre-collected batch answers it synchronously).
         */
        return action.execute();
      } else {
        game.defer(action);
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  public serialize(): SerializedColony {
    return {
      name: this.name,
      colonies: this.colonies,
      isActive: this.isActive,
      trackPosition: this.trackPosition,
      visitor: this.visitor,
    };
  }
}
