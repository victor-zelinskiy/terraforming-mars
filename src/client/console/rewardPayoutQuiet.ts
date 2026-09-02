/*
 * REWARD PAYOUT QUIET — the ONE answer to "is a resource payout still owning
 * the screen?", for scenes that must sequence themselves AFTER the resource
 * half of a reward (console-native only).
 *
 * One placement routinely produces BOTH a card and resources (a Terra
 * Cimmeria Nova volcanic cell prints STEEL + DRAW_CARD; an Ares neighbour
 * pays adjacency while the cell's own card cover is lifting). The card and
 * the chips may FLY in parallel — but the covering surfaces of the card's
 * story (the fullscreen viewer, the reveal frame) may only open once every
 * visible resource flight has landed and been absorbed. That ordering is a
 * COORDINATION fact, not a timing guess, so it is answered here from the
 * payout systems' own live state:
 *
 *   · tilePlacementHolding()     — the landing + reward beats of an OWN
 *                                  placement (printed / ocean / Ares payouts);
 *   · nomadMoveHolding()         — the camp hop + its reward/restore beats;
 *   · isResourceTransferActive() — chips in the air, absorb tails included
 *                                  (whoever launched them).
 *
 * The wait helper rides `probeTick`, never bare rAF (a quiet screen is
 * exactly the state it waits in), is BOUNDED, and exits the moment the
 * caller's own scene dies — a payout stall can gate a beat, never a session.
 *
 * Import direction (load-bearing): this module sits ABOVE the payout systems
 * (it imports them). The board-card-bonus CONTROLLER must never import this
 * (consoleTilePlacement imports the controller for its pace decision — a
 * cycle); the LAYER is the consumer.
 */

import {probeTick} from '@/client/console/probeTick';
import {
  isResourceTransferActive, resourceTransferState,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  tilePlacementHolding, tilePlacementRewardsSettling, tilePlacementState,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {nomadMoveHolding} from '@/client/console/nomads/consoleNomadMove';
import {boardCardBonusState} from '@/client/console/boardCardBonus/consoleBoardCardBonus';

/**
 * The bounded ceiling of one quiet-wait. Well above any real payout chain
 * (three beats × flight budget + breaths ≈ 4 s; every beat carries its own
 * shorter safety), well below the card scene's 15 s whole-scene backstop —
 * a stalled payout costs a beat of the card's story, never the scene.
 */
export const REWARD_QUIET_MAX_WAIT_MS = 8000;

/**
 * A reward payout still owns the screen: a placement/move hero is mid-beat,
 * or resource chips are visibly in the air. Every term is module-reactive,
 * so a computed reading this re-evaluates as the payouts progress.
 */
export function rewardPayoutSettling(): boolean {
  return tilePlacementHolding() || nomadMoveHolding() || isResourceTransferActive();
}

/**
 * Resource chips of the CURRENT payout are flying or still owed — the
 * narrow "is the card actually concurrent with resources?" question (the
 * broad predicate above is also true through a plain landing with no
 * rewards, which must not slow a card that flies alone).
 */
export function concurrentResourcePayout(): boolean {
  return tilePlacementRewardsSettling() || isResourceTransferActive();
}

/**
 * Resolve once the payout is QUIET (nothing settling), the caller's scene
 * died (`alive` false — an abort must never be held on a foreign payout),
 * or the bounded ceiling passed. Resolves synchronously-soon when already
 * quiet; never rejects.
 */
export function waitRewardPayoutQuiet(opts?: {maxMs?: number, alive?: () => boolean}): Promise<void> {
  const cap = opts?.maxMs ?? REWARD_QUIET_MAX_WAIT_MS;
  const alive = opts?.alive ?? (() => true);
  const started = Date.now();
  return new Promise((done) => {
    const poll = () => {
      if (!alive() || !rewardPayoutSettling() || Date.now() - started >= cap) {
        done();
        return;
      }
      probeTick(poll);
    };
    poll();
  });
}

/*
 * READ-ONLY e2e / diagnostics probe (the `__foregroundDiag` idiom): the whole
 * card↔payout coordination seam in one snapshot — every settling term plus
 * the card-bonus scene's own gate state. «The viewer opened over a flying
 * chip» / «the cover never left the cell» is exactly the question this
 * answers; never used by product code.
 */
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__rewardPayoutDiag = () => ({
    settling: rewardPayoutSettling(),
    tileHolding: tilePlacementHolding(),
    tilePhase: tilePlacementState.phase,
    tileRewards: tilePlacementRewardsSettling(),
    nomadHolding: nomadMoveHolding(),
    transfers: isResourceTransferActive(),
    flights: resourceTransferState.flights.length,
    runActive: resourceTransferState.runActive,
    scene: {
      active: boardCardBonusState.active,
      phase: boardCardBonusState.phase,
      staged: boardCardBonusState.stagedEventId,
      count: boardCardBonusState.stagedCount,
      zoomReady: boardCardBonusState.zoomEntryReady,
    },
  });
}
