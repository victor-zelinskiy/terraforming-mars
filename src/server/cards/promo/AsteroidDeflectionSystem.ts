import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import * as actionReveals from '../actionReveals';
import {ActionEffect} from '../../../common/models/ActionPreviewModel';

export class AsteroidDeflectionSystem extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.ASTEROID_DEFLECTION_SYSTEM,
      tags: [Tag.SPACE, Tag.EARTH, Tag.BUILDING],
      cost: 13,

      resourceType: CardResource.ASTEROID,
      victoryPoints: {resourcesHere: {}},

      behavior: {
        production: {energy: -1},
      },

      metadata: {
        cardNumber: 'X14',
        renderData: CardRenderer.builder((b) => {
          b.action('REVEAL AND DISCARD the top card of the deck. If it has a space tag, add an asteroid here.', (eb) => {
            eb.empty().startAction.cards(1).asterix().nbsp.tag(Tag.SPACE).colon().resource(CardResource.ASTEROID);
          }).br;
          b.production((pb) => pb.minus().energy(1)).text('opponents may not remove your plants', Size.SMALL, true);
        }),
        description: {
          text: 'Decrease your energy production 1 step. 1 VP per asteroid on this card.',
          align: 'left',
        },
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.game.projectDeck.canDraw(1);
  }

  public actionUnavailableReason() {
    return actionReason.deckEmpty();
  }

  // The asteroid gain on a match (the reward chip), used both in the reveal
  // descriptor and when recording the result. `asteroid` is the card-resource icon key.
  private revealReward(): ActionEffect {
    return actionReveals.cardResourceReward('asteroid', 1);
  }

  // The outcome (whether a space-tagged card is revealed → +1 asteroid here) is
  // random, so it rides the premium reveal slot (check: space tag → reward:
  // asteroid here) instead of a fixed gain chip.
  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player,
      [],
      [],
      {reveal: {
        deck: 'project',
        check: {tag: Tag.SPACE, label: 'Space tag'},
        reward: this.revealReward(),
        // 1 VP per asteroid → a match ALWAYS adds 1 VP (never maxed, no warning).
        vp: {from: this.resourceCount, to: this.resourceCount + 1},
      }});
  }

  public action(player: IPlayer) {
    const vpBefore = this.resourceCount;
    const card = player.game.projectDeck.drawOrThrow(player.game);
    player.game.log('${0} revealed and discarded ${1}', (b) => b.player(player).card(card, {tags: true}),
      {reveal: {origin: 'deck', result: 'discarded', source: this.name}});
    const matched = card.tags.includes(Tag.SPACE);
    if (matched) {
      player.addResourceTo(this, {qty: 1, log: true});
    }
    // Record the reveal result + the VP swing for the premium overlay — BEFORE discarding.
    actionReveals.recordReveal(player, this.name, card, matched, this.revealReward(),
      {from: vpBefore, to: this.resourceCount});
    player.game.projectDeck.discard(card);
    return undefined;
  }
}
