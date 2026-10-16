import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/** The play's own block — «Add 1 fighter resource to this card». */
export const FIGHTERS_ON_PLAY = 1;
/** Variant A's price — «[titanium] →». */
export const TITANIUM_PER_STEP = 1;
/** Variant A's good — «→ [fighter] [fighter]». */
export const FIGHTERS_PER_PURCHASE = 2;
/** Variant B's price — «[fighter] →», one fighter off this card. */
export const FIGHTERS_PER_PAYOUT = 1;
/** Variant B's stock good — «3 M€». */
export const PAYOUT_MEGACREDITS = 3;
/** Variant B's production good — the brown box with «1». */
export const PAYOUT_PRODUCTION = 1;
/** The two variants' prompt titles (the `OrOptions` options when both are live). */
export const CIVILIAN_SPACEFIGHTERS_BUY_TITLE = 'Pay 1 titanium to add 2 fighter resources to this card';
export const CIVILIAN_SPACEFIGHTERS_PAYOUT_TITLE = 'Spend 1 fighter from here to gain 3 M€ and increase your M€ production 1 step';

/**
 * TR60 — CIVILIAN SPACEFIGHTERS («Гражданские истребители»), a Turmoil Redux
 * PROJECT card: the Industrialists' seventh plate (TR54–TR59 before it) and a
 * fighter holder whose action is TR40 Forestry Mechs' form in fighters — buy
 * the resource («1 titanium → 2 fighters here») OR spend it («1 fighter off
 * here → 3 M€ AND +1 M€ production»). Variant B pays TWO goods for ONE price at
 * once — the set's first «and» after the arrow (TR57 was an «or»). The whole
 * action is ONE DECLARATION of the Local Shading class — `action: {or:
 * {behaviors: [A, B], autoSelect: true}}` — so nothing of the action lives in
 * this file: no `canAct`, no `action()`, no reason of its own.
 *
 * «Requires the Industrialists to be ruling or that you have 2 delegates
 * there. Add 1 fighter resource to this card. Action: Pay 1 titanium to add 2
 * fighter resources to this card, OR spend 1 fighter from here to gain 3 M€
 * and increase your M€ production 1 step.» Cost 6, blue, Space, no VP.
 *
 * SCAN READING — cost 6, blue (ACTIVE); ONE tag in the corner: the yellow star
 * on black (Space). The orange MIN box beside the cost holds the
 * INDUSTRIALISTS' emblem (the cog round the globe) — a REQUIREMENT (`{party:
 * INDUSTRIALISTS}`), never a tag. Two action rows: «[titanium] → [fighter]
 * [fighter]» and «OR [fighter] → [M€ 1 in the brown production box] [3 M€]» —
 * the PRODUCTION printed FIRST, the 3 M€ after it (the text names them the
 * other way round; the face follows the scan, and the executor raises the
 * production before it pays the stock, so the printed order IS the executed
 * one); the text: «(Action: Pay 1 titanium to add 2 fighter resources to this
 * card, OR spend 1 fighter from here to gain 3 M€ and increase your M€
 * production 1 step.)». The bottom block: a fighter icon and «(Requires the
 * Industrialists to be ruling or that you have 2 delegates there. Add 1
 * fighter resource to this card.)». No VP badge. Only the module's icon at the
 * bottom left (no ▲, no Venus icon): no `compatibility`. Printed lore:
 * «Military-grade fighter craft in the hands of the average Joe. What could
 * possibly go wrong?» (`lore_texts.json` «TR60»; the art: BoneTech3D).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/CivilianSpacefighters.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate — they rule, or 2 of the
 *     player's OWN delegates on their resolution — checked at the PLAY only
 *     (the TR15 class); the action works whoever rules later. TR36 Council
 *     Seat lowers the EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PLAY puts 1 fighter on THIS card (`behavior: {addResources: 1}` — a
 *     fixed self-target, the auto-select exemption) and nothing else; the
 *     journal names the fighter.
 *  3. ONE action, two variants in the printed order: A — 1 titanium → +2
 *     fighters here; B — 1 fighter off here → +3 M€ and +1 M€ production. Both
 *     live → an `OrOptions` marked `effect-choice` with this card as its
 *     giver; ONE live → it IS the action, no question asked (`autoSelect` —
 *     the `OrOptions.reduce()` exemption of invariant 3); both dead → the
 *     card-level reasons in the DECLARED order, so the FIRST is the titanium —
 *     the one blocker the player can act on. Once per generation, as any blue
 *     card's action.
 *  4. A is paid in TITANIUM the player owns (`spend.titanium`) — not «M€ with
 *     titanium accepted»: Helion's heat, steel and the mech units never pay
 *     it, and its value (Phobolog, Advanced Alloys) changes nothing.
 *  5. B pays its two goods AT ONCE for the one fighter — «and», never «or»:
 *     +3 M€ to the supply AND +1 step of M€ production; the preview's branch
 *     carries both chips, the journal both lines. The table's answer to the
 *     production step (Manutech and its kin) is what the server forecasts
 *     (`EffectForecast` `byBranch`), no number of this file's.
 *  6. Fighters from OTHER cards: TR56 Robotics Factory's «3 fighters to ANY
 *     card» may put them HERE (this card is a fighter holder in its address
 *     set); TR29 Spaceship Recycling («1 fighter from ANY of your cards») may
 *     take one from here — B loses its fuel; Security Fleet, TR08 Formula Zero
 *     and TR28 Earth Army Contract score / spend their OWN — the fighters here
 *     are nobody's VP, only B's fuel.
 *  7. The Space tag: titanium pays for the PLAY (`canUseTitanium`), EVA Mechs
 *     pay for it with their mechs (the `mechs` unit — never
 *     `constructionMechs`, no Building tag); the other answers to a Space tag
 *     are their own hooks (the forecast names them).
 *  8. The «too few fighters» reason of B is the CLASS's (PL-197): «0 of 1
 *     fighter on this card»; A's is the class «Not enough titanium».
 *  9. Futility: neither variant is ever futile (fighters; money and a
 *     production step).
 * 10. Preview = execution: the declaration feeds the play preview, the action
 *     preview (two branches, each with its price chip), the reasons and the
 *     forecast; the printed rows split by their «OR» into the two variants'
 *     prints. B's full rule is over the browser's caption budget — a curated
 *     `action-short` with its production token stands beside its row.
 * 11. THE HOLDER'S ROLE: B's fighter buys a SET of goods at one price — the
 *     production step WITH the 3 M€ (`HolderActionGood.with`, the owner's
 *     decision 4a of the TR60 prompt) — so the ДОП. РЕСУРСЫ satellite and the
 *     «put N on ANY card» target step name what the fighters here are FOR;
 *     A buys the resource and is ignored by the reading (TR40's rule).
 * 12. MarsBot never plays the card; save / load — an ordinary card (the
 *     fighter count and the used-action flag survive); the previews are pure.
 */
