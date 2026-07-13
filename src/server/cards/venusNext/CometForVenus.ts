import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {SelectPlayer} from '../../inputs/SelectPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {all} from '../Options';
import {IProjectCard} from '../IProjectCard';
import {skip} from '../../inputs/optionMetadata';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {AutomaTargeting} from '../../automa/AutomaTargeting';

export class CometForVenus extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.COMET_FOR_VENUS,
      type: CardType.EVENT,
      tags: [Tag.SPACE],
      cost: 11,

      behavior: {
        global: {venus: 1},
      },

      metadata: {

        infoText: [

          {text: 'Raise Venus 1 step.', tokens: ['venus']},

          {text: 'Remove up to 4 M€ from any player with a Venus tag in play.', tokens: ['megacredits']},

        ],
        description: 'Raise Venus 1 step. Remove up to 4M€ from any player WITH A VENUS TAG IN PLAY.',
        cardNumber: '218',
        renderData: CardRenderer.builder((b) => {
          b.venus(1).nbsp.nbsp.minus().megacredits(4, {all, secondaryTag: Tag.VENUS});
        }),
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    return this.buildOptions(player);
  }

  // The on-play preview: the declarative venus chip + the SAME M€-steal OrOptions
  // `bespokePlay` builds (rich target picker + skip), hosted as a step so the
  // player chooses the victim inside the play modal. Built read-only.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const options = this.buildOptions(player);
    const step = actionPreviews.targetStepOrWarning(player,
      options !== undefined ? actionPreviews.orOptionsStep(player, options) : undefined);
    return actionPreviews.playPreview(this, player, [], [step]);
  }

  // Side-effect-free construction shared by `bespokePlay` + the preview (the
  // attack only runs in the SelectPlayer `andThen`).
  private buildOptions(player: IPlayer): OrOptions | undefined {
    // MarsBot's Venus tags ARE its Venus track position (rulebook p.5).
    const venusTagPlayers = player.opponents.filter((opponent) => AutomaTargeting.effectiveTagCount(opponent, Tag.VENUS) > 0);

    if (player.game.isSoloMode()|| venusTagPlayers.length === 0) {
      return undefined;
    }

    const noVenusTag = player.opponents
      .filter((opponent) => AutomaTargeting.effectiveTagCount(opponent, Tag.VENUS) === 0)
      .map((opponent) => ({player: opponent, reason: 'No Venus tag' as const}));
    return new OrOptions(
      new SelectPlayer(
        Array.from(venusTagPlayers),
        'Select player to remove up to 4 M€ from',
        'Remove M€',
        {icon: 'megacredits', amount: 4, scope: 'stock', disabled: noVenusTag})
        .andThen((target) => {
          target.attack(player, Resource.MEGACREDITS, 4, {log: true});
          return undefined;
        }),
      new SelectOption('Do not remove M€').withMetadata(skip()));
  }
}
