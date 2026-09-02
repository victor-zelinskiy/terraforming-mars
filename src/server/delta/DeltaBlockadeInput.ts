import {BasePlayerInput} from '../PlayerInput';
import {DeltaBlockadeResponse, InputResponse, isDeltaBlockadeResponse} from '../../common/inputs/InputResponse';
import {DeltaBlockadeInputModel} from '../../common/models/PlayerInputModel';
import {DeltaBlockadeProjectionModel} from '../../common/models/DeltaBlockadeModel';
import {InputError} from '../inputs/InputError';

/**
 * THE MODULAR FLOODGATES (DP11) VARIANT-B ASK: which opponent receives the
 * blockade. The model carries the whole SERVER-AUTHORED projection
 * ({@link DeltaBlockadeProjectionModel}) — the client renders and validates
 * against it, never re-deriving a target's eligibility from a cell number.
 * The projection held here is built AT THE COMMIT REQUEST, so validating the
 * response against it IS the live re-validation: while this input stands the
 * game queue is blocked on it, and no position can move underneath.
 *
 * VALIDATION IS LOUD, never corrective (the DP10 contract):
 *  - `target` is REQUIRED and must be a LIVE legal candidate — never
 *    silently retargeted, never degraded to the other variant;
 *  - `expectedTargetFrom`, when the client pinned it, must match the
 *    projection — a prognosis the player never saw is not committed.
 * A refusal leaves the input standing, so the player re-decides against the
 * fresh projection instead of half-running the effect.
 */
export class DeltaBlockadeInput extends BasePlayerInput<DeltaBlockadeResponse> {
  constructor(
    public projection: DeltaBlockadeProjectionModel,
  ) {
    super('deltaBlockade', 'Choose a player to block on the Hydronetwork');
    this.buttonLabel = 'Confirm';
  }

  public toModel(): DeltaBlockadeInputModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'deltaBlockade',
      projection: this.projection,
    };
  }

  public process(input: InputResponse) {
    if (!isDeltaBlockadeResponse(input)) {
      throw new InputError('Not a valid DeltaBlockadeResponse');
    }
    const projection = this.projection;
    if (!projection.hasLegalTarget) {
      throw new InputError('There is no legal player to block');
    }
    const target = projection.targets.find((t) => t.color === input.target);
    if (target === undefined || !target.legal) {
      throw new InputError('That player can no longer be blocked — review the updated projection');
    }
    if (input.expectedTargetFrom !== undefined && input.expectedTargetFrom !== target.position) {
      throw new InputError('The target has moved since this was planned — review the updated projection');
    }
    if (projection.cardSteel < 1) {
      throw new InputError('No steel resource on the card to deploy');
    }
    return this.cb(input);
  }
}
