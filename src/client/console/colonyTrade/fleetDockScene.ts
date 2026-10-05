/*
 * THE FLEET-DOCK SCENE — what happens between the fleet's touchdown on a dock
 * CARD and the end of the trade's flow (Turmoil Redux TR06 Water Hauling,
 * TR26 UNMI Liner, TR27 Aurora Station — `docs/TURMOIL_REDUX_WATER_HAULING.md`).
 *
 * ONE phrase for every dock, with ONE slot whose content the reward's CATEGORY
 * decides. The category is read off the server's own preview of the trade
 * (`fleetDockModel.fleetDockScenePlan` — its chips and its follow-ups, pinned
 * at the commit boundary), never off the card's name:
 *
 *   ANSWER   — the impulse runs the card's printed «▲ : [reward]» and the
 *              reward's icon answers once (the action-commit language);
 *   REWARD   — the slot.
 *              · `rail` (UNMI Liner's +1 TR): a token leaves that very icon
 *                for its row on the rail, the counter ticks on its touchdown,
 *                and what the table pays because of it (the ruling Greens'
 *                M€) ticks one beat later — `resourceTransfer/railReward.ts`;
 *              · `placement` (Water Hauling's ocean): EMPTY. The reward is
 *                ahead, on the board, and is NOT shown placed;
 *   READ     — a short read (the colony stage's own CARDLAND read);
 *   LEAVE    — `placement` only: the card departs as a BEAT of its own (the
 *              fleet mark rides away with it), freeing the screen the
 *              placement is about to take. A `rail` reward has been delivered
 *              in full: the card stays where its token left it and goes WITH
 *              the workspace;
 *   CONCLUDE — the workspace leaves as ONE surface through the shell's ONE
 *              guarded conclusion, and the scene's hold is released by the END
 *              OF THAT LEAVE: the workspace's own root leaving the document.
 *
 * WHY A HOLD. A colony trade resolves ON its stage and the colonies fold back;
 * a dock trade ends its flow, and whatever the same response raised — the
 * ocean's placement, the next prompt, the notification of the trade — admitted
 * the instant the view applies would rise under a workspace still standing on
 * screen: the card never answering, the screen cut. So the scene is a BLOCKING
 * animation hold (`'trade-fleet-dock'`), seeded in the very block that applies
 * the view (`gameTransport.seedRewardHolds`) and ONLY while the dock's own
 * stage stands — a scene nobody will play is a hold nobody releases. The RAIL
 * half is seeded in that same block (`seedRailReward`): the rail keeps its
 * pre-reward values until the token lands, and without a stage to fly it the
 * counters simply tick with the commit.
 *
 * The stage plays the beats; this module owns the hold, its phase, the reward
 * it armed and their release. Interruptions (the stage unmounting mid-scene,
 * the world moving) release everything at once — a placement is server state
 * and is never lost, a rail row ticks honestly late; the registry ceiling is
 * the one net (`expire` ends the wedge, `diagnose` names it).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {FleetDockScenePlan} from '@/client/console/colonyTrade/fleetDockModel';
import {releaseRailReward, seedRailReward} from '@/client/console/resourceTransfer/railReward';

export type FleetDockScenePhase = 'idle' | 'seeded' | 'answer' | 'reward' | 'read' | 'leave' | 'conclude';

/** What the stage pinned at the commit boundary: the scene's plan and the trade's other moves on the rail. */
export type ArmedFleetDockScene = {
  card: CardName;
  plan: FleetDockScenePlan;
  /** The fee and the flat bonuses, by rail row (`fleetDockModel.tradeKnownRailMoves`) — the reward's diff check allows for them. */
  known: Readonly<Record<string, number>>;
};

export const fleetDockSceneState = reactive({
  /** The hold stands (whatever the response raised waits). */
  holding: false,
  /** The dock card the scene plays on. */
  card: '' as CardName | '',
  phase: 'idle' as FleetDockScenePhase,
  /** The dock stage standing right now (registered by the stage itself). */
  stageCard: '' as CardName | '',
  /** Why the last scene ended (diagnostics). */
  lastEnd: '',
  /** The rail reward is HELD for this scene (seeded and verified) — the stage flies it in the REWARD slot. */
  railHeld: false,
});

let armed: ArmedFleetDockScene | undefined;
let detachObserver: MutationObserver | undefined;

function stopWatchingDetach(): void {
  detachObserver?.disconnect();
  detachObserver = undefined;
}

/** The rail reward's owner key of one dock card (`railReward.ts`). */
export function fleetDockRewardKey(card: CardName | ''): string {
  return `fleet-dock:${card}`;
}

/** The dock stage registers itself while it stands ('' on unmount). */
export function setFleetDockStageCard(card: CardName | ''): void {
  fleetDockSceneState.stageCard = card;
}

