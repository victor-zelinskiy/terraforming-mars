import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {RemoveResourcesFromCard} from '../../deferredActions/RemoveResourcesFromCard';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class StratosphericBirds extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.STRATOSPHERIC_BIRDS,
      type: CardType.ACTIVE,
      tags: [Tag.VENUS, Tag.ANIMAL],
      cost: 12,
      resourceType: CardResource.ANIMAL,
      victoryPoints: {resourcesHere: {}},
      requirements: {venus: 12},

      action: {
        addResources: 1,
      },

      metadata: {
        cardNumber: '249',
        renderData: CardRenderer.builder((b) => {
          b.action('Add 1 animal to this card.', (eb) => {
            eb.empty().startAction.resource(CardResource.ANIMAL);
          }).br;
          b.minus().resource(CardResource.FLOATER).br;
          b.vpText('1 VP for each animal on this card.');
        }),
        description: {
          text: 'Requires Venus 12% and that you spend 1 floater from any card.',
          align: 'left',
        },
      },
    });
  }
  public override bespokeCanPlay(player: IPlayer): boolean {
    const cardsWithFloater = player.getCardsWithResources(CardResource.FLOATER);
    if (cardsWithFloater.length === 0) {
      return false;
    }

    if (cardsWithFloater.length > 1) {
      return true;
    } else {
      const floaterCard = cardsWithFloater[0];
      if (floaterCard.name !== CardName.DIRIGIBLES) {
        return true;
      }

      const canPayForFloater = ((floaterCard.resourceCount - 1) * 3 + player.megaCredits) >= player.getCardCost(this);
      return canPayForFloater;
    }
  }
  public override bespokePlay(player: IPlayer) {
    player.game.defer(new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false, autoselect: false}));
    return undefined;
  }

  // The on-play preview: the SAME "spend 1 floater from a card" picker bespokePlay
  // defers — the player chooses WHICH of their floater cards to take 1 from, as
  // premium card tiles in the play modal. Per the fork's no-autoselect principle
  // (`autoselect: false`) the picker ALWAYS shows, EVEN for a single floater card,
  // so the player always SEES which card the floater is spent from.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const step = actionPreviews.inputStep(
      new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false, autoselect: false}).previewSelectCard(),
      // The signed delta (−1) so the picker shows each candidate's floater
      // `current → resulting` (e.g. 2 → 1) — incl. the SINGLE-candidate case, which
      // ActionTargetCard pre-selects + shows with its projected count (no blind spend).
      -1);
    return actionPreviews.playPreview(this, player, [], [step]);
  }
}
