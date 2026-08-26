import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {PlayerInput} from '../PlayerInput';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {AdvanceOptions, DeltaProjectExpansion} from '../delta/DeltaProjectExpansion';
import {namedCardEffect} from '../inputs/choiceContext';

/** A free one-step bonus move: the card pays for it, the stock does not. */
const FREE: AdvanceOptions = {maxSteps: 1, free: true};
/** The same move, buying a waiver for exactly one missing required tag. */
const WAIVED: AdvanceOptions = {maxSteps: 1, free: true, tagWaiver: true, energyToll: 1};

/**
 * A CARD-GRANTED BONUS MOVE on the Delta Project track.
 *
 * Queued by the card that grants it (Dynamic Ocean Barrier, once per ocean its
 * owner actually places) and resolved FIFO with every other deferred
 * consequence of the same placement — so the placement's own bonuses (a card
 * draw among them) are finished before the player is asked anything here.
 *
 * ELIGIBILITY IS ANSWERED AT EXECUTE, NEVER AT DEFER. Two oceans queue two of
 * these, and the first one's move changes the answer for the second (a new
 * position, a spent energy, a claimed VP slot) — so each asks the standard
 * movement pipeline again, right before it would prompt, and silently drops out
 * when the move has stopped being possible. That is also what makes it correct
 * after a reload: nothing about the offer is stored, it is re-derived.
 *
 * The offer itself is the rule, twice:
 *  - the step is legal as it stands  → offer it FREE;
 *  - exactly one required tag short AND the player holds the energy → offer the
 *    1-energy waiver INSTEAD (never both: a move the player can make for free
 *    must never be sold to them).
 * Anything else — two tags short, no energy for the waiver, the end of the
 * track — raises no prompt at all.
 */
export class BonusDeltaAdvance extends DeferredAction {
  constructor(player: IPlayer, private source: ICard) {
    // BACK_OF_THE_LINE: the placement's own consequences (space bonuses, the
    // card draw and its reveal, Ares follow-ups) are the CAUSE of this offer
    // and must all resolve before it is put to the player.
    super(player, Priority.BACK_OF_THE_LINE);
  }

  /** Which shape of the offer is live right now, or undefined when none is. */
  private offer(): AdvanceOptions | undefined {
    const player = this.player;
    if (player.deltaProjectData === undefined) {
      return undefined;
    }
    if (DeltaProjectExpansion.getValidAdvanceSteps(player, FREE).includes(1)) {
      return FREE;
    }
    // The waiver is a PURCHASE, so it needs both the energy and a deficit of
    // exactly one — `getValidAdvanceSteps` with `tagWaiver` answers the second
    // half (it admits a one-tag gap and nothing wider).
    if (player.energy >= 1 && DeltaProjectExpansion.getValidAdvanceSteps(player, WAIVED).includes(1)) {
      return WAIVED;
    }
    return undefined;
  }

  public execute(): PlayerInput | undefined {
    const options = this.offer();
    if (options === undefined) {
      return undefined;
    }
    const player = this.player;
    const paid = options.energyToll !== undefined && options.energyToll > 0;
    const advance = new SelectOption(
      paid ?
        'Spend 1 energy and take the bonus step' :
        'Take the free bonus step',
      paid ? 'Spend and advance' : 'Advance')
      .andThen(() => {
        // The SAME pipeline the standard action runs — position, destination
        // validation, rewards, choices, the repeat-blue-action pick, the
        // journal scope. `advance` re-validates against these very options and
        // charges the toll atomically inside its own event scope.
        DeltaProjectExpansion.advance(player, 1, options);
        return undefined;
      });
    const skip = new SelectOption('Skip the bonus step', 'Skip').andThen(() => undefined);
    return new OrOptions(advance, skip)
      .markChoiceContext(namedCardEffect(
        this.source.name,
        false,
        paid ?
          'Spend 1 energy to ignore 1 required tag and advance 1 step on the Delta Project track' :
          'Advance 1 step on the Delta Project track without paying energy',
        'effect-choice'));
  }
}
