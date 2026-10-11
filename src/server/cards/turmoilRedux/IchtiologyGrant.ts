import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';

/** The printed «2 [animal]*» — the first branch of the choice. */
export const ANIMALS_TO_ANY_CARD = 2;
/** The printed «4 [microbe]*» — the second branch. */
export const MICROBES_TO_ANY_CARD = 4;
/** The two branches' titles — the i18n keys the composer's variant row, the OrOptions and a skip's record all print. */
export const ANIMALS_BRANCH = 'Add 2 animals to ANY card';
export const MICROBES_BRANCH = 'Add 4 microbes to ANY card';

/**
 * TR43 — ICHTIOLOGY GRANT («Ихтиологический грант»), a Turmoil Redux PROJECT
 * card: the Greens' sixth plate (TR38–TR42 before it) and the set's FIRST
 * play with an `or` whose branch holds a CARD TARGET — two pre-selects in
 * one batch (the variant, then the holder), the route the pre-select
 * iteration of 2026-10-11 rides first (docs/claude/prompts/project-tr43-
 * ichtiology-grant.md § 6.II).
 *
 * «Requires the Greens to be ruling or that you have 2 delegates there.
 * Increase your M€ production 1 step for each ocean in play. Add 2 animals
 * or 4 microbes to ANY card.» Cost 10, green, Microbe + Animal, no VP. The
 * whole card is ONE DECLARATION of classes that already stand: a COUNTED
 * production (`{megacredits: {oceans: {}}}` — Hydrogen Processing Plant's
 * form, the board's own count), and an `or` of two «add to ANY card»
 * branches (Vermin's form: `mustHaveCard` + `autoSelect`) that is OPTIONAL
 * (`OrBehavior.optional` — the knob this card introduces to the shared
 * layer): with no holder of either kind the production still stands and the
 * choice is skipped by name. Nothing of the card lives in this file — no
 * hook, no reason, no forecast of its own.
 *
 * SCAN READING — cost 10, green (AUTOMATED); two tags in the corner: the
 * MICROBE (light green) and the ANIMAL (dark green, the paw). The orange MIN
 * box beside the cost holds the GREENS' emblem (the tree) — a REQUIREMENT
 * (`{party: GREENS}`), never a tag. The upper row prints «[M€ production 1]
 * / [ocean]» — one step per ocean; the lower row «2 [animal]* OR 4
 * [microbe]*», the asterisk the printed «to ANY card». No VP badge. Only the
 * module's icon at the bottom left (no ▲, no Venus icon): no
 * `compatibility`. Printed lore: «♪ Ocean Man, take me by the hand, take me
 * to the land that you understand ♪» (`lore_texts.json` «TR43» — the notes
 * are the scan's; the spelling «Ichtiology» is the card's). «Getty Images»
 * is the scan's caption, not the face's.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/IchtiologyGrant.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate — the Greens rule (the STARTING
 *     RULE counts: generation 1 with nothing enacted) or 2 of the player's
 *     OWN delegates on their resolution — checked at the PLAY only; TR36
 *     Council Seat lowers an EFFECT's threshold, never a REQUIREMENT's.
 *  2. The PRODUCTION is the number of OCEANS ON THE BOARD at the play — all
 *     of them, whoever placed them, the upgraded ones (Ares' ocean city /
 *     farm / sanctuary) and Wetlands included: `Countable.oceans` is the
 *     board's `getOceanSpaces({upgradedOceans: true, wetlands: true})`
 *     (`Counter`), never an arithmetic of this card's. 0 oceans → +0 and the
 *     zero is NAMED by the chip's basis («0 → 0 · Oceans: 0» — the TR33
 *     class: a variable never leaves the screen); 9 → +9. Counted ONCE, at
 *     the play; an ocean placed later adds nothing.
 *  3. «To ANY card» = any of the player's OWN cards that can hold the
 *     resource (`AddResourcesToCard.getCards`: the own tableau + Self-
 *     replicating Robots' hosts; an opponent's card never). The target is
 *     NEVER applied automatically, a single holder included (the fork's
 *     invariant 3): the target step is shown, the player reads `current →
 *     resulting` on the holder.
 *  4. The CHOICE is Vermin's form — `mustHaveCard` on both branches,
 *     `autoSelect`: a branch with no holder is not offered (shown greyed with
 *     its reason, never hidden); a single available branch is resolved
 *     WITHOUT an OrOptions (the preview gives it index −1, the batch sends
 *     the bare target answer). NO HOLDER OF EITHER KIND → THE CARD STAYS
 *     PLAYABLE (`optional`): the production stands on its own, the game rule
 *     being «a card may be played even when part of its effect cannot
 *     apply»; the Executor records ONE named skip per branch («Add 2 animals
 *     to ANY card — No eligible card», its chip), the preview's general
 *     branch carries the same two warnings, the variants stand greyed.
 *  5. The LIVE ORDER: the production at once in `execute`; the `or` deferred
 *     at `DEFAULT` (`Executor` — an OrOptions with `choiceContext
 *     'effect-choice'`); the chosen branch's `AddResourcesToCard` at
 *     `GAIN_RESOURCE_OR_PRODUCTION`. The batch: `[play, {or, index,
 *     {option}}, {card}]`; collapsed, `[play, {card}]`. BOTH land whole
 *     through `replayBatch` — the first card pin of the pre-select iteration.
 *  6. Two tags wake the neighbours BY TAG: TR38 Biological Simulations takes
 *     +2 data in ONE answer (its rule 3 — a card with a microbe AND an animal
 *     tag pays 2), Decomposers +2 microbes (its rule: one per animal / plant /
 *     microbe tag), Ecological Zone +1 animal (the animal tag). The forecast
 *     names them BEFORE the press (`cardPlayedForecast`); the table's answer
 *     FLIES (PL-124), here with a «2» on one token for the first time.
 *  7. THE JOURNAL: the production line with its number; the resource line
 *     («added 2 animals to Pets»); with no holder, the skip line per branch.
 *     The rival's notification carries the chips in event order.
 *  8. MarsBot never plays it (the bot's deck is tags) and holds no card; «any
 *     card» against the bot is still the player's own table.
 *  9. Save / load adds nothing (production and card resources are ordinary
 *     fields).
 */
