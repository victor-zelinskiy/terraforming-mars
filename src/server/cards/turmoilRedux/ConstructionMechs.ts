import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/**
 * TR17 — CONSTRUCTION MECHS («Строительные мехи»), the fourteenth Turmoil Redux
 * PROJECT card — TR09 EVA Mechs' twin with other payment tags: the same ACTION
 * (1 energy → a mech on this card), and the stored mechs pay for a card with a
 * BUILDING or a CITY tag (EVA's pay for Space) at a flat 5 M€ each.
 *
 * The effect is a PAYMENT UNIT, not a trigger — `constructionMechs` in
 * `common/inputs/Spendable.ts`, the SECOND pool of one card resource: a unit
 * names exactly one card, so `Player.pay()` always knows which card a mech
 * leaves (docs/TURMOIL_REDUX_EVA_MECHS.md §6 — why a second unit, not a
 * generalised `mechs`). No `onCardPlayed`, no forecast twin.
 *
 * SCAN READING — cost 7; the brown circle in the corner is the only tag
 * (Building). The orange MIN plate beside the cost holds the MARS FIRST emblem:
 * the REQUIREMENT («Requires Mars First to be ruling or that you have 2
 * delegates there»), never a tag. No VP badge. Row 1 — the action, energy →
 * mech; row 2 — the effect, «[building], [city] : [mech] = [5]» (the DSL has
 * no comma node: the two tags are split by a slash). The purple Turmoil
 * symbol at the bottom left is the module itself (no `compatibility`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ConstructionMechs.spec.ts;
 * rules 1–4 mirror TR09's table):
 *  1. The mechs here pay ONLY for a card play with a Building OR a City tag —
 *     never a standard project (the City project has no tag), never a deferred
 *     bill (`SelectPaymentDeferred` → `false`), never through Last Resort
 *     Ingenuity (its text names steel and titanium).
 *  2. The value is a FLAT 5: steel modifiers (Advanced Alloys …) and the
 *     Metal Research law never reach it.
 *  3. Overpay is the upstream semantic — no change.
 *  4. Money is only the mechs ON THIS card. EVA Mechs' are their own unit
 *     (Space only); Mech Sports' (TR11) are no money at all. A card with a
 *     Space AND a Building tag opens BOTH units, each paid off its own card.
 *  5. A mech is a full card resource: Vesta and «a mech on ANY card» may put
 *     mechs here, and they become money for Building / City.
 *  6. The action's unavailability reason is the automatic «Not enough energy»
 *     from `spend.energy` — no bespoke `canAct`.
 *  7. The party requirement is the DSL `{party: MARS}`, checked at the play
 *     (the TR15 class: the emblem plate, the named reason with its «now»).
 *  8. Steel and mechs on one Building card are two independent lanes; neither
 *     eats the other (`steel` and `constructionMechs` are separate keys).
 */
export class ConstructionMechs extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.CONSTRUCTION_MECHS,
      type: CardType.ACTIVE,
      tags: [Tag.BUILDING],
      cost: 7,
      resourceType: CardResource.MECH,
      requirements: {party: PartyName.MARS},

      action: {
        spend: {energy: 1},
        addResources: 1,
      },

      metadata: {
        cardNumber: 'TR17',
        infoText: [{kind: 'effect-short', text: 'Building or City tag: mechs here pay 5 M€ each'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 1 energy to add a mech resource to this card.', (eb) => {
            eb.energy(1).startAction.resource(CardResource.MECH);
          }).br;
          // `.equals().megacredits(5)` is LOAD-BEARING (effectExtraction: valueAsPayment) — see EvaMechs.ts.
          b.effect('When playing a Building or City tag, mechs here may be used as payment, and are worth 5 M€ each.', (eb) => {
            eb.tag(Tag.BUILDING).slash().tag(Tag.CITY).startEffect.resource(CardResource.MECH).equals().megacredits(5);
          });
        }),
      },
    });
  }
}
