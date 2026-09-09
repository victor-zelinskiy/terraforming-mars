import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {all} from '../Options';
import {IProjectCard} from '../IProjectCard';
import {disabledPlayerTarget, removeResourceFromPlayer, skip} from '../../inputs/optionMetadata';
import {attackEffect} from '../../inputs/choiceContext';
import {message} from '../../logs/MessageBuilder';
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
      options !== undefined ? actionPreviews.orOptionsStep(player, options) : undefined,
      undefined,
      {
        label: actionPreviews.SKIPPED_LABEL.removeResources,
        effect: actionPreviews.skippedAttackChip(Resource.MEGACREDITS, 4),
      });
    return actionPreviews.playPreview(this, player, [], [step]);
  }

  /** Up to 4 M€, but never more than the target effectively holds (a MarsBot's
   *  stock reads through its M€-supply proxy) — the one honest number the
   *  prompt row and the attack itself state. */
  private removableFrom(target: IPlayer): number {
    return Math.min(4, AutomaTargeting.attackableStock(target, Resource.MEGACREDITS));
  }

  // Side-effect-free construction shared by `bespokePlay` + the preview (each
  // attack only runs in its option's `andThen`). The premium attack shape (the
  // Flooding / StealResources standard): one FLAT leaf option per victim with
  // the target's current → resulting, the deliberate skip, dead targets greyed
  // with a reason, and the choiceContext marker that routes the console to the
  // one-press decision screen — a nested SelectPlayer here rendered as a
  // context-less two-step wizard.
  private buildOptions(player: IPlayer): OrOptions | undefined {
    // MarsBot's Venus tags ARE its Venus track position (rulebook p.5).
    const venusTagPlayers = player.opponents.filter((opponent) => AutomaTargeting.effectiveTagCount(opponent, Tag.VENUS) > 0);

    if (player.game.isSoloMode() || venusTagPlayers.length === 0) {
      return undefined;
    }

    // A Venus-tagged opponent with no M€ is a dead target — greyed with a
    // reason; when every one of them is broke the removal is a silent no-op
    // (the shared removal helpers' precedent) and the play preview names the
    // skipped effect instead.
    const attackable = venusTagPlayers.filter((target) => this.removableFrom(target) > 0);
    if (attackable.length === 0) {
      return undefined;
    }

    const removalOptions = attackable.map((target) => {
      const qty = this.removableFrom(target);
      return new SelectOption(
        message('Remove ${0} M€ from ${1}', (b) => b.number(qty).player(target)),
        'Remove M€')
        .withMetadata(removeResourceFromPlayer(target, Resource.MEGACREDITS, qty,
          AutomaTargeting.attackableStock(target, Resource.MEGACREDITS)))
        .andThen(() => {
          target.attack(player, Resource.MEGACREDITS, qty, {log: true});
          return undefined;
        });
    });
    const disabled = player.opponents
      .filter((opponent) => !attackable.includes(opponent))
      .map((opponent) => AutomaTargeting.effectiveTagCount(opponent, Tag.VENUS) === 0 ?
        disabledPlayerTarget(opponent, 'megacredits', 'No Venus tag') :
        disabledPlayerTarget(opponent, 'megacredits', 'No M€ to remove'));
    return new OrOptions(
      ...removalOptions,
      new SelectOption('Do not remove M€').withMetadata(skip()))
      .setTitle('Select player to remove up to 4 M€ from')
      .setDisabledOptions(disabled)
      .markChoiceContext(attackEffect(this));
  }
}
