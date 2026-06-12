import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {DecreaseAnyProduction} from '../../deferredActions/DecreaseAnyProduction';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class Hackers extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.HACKERS,
      cost: 3,
      victoryPoints: -1,

      behavior: {
        production: {energy: -1, megacredits: 2},
      },

      metadata: {
        cardNumber: '125',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.minus().energy(1).megacredits(2, {all}).br;
            pb.plus().megacredits(2);
          });
        }),
        description: 'Decrease your energy production 1 step and any M€ production 2 steps. Increase your M€ production 2 steps.',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(
      new DecreaseAnyProduction(player, Resource.MEGACREDITS, {count: 2, stealing: true}));
    return undefined;
  }

  // The on-play preview: the declarative −1 energy / +2 M€ production chips
  // (auto-included by playPreview) PLUS the target picker for the "steal 2 M€
  // production from any player" — so the player chooses WHOSE production to reduce
  // inside the play modal (when a choice is offered). Mirrors EnergyTapping.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const step = actionPreviews.inputStep(
      new DecreaseAnyProduction(player, Resource.MEGACREDITS, {count: 2, stealing: true}).previewSelectPlayer());
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}

