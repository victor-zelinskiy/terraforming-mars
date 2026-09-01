import {BasePlayerInput} from '../PlayerInput';
import {DeltaEspionageResponse, InputResponse, isDeltaEspionageResponse} from '../../common/inputs/InputResponse';
import {DeltaEspionageInputModel} from '../../common/models/PlayerInputModel';
import {DeltaEspionageProjectionModel} from '../../common/models/DeltaEspionageModel';
import {InputError} from '../inputs/InputError';
import {isStructurallyValidStageAnswer} from './DeltaProjectInput';

/**
 * THE CORPORATE ESPIONAGE (DP10) ASK: which opponent to push back, plus the
 * owner's pre-answered ask of their OWN landing stage.
 *
 * The model carries the whole SERVER-AUTHORED projection
 * ({@link DeltaEspionageProjectionModel}) — the client renders and validates
 * against it, never re-deriving a transition or a reward. The projection held
 * here is built AT THE COMMIT REQUEST (`bespokePlay`), so validating the
 * response against it IS the live re-validation: while this input stands the
 * game queue is blocked on it, and no other player's position can move.
 *
 * VALIDATION IS LOUD, never corrective:
 *  - a legal target exists ⇒ `target` is REQUIRED (the mandatory pick);
 *  - none exists ⇒ `target` is FORBIDDEN (a stale claim of one refuses);
 *  - a named target must be a LIVE legal candidate — never silently
 *    retargeted, never silently degraded to a no-target play;
 *  - the `expected*From` positions, when the client pinned them, must match
 *    the projection — a prognosis the player never saw is not committed;
 *  - `ownerAnswer` must describe the OWNER's own destination (the same
 *    invocation-plan shape every Hydronetwork door carries; the target's
 *    choices can never ride it).
 * A refusal leaves the input standing, so the player re-decides against the
 * fresh projection instead of half-running the effect.
 */
export class DeltaEspionageInput extends BasePlayerInput<DeltaEspionageResponse> {
  constructor(
    public projection: DeltaEspionageProjectionModel,
  ) {
    super('deltaEspionage', 'Choose a player to push back on the Hydronetwork');
    this.buttonLabel = 'Confirm';
  }

  public toModel(): DeltaEspionageInputModel {
    return {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'deltaEspionage',
      projection: this.projection,
    };
  }

  public process(input: InputResponse) {
    if (!isDeltaEspionageResponse(input)) {
      throw new InputError('Not a valid DeltaEspionageResponse');
    }
    const projection = this.projection;
    if (projection.hasLegalTarget) {
      if (input.target === undefined) {
        throw new InputError('A target must be selected while a legal target exists');
      }
      const target = projection.targets.find((t) => t.color === input.target);
      if (target === undefined || !target.legal) {
        throw new InputError('That player can no longer be pushed back — review the updated projection');
      }
      if (input.expectedTargetFrom !== undefined && input.expectedTargetFrom !== target.fromPosition) {
        throw new InputError('The target has moved since this was planned — review the updated projection');
      }
    } else if (input.target !== undefined) {
      throw new InputError('There is no legal target to push back');
    }
    if (input.expectedOwnerFrom !== undefined && input.expectedOwnerFrom !== projection.owner.fromPosition) {
      throw new InputError('Your own position has changed since this was planned — review the updated projection');
    }
    if (input.ownerAnswer !== undefined) {
      if (!isStructurallyValidStageAnswer(input.ownerAnswer)) {
        throw new InputError('The stage answer must be a valid pick');
      }
      if (input.ownerAnswer.position !== projection.owner.toPosition) {
        throw new InputError('The stage answer must describe your own destination');
      }
    }
    return this.cb(input);
  }
}
