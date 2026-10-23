import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';

/** The printed «− [plant] [plant]» in red «any player» frames — UP TO two plants off one player. */
export const PLANTS_REMOVED = 2;
/** The printed «[heat] [heat]» on the production plate — two STEPS of heat production. */
export const HEAT_PRODUCTION = 2;

/**
 * TR71 — AERIAL LENSES («Воздушные линзы»), the Turmoil Redux REPLACEMENT of
 * the classic Turmoil T01 — the FIRST of the set's seven replacements
 * (`common/cards/turmoilReduxReplacements.ts`, `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`
 * §3.2). Registered as `Aerial Lenses:redux` (the plain name stays the classic
 * card's); the Redux manifest's `cardsToRemove` keeps the classic card out of
 * every Redux deck, so a Redux table deals this one and never the other.
 * Nothing of the play lives here: the requirement is the TR15 class (`{party}`
 * — the reason, the emblem, the hand's counter), the plant removal is the
 * engine's `removeAnyPlants` (`RemoveAnyPlants` — the target composer, MarsBot
 * through `AutomaTargeting`, the protected-plants refusal, the named skip), the
 * production is `behavior.production`.
 *
 * SCAN READING — cost 3, green (AUTOMATED). ONE tag in the corner: Science
 * (the atom). The orange MIN plate beside the cost holds the SCIENTISTS'
 * emblem (the flask): the REQUIREMENT («Requires the Scientists to be ruling or
 * that you have 2 delegates there») — PRINTED, not the general Kelvinists →
 * Greens reading the classic card would get (`normalizeReduxParty`). No VP
 * badge: the classic −1 VP is gone. Two rows: «− [plant] [plant]», both plants
 * in the red «any player» frame; then a brown production plate with TWO heat
 * icons. The scan's number box prints the placeholder «TR00» (all six project
 * replacements do) — the card is TR71, the first project row of the
 * replacement registry. Only the module's symbol at the bottom left (no ▲, no
 * Venus icon): no `compatibility`. Printed lore under the rule: «Burning the
 * ground to release carbon dioxide.» — the classic card's own quote, keyed
 * `T01` in `lore_texts.json` and borrowed through `reimplements` together with
 * the T01 art (credit: DARPA) — NOT an invented entry.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/AerialLensesRedux.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate: they rule, or 2 of the player's
 *     OWN delegates stand on their resolution — checked at the play only; a
 *     party effect GRANTED by a card is not a road (FAQ p.19); TR70 Backroom
 *     Deal waives it. Without either road the hand names the party and both
 *     roads (`partyRequirementStanding`), or that the resolution is not up for
 *     a vote (`partyOffVote`).
 *  2. ON PLAY: +2 heat PRODUCTION (never stock), at once.
 *  3. «Remove UP TO 2 plants from ANY player» — the opponents (and MarsBot,
 *     through `AutomaTargeting`) holding plants are the targets; a target with
 *     1 plant loses 1; with no target on the table the removal is a NAMED skip
 *     (Mining Expedition's rule), never a bare nothing; the attacker may decline
 *     inside the pick. The production happens whichever way the removal goes.
 *  4. THE SCIENCE TAG: other cards' Science-tag requirements count it; the
 *     table answers it like any Science tag.
 *  5. PREVIEW = EXECUTION — declarative: the production chip, the
 *     `removeAnyPlants` step; the preview is pure.
 *  6. MarsBot never plays the card.  7. Save / load: an ordinary card.
 */
export class AerialLensesRedux extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.AERIAL_LENSES_REDUX,
      type: CardType.AUTOMATED,
      tags: [Tag.SCIENCE],
      cost: 3,
      // Rule 1 — the printed Scientists, never the normalized Kelvinists.
      requirements: {party: PartyName.SCIENTISTS},

      // Rules 2–3.
      behavior: {
        production: {heat: HEAT_PRODUCTION},
        removeAnyPlants: PLANTS_REMOVED,
      },

      metadata: {
        cardNumber: 'TR71',
        // The classic T01's art and lore — the same illustration and the same printed quote.
        reimplements: CardName.AERIAL_LENSES,
        renderData: CardRenderer.builder((b) => {
          b.minus().plants(-PLANTS_REMOVED, {all}).br;
          b.production((pb) => pb.heat(HEAT_PRODUCTION));
        }),
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Remove up to 2 plants from any player. Increase your heat production 2 steps.',
      },
    });
  }
}
