/*
 * THE STAGE-REWARD PICK BRIDGE (Dutch Mountains, DP08) — the console twin of
 * the repeat-pick bridge, for «claim the reward of a reached Hydronetwork
 * stage» composer steps.
 *
 * The composer shows the claim as ONE capturable step (`{kind:'input'}` over
 * a `deltaStageReward` input — the ordinary confirm gating applies with no
 * special case). Activating the step hands the screen to the REAL Hydronetwork
 * workspace as a SELECTION surface: `enterDeltaRewardPick(request, onResolve,
 * onCancel)` flips this module state, pushes a `hydro` OVERLAY frame (the
 * track needs the whole band and has no zone to wait for — the sanctioned
 * overlay case), and the composer waits underneath with its captures intact
 * (`v-show`, the pick-bridge idiom). The section presents the track in its
 * reward-select mode, the player picks a CLAIMABLE stage + its nested
 * pre-selects (the per-position draft machinery the traversal already owns),
 * and the resolve returns a {@link DeltaRewardDraft} — which the composer
 * captures as the step's wire response. Nothing is submitted, nothing is
 * spent, the marker does not move: the FINAL activation is the composer's own
 * ordinary batch confirm.
 *
 * The callbacks live OUTSIDE the reactive state (function identity — the
 * consoleRepeatPick precedent); a hard teardown fires none of them.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import type {DeltaStageAnswer, DeltaStageRewardResponse, InputResponse} from '@/common/inputs/InputResponse';
import type {PlayerViewModel} from '@/common/models/PlayerModel';
import type {WorkspaceOutcomeKind, WorkspaceOutcomeScope} from '@/client/console/consoleWorkspaceOutcome';
import type {ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import type {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {repeatComposedResponses} from '@/client/console/consoleHydroAdvance';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';
import {buildRewardView, HydroPlayerSnapshot, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {hydroRewardTransfers} from '@/client/console/hydroMarker/hydroRewardTransfers';
import {actionPreviewMap} from '@/client/console/actionPreviewStore';
import {resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {resetHydroFlow} from '@/client/console/hydroFlow/consoleHydroFlow';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {popWorkspaceFrame, pushWorkspaceFrame, workspaceStackTop} from '@/client/console/consoleWorkspaceStack';

/** The composed claim of ONE stage — everything the pick surface collected. */
export type DeltaRewardDraft = {
  position: number;
  /** Choice stages (1/2): the picked alternative index. */
  rewardChoice?: number;
  /** Target stages (7/9): the picked card. */
  selectedCard?: CardName;
  /** Stage 7: the composed repeat (the same bridge result the advance uses). */
  repeat?: ConsoleRepeatPickResult;
};

export type DeltaRewardPickRequest = {
  /** The card whose action opened the pick (the ctx column's source). */
  source: CardName;
  /** The SERVER's own claimable positions (the input model's list). */
  claimable: ReadonlyArray<number>;
  /** A previous draft preserved for a «change» re-open. */
  prior?: DeltaRewardDraft;
};

export const deltaRewardPickState = reactive({
  active: false,
  request: undefined as DeltaRewardPickRequest | undefined,
});

let resolveCb: ((draft: DeltaRewardDraft) => void) | undefined;
let cancelCb: (() => void) | undefined;

export function isDeltaRewardPickActive(): boolean {
  return deltaRewardPickState.active;
}

/** Open the Hydronetwork workspace in reward-select mode (a stack STEP). */
export function enterDeltaRewardPick(
  request: DeltaRewardPickRequest,
  onResolve: (draft: DeltaRewardDraft) => void,
  onCancel?: () => void,
): void {
  // The pick opens on a CLEAN track plan (the delta-step door's own reset —
  // whatever the player studied on a previous visit must not leak in); the
  // section then seeds the prior draft from the request (`seatRewardPick`).
  resetHydroPlan();
  consoleHydroUi.repeatResult = undefined;
  resetHydroFlow();
  deltaRewardPickState.request = request;
  resolveCb = onResolve;
  cancelCb = onCancel;
  deltaRewardPickState.active = true;
  pushWorkspaceFrame({
    kind: 'hydro',
    subject: '',
    // The tail the crumb advances to — the root and the carried card come
    // from the frames BELOW (ДЕЙСТВИЯ КАРТ › DUTCH MOUNTAINS › …).
    stage: 'Reward selection',
    phase: 'configure',
    serves: [],
    anchor: {type: 'always'},
    overlay: true,
  });
}

