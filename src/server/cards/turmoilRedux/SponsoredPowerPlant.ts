import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';

/** The printed «[energy] [energy] [energy]» on the production plate — three STEPS of energy production. */
export const ENERGY_PRODUCTION = 3;

/**
 * TR59 — SPONSORED POWER PLANT («Спонсируемая электростанция»), a Turmoil
 * Redux PROJECT card: the Industrialists' seventh plate (TR54–TR58 before it)
 * over a whole declaration — Power Plant's play (+1 energy production) at
 * three steps, Fusion Power's size, gated by the party instead of tags.
 * Nothing of it lives here: the requirement is the TR15 class (`{party}` —
 * the reason, the emblem, the hand's counter), the production is the
 * engine's `behavior.production`, and the two tags wake whatever the table
 * already answers a Power or a Building tag with.
 *
 * SCAN READING — cost 8, green (AUTOMATED). TWO tags in the corner, in this
 * order: Power (the purple disc with the lightning), Building (the brown
 * roof). The orange MIN plate beside the cost holds the INDUSTRIALISTS'
 * emblem (the cog round the globe): the REQUIREMENT («Requires the
 * Industrialists to be ruling or that you have 2 delegates there»), never a
 * tag. The field holds ONE row: a brown production plate with THREE energy
 * icons (`b.production((pb) => pb.energy(3))` — three icons, Fusion Power's
 * print, never «3 [energy]»). No VP badge, no card resource. Only the
 * module's symbol at the bottom left (the purple diamond with the arrow; no
 * ▲, no Venus icon): no `compatibility`. Printed lore under the rule: «The
 * power companies saw in Mars a new opportunity to be deregulated, and they
 * jumped on it.» (`lore_texts.json` «TR59», word for word — NOT an invented
 * entry). Art credit: Martin Sawkins.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/SponsoredPowerPlant.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate (the TR15 class): they rule,
 *     or 2 of the player's OWN delegates stand on their resolution — checked at
 *     the play only; TR36 Council Seat lowers an EFFECT's threshold, never a
 *     requirement's. Without either road the hand names the party and both
 *     roads (`partyRequirementStanding`).
 *  2. ON PLAY: +3 energy PRODUCTION (never stock), at once; the journal reads
 *     «gained 3 energy production». It pays out from the next production
 *     phase on — the engine's rule, untouched by the card.
 *  3. THE POWER TAG: Thorgate's −3 M€ (cost 5); other cards' Power-tag
 *     requirements count it. THE BUILDING TAG: steel pays for it, and TR17
 *     Construction Mechs pays for it with mechs.
 *  4. THE TABLE'S ANSWERS to a production step (Manutech: +3 energy into the
 *     stock beside the step) are what the server forecasts (`EffectForecast`)
 *     — no number of this file's.
 *  5. PREVIEW = EXECUTION — declarative: the chip «+3 [energy] production
 *     current → resulting», the tags row; `cardPlayPreviewCoverage` takes the
 *     card by itself; the preview is pure.
 *  6. MarsBot never plays the card.  7. Save / load: an ordinary card.
 */
export class SponsoredPowerPlant extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.SPONSORED_POWER_PLANT,
      type: CardType.AUTOMATED,
      tags: [Tag.POWER, Tag.BUILDING],
      cost: 8,
      requirements: {party: PartyName.INDUSTRIALISTS},

      // Rule 2.
      behavior: {
        production: {energy: ENERGY_PRODUCTION},
      },

      metadata: {
        cardNumber: 'TR59',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.energy(ENERGY_PRODUCTION));
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there. Increase your energy production 3 steps.',
      },
    });
  }
}
