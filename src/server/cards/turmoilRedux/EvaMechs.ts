import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/**
 * TR09 — EVA MECHS («Мехи ВКД»), the first Turmoil Redux PROJECT card.
 *
 * Mechanically the Dirigibles twin, one tag over: an ACTION that stores a
 * MECH on this card for 1 energy, and an EFFECT that lets the stored mechs pay
 * for a Space-tag card at 5 M€ each. The effect is NOT a trigger — it is a
 * PAYMENT UNIT (`mechs` in `common/inputs/Spendable.ts`), so this card has no
 * `onCardPlayed` hook and no forecast twin; the payment layer is what carries
 * it (`Player.paymentOptionsForCard` → `pay()` → the «spent as payment» record).
 *
 * SCAN READING — the atom sits in the orange MIN box beside the cost: that is
 * the REQUIREMENT («Requires 1 Science tag»), not a tag. The card's only tag is
 * the one in the corner — Space.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/EvaMechs.spec.ts):
 *  1. Mechs pay ONLY for a card play with a Space tag — never a standard
 *     project, never a deferred bill, never through Last Resort Ingenuity
 *     (its text names steel and titanium).
 *  2. The value is a FLAT 5: titanium modifiers and Metal Research do not
 *     reach it (`rateFor` falls through to `DEFAULT_PAYMENT_VALUES`).
 *  3. Overpay is the upstream semantic (`payingAmount >= cost`, no change):
 *     two mechs on a 6 M€ card are legal, and both leave.
 *  4. `Mech` is a FULL card resource — any future card may hold or add mechs
 *     (`addResourcesToAnyCard`, `getResourceCards(MECH)` are generic); money
 *     is only the mechs ON THIS card (`CARD_FOR_SPENDABLE_RESOURCE.mechs`).
 *  5. A mech does not «count as on the player board»: no unit-cost gate, no
 *     award, no attack knows it. Attacks on card resources are the ordinary
 *     `RemoveResourcesFromCard` path, no exception.
 *  6. The action's unavailability reason is the automatic one for
 *     `spend.energy` («Not enough energy») — no bespoke `canAct`/`canPlay`.
 */
export class EvaMechs extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.EVA_MECHS,
      type: CardType.ACTIVE,
      tags: [Tag.SPACE],
      cost: 6,
      resourceType: CardResource.MECH,
      requirements: {tag: Tag.SCIENCE},

      action: {
        spend: {energy: 1},
        addResources: 1,
      },

      metadata: {
        cardNumber: 'TR09',
        infoText: [{kind: 'effect-short', text: 'Space tag: mechs here pay 5 M€ each'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 1 energy to add a mech resource to this card.', (eb) => {
            eb.energy(1).startAction.resource(CardResource.MECH);
          }).br;
          // `.equals().megacredits(5)` is LOAD-BEARING: `effectExtraction.ts`
          // reads `valueAsPayment = equals ∧ cardResource ∧ megacredits` — without
          // it the effect classifies as «or gain M€» and the effects overlay lies.
          b.effect('When playing a Space tag, mechs here may be used as payment, and are worth 5 M€ each.', (eb) => {
            eb.tag(Tag.SPACE).startEffect.resource(CardResource.MECH).equals().megacredits(5);
          });
        }),
      },
    });
  }
}
