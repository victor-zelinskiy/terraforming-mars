import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';

/**
 * TR49 — CUTTING-EDGE DESIGN («Новаторская разработка»), a Turmoil Redux
 * PROJECT card: the Scientists' plate over the set's ONE-PLAY card — it does
 * nothing at once and ARMS the next card the player plays this generation,
 * which then ignores every global-parameter requirement. The set's first card
 * of the ONE-PLAY class with a WAIVER (Special Design's ±2 is its elder
 * sister; Ecology Experts' waiver is the same kind inside a prelude) — the
 * whole card is a DECLARATION, and the class infrastructure
 * (`docs/TURMOIL_REDUX_CUTTING_EDGE_DESIGN.md`) is what reads it.
 *
 * SCAN READING — cost 2, a RED card (EVENT); three discs in the corner, in
 * printed order: SCIENCE (the atom), MICROBE (the green disc), EVENT (the
 * yellow disc with the arrow down — the card type, not a `Tag`). The orange
 * MIN plate beside the cost holds the SCIENTISTS' emblem (the flask): a
 * REQUIREMENT (`{party: SCIENTISTS}`), never a tag. One row: the dark card
 * with a planet, two bullets and «GLOBAL REQS.» STRUCK THROUGH by a red
 * diagonal, an asterisk — upstream's printed «ignore global requirements»
 * glyph (`projectRequirements()`, Ecology Experts' and Valuable Gases' row)
 * with the asterisk the scan prints. The red diagonal is the CLASS's
 * language for «waived»: the requirement cassette of the next card inherits
 * it. No VP badge. No quote — the lower block is the rule — so the lore is
 * INVENTED (`docs/claude/turmoil-redux-invented-lore.md`: «Engineered for a
 * planet that doesn't exist yet.»). Only the module's icon at the bottom
 * left: no `compatibility`. The art's caption «marinebiodiversity.ca» is the
 * art's, not the face's.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/CuttingEdgeDesign.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate — they rule, or 2 of the
 *     player's OWN delegates stand on their resolution — checked at the PLAY
 *     only; TR36 Council Seat lowers an EFFECT's threshold, never a requirement.
 *  2. The play gives nothing at once — it ARMS: `lastCardPlayed` names this
 *     card, and the NEXT card this player plays this generation is played
 *     with its global requirements WAIVED. The card itself is an ordinary
 *     event: into the events pile, Media Group +3 M€, its Science tag leaves
 *     the count with it.
 *  3. «All global parameter requirements» = every `GlobalParameterRequirement`
 *     — temperature, oxygen, oceans, Venus (and the Moon rates, structurally),
 *     MIN and MAX alike. NOT waived: tags, production, TR, cities / colonies /
 *     resources, a party, the chairman. A waived requirement is MET (never a
 *     bound «stretched by 50»): Think Tank / Aeron Genomics bridge nothing,
 *     `unattainable` is never set, `additionalProjectCosts` stays empty.
 *  4. SPENT by the next CARD played by any road (from hand, a prelude's «play a
 *     card», a variant) whether or not it needs it — upstream's
 *     `lastCardPlayed` semantics: a Special Design played after this card
 *     spends the waiver (and arms its own ±2). A standard project, a card
 *     action or a conversion is no card play and spends nothing. Not spent by
 *     the pass → LOST (`pass()`); it never crosses into the next generation.
 *  5. ONE armed card at a time — `lastCardPlayed` is one field: a new play
 *     REPLACES what was armed (this card after Special Design: the ±2 is
 *     spent on THIS card, the waiver armed).
 *  6. PREVIEW = EXECUTION: the play is the batch `[play]` with no follow-up;
 *     the composer names what it arms (the class's preview chip).
 *  7. A RIVAL sees an ordinary play; the armed waiver stands in the seat's
 *     public «ЭФФЕКТЫ» (`PublicPlayerModel.armedPlayEffects`); the next play it
 *     lets through writes `requirement-eased` with this card as its source.
 *  8. MarsBot never plays the card (no hand).
 *  9. SAVE / LOAD: `lastCardPlayed` is serialized — the waiver survives a
 *     reload, the model re-derives the strip and the cassettes.
 * 10. The JOURNAL: «played» (the engine) + under the NEXT play, when a
 *     requirement was met only thanks to the waiver, «… ignored the global
 *     requirements of … thanks to Cutting-Edge Design».
 * 11. Inside a prelude's «play a card» the same rules apply (Ecology Experts is
 *     the waiver's elder: one kind, one reading).
 * 12. The classic Scientists policy (sp02) never applies under the Redux
 *     politics (no classic Turmoil) — the class names no party here.
 * 13. TAGS: Science → Olympus Conference / Mars University / Pharmacy Union ask
 *     before the press (TR51); Microbe → Decomposers (+1 microbe), Splice;
 *     the EVENT → Media Group.
 * 14. Playwrights (community, out of scope): a replayed copy arms through
 *     `removedFromPlayCards` like the discounts do — the class reads both places.
 */
export class CuttingEdgeDesign extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.CUTTING_EDGE_DESIGN,
      type: CardType.EVENT,
      tags: [Tag.SCIENCE, Tag.MICROBE],
      cost: 2,
      requirements: {party: PartyName.SCIENTISTS},
      // Rules 2–5: the WHOLE card — a one-play waiver of the next card's global requirements.
      globalParameterRequirementBonus: {waive: true, nextCardOnly: true},

      metadata: {
        cardNumber: 'TR49',
        renderData: CardRenderer.builder((b) => {
          b.projectRequirements().asterix();
        }),
        infoText: [
          {text: 'Ignore all global parameter requirements when playing your next card this generation.', tokens: ['ignore_global_requirements']},
        ],
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Ignore all global parameter requirements when playing your next card this generation.',
      },
    });
  }
}
