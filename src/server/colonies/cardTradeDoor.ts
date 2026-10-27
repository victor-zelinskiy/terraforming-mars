import {CardName} from '../../common/cards/CardName';
import {OptionMetadata} from '../../common/models/PlayerInputModel';
import {ICard} from '../cards/ICard';
import {IPlayer} from '../IPlayer';
import {SelectOption} from '../inputs/SelectOption';
import {message} from '../logs/MessageBuilder';
import {IColonyTrader} from './IColonyTrader';
import {ITradeDestination} from './ITradeDestination';
import {tradeDestinationPick, tradeThrough} from './tradeDoor';

/**
 * THE CARD'S OWN TRADE DOOR — «spend 1 <resource> from here to trade for free».
 *
 * Three cards print that half word for word: Titan Floating Launch-Pad (C44, a floater), Automated Convoys (TR66, a
 * mech) and Veynon Dynamics (TR85, a mech). It is ONE door with ONE payment path — the card's resource is the fee,
 * `Colony.trade` (through the destination) is the trade — so it lives here once and each card states its spec:
 *
 *  - {@link CardResourceTrader} — the `IColonyTrader` of the path. It stands in `Colonies.tradeHandlers()`, so the
 *    colonies menu's fee picker, `bestTradeTerms` and `tradeBlockedReason` see it; the card's own action enters the
 *    VERY SAME option (the console locks the fee by `optionMetadata.card` — never by the translated label).
 *  - {@link cardTradeDoorReason} — the ONE blocker of the card's trade variant, in check order: the resource on the
 *    card (the only condition the card adds), then the engine's own trade gate.
 *  - {@link cardTradeDoorOption} — the action's option: it defers the destination pick (a colony tile or a fleet dock
 *    of the player's own) and trades through the trader inside the shared door scope (`tradeThrough`).
 *
 * The branch's PREVIEW stays co-located in each card (invariant 8): `cardCost(card, price)` + `colonyTradeStep(card)`.
 */
export type CardTradeDoorSpec = {
  /** The card whose resource pays — and the path's structural identity. */
  card: CardName;
  /** The resource icon key of the payment picker (`floater`, `mech`). */
  icon: string;
  /** The printed fee — one resource per trade on every card that prints the door. */
  price: number;
  /** The fee picker's row — `${0}` is the card's name. */
  optionText: string;
  /** The journal line of the paid trade — `${0}` the player, `${1}` the destination. */
  logText: string;
  /** The named blocker with no resource on the card. */
  noResourceReason: string;
  /**
   * How the fee leaves the card. `recorded` — `removeResourceFrom` (on the event recorder); `field` — the direct
   * decrement upstream's Titan Floating Launch-Pad has always done (kept byte for byte: the door was unified, the
   * card's journal was not re-cut).
   */
  spend: 'recorded' | 'field';
};

/** Pays a colony trade fee with the card's own resource (the card's action, and the fee picker's row). */
export class CardResourceTrader implements IColonyTrader {
  protected readonly card: ICard | undefined;

  constructor(protected readonly player: IPlayer, public readonly spec: CardTradeDoorSpec) {
    this.card = player.tableau.get(spec.card);
  }

  public canUse(): boolean {
    return (this.card?.resourceCount ?? 0) >= this.spec.price &&
      !this.player.actionsThisGeneration.has(this.spec.card);
  }

  public optionText() {
    return message(this.spec.optionText, (b) => b.cardName(this.spec.card));
  }

  /** `card` is this path's structural IDENTITY: the card's own action enters this very option, and the console locks
   *  the fee by it — never by the translated label. */
  public optionMetadata(): OptionMetadata {
    const current = this.card?.resourceCount ?? 0;
    return {kind: 'resourceRemoval' as const, icon: this.spec.icon, amount: this.spec.price,
      card: this.spec.card,
      resource: {current, resulting: Math.max(0, current - this.spec.price)}};
  }

  /** Mirrors `canUse`, one named blocker each; `undefined` = the card is not owned, so there is no option to explain. */
  public disabledReason(): string | undefined {
    if (this.card === undefined) {
      return undefined;
    }
    if (this.card.resourceCount < this.spec.price) {
      return this.spec.noResourceReason;
    }
    return 'This card\'s action was already used this generation';
  }

  public trade(destination: ITradeDestination): void {
    if (this.card !== undefined) {
      if (this.spec.spend === 'recorded') {
        this.player.removeResourceFrom(this.card, this.spec.price, {log: false});
      } else {
        this.card.resourceCount -= this.spec.price;
      }
    }
    this.player.actionsThisGeneration.add(this.spec.card);
    this.player.game.log(this.spec.logText, (b) => b.player(this.player).tradeDestination(destination));
    destination.trade(this.player);
  }
}

/** ONE blocker for the card's trade variant: the resource here first, then the engine's own trade gate. */
export function cardTradeDoorReason(player: IPlayer, card: ICard, spec: CardTradeDoorSpec): string | undefined {
  if (card.resourceCount < spec.price) {
    return spec.noResourceReason;
  }
  return player.colonies.tradeBlockedReason();
}

/**
 * The card action's trade option. The trader IS the implementation; this is one of its two entry points (the
 * colonies menu's fee picker is the other). The pick is of a DESTINATION — a colony tile or a fleet-dock card of the
 * player's own — and the door's scope is the shared one.
 */
export function cardTradeDoorOption(player: IPlayer, trader: CardResourceTrader, title: string, buttonLabel: string): SelectOption {
  return new SelectOption(title, buttonLabel).andThen(() => {
    player.defer(
      tradeDestinationPick(player, 'Select colony tile to trade with for free', 'trade', 0,
        (destination) => tradeThrough(player, trader, destination)));
    return undefined;
  });
}
