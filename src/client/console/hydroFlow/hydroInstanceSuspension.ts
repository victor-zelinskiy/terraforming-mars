/*
 * HYDRO INSTANCE SUSPENSION — what makes a NESTED same-kind descent safe.
 *
 * The Hydronetwork is ONE screen serving many ROLES per invocation (the plan
 * flow, the reward pick, the target picks, the execution view), and those
 * roles share ONE set of module state (`hydroNetworkState` plan drafts,
 * `consoleHydroUi.repeatResult`, the `hydroFlowState` record). Every pick door
 * deliberately opens on a CLEAN slate (`resetHydroPlan` …), which is right
 * for a fresh descent and destructive for a NESTED one: the outer role's
 * drafts — the reward pick's per-position answers, a parked traversal's
 * record — are exactly what the player expects back when the inner instrument
 * resolves.
 *
 * So the door that nests SUSPENDS first: a shallow field snapshot of the
 * three states (plain data by construction — positions, names, records; the
 * commit record is restored by REFERENCE, since the nested instrument resets
 * the field and never mutates the object). The restore is handed back as a
 * closure and executed by the bridge's own reset funnel — the one place every
 * exit (resolve · cancel · hard teardown) already routes through.
 *
 * This is the same idea as the workspace PARK's suspended-instance record,
 * applied one level down: the stack carries WHERE the player is
 * (`WorkspaceFrame.nested`), this module carries WHAT the outer role knew.
 */
import {hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import {hydroFlowState} from '@/client/console/hydroFlow/consoleHydroFlow';

/** Snapshot the outer hydro role's module state; returns the restore. */
export function suspendHydroInstance(): () => void {
  const net = {
    selectedPosition: hydroNetworkState.selectedPosition,
    rewardChoice: hydroNetworkState.rewardChoice,
    selectedCard: hydroNetworkState.selectedCard,
    planChoices: {...hydroNetworkState.planChoices},
    planPicks: {...hydroNetworkState.planPicks},
    awaitingPick: hydroNetworkState.awaitingPick,
  };
  const repeatResult = consoleHydroUi.repeatResult;
  const flow = {
    step: hydroFlowState.step,
    repeatBridge: hydroFlowState.repeatBridge,
    commit: hydroFlowState.commit,
    frameEpoch: hydroFlowState.frameEpoch,
    draftVersion: hydroFlowState.draftVersion,
    ceremonyActive: hydroFlowState.ceremonyActive,
    ceremonyPlayed: hydroFlowState.ceremonyPlayed,
  };
  return () => {
    hydroNetworkState.selectedPosition = net.selectedPosition;
    hydroNetworkState.rewardChoice = net.rewardChoice;
    hydroNetworkState.selectedCard = net.selectedCard;
    hydroNetworkState.planChoices = {...net.planChoices};
    hydroNetworkState.planPicks = {...net.planPicks};
    hydroNetworkState.awaitingPick = net.awaitingPick;
    consoleHydroUi.repeatResult = repeatResult;
    hydroFlowState.step = flow.step;
    hydroFlowState.repeatBridge = flow.repeatBridge;
    hydroFlowState.commit = flow.commit;
    hydroFlowState.frameEpoch = flow.frameEpoch;
    hydroFlowState.draftVersion = flow.draftVersion;
    hydroFlowState.ceremonyActive = flow.ceremonyActive;
    hydroFlowState.ceremonyPlayed = flow.ceremonyPlayed;
  };
}
