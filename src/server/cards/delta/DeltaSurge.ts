import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';

/**
 * DP07 — DELTA SURGE.
 *
 * ONE passive movement modifier and ONE immediate ocean, nothing else:
 *
 *  - The ocean rides the declarative `behavior` (the shared placement
 *    pipeline: `PlaceOceanTile` validation, placement bonuses, the owner's
 *    ocean triggers — Dynamic Ocean Barrier's bonus step included — journal,
 *    undo). The card never places anything by hand.
 *
 *  - The effect is DECLARED, never computed: `grantsDeltaTraversalRewards`
 *    marks the tableau, and the SHARED traversal plan
 *    (`DeltaProjectExpansion.traversalSteps`) is the single reader — the
 *    preview and the committed advance ask the same function, so the promise
 *    and the payout can never diverge. The card holds no reward table and no
 *    copy of the movement pipeline.
 *
 * WHAT THE EFFECT MEANS (and the plan encodes): ONE committed advance of
 * MORE THAN ONE step grants the reward of every stage it CROSSES, in path
 * order, on top of the landing stage's usual reward. The 2 VP stage is the
 * one exception — its value is POSITIONAL (scored from where the marker
 * STANDS at game end, the slot exclusive), so crossing it grants nothing and
 * the plan names that exclusion honestly. A LANDING on the 2 VP stage is
 * untouched: that is the standard rule, not this card's.
 *
 * WHAT IT DOES NOT TOUCH: destination legality, the tag path, wilds, the
 * price and its Delta Works steel mix, the once-per-generation limit, the
 * per-stage reward definitions, and other players' moves. Two separate
 * one-step advances stay two events (`advance` is the one commit point and
 * reports one move at a time — the Development Manager precedent).
 */
export class DeltaSurge extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DELTA_SURGE,
      tags: [Tag.SCIENCE],
      cost: 22,

      behavior: {
        ocean: {},
      },

      metadata: {
        cardNumber: 'DP07',
        renderData: CardRenderer.builder((b) => {
          // ONE variable, stated once: the TRIGGER is the Hydronetwork move
          // itself (the plate), the RESULT is «X rewards» (the asterisked
          // fine print carries the 2 VP exclusion). The old leading «+X»
          // restated the X on the trigger side and the compact formula read
          // as two unrelated quantities («+X [ГИДРОСЕТЬ] : X*»).
          b.effect('When advancing multiple steps on the Hydronetwork track at once, gain each step\'s reward. Does not apply to the 2 VP step.', (eb) => {
            eb.plate('Hydronetwork').startEffect.text('X').asterix();
          }).br;
          b.oceans(1);
        }),
        description: 'Place 1 ocean tile.',
      },
    });
  }

  /** The whole effect — see the class comment and `ICard`'s field doc. */
  public readonly grantsDeltaTraversalRewards = true;
}
