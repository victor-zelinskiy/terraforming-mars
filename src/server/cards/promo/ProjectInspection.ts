import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {repeatableActionCards} from '../repeatableActions';
import {SelectCard} from '../../inputs/SelectCard';
import {CardRenderer} from '../render/CardRenderer';
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

        infoText: [

          {text: 'Use a card action that has been used this generation.', tokens: ['action-replay']},

        ],
        cardNumber: 'X02',
        renderData: CardRenderer.builder((b) => {
          b.replayAction();
        }),
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return repeatableActionCards(player, this).length > 0;
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (repeatableActionCards(player, this).length === 0) {
      return reason.targetReason('No card action used this generation to use again');
    }
    return undefined;
  }

  // The on-play preview: the SAME card picker `bespokePlay` builds — the player
  // chooses WHICH already-used action to perform again, as premium card tiles in
  // the play modal, instead of a follow-up prompt. (The re-run action's own
  // prompts arrive after the batch, on their normal surfaces.)
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const cards = repeatableActionCards(player, this);
    const step = cards.length > 0 ?
      actionPreviews.selectCardStep(player, 'Perform an action from a played card again', 'Take action', cards, {repeatAction: true}) :
      undefined;
    return actionPreviews.playPreview(this, player, [], [step]);
  }

  public override bespokePlay(player: IPlayer) {
    const actionCards = repeatableActionCards(player, this);
    if (actionCards.length === 0 ) {
      return undefined;
    }
    return new SelectCard(
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
