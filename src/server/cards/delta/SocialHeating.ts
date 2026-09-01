import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {DeltaMovement, DeltaMovementBonus} from '../../delta/deltaMovement';

/**
 * DP09 — SOCIAL HEATING.
 *
 * ONE passive effect and nothing else: «Any time any player moves on the
 * Hydronetwork track, gain an equal amount of heat as steps taken.»
 *
 * ═══ THE WHOLE CARD IS ONE PURE ANSWER ═══
 *
 * `deltaMovementBonus` returns WHAT IS OWED for one movement; it never grants,
 * logs, defers or moves anything. The shared ledger (`delta/deltaMovement.ts`)
 * is the single caller and does all three jobs it implies:
 *  - the COMMIT pays the answer out inside the movement's own event scope, so
 *    the journal reads «Социальное отопление → +N тепла» under the move that
 *    caused it, and the affected-player notification/journal machinery picks
 *    it up with no card-specific wiring;
 *  - the PLANNING PROJECTION asks the SAME function for a move that has not
 *    happened yet, which is what the workspace shows beside «Вы получите»
 *    before the player confirms.
 * One function, two readers ⇒ the promise and the payout cannot diverge, and
 * a card that cannot mutate cannot re-trigger the movement that called it.
 *
 * ═══ WHY THERE IS NO «if bot» ANYWHERE ═══
 *
 * The card never asks WHO moved. `commitDeltaMovement` is the one position
 * write on this track — the human advance (standard action, DP03's bonus move,
 * DP04's card action) and the Solo Delta Project resolution both go through it
 * — so a MarsBot move publishes exactly the fact a human move does. «Any
 * player» is therefore true by construction rather than by enumeration, and a
 * future mover (a second bot, another card) is covered the day it is written.
 *
 * ═══ WHAT COUNTS AS A STEP (rule reading, all of it from the printed text) ═══
 *
 *  - `movement.steps` is the ACTUAL committed distance (`to - from`), never
 *    what was requested: a move the rules cut short pays for the cells really
 *    crossed. A zero-step «move» is not a movement at all and never reaches
 *    this hook (the ledger publishes nothing for one).
 *  - THE OWNER'S OWN MOVE COUNTS. «Any player» includes them — the printed
 *    text draws no exception, and the ledger dispatches over every tableau
 *    including the mover's.
 *  - EVERY CELL COUNTS, whatever sits on it. The Jovian stage (8) and the two
 *    VP terminals (10/11) are cells of this track like any other; the card
 *    prints no exclusion, so entering or crossing them is worth its steps.
 *    (Contrast Delta Surge, which prints its own 2 VP exclusion — that clause
 *    belongs to THAT card's rule, not to this one.)
 *  - BACKWARD MOVEMENT IS NOT A RULE OF THIS TRACK: nothing in the game
 *    decreases a Hydronetwork position (`deltaMovement.ts` is the one writer
 *    and only ever advances). So there is no «equal amount of heat» to argue
 *    about for one — and if a future effect ever introduced regression, this
 *    hook would still be asked with a positive `steps` only, because the
 *    ledger refuses to publish anything else.
 *  - A REWARD-ONLY GRANT IS NOT A MOVE. Dutch Mountains claims a reached
 *    stage's reward WITHOUT moving the marker
 *    (`DeltaProjectExpansion.grantStageReward`), so it never touches the
 *    ledger and never pays this card a thing.
 */
export class SocialHeating extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.SOCIAL_HEATING,
      tags: [Tag.BUILDING],
      cost: 12,

      // «Requires that you have a city in play.» The CANONICAL city check —
      // `CitiesRequirement` → `board.getCities(player)`, the same one every
      // other city-gated card uses, which counts the player's OWN city tiles
      // (CITY / CAPITAL / OCEAN CITY / RED CITY / NEW HOLLAND) wherever they
      // are in play, Mars and off-Mars colony spaces alike. Declaring it as a
      // requirement — never a bespoke board walk — is also what keeps the
      // client's playability, the server's validation and the rules panel
      // reading one verdict.
      requirements: {cities: 1},

      metadata: {
        cardNumber: 'DP09',
        renderData: CardRenderer.builder((b) => {
          // ONE variable, stated once, exactly as the card prints it: the
          // TRIGGER is X steps of movement on the track (the plate), the
          // RESULT is X heat. «Any player» is a rule about WHOSE movement
          // counts and has no icon of its own — the effect prose below is
          // the card's own wording for it, and it is what the information
          // panel and the premium face's rule zone render.
          b.effect('Any time any player advances on the Hydronetwork track, gain 1 heat per step they took.', (eb) => {
            eb.text('X').plate('Hydronetwork').startEffect.text('X').heat(1);
          });
        }),
      },
    });
  }

  /**
   * THE WHOLE RULE — see the class comment and `ICard`'s field doc.
   *
   * `cardOwner` is deliberately unused: the beneficiary is always this card's
   * owner, and WHO moved is not a term of the rule.
   */
  public deltaMovementBonus(_cardOwner: IPlayer, movement: DeltaMovement): DeltaMovementBonus | undefined {
    if (movement.steps <= 0) {
      return undefined;
    }
    return {card: this.name, resource: Resource.HEAT, amount: movement.steps};
  }
}
