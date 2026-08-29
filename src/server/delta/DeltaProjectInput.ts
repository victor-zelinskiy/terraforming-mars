import {BasePlayerInput} from '../PlayerInput';
import {InputResponse, isDeltaProjectInputResponse} from '../../common/inputs/InputResponse';
import {DeltaProjectInputModel} from '../../common/models/PlayerInputModel';
import {InputError} from '../inputs/InputError';

export class DeltaProjectInput extends BasePlayerInput<number> {
  /**
   * The response consciously declined the landed stage's TARGET-bearing reward
   * (pos 7 repeat / pos 9 animals) — set from the wire in {@link process},
   * BEFORE the callback runs, so the `andThen` closures read it off this very
   * input and hand it to `DeltaProjectExpansion.advance`. A field rather than a
   * callback-signature change: the amount stays the input's one answer.
   */
  public waiveReward = false;

  /**
   * Steel spent 1:1 in place of energy (Delta Works) — set from the wire in
   * {@link process} like {@link waiveReward}, read by the `andThen` closure
   * and handed to `advance` as the payment mix. 0 = the whole price is
   * energy (the legacy wire shape omits the field entirely). Range-checked
   * structurally here; the authoritative mix validation lives in
   * `DeltaProjectExpansion.resolveAdvancePayment`, at commit.
   */
  public steelSpent = 0;

  /**
   * @param validSteps the legal step counts the player may submit. Each value
   * is both the number of track positions to advance and the energy cost.
   * Sparse (not always `[1..max]`) when an opponent occupies a VP spot —
   * e.g. `[1, 3]` if a 2-step advance would land on a blocked space.
   */
  constructor(
    public validSteps: ReadonlyArray<number>,
  ) {
    super('deltaProject', 'Select the amount of energy to spend to advance on the track');
    this.buttonLabel = 'Advance';
  }

  public toModel(): DeltaProjectInputModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'deltaProject',
      validSteps: this.validSteps,
    };
  }

  public process(input: InputResponse) {
    if (!isDeltaProjectInputResponse(input)) {
      throw new InputError('Not a valid DeltaProjectInputResponse');
    }
    if (!this.validSteps.includes(input.amount)) {
      throw new InputError('Amount must be one of: ' + this.validSteps.join(', '));
    }
    const steel = input.steel ?? 0;
    if (!Number.isInteger(steel) || steel < 0 || steel > input.amount) {
      throw new InputError('Steel share must be an integer between 0 and the step count');
    }
    this.waiveReward = input.waiveReward === true;
    this.steelSpent = steel;
    return this.cb(input.amount);
  }
}
