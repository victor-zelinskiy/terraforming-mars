import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {SelectCard} from '../../inputs/SelectCard';
import {OrOptions} from '../../inputs/OrOptions';
import {CardRenderer} from '../render/CardRenderer';
import {SerializedCard} from '../../SerializedCard';
import {newProjectCard} from '../../createCard';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class SelfReplicatingRobots extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.SELF_REPLICATING_ROBOTS,
      cost: 7,

      requirements: {tag: Tag.SCIENCE, count: 2},
      metadata: {
        // The play-from-here effect lived ONLY in the render text (absent from
        // the fullscreen rule blocks). Authored as an `effect` block; the two
        // action frames + the requirement are auto-derived (an `effect`/`action`
        // infoText entry augments, it does not replace the frames).
        infoText: [
          {kind: 'effect', text: 'A card here may be played as if from hand, with its cost reduced by the number of resources on it.'},
        ],
        cardNumber: '210',
        renderData: CardRenderer.builder((b) => {
          // TWO separate action rows (one per branch) so the premium per-branch
          // UI (ActionsOverlay split + confirmation modal) maps each choice to
          // its OWN graphic instead of painting the whole combined "link OR ×2"
          // box on a single branch. Titles match the preview branch titles so the
          // node↔branch matcher (assignBranchNodes) pairs them cleanly.
          b.action('Reveal and place a building or space card from hand here, and place 2 resources on it.', (eb) => {
            eb.empty().startAction.selfReplicatingRobots();
          }).br;
          b.action('Double the resources on a card here.', (eb) => {
            eb.empty().startAction.multiplierWhite().text('x2');
          });
        }),
        description: 'Requires 2 science tags.',
      },
    });
  }

  /**
   * Cards hosted by Self-Replicating Robots. They are not considered "played" cards.
   */
  public targetCards: Array<IProjectCard> = [];

  public override getCardDiscount(_player: IPlayer, card: IProjectCard): number {
    return this.targetCards.find((c) => c.name === card.name)?.resourceCount ?? 0;
  }

  public canAct(player: IPlayer): boolean {
    return this.targetCards.length > 0 ||
             player.cardsInHand.some((card) => card.tags.some((tag) => tag === Tag.SPACE || tag === Tag.BUILDING));
  }

  public actionUnavailableReason() {
    return actionReason.targetReason('No card to place resources on');
  }

  private isLinkable(card: IProjectCard): boolean {
    return card.tags.some((tag) => tag === Tag.SPACE || tag === Tag.BUILDING);
  }

  // Two clear branches in the SAME order action() pushes them (double first when
  // there ARE hosted cards, then link). The "double" branch previews a hosted
  // card's resources X → 2X; the "link" branch hosts a hand-card picker that
  // shows EVERY hand card with the non-eligible ones greyed + a reason (the
  // premium picker's Available/Unavailable filter), so the player sees exactly
  // which cards qualify and why the rest don't.
  public actionPreview(player: IPlayer) {
    const eligible = player.cardsInHand.filter((card) => this.isLinkable(card));
    const ineligible = player.cardsInHand.filter((card) => !this.isLinkable(card));
    const hosted = this.targetCards;

    return actionPreviews.orBranches(this, [
      {
        available: hosted.length > 0,
        title: 'Double the resources on a card here',
        unavailableReason: actionReason.targetReason('No card here to double'),
        // X → 2X for a single hosted card; with several, the picker shows each.
        effects: hosted.length === 1 ? [actionPreviews.cardGain(hosted[0], hosted[0].resourceCount)] : [],
        optionInput: hosted.length > 0 ?
          actionPreviews.cardInput(player, 'Select card to double robots resource', 'Double resource', hosted, {played: CardName.SELF_REPLICATING_ROBOTS}) :
          undefined,
      },
      {
        available: eligible.length > 0,
        title: 'Reveal a building or space card from hand, place it here with 2 resources',
        unavailableReason: actionReason.targetReason('No building or space card in hand'),
        optionInput: eligible.length > 0 ?
          actionPreviews.cardInput(player, 'Select card to link with Self-replicating Robots', 'Link card', eligible, {
            played: CardName.SELF_REPLICATING_ROBOTS,
            disabled: ineligible.map((card) => ({card, reason: 'No building or space tag'})),
          }) :
          undefined,
      },
    ]);
  }

  public action(player: IPlayer) {
    const orOptions = new OrOptions();
    const selectableCards = player.cardsInHand.filter((card) => card.tags.some((tag) => tag === Tag.SPACE || tag === Tag.BUILDING));

    if (this.targetCards.length > 0) {
      orOptions.options.push(new SelectCard(
        'Select card to double robots resource', 'Double resource', this.targetCards, {played: CardName.SELF_REPLICATING_ROBOTS})
        .andThen(([card]) => {
          const resourceCount = card.resourceCount;
          card.resourceCount *= 2;
          player.game.log('${0} doubled resources on ${1} from ${2} to ${3}', (b) => {
            b.player(player).card(card).number(resourceCount).number(card.resourceCount);
          });
          return undefined;
        }));
    }

    if (selectableCards.length > 0) {
      orOptions.options.push(new SelectCard(
        'Select card to link with Self-replicating Robots',
        'Link card', selectableCards,
        {played: CardName.SELF_REPLICATING_ROBOTS}).andThen(
        ([card]) => {
          const projectCardIndex = player.cardsInHand.findIndex((c) => c.name === card.name);
          player.cardsInHand.splice(projectCardIndex, 1);
          this.targetCards.push(card);
          card.resourceCount = 2;
          player.game.log('${0} linked ${1} with ${2}', (b) => b.player(player).card(card).card(this));
          return undefined;
        }));
    }

    // Auto-resolve the lone executable option (the standard bespoke-`or`
    // convention `actionPreview`'s `orBranches` relies on): with only ONE branch
    // available the live prompt is the bare SelectCard, matching the preview's
    // auto-resolved `index: -1` — so the confirm modal's pre-collected pick is
    // consumed by the batch instead of leaving a redundant follow-up "select
    // card to link" prompt (the double-ask bug).
    if (orOptions.options.length === 1) {
      return orOptions.options[0];
    }
    return orOptions;
  }

  serialize(serialized: SerializedCard): void {
    serialized.targetCards = this.targetCards.map((t) => {
      return {
        card: {name: t.name},
        resourceCount: t.resourceCount,
      };
    });
  }

  deserialize(serialized: SerializedCard): void {
    if (serialized.targetCards !== undefined) {
      this.targetCards = [];
      serialized.targetCards.forEach((targetCard) => {
        const card = newProjectCard(targetCard.card.name);
        if (card !== undefined) {
          card.resourceCount = targetCard.resourceCount;
          this.targetCards.push(card);
        } else {
          console.warn('did not find card for SelfReplicatingRobots', targetCard);
        }
      });
    }
  }
}