/** Pop the pick's own frame — and ONLY when it is the frame on top (the
 *  repeat-pick guard: a cleared stack must not lose somebody else's frame). */
function popRewardPickFrame(): void {
  if (workspaceStackTop()?.kind === 'hydro') {
    popWorkspaceFrame();
  }
}

/** Deliver the composed draft to the waiting composer. */
export function resolveDeltaRewardPick(draft: DeltaRewardDraft): void {
  if (!deltaRewardPickState.active) {
    return;
  }
  const cb = resolveCb;
  resetDeltaRewardPick();
  cb?.(draft);
}

/** B / an external teardown: return to the composer with the OLD draft kept. */
export function cancelDeltaRewardPick(): void {
  if (!deltaRewardPickState.active) {
    return;
  }
  const cb = cancelCb;
  resetDeltaRewardPick();
  cb?.();
}

/** Hard reset (game switch / shell unmount) — fires NO callbacks. */
export function resetDeltaRewardPick(): void {
  popRewardPickFrame();
  deltaRewardPickState.active = false;
  deltaRewardPickState.request = undefined;
  resolveCb = undefined;
  cancelCb = undefined;
}

// ── The WIRE — the step's captured response ────────────────────────────────

/**
 * The draft as the step's ONE wire response ({@link DeltaStageRewardResponse}).
 * The nested plan rides `answer` in the same invocation-plan shape the move
 * step carries — the server's reward resolver consumes it with the very
 * closures the prompts would run. A repeat whose composition no longer names
 * the drafted card degrades to the bare card answer (the action's own inputs
 * then arrive as embedded runtime follow-ups — the advance's exact contract).
 */
export function deltaRewardStepResponse(draft: DeltaRewardDraft): DeltaStageRewardResponse {
  const answer: {
    position: number, rewardChoice?: number, selectedCard?: CardName,
    repeatResponses?: ReadonlyArray<InputResponse>,
  } = {position: draft.position};
  let has = false;
  if (draft.rewardChoice !== undefined) {
    answer.rewardChoice = draft.rewardChoice;
    has = true;
  }
  if (draft.selectedCard !== undefined) {
    answer.selectedCard = draft.selectedCard;
    has = true;
    if (draft.repeat !== undefined && draft.repeat.chosenCard === draft.selectedCard) {
      const composed = repeatComposedResponses(draft.repeat.composed);
      if (composed.length > 0) {
        answer.repeatResponses = composed as ReadonlyArray<InputResponse>;
      }
    }
  }
  return {
    type: 'deltaStageReward',
    position: draft.position,
    ...(has ? {answer: answer as DeltaStageAnswer} : {}),
  };
}

/** The captured step response, read back as a draft (the composer's summary
 *  row and the re-open's `prior` both come from THIS — the capture is the one
 *  source of truth, never a second module copy). */
export function deltaRewardDraftOf(response: unknown): DeltaRewardDraft | undefined {
  const r = response as DeltaStageRewardResponse | undefined;
  if (r === undefined || r.type !== 'deltaStageReward' || !Number.isInteger(r.position)) {
    return undefined;
  }
  return {
    position: r.position,
    rewardChoice: r.answer?.rewardChoice,
    selectedCard: r.answer?.selectedCard,
  };
}

// ── The COMMIT plans — claim + presentation, structural off the track ──────

/**
 * WHAT THE CLAIMED STAGE'S RESOLUTION WILL SEND BACK, derived from the track
 * configuration (never a card literal): the stage-5 draw raises a keep-pick
 * batch, a composed repeat raises whatever the repeated action's own preview
 * promises (draws / a deck-check verdict — the hydro advance's exact
 * derivation, `scope: 'chain'` because the server attributes a copied
 * action's effects to the card that RAN). Consumed by the Cards Actions
 * confirm so the arriving artifacts embed in the workspace that asked.
 */
