import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/** The play's own block — «Add 1 mech resource to this card». */
export const MECHS_ON_PLAY = 1;
/** Variant A — 1 energy buys 1 mech here (the TR09 / TR11 / TR17 / TR34 row, word for word). */
export const ENERGY_PER_MECH = 1;
/** Variant B — 1 mech off here buys one step of plant production. */
export const MECHS_PER_STEP = 1;
/** The two variants' prompt titles (the `OrOptions` options when both are live). */
export const FORESTRY_MECHS_ADD_TITLE = 'Pay 1 energy to add a mech resource to this card';
export const FORESTRY_MECHS_STEP_TITLE = 'Spend 1 mech from here to increase your plant production 1 step';

/**
 * TR40 — FORESTRY MECHS («Лесозаготовительные мехи»), a Turmoil Redux PROJECT
 * card: the set's THIRD plate of the Greens (TR38, TR39) and its SIXTH mech
 * holder — TR34 Mars Army Mechs with another B. Variant A is the mech row of
 * TR09 / TR11 / TR17 / TR34 word for word (1 energy → a mech on this card);
 * variant B is TR38 Biological Simulations' action in mechs (a stored resource
 * off this card → +1 plant production — the step the Greens' own passive
 * answers). The census module (`censusAction.ts`) is NOT this card's: its B is
 * a vote. The whole action is ONE DECLARATION of the Local Shading class —
 * `action: {or: {behaviors: [A, B], autoSelect: true}}` — so nothing of the
 * action lives in this file: no `canAct`, no `action()`, no reason of its own.
 *
 * «Requires the Greens to be ruling or that you have 2 delegates there. Add 1
 * mech resource to this card. Action: Pay 1 energy to add a mech resource to
 * this card, OR spend 1 mech from here to increase your plant production 1
 * step.» Cost 7, blue, Plant + Building, no VP.
 *
 * SCAN READING — cost 7, blue (ACTIVE); two tags in the corner: the leaf on
 * green (Plant) and the building on brown (Building). The orange MIN box
 * beside the cost holds the GREENS' emblem — a REQUIREMENT (`{party:
 * GREENS}`), never a tag. Two action rows: «[energy] → [mech]» and «OR [mech]
 * → [plant production]» (the leaf in the brown production box); the text:
 * «(Action: Pay 1 energy to add a mech resource to this card, OR spend 1 mech
 * from here to increase your plant production 1 step.)». The bottom block: a
 * mech icon and «(Requires the Greens to be ruling or that you have 2
 * delegates there. Add 1 mech resource to this card.)». No VP badge. Only the
 * module's icon at the bottom left (no ▲, no Venus icon): no `compatibility`.
 * Printed lore: «I come. I saw. I conquer.» (`lore_texts.json` «TR40» — the
 * broken tenses are the scan's; the art: Longque Chen).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ForestryMechs.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate — the Greens rule (the STARTING
 *     RULE counts: with nothing enacted the Greens rule in generation 1), or 2
 *     of the player's OWN delegates on their resolution — checked at the PLAY
 *     only (the TR15 class); the action works whoever rules later. TR36
 *     Council Seat lowers the EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PLAY puts 1 mech on THIS card (`behavior: {addResources: 1}` — a
 *     fixed self-target, the auto-select exemption) and nothing else. The
 *     play is paid in M€ and / or Construction Mechs' mechs (the Building
 *     tag opens the `constructionMechs` unit) — never EVA's (no Space tag).
 *  3. ONE action, two variants in the printed order: A — 1 energy → +1 mech
 *     here; B — 1 mech off here → +1 plant production. Both live → an
 *     `OrOptions` marked `effect-choice` with this card as its giver; ONE
 *     live → it IS the action, no question asked (`autoSelect` — the
 *     `OrOptions.reduce()` exemption of invariant 3); both dead → `canAct` is
 *     false and the card-level reasons come in the declared order, so the
 *     FIRST is the energy — the one blocker the player can act on (both dead
 *     means no mech here, and a mech is only ever spent, never bought for
 *     anything but energy).
 *  4. The reasons are the automatic ones of the declaration: A — «Not enough
 *     energy» (`spend.energy`); B — «Not enough resources on this card» with
 *     the count (`spend.resourcesHere`). A refused variant is SHOWN beside
 *     the live one, never hidden.
 *  5. B is an ORDINARY plant-production step: with the Greens' effect at the
 *     moment of the ACTION (ruling, 2 delegates, TR36's one) the Parliament
 *     raises M€ production by the applied delta (`PartyEffects` →
 *     `onProductionChanged`); without it, nothing. The action's forecast
 *     names «+1 M€ production · the Greens» before the press
 *     (`greens-production`).
 *  6. The mechs here are NOT money, NOT VP, NOT delegates, NOT a trade: the
 *     `mechs` / `constructionMechs` units read EVA Mechs / Construction Mechs
 *     only, Mech Sports scores its own, TR34 and TR66 spend their own. A mech
 *     Vesta or TR29's B puts HERE is fuel for B (this card is a legal target
 *     of every generic «mech to any card»).
 *  7. The card's OWN tags wake its neighbours: Plant — Decomposers (+1
 *     microbe), Viral Enhancers, Ecological Zone; Building — Construction
 *     Mechs is a PAYMENT, not a trigger, and TR16 Administration District
 *     does NOT fire (no VP icon).
 *  8. Order of events: A — the energy leaves, then the mech arrives; B — the
 *     mech leaves (the price's own line), the plant-production step, then the
 *     Greens' answer as ITS line. All under the card's source.
 *  9. Once per generation, as any blue card's action.
 * 10. Save / load: the mech count and the used-action flag survive.
 * 11. MarsBot never plays the card; the bot's plant tag touches nothing here.
 * 12. The structured text prints the two action rows of the `or` and the
 *     play's own line, with B's curated short beside the full rule.
 */
