import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {CardRenderer} from '../render/CardRenderer';

/** The printed four microbe squares with the asterisk — onto ANY of the player's own microbe holders. */
export const MICROBES_ADDED = 4;

/**
 * TR67 — ENCELADEAN INCUBATOR («Инкубатор Энцелада»), a Turmoil Redux
 * PROJECT card: an ocean and four microbes onto any card, as ONE DECLARATION.
 *
 * SCAN READING — cost 23, a GREEN card (AUTOMATED). Two tags in the corner, in
 * the printed order: JOVIAN (the banded planet), SPACE (the star). The orange
 * MIN plate beside the cost is EMPTY — no requirement. One printed row: the
 * blue ocean hexagon, then FOUR microbe squares and the asterisk (onto ANY
 * card) — four icons, never «4 [microbe]» (the face prints no digit). The VP
 * badge: «2» on the Mars disc — a fixed 2 VP. The quote «That's
 * "En-ce-ladus", not "En-chi-ladus"!» is the lore. Art credit Dorje
 * Bellbrook. Only the module's icon at the bottom left: no `compatibility`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/EnceladeanIncubator.spec.ts):
 *  1. NO REQUIREMENT — playable under any ruling party.
 *  2. THE PLAY IS ONE DECLARATION — `ocean` + `addResourcesToAnyCard`, 2 VP;
 *     no `bespokePlay`, no hook: the preview, the reasons, the forecast and
 *     the card information come from the declaration.
 *  3. 4 MICROBES ONTO ANY CARD — any of the player's OWN microbe holders (the
 *     tableau; never a rival's — TR43's rule 3), MANDATORY, the target
 *     pre-selected in the composer and never chosen for the player (one holder
 *     is still a question — invariant 3); no holder → a skip BY NAME
 *     (`skippedAddToCard`), the card still playable. Asked BEFORE the ocean
 *     (`Priority.PLAY_CARD_RESOURCE_CHOICE` < `PLACE_OCEAN_TILE` — the
 *     Imported Hydrogen precedent), landing where it was addressed (law 27).
 *  4. THE OCEAN — an ordinary placement: the cell, its printed bonus, +2 M€
 *     per adjacent ocean, +1 TR; the table's answers to an ocean (Arctic Algae
 *     …) are their own hooks (the server's forecast). Nine oceans → no
 *     placement and no TR, the `maxoceans` warning NAMED before the press
 *     (`Executor`); the card still plays.
 *  5. THE JOVIAN TAG counts for the Jovian VP cards (Io Mining Industries,
 *     Ganymede Colony, Water Import From Europa …); THE SPACE TAG lets titanium
 *     pay and EVA Mechs' mechs pay (the `mechs` unit). Not an event: Optimal
 *     Aerobraking does not answer. Every other answer is its card's hook.
 *  6. The table's answer to the microbes (Topsoil Contract …) is the server's
 *     forecast — no number of this file.
 *  7. 2 VP — fixed; the VP cell (TR55) reads `victoryPoints: 2`.
 *  8. PREVIEW = EXECUTION: the declaration feeds the play's preview (the
 *     microbes' «КУДА» step with its address, then the staged ocean).
 *  9. NEVER FUTILE: at nine oceans and with no holder the play still scores
 *     its 2 VP — both losses are named skips, never «an action with no effect».
 * 10. MarsBot never plays the card; save / load is an ordinary card's.
 */
export class EnceladeanIncubator extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.ENCELADEAN_INCUBATOR,
      type: CardType.AUTOMATED,
      tags: [Tag.JOVIAN, Tag.SPACE],
      cost: 23,
      victoryPoints: 2,

      // Rules 2–4 — ONE declaration: the engine asks the microbes' target ahead of the placement
      // (`PLAY_CARD_RESOURCE_CHOICE`), then defers the ocean (the staged cell).
      behavior: {
        ocean: {},
        addResourcesToAnyCard: {type: CardResource.MICROBE, count: MICROBES_ADDED},
      },

      metadata: {
        cardNumber: 'TR67',
        renderData: CardRenderer.builder((b) => {
          // The scan's one row: the ocean, then four microbe squares (no digit) and the asterisk.
          b.oceans(1).nbsp.resource(CardResource.MICROBE, MICROBES_ADDED).asterix();
        }),
        description: 'Place an ocean tile. Add 4 microbes to ANY card.',
      },
    });
  }
}
