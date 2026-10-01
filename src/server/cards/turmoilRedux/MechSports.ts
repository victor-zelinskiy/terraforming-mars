import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/**
 * TR11 — MECH SPORTS («Мех-спорт»).
 *
 * Two shipped cards glued together: the ACTION is TR09 EVA Mechs' word for
 * word (1 energy → a mech on this card), the requirement, the tag and the VP
 * are TR08 Formula Zero's (2 Science tags, Mars, 1 VP per resource here).
 * Fully declarative: no hook, no trigger, no forecast twin.
 *
 * SCAN READING — the two atoms sit in the orange MIN box beside the cost: that
 * is the REQUIREMENT («Requires 2 Science tags»), not tags. The card's only tag
 * is the planet in the corner — Mars. The planet under the «1/[mech]» is the
 * VP badge's backdrop. The purple Turmoil symbol at the bottom left is the
 * module itself (no `compatibility`); there is no Colonies ▲.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MechSports.spec.ts):
 *  1. The action's price is `spend.energy`: with 0 energy it is unavailable
 *     with the automatic «Not enough energy» reason — no bespoke `canAct`.
 *  2. VP = the mechs on this card, through the shared `resourcesHere` path.
 *  3. The requirement is DSL-only, so the parliament's science bonuses count;
 *     the Mars tag never counts as science.
 *  4. The mechs here are NOT money: the `mechs` payment unit reads EVA Mechs
 *     only (`CARD_FOR_SPENDABLE_RESOURCE.mechs`) — with both cards in play a
 *     Space-tag card is offered EVA's mechs and never touches these.
 *  5. A mech is a FULL card resource: Vesta's income and any «mech to any
 *     card» effect may land here, and it scores. Attacks on card resources
 *     take the ordinary `RemoveResourcesFromCard` path, no exception.
 *  6. Automated Convoys' trade spends a mech from ITS OWN card — the mechs here
 *     never open it.
 *  7. MarsBot never plays the card.
 */
export class MechSports extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.MECH_SPORTS,
      type: CardType.ACTIVE,
      tags: [Tag.MARS],
      cost: 7,
      resourceType: CardResource.MECH,
      requirements: {tag: Tag.SCIENCE, count: 2},
      victoryPoints: {resourcesHere: {}},

      action: {
        spend: {energy: 1},
        addResources: 1,
      },

      metadata: {
        cardNumber: 'TR11',
        renderData: CardRenderer.builder((b) => {
          // The action row is TR09's, key and all — one translation for both cards.
          b.action('Pay 1 energy to add a mech resource to this card.', (eb) => {
            eb.energy(1).startAction.resource(CardResource.MECH);
          }).br;
          b.vpText('1 VP for each mech resource on this card.');
        }),
      },
    });
  }
}
