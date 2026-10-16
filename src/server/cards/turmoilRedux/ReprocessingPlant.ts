import {IActionCard} from '../ICard';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {digit} from '../Options';

/** The first printed price — «3 [plant]». */
export const PLANTS_PRICE = 3;
/** The second printed price — «5 [heat]». */
export const HEAT_PRICE = 5;
/** The ONE printed result both prices buy — «3 [floater]*», the asterisk «to ANY card». */
export const FLOATERS_TO_ANY_CARD = 3;
/** The two variants' prompt titles (the `OrOptions` options when both are live). */
export const REPROCESSING_PLANT_PLANTS_TITLE = 'Spend 3 plants to add 3 floaters to ANY card';
export const REPROCESSING_PLANT_HEAT_TITLE = 'Spend 5 heat to add 3 floaters to ANY card';

/**
 * TR58 — REPROCESSING PLANT («Перерабатывающий завод»), a Turmoil Redux
 * PROJECT card: the Industrialists' sixth plate (TR54–TR57 before it) and the
 * set's first `or` whose seam stands on the PRICE side — two prices, ONE
 * result (the mirror of TR57, one price and two goods; Electro Catapult is
 * the base game's precedent, «1 plant OR 1 steel → 7 M€»). Holding no
 * resource of its own, the card is a converter: plants or heat in, three
 * floaters out onto ANY of the player's floater holders. The whole action is
 * ONE DECLARATION — `action: {or: {behaviors: [plants, heat], autoSelect:
 * true}}`, each branch `spend` + `addResourcesToAnyCard` (Breeding Farms'
 * shape) — so nothing of the action lives in this file: no `canAct`, no
 * `action()`, no reason, no forecast of its own.
 *
 * «Requires the Industrialists to be ruling or that you have 2 delegates
 * there. Action: Pay 3 plants or 5 heat to add 3 floater resources to ANY
 * card.» Cost 8, blue, Building, no VP.
 *
 * SCAN READING — cost 8, blue (ACTIVE); ONE tag in the corner: the house on
 * brown (Building). The orange MIN box beside the cost holds the
 * INDUSTRIALISTS' emblem (the cog round the globe) — a REQUIREMENT (`{party:
 * INDUSTRIALISTS}`), never a tag. ONE action row: «3 [plant] OR 5 [heat] → 3
 * [floater]*» — the «OR» between the two PRICES, the result printed ONCE
 * after the arrow, its asterisk the printed «to ANY card»; the text:
 * «(Action: Pay 3 plants or 5 heat to add 3 floater resources to ANY card.)».
 * No play block: the bottom holds only «(Requires the Industrialists to be
 * ruling or that you have 2 delegates there.)». No VP badge. Only the
 * module's icon at the bottom left (no ▲, no Venus icon): no `compatibility`.
 * Printed lore: «Whatever floats your boat.» (`lore_texts.json` «TR58»; the
 * art: Adam Taylor).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ReprocessingPlant.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate — they rule, or 2 of the
 *     player's OWN delegates on their resolution — checked at the PLAY only
 *     (the TR15 class); the action works whoever rules later. TR36 Council
 *     Seat lowers the EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PLAY does nothing but stand the card with its Building tag:
 *     Construction Mechs (TR17) PAYS for it with mechs; every other answer to
 *     a Building tag goes by its own hook.
 *  3. ONE action, two variants in the printed order: plants, then heat — each
 *     its price off the player's stock → 3 floaters onto ANY card. Both live
 *     → an `OrOptions` marked `effect-choice` with this card as its giver; one
 *     live → it runs without a pick (`autoSelect`). NOT `optional`: with no
 *     floater holder both variants are refused and the action is unavailable
 *     (an action that took the price and lost the floaters would be a trap).
 *     Once per generation, as any blue card's action.
 *  4. «To ANY card» = any of the player's OWN floater holders
 *     (`AddResourcesToCard.getCards`: the own tableau + Self-replicating
 *     Robots' hosts; an opponent's card never), NEVER applied automatically —
 *     a single holder included (the fork's invariant 3). Stormcraft is a
 *     holder too: its floaters may come back onto it.
 *  5. HEAT UNDER STORMCRAFT is paid by its floaters too (2 heat each —
 *     `Player.availableHeat` for the gate, `Player.spendHeat` → Stormcraft's
 *     own split prompt for the price). The split is a choice the player makes
 *     BEFORE the commit: it is the heat variant's FIRST step in the preview
 *     (asked after the variant pick, before the target — the live order), not
 *     a question after the press.
 *  6. The UNAVAILABLE reason leads with what closes BOTH variants: no floater
 *     holder → «No card to add the resource to» first, then each variant's own
 *     shortfall (too few plants, too little heat) in the printed order.
 *  7. The table's answer to the ACTION (floaters onto a card that answers a
 *     floater, a spend of plants / heat) and to the PLAY (the Building tag) is
 *     what the server forecasts (`EffectForecast`), no number of this file's.
 *  8. Preview = execution: the declaration feeds the action preview (two
 *     branches, one price chip each, the target step with every holder), the
 *     reasons and the forecast; the printed row splits by its «OR» on the
 *     PRICE side into the two variants' prints.
 *  9. The card PRINTS floaters, so Celestic reveals it as a floater card
 *     (`floaterCards`).
 * 10. MarsBot never plays the card; save / load — an ordinary card (the
 *     used-action flag survives); the previews are pure; futility is the
 *     server's verdict (never futile while a holder stands).
 */
export class ReprocessingPlant extends ActionCard implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.REPROCESSING_PLANT,
      type: CardType.ACTIVE,
      tags: [Tag.BUILDING],
      cost: 8,
      requirements: {party: PartyName.INDUSTRIALISTS},

      action: {
        or: {
          behaviors: [
            {
              spend: {plants: PLANTS_PRICE},
              addResourcesToAnyCard: {type: CardResource.FLOATER, count: FLOATERS_TO_ANY_CARD, mustHaveCard: true},
              title: REPROCESSING_PLANT_PLANTS_TITLE,
            },
            {
              spend: {heat: HEAT_PRICE},
              addResourcesToAnyCard: {type: CardResource.FLOATER, count: FLOATERS_TO_ANY_CARD, mustHaveCard: true},
              title: REPROCESSING_PLANT_HEAT_TITLE,
            },
          ],
          autoSelect: true,
        },
      },

      metadata: {
        cardNumber: 'TR58',
        // The full rule is 72 (RU ≈ 90) — over the browser's caption budget (52); the short stands beside its own row.
        infoText: [{kind: 'action-short', text: 'Pay 3 plants or 5 heat for 3 floaters on ANY card', tokens: ['res-floater']}],
        renderData: CardRenderer.builder((b) => {
          // The scan's one action row — «3 [plant] OR 5 [heat] → 3 [floater]*»: the «OR» between the two PRICES, the
          // result ONCE after the arrow (Electro Catapult's two rows are the base game's drawing; the scan prints one).
          b.action('Pay 3 plants or 5 heat to add 3 floater resources to ANY card.', (eb) => {
            eb.plants(PLANTS_PRICE, {digit}).or().heat(HEAT_PRICE, {digit})
              .startAction.resource(CardResource.FLOATER, {amount: FLOATERS_TO_ANY_CARD, digit}).asterix();
          });
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there.',
      },
    });
  }
}
