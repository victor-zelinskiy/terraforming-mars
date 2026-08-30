import {BasePlayerInput} from '../PlayerInput';
import {DeltaStageAnswer, InputResponse, isDeltaStageRewardResponse} from '../../common/inputs/InputResponse';
import {DeltaStageRewardInputModel} from '../../common/models/PlayerInputModel';
import {InputError} from '../inputs/InputError';
import {isStructurallyValidStageAnswer} from './DeltaProjectInput';

/**
 * A REWARD-ONLY Hydronetwork stage claim (Dutch Mountains, DP08): which
 * REACHED stage's ordinary reward to grant — no movement, no position change.
 *
 * The `claimable` list is the SERVER's own verdict
 * ({@link DeltaProjectExpansion.rewardClaimableStages} at ask time), and the
 * commit re-derives it fresh inside `grantStageReward` — so a crafted or
 * stale position refuses before anything mutates. The optional composite
 * `answer` (the invocation-plan contract, {@link DeltaStageAnswer}) rides
 * by-reference exactly the way `DeltaProjectInput` carries the move step's
 * plan: set from the wire in {@link process} BEFORE the callback runs, read
 * by the card's `andThen` closure and handed to the reward resolver, which
 * consumes it with the very closures the prompts would run.
 */
export class DeltaStageRewardInput extends BasePlayerInput<number> {
  /** The pre-answered nested plan of the claimed stage's reward, if any. */
  public answer: DeltaStageAnswer | undefined;

  constructor(
    public claimable: ReadonlyArray<number>,
  ) {
    super('deltaStageReward', 'Claim the reward of a reached Hydronetwork stage');
    this.buttonLabel = 'Claim reward';
  }

  public toModel(): DeltaStageRewardInputModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'deltaStageReward',
      claimable: this.claimable,
    };
  }

  public process(input: InputResponse) {
    if (!isDeltaStageRewardResponse(input)) {
      throw new InputError('Not a valid DeltaStageRewardResponse');
    }
    if (!this.claimable.includes(input.position)) {
      throw new InputError('That Hydronetwork stage reward is not claimable');
    }
    if (input.answer !== undefined) {
      if (!isStructurallyValidStageAnswer(input.answer)) {
        throw new InputError('The stage answer must be a valid pick');
      }
      // The plan must describe THE claimed stage — a stray answer for another
      // position could otherwise smuggle a foreign pick into the resolver.
      if (input.answer.position !== input.position) {
        throw new InputError('The stage answer must describe the claimed stage');
      }
    }
    this.answer = input.answer;
    return this.cb(input.position);
  }
}
