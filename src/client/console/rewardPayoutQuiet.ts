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
 * The wait helpers ride `probeTick`, never bare rAF (a quiet screen is
 * exactly the state they wait in), are BOUNDED, and exit the moment the
 * caller's own scene dies — a payout stall can gate a beat, never a session.
 *
 * THE SECOND CONSUMER CLASS — AUTOMATIC WORKSPACE TRANSITIONS. A transition
 * nobody pressed for (the endgame auto-open on Phase.END, a yielded stack
 * returning when the placement prompt resolves) used to fire on the raw
 * server edge — which lands BEFORE the board's post-commit half (the tile
 * hero, the reward wave, the cell's card-bonus lift, a remote landing), so
 * the workspace stood up UNDER a still-flying board scene (the flight
 * layers live at z 11620–11670, the whole workspace band at 11480–11560).
 * `boardSceneSettling()` / `waitBoardSceneQuiet()` are that gate: the WHOLE
 * board story, own and remote alike. Deliberately ANIMATION FLAGS ONLY —
 * every term is self-bounded by its owning module's safety ceiling, so the
 * wait can never hang on a prompt or a player-paced surface; the shared cap
 * is the net under the net.
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
import {isRemotePlacementActive} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {nomadMoveHolding, isRemoteNomadMoveActive} from '@/client/console/nomads/consoleNomadMove';
import {boardCardBonusState, isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';

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
 * The WHOLE BOARD SCENE is settling — every animation whose visual story
 * belongs to the MARS BOARD, own and remote alike: the payout chain above,
 * a landed tile's rewards still owed (`tilePlacementRewardsSettling` covers
 * the pending-Ares/ocean window past the hero's own phases), another
 * player's tile or nomad hop presenting, and the placed cell's card-bonus
 * lift. The AUTOMATIC-transition gate (see the header): a workspace that
 * opens with no press behind it waits this out, so the board finishes its
 * own story on a board the player can see.
 *
 * NOT here, deliberately: prompts, reveals and hand intake (player-paced —
 * an automatic transition must never wait on the player), planet focus (a
 * camera mode INSIDE `.con-main`, under every workspace by construction),
 * and the workspace-sourced flight scenes (played hero, patent sale, colony
 * flows — their story is a panel's, not the board's).
 */
export function boardSceneSettling(): boolean {
  return rewardPayoutSettling() ||
    tilePlacementRewardsSettling() ||
    isRemotePlacementActive() ||
    isRemoteNomadMoveActive() ||
    isBoardCardBonusActive();
}

/** The shared bounded quiet-wait loop (see the two public wrappers). */
function waitQuiet(settling: () => boolean, opts?: {maxMs?: number, alive?: () => boolean}): Promise<void> {
  const cap = opts?.maxMs ?? REWARD_QUIET_MAX_WAIT_MS;
  const alive = opts?.alive ?? (() => true);
  const started = Date.now();
  return new Promise((done) => {
    const poll = () => {
      if (!alive() || !settling() || Date.now() - started >= cap) {
        done();
        return;
      }
      probeTick(poll);
    };
    poll();
  });
}

/**
 * Resolve once the payout is QUIET (nothing settling), the caller's scene
 * died (`alive` false — an abort must never be held on a foreign payout),
 * or the bounded ceiling passed. Resolves synchronously-soon when already
 * quiet; never rejects.
 */
export function waitRewardPayoutQuiet(opts?: {maxMs?: number, alive?: () => boolean}): Promise<void> {
  return waitQuiet(rewardPayoutSettling, opts);
}

/**
 * Resolve once the whole BOARD scene is quiet (`boardSceneSettling` false),
 * the caller's reason died (`alive` false — a superseded transition must
 * never be held on a foreign scene), or the bounded ceiling passed. Same
 * contract as `waitRewardPayoutQuiet`; never rejects.
 */
export function waitBoardSceneQuiet(opts?: {maxMs?: number, alive?: () => boolean}): Promise<void> {
  return waitQuiet(boardSceneSettling, opts);
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
    boardScene: boardSceneSettling(),
    remoteTile: isRemotePlacementActive(),
    remoteNomad: isRemoteNomadMoveActive(),
    boardBonusActive: isBoardCardBonusActive(),
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
