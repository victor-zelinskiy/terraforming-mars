import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {IActionCard, ICard, isIActionCard, isIHasCheckLoops} from '../ICard';
import {SelectCard} from '../../inputs/SelectCard';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class ProjectInspection extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.PROJECT_INSPECTION,
      cost: 0,

      metadata: {
        cardNumber: 'X02',
        renderData: CardRenderer.builder((b) => {
          b.text('Use a card action that has been used this generation.', Size.SMALL, true);
        }),
      },
    });
  }

  // This matches Viron.getActionCards.
  private getActionCards(player: IPlayer): Array<IActionCard & ICard> {
    const result = [];

    for (const playedCard of player.tableau) {
      if (playedCard === this) {
        continue;
      }
      if (!isIActionCard(playedCard)) {
        continue;
      }
      if (isIHasCheckLoops(playedCard) && playedCard.getCheckLoops() >= 2) {
        continue;
      }
      if (player.actionsThisGeneration.has(playedCard.name) && playedCard.canAct(player)) {
        result.push(playedCard);
      }
    }
    return result;
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.getActionCards(player).length > 0;
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.getActionCards(player).length === 0) {
      return reason.targetReason('No card action used this generation to use again');
    }
    return undefined;
  }

  // The on-play preview: the SAME card picker `bespokePlay` builds — the player
  // chooses WHICH already-used action to perform again, as premium card tiles in
  // the play modal, instead of a follow-up prompt. (The re-run action's own
  // prompts arrive after the batch, on their normal surfaces.)
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = this.getActionCards(player);
    const step = cards.length > 0 ?
      actionPreviews.selectCardStep(player, 'Perform an action from a played card again', 'Take action', cards, {repeatAction: true}) :
      undefined;
    return actionPreviews.playPreview(this, player, [], [step]);
  }

  public override bespokePlay(player: IPlayer) {
    const actionCards = this.getActionCards(player);
    if (actionCards.length === 0 ) {
      return undefined;
    }
    return new SelectCard<IActionCard & ICard>(
      'Perform an action from a played card again',
      'Take action',
      actionCards)
      .andThen(([card]) => {
        const foundCard = card;
        const events = player.game?.events;
        const run = () => {
          player.game.log('${0} used ${1} action with ${2}', (b) => b.player(player).card(foundCard).card(this));
          return foundCard.action(player);
        };
        return events !== undefined ? events.withCopiedAction(player, this, foundCard, run) : run();
      });
  }
}
