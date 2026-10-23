import {IPlayer} from '../../../IPlayer';
import {Resource} from '../../../../common/Resource';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {StandardProjectCard} from '../../StandardProjectCard';
import {SelectCard} from '../../../inputs/SelectCard';
import {IProjectCard} from '../../IProjectCard';
import * as actionReason from '../../actionReasons';
import {UnplayableReason} from '../../../../common/cards/UnplayableReason';
import {SELL_PATENTS_MEGACREDITS_PER_CARD} from './patentSale';
import {patentSaleModel} from '../../../models/patentSaleModel';
import {SELL_PATENTS_EXHAUSTED_REASON} from '../../../../common/game/fastMode';

export class SellPatentsStandardProject extends StandardProjectCard {
  constructor() {
    super({
      name: CardName.SELL_PATENTS_STANDARD_PROJECT,
      cost: 0,
      metadata: {
        cardNumber: 'SP8',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Discard any number of cards to gain that amount of M€.', (eb) => {
            eb.text('X').cards(1).startAction.megacredits(1, {text: 'x'});
          }),
        ),
      },
    });
  }

  /**
   * FAST MODE caps the sale at ONE per generation per player (the fork's
   * extension of upstream's «cannot end turn after one action»). The same
   * predicate feeds `canAct` and the reason, so the two can never drift.
   */
  public static exhaustedForGeneration(player: IPlayer): boolean {
    return player.game.gameOptions.fastModeOption && player.patentSalesThisGeneration > 0;
  }

  public override canAct(player: IPlayer): boolean {
    return player.cardsInHand.length > 0 && !SellPatentsStandardProject.exhaustedForGeneration(player);
  }

  // Co-located with canAct so the reason can't drift when the gate changes.
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (SellPatentsStandardProject.exhaustedForGeneration(player)) {
      return actionReason.ruleReason(SELL_PATENTS_EXHAUSTED_REASON);
    }
    return player.cardsInHand.length === 0 ? actionReason.ruleReason('No cards in hand') : undefined;
  }

  actionEssence(): void {
    // no-op
  }

  public action(player: IPlayer): SelectCard<IProjectCard> {
    return new SelectCard(
      'Sell patents',
      'Sell',
      player.cardsInHand,
      {max: player.cardsInHand.length, played: false})
      // THE STRUCTURAL MARK of the sale (never its title) and its rate: what one
      // card pays and what the seller's table answers to it, derived per serialization.
      .markPatentSale((viewer) => patentSaleModel(viewer, this))
      .andThen((cards) => {
        // THE SALE IS AN ACTION ROOT, like every standard project (`payAndExecute`):
        // without it the recorder drops the +M€ as loose bookkeeping (no source, no
        // context) and a reactor's answer (TR46's data) becomes an orphan chain
        // with no cause — the journal and a rival's notification lose the sale.
        this.commitInScope(player, () => {
          // stock.add (NOT `player.megaCredits +=`) so the +M€ from selling patents is
          // recorded as a GameEvent and appears in the journal / notifications.
          player.stock.add(Resource.MEGACREDITS, cards.length * SELL_PATENTS_MEGACREDITS_PER_CARD);
          cards.forEach((card) => player.discardCardFromHand(card));
          // The fast-mode cap counts SALES, not cards: a one-card sale spends the
          // generation's one sale exactly like a ten-card sale.
          player.patentSalesThisGeneration++;
          this.projectPlayed(player);
          player.game.log('${0} sold ${1} patents', (b) => b.player(player).number(cards.length));
          this.patentsSold(player, cards);
        });
        return undefined;
      });
  }

  /**
   * THE ONE WRITER of `ICard.onPatentsSold` (TR46 Research Startups): the seller's
   * own tableau, each reactor inside its passive-effect scope — the journal's
   * effect line and the notifications name the reacting card. After the sale's
   * own line, so the journal reads the cause before its answer.
   */
  private patentsSold(player: IPlayer, cards: ReadonlyArray<IProjectCard>): void {
    if (cards.length === 0) {
      return;
    }
    const events = player.game?.events;
    for (const reactor of player.tableau) {
      if (reactor.onPatentsSold === undefined) {
        continue;
      }
      if (events !== undefined) {
        events.withEffect(player, reactor, 'standard-project', () => reactor.onPatentsSold?.(player, cards));
      } else {
        reactor.onPatentsSold(player, cards);
      }
    }
  }
}
