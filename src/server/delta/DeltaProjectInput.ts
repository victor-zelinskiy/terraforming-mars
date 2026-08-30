import {BasePlayerInput} from '../PlayerInput';
import {DeltaStageAnswer, InputResponse, isDeltaProjectInputResponse} from '../../common/inputs/InputResponse';
import {DeltaProjectInputModel} from '../../common/models/PlayerInputModel';
import {InputError} from '../inputs/InputError';
import {CardName} from '../../common/cards/CardName';

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
   * PER-POSITION conscious declines of target-bearing stage rewards along a
   * multi-reward traversal (Delta Surge) — same by-reference contract as
   * {@link waiveReward}: set from the wire BEFORE the callback, read by the
   * `andThen` closure, handed to `advance` (`waivedTargetPositions`). Empty
   * for the historical wire shapes.
   */
  public waivedSteps: ReadonlyArray<number> = [];

  /**
   * THE DECLARED RESOURCE PLAN — pre-selected repeated actions at their
   * stages, same by-reference contract. `advance` re-validates the ordered
   * projection against these BEFORE any mutation: a mix that starves a
   * declared action throws atomically (nothing spent, no movement).
   */
  public plannedActions: ReadonlyArray<{position: number, card: CardName}> = [];

  /** The declared choice answers of the same plan (see the wire doc). */
  public plannedChoices: ReadonlyArray<{position: number, choice: number}> = [];

  /**
   * THE INVOCATION PLAN — the pre-answered stage asks, by position (see the
   * wire doc on `DeltaProjectInputResponse.answers`). Same by-reference
   * contract as the fields above: set from the wire BEFORE the callback,
   * handed to `advance`, CONSUMED by the reward resolution itself. The
   * authoritative validation happens at consume time against the live
   * candidate lists — a stale entry degrades to that stage's own prompt.
   */
  public answers: ReadonlyArray<DeltaStageAnswer> = [];

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
    const waivedSteps = input.waivedSteps ?? [];
    if (!Array.isArray(waivedSteps) ||
        waivedSteps.some((p) => !Number.isInteger(p) || p < 0 || p > 11)) {
      throw new InputError('Waived steps must be track positions');
    }
    const plannedActions = input.plannedActions ?? [];
    if (!Array.isArray(plannedActions) ||
        plannedActions.some((a) => a === null || typeof a !== 'object' ||
          !Number.isInteger(a.position) || a.position < 0 || a.position > 11 ||
          typeof a.card !== 'string')) {
      throw new InputError('Planned actions must name track positions and cards');
    }
    const plannedChoices = input.plannedChoices ?? [];
    if (!Array.isArray(plannedChoices) ||
        plannedChoices.some((c) => c === null || typeof c !== 'object' ||
          !Number.isInteger(c.position) || c.position < 0 || c.position > 11 ||
          !Number.isInteger(c.choice) || c.choice < 0)) {
      throw new InputError('Planned choices must name track positions and options');
    }
    const answers = input.answers ?? [];
    if (!Array.isArray(answers) ||
        answers.some((a) => a === null || typeof a !== 'object' ||
          !Number.isInteger(a.position) || a.position < 0 || a.position > 11 ||
          (a.rewardChoice !== undefined && (!Number.isInteger(a.rewardChoice) || a.rewardChoice < 0)) ||
          (a.selectedCard !== undefined && typeof a.selectedCard !== 'string') ||
          (a.repeatResponses !== undefined && (!Array.isArray(a.repeatResponses) ||
            a.repeatResponses.some((r: unknown) => r === null || typeof r !== 'object'))))) {
      throw new InputError('Stage answers must name track positions with valid picks');
    }
    this.waiveReward = input.waiveReward === true;
    this.steelSpent = steel;
    this.waivedSteps = waivedSteps;
    this.plannedActions = plannedActions;
    this.plannedChoices = plannedChoices;
    this.answers = answers;
    return this.cb(input.amount);
  }
}