export class IchtiologyGrant extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.ICHTIOLOGY_GRANT,
      type: CardType.AUTOMATED,
      tags: [Tag.MICROBE, Tag.ANIMAL],
      cost: 10,
      requirements: {party: PartyName.GREENS},

      behavior: {
        production: {megacredits: {oceans: {}}},
        or: {
          optional: true,
          autoSelect: true,
          behaviors: [
            {title: ANIMALS_BRANCH, addResourcesToAnyCard: {type: CardResource.ANIMAL, count: ANIMALS_TO_ANY_CARD, mustHaveCard: true}},
            {title: MICROBES_BRANCH, addResourcesToAnyCard: {type: CardResource.MICROBE, count: MICROBES_TO_ANY_CARD, mustHaveCard: true}},
          ],
        },
      },

      metadata: {
        cardNumber: 'TR43',
        // ONE block per bonus, in execution order (the production, then the choice) — the `or` is a declarative
        // shape the generator does not prose on its own (`behavior.or (choice) — needs curation`).
        infoText: [
          {text: 'Increase your M€ production 1 step for each ocean in play.', tokens: ['production(megacredits', 'production(', 'oceans']},
          {text: 'Add 2 animals or 4 microbes to ANY card.', tokens: ['res-animal', 'res-microbe']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The scan's upper row — «[M€ production 1] / [ocean]».
          b.production((pb) => pb.megacredits(1)).slash().oceans(1).br;
          // The lower row — «2 [animal]* OR 4 [microbe]*» (Imported Nitrogen's digit form, the asterisk «to ANY card»).
          b.resource(CardResource.ANIMAL, {amount: ANIMALS_TO_ANY_CARD, digit}).asterix().or().resource(CardResource.MICROBE, {amount: MICROBES_TO_ANY_CARD, digit}).asterix();
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Increase your M€ production 1 step for each ocean in play. Add 2 animals or 4 microbes to ANY card.',
      },
    });
  }
}