export class ForestryMechs extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.FORESTRY_MECHS,
      type: CardType.ACTIVE,
      tags: [Tag.PLANT, Tag.BUILDING],
      cost: 7,
      requirements: {party: PartyName.GREENS},
      resourceType: CardResource.MECH,

      behavior: {
        addResources: MECHS_ON_PLAY,
      },

      action: {
        or: {
          behaviors: [
            {
              spend: {energy: ENERGY_PER_MECH},
              addResources: 1,
              title: FORESTRY_MECHS_ADD_TITLE,
            },
            {
              spend: {resourcesHere: MECHS_PER_STEP},
              production: {plants: 1},
              title: FORESTRY_MECHS_STEP_TITLE,
            },
          ],
          autoSelect: true,
        },
      },

      metadata: {
        cardNumber: 'TR40',
        // B's full rule is 64 (RU ≈ 86) — over the browser's caption budget (52); A (TR09's row) reads short as printed.
        infoText: [{kind: 'action-short', text: 'Spend 1 mech for 1 plant production', tokens: ['production(plants)']}],
        renderData: CardRenderer.builder((b) => {
          // The two action rows as the scan prints them — «[energy] → [mech] / OR / [mech] → [plant production]»
          // (each row describes itself — the TFLP / DP11 contract); then the play's own block, a mech, under the art.
          b.action('Pay 1 energy to add a mech resource to this card.', (eb) => {
            eb.energy(ENERGY_PER_MECH).startAction.resource(CardResource.MECH);
          }).br;
          b.or().br;
          b.action('Spend 1 mech from here to increase your plant production 1 step.', (eb) => {
            eb.resource(CardResource.MECH, MECHS_PER_STEP).startAction.production((pb) => pb.plants(1));
          }).br;
          b.resource(CardResource.MECH, MECHS_ON_PLAY);
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Add 1 mech resource to this card.',
      },
    });
  }
}
