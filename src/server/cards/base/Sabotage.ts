import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {AutomaTargeting} from '../../automa/AutomaTargeting';
import {OrOptions} from '../../inputs/OrOptions';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {SelectOption} from '../../inputs/SelectOption';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {all, digit} from '../Options';
import {message} from '../../logs/MessageBuilder';
import {disabledPlayerTarget, removeResourceFromPlayer, skip} from '../../inputs/optionMetadata';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class Sabotage extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.SABOTAGE,
      cost: 1,

      metadata: {

        infoText: [

          {text: 'Remove up to 3 titanium or up to 4 steel from any player.', tokens: ['titanium']},

          {text: 'Or remove up to 7 M€ from any player.', tokens: ['megacredits']},

        ],
        cardNumber: '121',
        renderData: CardRenderer.builder((b) => {
          b.minus().titanium(3, {all, digit}).nbsp.or(Size.SMALL).nbsp;
          b.minus().steel(4, {all, digit}).br.or(Size.SMALL).nbsp;
          b.minus().megacredits(7, {all});
        }),
        description: 'Remove up to 3 titanium from any player, or 4 steel, or 7 M€.',
      },
    });
  }

  private title(amount: number, type: string, target: IPlayer) {
    return message('Remove ${0} ${1} from ${2}', (b) => b.number(amount).string(type).player(target));
  }

  public override bespokePlay(player: IPlayer) {
    return this.buildOptions(player);
  }

  // The on-play preview: the SAME OrOptions `bespokePlay` builds, hosted as a
  // step so the player picks WHICH resource to remove from WHICH opponent inside
  // the play modal (rich target cards + disabled opponents). Built read-only (the
  // attacks live in `andThen`).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const options = this.buildOptions(player);
    const step = options !== undefined ? actionPreviews.orOptionsStep(player, options) : undefined;
    return actionPreviews.playPreview(this, player, [], [step]);
  }

  // Side-effect-free construction shared by `bespokePlay` + the preview (the
  // resource removals only run when an option's `andThen` fires).
  private buildOptions(player: IPlayer): OrOptions | undefined {
    const availableActions = new OrOptions();

    if (player.game.isSoloMode() && player.playedCards.has(CardName.MONS_INSURANCE)) {
      availableActions.options.push(new SelectOption(
        'Remove resources from the neutral oppponent',
        'Remove plants')
        .andThen(() => {
          player.resolveInsuranceInSoloGame();
          return undefined;
        }));
    } else {
      player.opponents.forEach((target) => {
        // MarsBot's removable alloys = its storage areas + the M€-supply proxy.
        const titanium = AutomaTargeting.attackableStock(target, Resource.TITANIUM);
        const steel = AutomaTargeting.attackableStock(target, Resource.STEEL);
        if (titanium > 0 && !target.alloysAreProtected()) {
          const amountRemoved = Math.min(3, titanium);
          const optionTitle = this.title(amountRemoved, 'titanium', target);
          availableActions.options.push(new SelectOption(optionTitle, 'Remove')
            .withMetadata(removeResourceFromPlayer(target, Resource.TITANIUM, amountRemoved, titanium))
            .andThen(() => {
              target.attack(player, Resource.TITANIUM, 3, {log: true});
              return undefined;
            }));
        }

        if (steel > 0 && !target.alloysAreProtected()) {
          const amountRemoved = Math.min(4, steel);
          const optionTitle = this.title(amountRemoved, 'steel', target);
          availableActions.options.push(new SelectOption(optionTitle, 'Remove')
            .withMetadata(removeResourceFromPlayer(target, Resource.STEEL, amountRemoved, steel))
            .andThen(() => {
              target.attack(player, Resource.STEEL, 4, {log: true});
              return undefined;
            }));
        }

        if (target.megaCredits > 0) {
          const amountRemoved = Math.min(7, target.megaCredits);
          const optionTitle = this.title(amountRemoved, 'M€', target);
          availableActions.options.push(new SelectOption(optionTitle, 'Remove')
            .withMetadata(removeResourceFromPlayer(target, Resource.MEGACREDITS, amountRemoved, target.megaCredits))
            .andThen(() => {
              target.attack(player, Resource.MEGACREDITS, 7, {log: true});
              return undefined;
            }));
        }
      });

      // Opponents we can't take anything from → greyed cards with a reason.
      const disabled = player.opponents
        .filter((target) => {
          const hasRemovable = (AutomaTargeting.attackableStock(target, Resource.TITANIUM) > 0 && !target.alloysAreProtected()) ||
            (AutomaTargeting.attackableStock(target, Resource.STEEL) > 0 && !target.alloysAreProtected()) ||
            target.megaCredits > 0;
          return !hasRemovable;
        })
        .map((target) => {
          const alloyOnly = (target.titanium > 0 || target.steel > 0) && target.alloysAreProtected() && target.megaCredits === 0;
          return disabledPlayerTarget(target, undefined, alloyOnly ? 'Resources are protected' : 'No resources to remove');
        });
      availableActions.setDisabledOptions(disabled);
    }

    if (availableActions.options.length > 0) {
      availableActions.options.push(new SelectOption('Do not remove resource').withMetadata(skip()).andThen(() => {
        return undefined;
      }));
      return availableActions;
    }
    return undefined;
  }
}

