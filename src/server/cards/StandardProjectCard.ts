import {CardType} from '../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../IPlayer';
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

  // Public because the standard-project explainer (`standardProjectReasons.ts`)
  // reads the SAME affordability request the gate uses — a reason derived from a
  // second, hand-built cost/TR/reserve triple would drift from `canAct`.
  public canPlayOptions(player: IPlayer) {
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

  /**
   * The affordability basis a PAY-ON-COMMIT placement must filter its targets by.
   *
   * The target list is built BEFORE the project's own cost is charged (that only
   * happens inside `commit`), so a plain affordability check offers spaces whose
   * ADDITIONAL placement cost (Ares hazard removal / Ares adjacency / the Hellas
   * ocean / the Vastitas temperature / the Terra Cimmeria colony) the player can
   * pay ONLY with money already earmarked for the project itself. Committing such
   * a space placed the tile and THEN threw «Player does not have N M€» out of the
   * deferred placement payment — the hazard cleared, its TR granted, the cost
   * never paid, the turn dead. `canAct` never had that hole (it asks with the
   * project's cost included); the space list must ask the same question.
   *
   * The chosen `payment` is known here, so the answer is EXACT: reserve precisely
   * what the commit will spend and ask what a placement may still cost on top.
   * `canPayWith` is deliberately NOT carried over — a placement cost is payable
   * only in M€ (plus Helion heat / Luna Trade Federation titanium, which
   * `canAfford` adds itself), never in the steel/seeds/asteroids this project may
   * accept for its own cost. `tr` carries the project's OWN terraform bump so a
   * Reds tax on it is reserved too; `Board.canAfford` adds the space's TR to it.
   */
  protected placementCanAffordOptions(player: IPlayer, payment: Payment): CanAffordOptions {
    const reserved = MoonExpansion.adjustedReserveCosts(player, this);
    return {
      // Not a second charge: the project's own cost IS `payment`, reserved below.
      cost: 0,
      tr: this.tr,
      reserveUnits: Units.of({
        megacredits: reserved.megacredits + payment.megacredits,
        steel: reserved.steel + payment.steel,
        titanium: reserved.titanium + payment.titanium,
        plants: reserved.plants + payment.plants,
        energy: reserved.energy,
        heat: reserved.heat + payment.heat,
      }),
    };
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