export function deltaRewardClaimPlan(draft: DeltaRewardDraft): {
  kinds: Array<WorkspaceOutcomeKind>, expectedCards: number, scope: WorkspaceOutcomeScope,
} | undefined {
  const stage = HYDRO_STAGES[draft.position];
  if (stage === undefined) {
    return undefined;
  }
  if (stage.followUp === 'draw') {
    return {kinds: ['draw', 'pick'], expectedCards: 4, scope: 'card'};
  }
  if (stage.followUp === 'reuse-action' && draft.repeat !== undefined &&
      draft.repeat.chosenCard === draft.selectedCard) {
    const branch = actionPreviewMap().get(draft.repeat.chosenCard)?.branches[draft.repeat.composed.branchIndex];
    const kinds: Array<WorkspaceOutcomeKind> = [];
    let expectedCards = 0;
    for (const e of branch?.effects ?? []) {
      if (e.direction === 'gain' && e.icon === 'cards') {
        expectedCards += Math.max(1, Math.round(e.amount));
      }
    }
    if (branch?.reveal !== undefined) {
      kinds.push('deck-check');
    }
    if (expectedCards > 0) {
      kinds.push('draw', 'pick');
    }
    return kinds.length > 0 ? {kinds, expectedCards, scope: 'chain'} : undefined;
  }
  return undefined;
}

/**
 * The commit wave's reward specs — the claimed stage's own «сейчас → станет»
 * through the ONE reward view + transfer extraction every hydro landing uses
 * (`buildRewardView` → `hydroRewardTransfers`), so a claimed reward flies
 * exactly the chips an arrival would. Undefined lines (a draw, a repeat) fly
 * nothing here — their presentation is the claimed batch / the embedded
 * action, exactly as on the track.
 */
/**
 * THE CLAIMED STAGE'S OWN «Вы получите» — the ONE reward view every
 * Hydronetwork landing renders (`buildRewardView` over the live snapshot),
 * addressed by the DRAFT. This is what the composer's configuration screen
 * shows under the claimed stage, so the pre-confirm reading and the commit's
 * flown chips derive from the SAME lines by construction: icons, honest
 * `before → after`, the draw stage's «посмотреть 4, взять 2» chips, the
 * picked target's counter — never a UI re-computation of the rule.
 */
export function deltaRewardPreviewView(
  draft: DeltaRewardDraft, playerView: PlayerViewModel,
): HydroRewardView | undefined {
  const stage = HYDRO_STAGES[draft.position];
  if (stage === undefined) {
    return undefined;
  }
  const p = playerView.thisPlayer;
  const snapshot: HydroPlayerSnapshot = {
    steel: p.steel, plants: p.plants, titanium: p.titanium, energy: p.energy, heat: p.heat, megacredits: p.megacredits,
    prod: {
      megacredits: p.megacreditProduction, steel: p.steelProduction, titanium: p.titaniumProduction,
      plants: p.plantProduction, energy: p.energyProduction, heat: p.heatProduction,
    },
    plantTags: p.tags['plant' as never] ?? 0,
    jovianTags: p.tags['jovian' as never] ?? 0,
  };
  return buildRewardView({
    stage,
    snapshot,
    rewardChoice: draft.rewardChoice,
    animalTargetCurrent: draft.selectedCard !== undefined ?
      p.tableau.find((c) => c.name === draft.selectedCard)?.resources ?? 0 : undefined,
    animalTargetCardName: draft.selectedCard,
  });
}

export function deltaRewardCommitSpecs(
  draft: DeltaRewardDraft, playerView: PlayerViewModel,
): ReadonlyArray<ResourceTransferSpec> {
  const view = deltaRewardPreviewView(draft, playerView);
  return view === undefined ? [] : hydroRewardTransfers(view);
}