export class CivilianSpacefighters extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.CIVILIAN_SPACEFIGHTERS,
      type: CardType.ACTIVE,
      tags: [Tag.SPACE],
      cost: 6,
      requirements: {party: PartyName.INDUSTRIALISTS},
      resourceType: CardResource.FIGHTER,

      behavior: {
        addResources: FIGHTERS_ON_PLAY,
      },

      action: {
        or: {
          behaviors: [
            {
              spend: {titanium: TITANIUM_PER_STEP},
              addResources: FIGHTERS_PER_PURCHASE,
              title: CIVILIAN_SPACEFIGHTERS_BUY_TITLE,
            },
            {
              spend: {resourcesHere: FIGHTERS_PER_PAYOUT},
              // The printed order — the production box first, then the 3 M€ — which is also the executor's.
              production: {megacredits: PAYOUT_PRODUCTION},
              stock: {megacredits: PAYOUT_MEGACREDITS},
              title: CIVILIAN_SPACEFIGHTERS_PAYOUT_TITLE,
            },
          ],
          autoSelect: true,
        },
      },

      metadata: {
        cardNumber: 'TR60',
        // Both rules are over the browser's caption budget (52 — A 55, B 81; RU ≈ 70 / 105): each row its own caption.
        infoText: [
          {kind: 'action-short', text: 'Pay 1 titanium for 2 fighters here', tokens: ['titanium']},
          {kind: 'action-short', text: 'Spend 1 fighter for 3 M€ and 1 M€ production', tokens: ['production(megacredits)']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The two action rows as the scan prints them — «[titanium] → [fighter] [fighter] / OR / [fighter] →
          // [M€ production 1] [3 M€]» (each row describes itself — the TFLP / DP11 contract); then the play's own
          // block, a fighter, under the art.
          b.action('Pay 1 titanium to add 2 fighter resources to this card.', (eb) => {
            eb.titanium(TITANIUM_PER_STEP).startAction.resource(CardResource.FIGHTER, FIGHTERS_PER_PURCHASE);
          }).br;
          b.or().br;
          b.action('Spend 1 fighter from here to gain 3 M€ and increase your M€ production 1 step.', (eb) => {
            eb.resource(CardResource.FIGHTER, FIGHTERS_PER_PAYOUT).startAction
              .production((pb) => pb.megacredits(PAYOUT_PRODUCTION))
              .megacredits(PAYOUT_MEGACREDITS);
          }).br;
          b.resource(CardResource.FIGHTER, FIGHTERS_ON_PLAY);
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there. Add 1 fighter resource to this card.',
      },
    });
  }
}
