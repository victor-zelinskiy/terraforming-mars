/*
 * THE FLEET-DOCK SCENE — what happens between the fleet's touchdown on a dock
 * CARD and the clean board the reward is placed on (Turmoil Redux TR06 Water
 * Hauling: the trade's reward is an OCEAN, i.e. a board placement).
 *
 * A colony trade resolves ON its stage and the colonies fold back; a dock trade
 * ends in a PLACEMENT, and a placement admitted the instant the view applies
 * would rise under a workspace still standing on screen — the card never
 * answering, the screen cut to the board. So the scene is a BLOCKING animation
 * hold (`'trade-fleet-dock'`), seeded in the very block that applies the view
 * (`gameTransport.seedRewardHolds` — and only while the dock's stage stands,
 * since nobody else would play it), and the placement's admission waits on it:
 *
 *   ANSWER   — the impulse runs the card's printed «▲ : [ocean]» and the ocean
 *              icon answers once (the action-commit language). The ocean is NOT
 *              shown placed — it is ahead;
 *   READ     — a short read (the colony stage's own CARDLAND read);
 *   LEAVE    — the card departs as a BEAT (the fleet mark rides away with it);
 *   CONCLUDE — the workspace leaves as ONE surface through the shell's ONE
 *              guarded conclusion, and the hold is released by the END OF THAT
 *              LEAVE: the workspace's own root element leaving the document.
 *
 * The stage plays the beats; this module owns the hold, its phase and its
 * release. Interruptions (the stage unmounting mid-scene, the world moving)
 * release at once — the placement is server state and is never lost; the
 * registry ceiling is the one net (`expire` ends the wedge, `diagnose` names it).
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';

export type FleetDockScenePhase = 'idle' | 'seeded' | 'answer' | 'read' | 'leave' | 'conclude';

export const fleetDockSceneState = reactive({
  /** The hold stands (the placement waits). */
  holding: false,
  /** The dock card the scene plays on. */
  card: '' as CardName | '',
  phase: 'idle' as FleetDockScenePhase,
  /** The dock stage standing right now (registered by the stage itself). */
  stageCard: '' as CardName | '',
  /** Why the last scene ended (diagnostics). */
  lastEnd: '',
});

let detachObserver: MutationObserver | undefined;

function stopWatchingDetach(): void {
  detachObserver?.disconnect();
  detachObserver = undefined;
}

/** The dock stage registers itself while it stands ('' on unmount). */
export function setFleetDockStageCard(card: CardName | ''): void {
  fleetDockSceneState.stageCard = card;
}

/**
 * SEED — called in the transport's apply block, beside every other reward
 * hold. Only when the dock's own stage stands for THIS card: a scene nobody
 * will play is a hold nobody releases.
 */
export function seedFleetDockHold(card: CardName | ''): void {
  if (card === '' || fleetDockSceneState.stageCard !== card || fleetDockSceneState.holding) {
    return;
  }
  stopWatchingDetach();
  fleetDockSceneState.holding = true;
  fleetDockSceneState.card = card;
  fleetDockSceneState.phase = 'seeded';
  fleetDockSceneState.lastEnd = '';
}

/** The stage advances the scene's phase (the beats are its own). */
export function setFleetDockScenePhase(phase: FleetDockScenePhase): void {
  if (fleetDockSceneState.holding) {
    fleetDockSceneState.phase = phase;
  }
}

/** END — the hold falls and the placement is admitted. Idempotent. */
export function endFleetDockScene(reason: string): void {
  stopWatchingDetach();
  if (!fleetDockSceneState.holding && fleetDockSceneState.phase === 'idle') {
    return;
  }
  fleetDockSceneState.holding = false;
  fleetDockSceneState.phase = 'idle';
  fleetDockSceneState.card = '';
  fleetDockSceneState.lastEnd = reason;
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
  diagnose: () => ({card: fleetDockSceneState.card, phase: fleetDockSceneState.phase, stage: fleetDockSceneState.stageCard}),
  expire: () => endFleetDockScene('expired'),
});

/** Test-only reset. */
export function resetFleetDockScene(): void {
  stopWatchingDetach();
  fleetDockSceneState.holding = false;
  fleetDockSceneState.card = '';
  fleetDockSceneState.phase = 'idle';
  fleetDockSceneState.stageCard = '';
  fleetDockSceneState.lastEnd = '';
}
