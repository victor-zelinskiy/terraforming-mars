/*
 * THE BLOCKADE TARGET-PICK BRIDGE (Modular Floodgates, DP11) — the blue-card
 * ACTION composer's door onto the real Hydronetwork workspace as a
 * TARGET-SELECTION surface: the deltaEspionageEntry (DP10) idiom, for the
 * «deploy a blockade in front of another player» variant step.
 *
 * The composer shows the deploy variant with the target as a capturable
 * pre-select row. Activating it hands the screen to the Hydronetwork
 * workspace: `enterDeltaBlockadePick` flips this module state and pushes a
 * `hydro` OVERLAY frame (the track needs the whole band — the sanctioned
 * pick-bridge case), while the composer waits underneath with its captures
 * intact. The section presents the track in its blockade projection mode —
 * every candidate at the SERVER's own live position, the focused candidate's
 * GHOST BLOCKADE on the cell in front of their marker, every refusal named —
 * and the resolve returns the chosen target. Nothing is submitted, nothing
 * moves: the final activation is the composer's own ordinary action batch.
 *
 * The PROJECTION IS THE SERVER'S and rides through untouched
 * ({@link DeltaBlockadeProjectionModel} off the action preview) — this module
 * re-derives no eligibility and no position.
 *
 * The callbacks live OUTSIDE the reactive state (function identity — the
 * consoleRepeatPick precedent); a hard teardown fires none of them.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import type {DeltaBlockadeProjectionModel, DeltaBlockadeTargetProjection} from '@/common/models/DeltaBlockadeModel';
import type {DeltaBlockadeResponse} from '@/common/inputs/InputResponse';
import {resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {resetHydroFlow} from '@/client/console/hydroFlow/consoleHydroFlow';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {popWorkspaceFrame, pushWorkspaceFrame, workspaceStackTop} from '@/client/console/consoleWorkspaceStack';

/** The pick's one result: WHO to block (a legal candidate's color). Unlike
 *  the espionage draft it is never empty — the deploy variant does not exist
 *  without a legal target (the branch is refused instead). */
export type DeltaBlockadeDraft = {
  target: Color;
};

