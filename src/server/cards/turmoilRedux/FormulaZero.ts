import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/**
 * TR08 — FORMULA ZERO («Формула-0»).
 *
 * The Security Fleet twin: an ACTION that stores a FIGHTER on this card, and
 * 1 VP per fighter here — the action is paid in M€ instead of titanium, and the
 * card asks for 2 Science tags. Fully declarative: no hook, no trigger, no
 * forecast twin.
 *
 * SCAN READING — the two atoms sit in the orange MIN box beside the cost: that
 * is the REQUIREMENT («Requires 2 Science tags»), not tags. The card's only tag
 * is the planet in the corner — Mars.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/FormulaZero.spec.ts):
 *  1. The action's 1 M€ is `spend.megacredits`: a flat cost for an ordinary
 *     player; for Helion / Luna Trade Federation the Executor defers a
 *     `SelectPaymentDeferred`, and `actionPreview` pre-collects that step
 *     itself (the generic `spend.megacredits` rule — nothing here).
 *  2. With 0 M€ the action is unavailable with the automatic M€-deficit
 *     reason («Need 1 more M€») — no bespoke `canAct`.
 *  3. VP = the fighters on this card, through the shared `resourcesHere` path.
 *  4. The requirement is DSL-only, so the parliament's science bonuses count.
 *  5. The Mars tag is an ordinary tag: it never counts as science by itself.
 */
export class FormulaZero extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.FORMULA_ZERO,
      type: CardType.ACTIVE,
      tags: [Tag.MARS],
      cost: 5,
      resourceType: CardResource.FIGHTER,
      requirements: {tag: Tag.SCIENCE, count: 2},
      victoryPoints: {resourcesHere: {}},

      action: {
        spend: {megacredits: 1},
        addResources: 1,
      },

      metadata: {
        cardNumber: 'TR08',
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 1 M€ to add a fighter resource to this card.', (eb) => {
            eb.megacredits(1).startAction.resource(CardResource.FIGHTER);
          }).br;
          b.vpText('1 VP for each fighter resource on this card.');
        }),
      },
    });
  }
}
