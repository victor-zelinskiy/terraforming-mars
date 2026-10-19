import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';

/** The printed «3 [mech]*» — the first branch of the choice. */
export const MECHS_TO_ANY_CARD = 3;
/** The printed «3 [fighter]*» — the second branch. */
export const FIGHTERS_TO_ANY_CARD = 3;
/** The printed «6 [floater]*» — the third branch. */
export const FLOATERS_TO_ANY_CARD = 6;
/** The three branches' titles — the i18n keys the composer's variant row, the OrOptions and a skip's record all print. */
export const MECHS_BRANCH = 'Add 3 mechs to ANY card';
export const FIGHTERS_BRANCH = 'Add 3 fighters to ANY card';
export const FLOATERS_BRANCH = 'Add 6 floaters to ANY card';

/**
 * TR56 — ROBOTICS FACTORY («Фабрика роботов»), a Turmoil Redux PROJECT card:
 * the Industrialists' fourth plate (TR54, TR55 before it) and the set's first
 * play with an `or` of THREE «add to ANY card» branches — three resources,
 * three holder sets, so a change of variant changes the whole set of targets
 * (the «КУДА ЛЯЖЕТ» iteration, docs/claude/prompts/project-tr56-robotics-
 * factory.md, rides it).
 *
 * «Requires the Industrialists to be ruling or that you have 2 delegates
 * there. Add 3 mech resources to ANY card, OR 3 fighter resources to ANY
 * card, OR 6 floater resources to ANY card.» Cost 7, green, Building, no VP.
 * The whole card is ONE DECLARATION of a class that already stands: TR43's
 * optional `or` of holder-gated «add to ANY card» branches (`mustHaveCard` +
 * `autoSelect` + `optional`), here with three. Nothing of the card lives in
 * this file — no hook, no reason, no forecast of its own.
 *
 * SCAN READING — cost 7, green (AUTOMATED); ONE tag in the corner: BUILDING
 * (the brown disc with the house). The orange MIN box beside the cost holds
 * the INDUSTRIALISTS' emblem (the cog round the globe) — a REQUIREMENT
 * (`{party: INDUSTRIALISTS}`), never a tag. ONE row: «3 [mech]* OR 3
 * [fighter]* OR 6 [floater]*», each asterisk the printed «to ANY card». No VP
 * badge. Only the module's icon at the bottom left (no ▲, no Venus icon): no
 * `compatibility`. Printed lore: «Funnily enough, the line wasn't drawn at
 * robot labor. No, it was sex robots that was a step too far.»
 * (`lore_texts.json` «TR56»). «Khang Le — Hawken» is the art's credit, not
 * the face's.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/RoboticsFactory.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate — they rule, or 2 of the
 *     player's OWN delegates on their resolution — checked at the PLAY only;
 *     TR36 Council Seat lowers an EFFECT's threshold, never a REQUIREMENT's.
 *  2. The CHOICE is TR43's form — `mustHaveCard` on every branch,
 *     `autoSelect`, in the printed order (mechs · fighters · floaters): a
 *     branch with no holder is not offered (shown greyed with its reason,
 *     never hidden); a single available branch is resolved WITHOUT an
 *     OrOptions (the preview gives it index −1, the batch sends the bare
 *     target answer).
 *  3. «To ANY card» = any of the player's OWN cards that can hold that
 *     resource (`AddResourcesToCard.getCards`: the own tableau — Self-
 *     replicating Robots' hosts only for a declaration with `robotCards`,
 *     which this card has not; an opponent's card never). The target is
 *     NEVER applied automatically, a single holder included (the fork's
 *     invariant 3).
 *  4. NO HOLDER OF ANY KIND → THE CARD STAYS PLAYABLE (`optional`, the
 *     owner's decision 4 by default): its Building tag still counts, the
 *     Executor records ONE named skip per branch («Add 3 mechs to ANY card —
 *     No eligible card», …), the preview's general branch carries the same
 *     three warnings, the variants stand greyed.
 *  5. The LIVE ORDER: the `or` deferred at `DEFAULT` (an OrOptions with
 *     `choiceContext 'effect-choice'`); the chosen branch's
 *     `AddResourcesToCard` at `GAIN_RESOURCE_OR_PRODUCTION`. The batch:
 *     `[play, {or, index, {option}}, {card}]`; collapsed, `[play, {card}]`.
 *     BOTH land whole through `replayBatch`.
 *  6. The BUILDING tag: TR17 Construction Mechs (mechs pay 5 M€ on a
 *     Building / City tag) PAYS for this card with mechs, and the card may
 *     put 3 mechs back on that same card — the price is taken BEFORE the
 *     effect (the capsule 2 → 0 → 3, never 2 → 3). Mining Guild and every
 *     other answer to a Building tag go by their own hooks.
 *  7. A holder with a ROLE reads the server's numbers (`holderGainOutcome`):
 *     a tender, a delegate threshold, VP (Security Fleet), an action.
 *  8. THE JOURNAL: «added 3 mechs to Construction Mechs»; with no holder, the
 *     skip line per branch. The rival sees the play, the variant and the
 *     target.
 *  9. MarsBot never plays it and holds no card; save / load adds nothing (the
 *     card resources are ordinary fields; a standing `or` / target pick is the
 *     live `waitingFor`).
 * 10. The preview mutates nothing.
 */
export class RoboticsFactory extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.ROBOTICS_FACTORY,
      type: CardType.AUTOMATED,
      tags: [Tag.BUILDING],
      cost: 7,
      requirements: {party: PartyName.INDUSTRIALISTS},

      behavior: {
        or: {
          optional: true,
          autoSelect: true,
          behaviors: [
            {title: MECHS_BRANCH, addResourcesToAnyCard: {type: CardResource.MECH, count: MECHS_TO_ANY_CARD, mustHaveCard: true}},
            {title: FIGHTERS_BRANCH, addResourcesToAnyCard: {type: CardResource.FIGHTER, count: FIGHTERS_TO_ANY_CARD, mustHaveCard: true}},
            {title: FLOATERS_BRANCH, addResourcesToAnyCard: {type: CardResource.FLOATER, count: FLOATERS_TO_ANY_CARD, mustHaveCard: true}},
          ],
        },
      },

      metadata: {
        cardNumber: 'TR56',
        // ONE block for the choice — the `or` is a declarative shape the generator does not prose on its own.
        infoText: [
          {text: 'Add 3 mechs, 3 fighters or 6 floaters to ANY card.', tokens: ['res-mech', 'res-fighter', 'res-floater']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The scan's one row — «3 [mech]* OR 3 [fighter]* OR 6 [floater]*» (TR43's digit form, the asterisk «to ANY card»).
          b.resource(CardResource.MECH, {amount: MECHS_TO_ANY_CARD, digit}).asterix()
            .or().resource(CardResource.FIGHTER, {amount: FIGHTERS_TO_ANY_CARD, digit}).asterix()
            .or().resource(CardResource.FLOATER, {amount: FLOATERS_TO_ANY_CARD, digit}).asterix();
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there. Add 3 mech resources to ANY card, OR 3 fighter resources to ANY card, OR 6 floater resources to ANY card.',
      },
    });
  }
}
