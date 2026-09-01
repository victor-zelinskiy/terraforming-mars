/*
 * THE ESPIONAGE TARGET-PICK BRIDGE (Corporate Espionage, DP10) — the play
 * composer's door onto the real Hydronetwork workspace as a TARGET-SELECTION
 * surface: the deltaRewardEntry (DP08) idiom, for «push another player back»
 * composer steps.
 *
 * The composer shows the whole espionage ask as capturable pre-select rows
 * (the target, plus the owner's own landing asks). Activating the TARGET row
 * hands the screen to the Hydronetwork workspace: `enterDeltaEspionagePick`
 * flips this module state and pushes a `hydro` OVERLAY frame (the track needs
 * the whole band — the sanctioned pick-bridge case), while the composer waits
 * underneath with its captures intact. The section presents the track in its
 * espionage projection mode — every candidate with the SERVER's own
 * `from → to` and resulting reward, ghost markers for the focused candidate's
 * backward step and the owner's own forward step — and the resolve returns
 * the chosen target. Nothing is submitted, nothing moves: the final
 * activation is the composer's own ordinary play batch.
 *
 * The PROJECTION IS THE SERVER'S and rides through untouched
 * ({@link DeltaEspionageProjectionModel} off the card-play preview) — this
 * module re-derives no transition, no legality, no reward.
 *
 * The callbacks live OUTSIDE the reactive state (function identity — the
 * consoleRepeatPick precedent); a hard teardown fires none of them.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import type {DeltaEspionageProjectionModel, DeltaEspionageTargetProjection} from '@/common/models/DeltaEspionageModel';
import type {DeltaEspionageResponse, DeltaStageAnswer} from '@/common/inputs/InputResponse';
import {resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {resetHydroFlow} from '@/client/console/hydroFlow/consoleHydroFlow';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {popWorkspaceFrame, pushWorkspaceFrame, workspaceStackTop} from '@/client/console/consoleWorkspaceStack';

/** The pick's one result: WHO to push back (a legal candidate's color), or
 *  undefined when the projection offers no legal target (the system outcome —
 *  the composer then captures the explicit no-target response). */
export type DeltaEspionageDraft = {
  target?: Color;
};

export type DeltaEspionagePickRequest = {
  /** The card whose play opened the pick (the ctx column's source). */
  source: CardName;
  /** THE server-authored projection — the selection surface renders and
   *  validates against this, never a re-derivation. */
  projection: DeltaEspionageProjectionModel;
  /** A previously chosen target preserved for a «change» re-open. */
  prior?: Color;
  /**
   * The STANDALONE-PROMPT door (a refused/stale batch answer, a reconnect):
   * the ask is a mandatory server demand with no composer to cancel back to,
   * so B refuses out loud instead of cancelling — the resolve submits the
   * answer directly.
   */
  mandatory?: boolean;
};

export const deltaEspionagePickState = reactive({
  active: false,
  request: undefined as DeltaEspionagePickRequest | undefined,
});

let resolveCb: ((draft: DeltaEspionageDraft) => void) | undefined;
let cancelCb: (() => void) | undefined;

export function isDeltaEspionagePickActive(): boolean {
  return deltaEspionagePickState.active;
}

/** Open the Hydronetwork workspace in target-selection mode (a stack STEP). */
export function enterDeltaEspionagePick(
  request: DeltaEspionagePickRequest,
  onResolve: (draft: DeltaEspionageDraft) => void,
  onCancel?: () => void,
): void {
  // A clean track plan (the door's own reset — whatever the player studied on
  // a previous visit must not leak in); the section then seats the prior
  // target from the request.
  resetHydroPlan();
  consoleHydroUi.repeatResult = undefined;
  resetHydroFlow();
  deltaEspionagePickState.request = request;
  resolveCb = onResolve;
  cancelCb = onCancel;
  deltaEspionagePickState.active = true;
  pushWorkspaceFrame({
    kind: 'hydro',
    subject: '',
    // The tail the crumb advances to — the root and the carried card come
    // from the frames BELOW (КАРТЫ В РУКЕ › CORPORATE ESPIONAGE › …).
    stage: 'Target selection',
    phase: 'configure',
    serves: [],
    anchor: {type: 'always'},
    overlay: true,
  });
}

/** Pop the pick's own frame — and ONLY when it is the frame on top. */
function popEspionagePickFrame(): void {
  if (workspaceStackTop()?.kind === 'hydro') {
    popWorkspaceFrame();
  }
}

/** Deliver the chosen target to the waiting composer. */
export function resolveDeltaEspionagePick(draft: DeltaEspionageDraft): void {
  if (!deltaEspionagePickState.active) {
    return;
  }
  const cb = resolveCb;
  resetDeltaEspionagePick();
  cb?.(draft);
}

/** B / an external teardown: return to the composer with the OLD pick kept. */
export function cancelDeltaEspionagePick(): void {
  if (!deltaEspionagePickState.active) {
    return;
  }
  const cb = cancelCb;
  resetDeltaEspionagePick();
  cb?.();
}

/** Hard reset (game switch / shell unmount) — fires NO callbacks. */
export function resetDeltaEspionagePick(): void {
  popEspionagePickFrame();
  deltaEspionagePickState.active = false;
  deltaEspionagePickState.request = undefined;
  resolveCb = undefined;
  cancelCb = undefined;
}

// ── The WIRE — the step's captured response ────────────────────────────────

/**
 * The composed answer as the step's ONE wire response
 * ({@link DeltaEspionageResponse}). The `expected*From` positions pin the
 * rendered prognosis (the server refuses a commit whose live positions
 * moved); the owner's landing plan rides `ownerAnswer` in the same
 * invocation-plan shape every Hydronetwork door carries.
 */
export function deltaEspionageStepResponse(
  projection: DeltaEspionageProjectionModel,
  target: Color | undefined,
  ownerAnswer?: DeltaStageAnswer,
): DeltaEspionageResponse {
  const targetEntry = target !== undefined ?
    projection.targets.find((t) => t.color === target) : undefined;
  return {
    type: 'deltaEspionage',
    ...(target !== undefined ? {target} : {}),
    ...(targetEntry !== undefined ? {expectedTargetFrom: targetEntry.fromPosition} : {}),
    expectedOwnerFrom: projection.owner.fromPosition,
    ...(ownerAnswer !== undefined ? {ownerAnswer} : {}),
  };
}

/** The captured step response, read back (the composer's summary row and the
 *  re-open's `prior` both come from THIS — the capture is the one source of
 *  truth, never a second module copy). */
export function deltaEspionageResponseOf(response: unknown): DeltaEspionageResponse | undefined {
  const r = response as DeltaEspionageResponse | undefined;
  if (r === undefined || r.type !== 'deltaEspionage') {
    return undefined;
  }
  return r;
}

/** The LEGAL candidates of a projection, in seating order. */
export function espionageLegalTargets(projection: DeltaEspionageProjectionModel): ReadonlyArray<DeltaEspionageTargetProjection> {
  return projection.targets.filter((t) => t.legal);
}
