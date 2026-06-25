import {CardType} from '../../common/cards/CardType';
import {IPlayer} from '../IPlayer';
import {TRSource} from '../../common/cards/TRSource';
import {CardMetadata} from '../../common/cards/CardMetadata';
import {CardName} from '../../common/cards/CardName';
import {Card} from './Card';
import {MoonExpansion} from '../moon/MoonExpansion';
import {Units} from '../../common/Units';
import {IStandardProjectCard} from './IStandardProjectCard';
import {sum} from '../../common/utils/utils';
import {Payment} from '../../common/inputs/Payment';
import {StandardProjectCanPayWith} from '../../common/cards/Types';

type StaticStandardProjectCardProperties = {
  name: CardName,
  cost: number,
  metadata: CardMetadata,
  reserveUnits?: Partial<Units>,
  tr?: TRSource,
}


export abstract class StandardProjectCard extends Card implements IStandardProjectCard {
  constructor(properties: StaticStandardProjectCardProperties) {
    super({
      type: CardType.STANDARD_PROJECT,
      ...properties,
    });
  }

  public override get type(): CardType.STANDARD_PROJECT {
    return CardType.STANDARD_PROJECT;
  }

  protected discount(_player: IPlayer) {
    return 0;
  }

  public getAdjustedCost(player: IPlayer) {
    const discountFromCards =
      sum(player.tableau.asArray()
        .map((card) => card.getStandardProjectDiscount?.(player, this) ?? 0));
    const discount = discountFromCards + this.discount(player);
    const adjusted = Math.max(0, this.cost - discount);
    return adjusted;
  }

  protected abstract actionEssence(player: IPlayer): void

  public onStandardProject(player: IPlayer): void {
    const events = player.game?.events;
    for (const playedCard of player.tableau) {
      if (playedCard.onStandardProject === undefined) {
        continue;
      }
      if (events !== undefined) {
        events.withEffect(player, playedCard, 'standard-project', () => playedCard.onStandardProject?.(player, this));
      } else {
        playedCard.onStandardProject(player, this);
      }
    }
  }

  protected canPlayOptions(player: IPlayer) {
    const canPayWith = this.canPayWith(player);
    return {
      ...canPayWith,
      cost: this.getAdjustedCost(player),
      tr: this.tr,
      auroraiData: true,
      spireScience: true,
      reserveUnits: MoonExpansion.adjustedReserveCosts(player, this),
    };
  }

  public canAct(player: IPlayer): boolean {
    return player.canAfford(this.canPlayOptions(player));
  }

  public canPayWith(_player: IPlayer): StandardProjectCanPayWith {
    return {};
  }

  public payAndExecute(player: IPlayer, payment: Payment): void {
    const events = player.game?.events;
    if (events === undefined) {
      this.payAndExecuteImpl(player, payment);
      return;
    }
    // Root the analytics chain at the standard project so its effects / tile
    // placements / triggered effects group under it in the journal.
    events.beginAction(player, {kind: 'standardProject', card: this.name}, {category: 'standard-project'});
    try {
      this.payAndExecuteImpl(player, payment);
    } finally {
      events.endScope();
    }
  }

  /**
   * The default project execution: charge the player, then run the project's
   * effect. Placement-bearing projects (City / Greenery / Aquifer) OVERRIDE this
   * to PAY ON COMMIT — they defer a cancellable placement and call `commitCost`
   * only once a space is chosen, so the player can cancel before anything is spent.
   */
  protected payAndExecuteImpl(player: IPlayer, payment: Payment): void {
    this.commitCost(player, payment);
    this.actionEssence(player);
  }

  /**
   * Record discounts + payment, charge the player, and mark the project played
   * (log + `standardProjectsThisGeneration` + `onStandardProject` triggers).
   * Extracted so the pay-on-commit placement projects can invoke it from inside
   * the placement callback (after a space is chosen) rather than up front.
   */
  protected commitCost(player: IPlayer, payment: Payment): void {
    const events = player.game?.events;
    if (events !== undefined) {
      // Discounts are recorded HERE (at pay time), never in getAdjustedCost —
      // that runs on every affordability check and would spam false savings.
      for (const card of player.tableau) {
        const discount = card.getStandardProjectDiscount?.(player, this) ?? 0;
        if (discount > 0) {
          events.recordDiscount(player, {kind: card.type === CardType.CORPORATION ? 'corporation' : 'card', card: card.name, owner: player.color}, discount, this.name);
        }
      }
      events.recordPayment(player, this.getAdjustedCost(player), this.name);
    }
    if (events !== undefined) {
      events.withSource({kind: 'payment'}, () => player.pay(payment));
    } else {
      player.pay(payment);
    }
    this.projectPlayed(player);
  }

  /**
   * Run `commit` inside the standard-project analytics scope (so the tile
   * placement, payment, and effects group under this project in the journal).
   * Used by the pay-on-commit placement projects: the scope is opened ONLY when a
   * space is actually chosen, so a cancelled placement emits no (empty) journal
   * root.
   */
  protected commitInScope(player: IPlayer, commit: () => void): void {
    const events = player.game?.events;
    if (events === undefined) {
      commit();
      return;
    }
    events.beginAction(player, {kind: 'standardProject', card: this.name}, {category: 'standard-project'});
    try {
      commit();
    } finally {
      events.endScope();
    }
  }

  protected projectPlayed(player: IPlayer) {
    player.game.log('${0} used ${1} standard project', (b) => b.player(player).card(this));
    // standardProjectsThisGeneration does not include Sell Patents.
    if (this.name !== CardName.SELL_PATENTS_STANDARD_PROJECT) {
      player.standardProjectsThisGeneration.add(this.name);
    }
    this.onStandardProject(player);
  }
}
