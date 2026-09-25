import {CorporationCard} from '../corporation/CorporationCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {repeatableActionCards} from '../repeatableActions';
import {SelectCard} from '../../inputs/SelectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ICorporationCard} from '../corporation/ICorporationCard';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';

export class Viron extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.VIRON,
      tags: [Tag.MICROBE],
      startingMegaCredits: 48,

      metadata: {
        cardNumber: 'R12',
        description: 'You start with 48 M€.',
        infoText: [{kind: 'action-short', text: 'Repeat a blue action used this generation'}],
        renderData: CardRenderer.builder((b) => {
          b.br.br.br;
          b.megacredits(48);
          b.corpBox('action', (ce) => {
            ce.action('Use a blue card action that has already been used this generation.', (eb) => {
              eb.empty().startAction.empty();
            });
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return repeatableActionCards(player, this).length > 0 && !player.actionsThisGeneration.has(this.name);
  }
  public actionUnavailableReason() {
    return actionReason.ruleReason('No other action card to copy');
  }

  // The action preview: the SAME card picker `action()` builds — the player
  // chooses WHICH already-used blue-card action to perform again, as premium card
  // tiles in the confirmation modal, instead of a follow-up prompt. (The re-run
  // action's own prompts arrive after the batch, on their normal surfaces.)
  public actionPreview(player: IPlayer): ActionPreview {
    const cards = repeatableActionCards(player, this);
    const steps = cards.length > 0 ?
      [actionPreviews.selectCardStep(player, 'Perform again an action from a played card', 'Take action', cards, {repeatAction: true})] :
      [];
    return actionPreviews.singleBranch(this, player, steps);
  }

  public action(player: IPlayer) {
    if (repeatableActionCards(player, this).length === 0 ) {
      return undefined;
    }

    return new SelectCard(
      'Perform again an action from a played card',
      'Take action',
      repeatableActionCards(player, this))
      .andThen(([card]) => {
        // Analytics: a `copied-action` scope so the copied card's impact is
        // attributed to VIRON (the copying corporation), forming the chain
        // VIRON → copied card → its resulting gains. The "used X with VIRON" log
        // is emitted INSIDE the scope so it heads the journal group.
        const events = player.game?.events;
        const run = () => {
          player.game.log('${0} used ${1} action with ${2}', (b) => b.player(player).card(card).card(this));
          return card.action(player);
        };
        return events !== undefined ? events.withCopiedAction(player, this, card, run) : run();
      });
  }
}
