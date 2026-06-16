import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {CardRenderer} from '../render/CardRenderer';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import * as actionReveals from '../actionReveals';
import {ActionEffect} from '../../../common/models/ActionPreviewModel';
import {Resource} from '../../../common/Resource';
import {searchForLife} from '../render/DynamicVictoryPoints';
import {max} from '../Options';
import {TITLES} from '../../inputs/titles';

export class SearchForLife extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.SEARCH_FOR_LIFE,
      tags: [Tag.SCIENCE],
      cost: 3,

      resourceType: CardResource.SCIENCE,
      victoryPoints: 'special',

      requirements: {oxygen: 6, max},
      metadata: {
        cardNumber: '005',
        description: 'Oxygen must be 6% or less.',
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 1 M€ to reveal the top card of the draw deck. If that card has a microbe tag, add a science resource here.', (eb) => {
            eb.megacredits(1).startAction.tag(Tag.MICROBE).asterix().nbsp.colon().nbsp.resource(CardResource.SCIENCE);
          }).br;
          b.vpText('3 VPs if you have one or more science resources here.');
        }),
        victoryPoints: searchForLife(),
      },
    });
  }

  public override getVictoryPoints() {
    if (this.resourceCount > 0) {
      return 3;
    }
    return 0;
  }
  public canAct(player: IPlayer): boolean {
    return player.canAfford(1) && player.game.projectDeck.canDraw(1);
  }
  public actionUnavailableReason(player: IPlayer) {
    return player.game.projectDeck.canDraw(1) ? actionReason.needMoreMC(player, 1) : actionReason.deckEmpty();
  }
  // The science gain on a match (the reward chip), used both in the reveal
  // descriptor (the POTENTIAL reward, shown before confirming) and when recording
  // the actual result. `science` is the card-resource icon key.
  private revealReward(): ActionEffect {
    return actionReveals.cardResourceReward('science', 1);
  }

  // The VP this card scores for a given number of science resources: a BINARY 3 VP
  // once it holds at least one (not 1-per). This is why a SECOND find adds no VP —
  // surfaced as the reveal's clarity note (gain the first time, amber "no more VP"
  // when it already has one).
  private vpFor(resources: number): number {
    return resources > 0 ? 3 : 0;
  }

  // Spend 1 M€, reveal the top card; a science resource is gained ONLY if it has
  // a microbe tag. The outcome is random, so it rides the premium reveal slot
  // (check: microbe tag → reward: science here) instead of a fixed gain chip.
  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player,
      [],
      [actionPreviews.stockCost(player, Resource.MEGACREDITS, 1)],
      {reveal: {
        deck: 'project',
        check: {tag: Tag.MICROBE, label: 'Microbe tag'},
        reward: this.revealReward(),
        // VP now → VP after a successful find. `from === to` (already holds a
        // science) → the amber "no more VP" warning before confirming.
        vp: {from: this.vpFor(this.resourceCount), to: this.vpFor(this.resourceCount + 1)},
      }});
  }

  public action(player: IPlayer) {
    player.game.defer(new SelectPaymentDeferred(player, 1, {title: TITLES.payForCardAction(this.name)}))
      .andThen(() => {
        const vpBefore = this.vpFor(this.resourceCount);
        const card = player.game.projectDeck.drawOrThrow(player.game);
        player.game.log('${0} revealed and discarded ${1}', (b) => b.player(player).card(card, {tags: true}),
          {reveal: {origin: 'deck', result: 'discarded', source: this.name}});
        const found = card.tags.includes(Tag.MICROBE);
        if (found) {
          player.addResourceTo(this, 1);
          player.game.log('${0} found life!', (b) => b.player(player));
        }
        // Record the reveal result (revealed card + whether life was found + the
        // VP swing) for the premium reveal-result overlay — BEFORE discarding.
        actionReveals.recordReveal(player, this.name, card, found, this.revealReward(),
          {from: vpBefore, to: this.vpFor(this.resourceCount)});
        player.game.projectDeck.discard(card);
      });

    return undefined;
  }
}