/**
 * ARM — the stage's commit boundary (the shell accepted the confirm): the plan
 * of the scene and the trade's known moves, as priced AT THE PRESS. The answer
 * re-prices everything under the scene, so nothing is read later.
 */
export function armFleetDockScene(scene: ArmedFleetDockScene): void {
  armed = scene;
}

/** A refused submit (or a stage that left before the answer): the plan is void. */
export function disarmFleetDockScene(card?: CardName | ''): void {
  if (card === undefined || armed?.card === card) {
    armed = undefined;
  }
}

/** The plan the stage armed for `card`, if any (the scene reads its category from it). */
export function armedFleetDockScene(card: CardName | ''): ArmedFleetDockScene | undefined {
  return armed !== undefined && armed.card === card ? armed : undefined;
}

/**
 * SEED — called in the transport's apply block, beside every other reward
 * hold. Only when the dock's own stage stands for THIS card: a scene nobody
 * will play is a hold nobody releases. A `rail` reward is held on the rail in
 * the same block, checked against the two views (`railReward.seedRailReward`:
 * a promise the applied view does not keep is not held — it ticks with this
 * very commit and names itself).
 */
export function seedFleetDockHold(card: CardName | '', before?: PlayerViewModel, after?: PlayerViewModel): void {
  if (card === '' || fleetDockSceneState.stageCard !== card || fleetDockSceneState.holding) {
    return;
  }
  stopWatchingDetach();
  fleetDockSceneState.holding = true;
  fleetDockSceneState.card = card;
  fleetDockSceneState.phase = 'seeded';
  fleetDockSceneState.lastEnd = '';
  const scene = armedFleetDockScene(card);
  fleetDockSceneState.railHeld = scene !== undefined && scene.plan.category === 'rail' && scene.plan.specs.length > 0 &&
    seedRailReward(fleetDockRewardKey(card), {cause: scene.plan.specs, reactions: scene.plan.reactions, known: scene.known}, before, after);
}

/** The stage advances the scene's phase (the beats are its own). */
export function setFleetDockScenePhase(phase: FleetDockScenePhase): void {
  if (fleetDockSceneState.holding) {
    fleetDockSceneState.phase = phase;
  }
}

/** END — the hold falls and whatever waited is admitted; a rail row still held ticks now. Idempotent. */
export function endFleetDockScene(reason: string): void {
  stopWatchingDetach();
  if (!fleetDockSceneState.holding && fleetDockSceneState.phase === 'idle') {
    return;
  }
  const card = fleetDockSceneState.card;
  fleetDockSceneState.holding = false;
  fleetDockSceneState.phase = 'idle';
  fleetDockSceneState.card = '';
  fleetDockSceneState.lastEnd = reason;
  fleetDockSceneState.railHeld = false;
  // The reward's own chain releases every row it held on its landings; this is the interrupt's net.
  releaseRailReward(fleetDockRewardKey(card), reason);
  disarmFleetDockScene(card);
}

/**
 * RELEASE AT THE END OF THE LEAVE — the workspace's root element (the
 * colonies section, or the card-actions host it stands in) leaves the document
 * when its own leave has finished, and that is the moment the board is clean.
 * Observed, never timed: the registry ceiling is the only net.
 */
export function releaseFleetDockHoldWhenGone(root: Element | null | undefined): void {
  if (!fleetDockSceneState.holding) {
    return;
  }
  fleetDockSceneState.phase = 'conclude';
  if (root === null || root === undefined || !root.isConnected || typeof MutationObserver === 'undefined') {
    endFleetDockScene('concluded');
    return;
  }
  stopWatchingDetach();
  detachObserver = new MutationObserver(() => {
    if (!root.isConnected) {
      endFleetDockScene('concluded');
    }
  });
  detachObserver.observe(document.body, {childList: true, subtree: true});
}

registerAnimationHoldSupplier('trade-fleet-dock', () => fleetDockSceneState.holding, {
  diagnose: () => ({
    card: fleetDockSceneState.card, phase: fleetDockSceneState.phase, stage: fleetDockSceneState.stageCard,
    category: armedFleetDockScene(fleetDockSceneState.card)?.plan.category, railHeld: fleetDockSceneState.railHeld,
  }),
  expire: () => endFleetDockScene('expired'),
});

/** Test-only reset. */
export function resetFleetDockScene(): void {
  stopWatchingDetach();
  releaseRailReward(fleetDockRewardKey(fleetDockSceneState.card), 're-seed');
  armed = undefined;
  fleetDockSceneState.holding = false;
  fleetDockSceneState.card = '';
  fleetDockSceneState.phase = 'idle';
  fleetDockSceneState.stageCard = '';
  fleetDockSceneState.lastEnd = '';
  fleetDockSceneState.railHeld = false;
}
