import {Card} from '../Card';
import {IPlayer} from '../../IPlayer';
import {IProjectCard} from '../IProjectCard';
import {CardType} from '../../../common/cards/CardType';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {all} from '../Options';
import {message} from '../../logs/MessageBuilder';
import {disabledPlayerTarget, stealResourceFromPlayer, skip} from '../../inputs/optionMetadata';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class HiredRaiders extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.HIRED_RAIDERS,
      cost: 1,

      metadata: {
        cardNumber: '124',
        renderData: CardRenderer.builder((b) => {
          b.text('steal', Size.MEDIUM, true).steel(2, {all}).br;
          b.or().br;
          b.text('steal', Size.MEDIUM, true).megacredits(3, {all});
        }),
        description: 'Steal up to 2 steel, or 3 M€ from any player.',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    return this.buildOptions(player);
  }

  // The on-play preview: the SAME steal OrOptions `bespokePlay` builds, hosted as
  // a step so the player picks WHAT to steal from WHOM inside the play modal.
  // Built read-only (the steals run only in each option's `andThen`).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const options = this.buildOptions(player);
    const step = options !== undefined ? actionPreviews.orOptionsStep(player, options) : undefined;
    return actionPreviews.playPreview(this, player, [], [step]);
  }

  private buildOptions(player: IPlayer): OrOptions | undefined {
    if (player.game.isSoloMode()) {
      return new OrOptions(
        new SelectOption('Steal 2 steel', 'Steal steel').andThen(() => {
          // stock.add (NOT `player.steel +=`) so the gain is recorded as a GameEvent
          // and shows in the journal (the multiplayer path already records via attack).
          player.stock.add(Resource.STEEL, 2);
          return undefined;
        }),
        new SelectOption('Steal 3 M€', 'Steal M€').andThen(() => {
          player.stock.add(Resource.MEGACREDITS, 3);
          return undefined;
        }),
      );
    }

    const availableActions = new OrOptions();

    player.opponents.forEach((target) => {
      if (target.steel > 0 && !target.alloysAreProtected()) {
        const amountStolen = Math.min(2, target.steel);
        const optionTitle = message('Steal ${0} steel from ${1}', (b) => b.number(amountStolen).player(target).getMessage());

        availableActions.options.push(new SelectOption(optionTitle, 'Steal')
          .withMetadata(stealResourceFromPlayer(target, Resource.STEEL, amountStolen, target.steel))
          .andThen(() => {
            target.attack(player, Resource.STEEL, 2, {stealing: true, log: true});
            return undefined;
          }));
      }

      if (target.megaCredits > 0) {
        const amountStolen = Math.min(3, target.megaCredits);
        const optionTitle = message('Steal ${0} M€ from ${1}', (b) => b.number(amountStolen).player(target));

        availableActions.options.push(new SelectOption(optionTitle, 'Steal')
          .withMetadata(stealResourceFromPlayer(target, Resource.MEGACREDITS, amountStolen, target.megaCredits))
          .andThen(() => {
            target.attack(player, Resource.MEGACREDITS, 3, {log: true, stealing: true});
            return undefined;
          }));
      }
    });

    // Opponents we can't take steel or M€ from → greyed cards with a reason.
    const disabled = player.opponents
      .filter((target) => !((target.steel > 0 && !target.alloysAreProtected()) || target.megaCredits > 0))
      .map((target) => {
        const alloyOnly = target.steel > 0 && target.alloysAreProtected() && target.megaCredits === 0;
        return disabledPlayerTarget(target, undefined, alloyOnly ? 'Resources are protected' : 'No resources to remove');
      });
    availableActions.setDisabledOptions(disabled);

    if (availableActions.options.length > 0) {
      availableActions.options.push(new SelectOption('Do not steal').withMetadata(skip()).andThen(() => {
        return undefined;
      }));
      return availableActions;
    }
    return undefined;
  }
}