export type DeltaBlockadePickRequest = {
  /** The card whose action opened the pick (the ctx column's source). */
  source: CardName;
  /** THE server-authored projection — the selection surface renders and
   *  validates against this, never a re-derivation. */
  projection: DeltaBlockadeProjectionModel;
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

export const deltaBlockadePickState = reactive({
  active: false,
  request: undefined as DeltaBlockadePickRequest | undefined,
});

let resolveCb: ((draft: DeltaBlockadeDraft) => void) | undefined;
let cancelCb: (() => void) | undefined;

export function isDeltaBlockadePickActive(): boolean {
  return deltaBlockadePickState.active;
}

/** Open the Hydronetwork workspace in blockade-selection mode (a stack STEP). */
export function enterDeltaBlockadePick(
  request: DeltaBlockadePickRequest,
  onResolve: (draft: DeltaBlockadeDraft) => void,
  onCancel?: () => void,
): void {
  // A clean track plan (the door's own reset — whatever the player studied on
  // a previous visit must not leak in); the section then seats the prior
  // target from the request.
  resetHydroPlan();
  consoleHydroUi.repeatResult = undefined;
  resetHydroFlow();
  deltaBlockadePickState.request = request;
  resolveCb = onResolve;
  cancelCb = onCancel;
  deltaBlockadePickState.active = true;
  pushWorkspaceFrame({
    kind: 'hydro',
    subject: '',
    // The tail the crumb advances to — the root and the carried card come
    // from the frames BELOW (ДЕЙСТВИЯ КАРТ › MODULAR FLOODGATES › …).
    stage: 'Target selection',
    phase: 'configure',
    serves: [],
    anchor: {type: 'always'},
    overlay: true,
  });
}

/** Pop the pick's own frame — and ONLY when it is the frame on top. */
function popBlockadePickFrame(): void {
  if (workspaceStackTop()?.kind === 'hydro') {
    popWorkspaceFrame();
  }
}

/** Deliver the chosen target to the waiting composer. */
export function resolveDeltaBlockadePick(draft: DeltaBlockadeDraft): void {
  if (!deltaBlockadePickState.active) {
    return;
  }
  const cb = resolveCb;
  resetDeltaBlockadePick();
  cb?.(draft);
}

/** B / an external teardown: return to the composer with the OLD pick kept. */
export function cancelDeltaBlockadePick(): void {
  if (!deltaBlockadePickState.active) {
    return;
  }
  const cb = cancelCb;
  resetDeltaBlockadePick();
  cb?.();
}

/** Hard reset (game switch / shell unmount) — fires NO callbacks. */
export function resetDeltaBlockadePick(): void {
  popBlockadePickFrame();
  deltaBlockadePickState.active = false;
  deltaBlockadePickState.request = undefined;
  resolveCb = undefined;
  cancelCb = undefined;
}

// ── The EXECUTION SURFACE — the committed deploy returns to the track ──────
//
// The commit boundary contract («Не закрывай workspace на поле с мгновенно
// появившимся status badge»): after the composer's own commit beat the flow
// does NOT conclude to the board — the Hydronetwork workspace opens as the
// execution surface, where the fresh gate ASSEMBLES in front of the target's
// marker (the `con-hydro-gatein` entry plays exactly once, because the gate
// element enters the DOM with the applied response — a reload or reconnect
// mounts it already standing, replaying nothing). «Готово» pops the frame
// and the card-actions conclusion resumes.
//
// ARM at submit, CONSUME at flow-complete: a refused batch never completes
// its flow, so a stale arm simply expires (bounded window) — it can neither
// leak into a later action nor hold a workspace.

export const blockadeExecutionState = reactive({
  active: false,
  target: undefined as Color | undefined,
  source: undefined as CardName | undefined,
});

let pendingExecution: {target: Color, source: CardName, at: number} | undefined;
const PENDING_EXECUTION_MAX_MS = 30_000;

/** The submit carried a deploy — remember whom, for the flow's completion. */
export function armBlockadeExecution(target: Color, source: CardName): void {
  pendingExecution = {target, source, at: Date.now()};
}

/** The flow completed — was a deploy part of it? One-shot, bounded. */
export function consumeBlockadeExecution(): {target: Color, source: CardName} | undefined {
  const p = pendingExecution;
  pendingExecution = undefined;
  if (p === undefined || Date.now() - p.at > PENDING_EXECUTION_MAX_MS) {
    return undefined;
  }
  return {target: p.target, source: p.source};
}

export function isBlockadeExecutionActive(): boolean {
  return blockadeExecutionState.active;
}

/** Open the Hydronetwork workspace as the deploy's execution surface. */
export function beginBlockadeExecution(target: Color, source: CardName): void {
  blockadeExecutionState.target = target;
  blockadeExecutionState.source = source;
  blockadeExecutionState.active = true;
  pushWorkspaceFrame({
    kind: 'hydro',
    subject: '',
    stage: 'Deployment',
    phase: 'committed',
    serves: [],
    anchor: {type: 'always'},
    overlay: true,
  });
}

/** «Готово» / B — the execution view ends (the blockade itself is committed
 *  server state and needs nothing from this surface). */
export function endBlockadeExecution(): void {
  if (!blockadeExecutionState.active) {
    return;
  }
  if (workspaceStackTop()?.kind === 'hydro') {
    popWorkspaceFrame();
  }
  blockadeExecutionState.active = false;
  blockadeExecutionState.target = undefined;
  blockadeExecutionState.source = undefined;
}

/** Hard reset (game switch / shell unmount) — fires no navigation. */
export function resetBlockadeExecution(): void {
  pendingExecution = undefined;
  blockadeExecutionState.active = false;
  blockadeExecutionState.target = undefined;
  blockadeExecutionState.source = undefined;
}

// ── The WIRE — the step's captured response ────────────────────────────────

/**
 * The composed answer as the step's ONE wire response
 * ({@link DeltaBlockadeResponse}). `expectedTargetFrom` pins the rendered
 * prognosis — the server refuses a commit whose live position moved.
 */
export function deltaBlockadeStepResponse(
  projection: DeltaBlockadeProjectionModel,
  target: Color,
): DeltaBlockadeResponse {
  const targetEntry = projection.targets.find((t) => t.color === target);
  return {
    type: 'deltaBlockade',
    target,
    ...(targetEntry !== undefined ? {expectedTargetFrom: targetEntry.position} : {}),
  };
}

/** The captured step response, read back (the composer's summary row and the
 *  re-open's `prior` both come from THIS — the capture is the one source of
 *  truth, never a second module copy). */
export function deltaBlockadeResponseOf(response: unknown): DeltaBlockadeResponse | undefined {
  const r = response as DeltaBlockadeResponse | undefined;
  if (r === undefined || r.type !== 'deltaBlockade') {
    return undefined;
  }
  return r;
}

/** The LEGAL candidates of a projection, in seating order. */
export function blockadeLegalTargets(projection: DeltaBlockadeProjectionModel): ReadonlyArray<DeltaBlockadeTargetProjection> {
  return projection.targets.filter((t) => t.legal);
}
