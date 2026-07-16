/*
 * CONSOLE REMOTE TILE PLACEMENT — the premium landing for tiles the VIEWER
 * did not place: another player's build or a MarsBot turn. The board never
 * pops a foreign tile in (the old generic impact ring) — every placement
 * lands with the SAME physical language as the viewer's own hero scene,
 * differing only in PROVENANCE:
 *
 *   - the flight departs from the ACTING player's chip in the top status
 *     strip (fallback: the neutral top table edge — the mirror of the
 *     viewer's bottom-centre supply), never from the player's hand zone;
 *   - the pose is REMOTE_FLIGHT_PROFILE — already near the board's scale
 *     (nobody picked it off the viewer's table) with the carried tilt
 *     mirrored; the arc / touchdown / thickness / shadow are identical;
 *   - the owner cube then drops with the shared premium `pc-place` beat.
 *
 * POST-COMMIT REVEAL (deliberately the opposite of the own hero's held
 * commit): remote placements arrive on paths where holding the commit is
 * fragile (the poll loop, the bot staging's synchronous per-turn visual
 * commits, the staged last-turn closure). So the caller COMMITS normally —
 * in the SAME synchronous block it first calls `stageRemotePlacements`,
 * which registers a REVEAL HOLD per fresh tile (remoteRevealHold → the
 * existing `placement-cleared` art suppression, so the cell keeps reading
 * as untouched, printed bonuses included) plus a cube hold, and queues the
 * flights. The queue then drains sequentially: each proxy flies in, the
 * committed tile is revealed frame-perfect at its touchdown, the cube
 * drops. No game state is ever mutated here and no commit is ever delayed
 * — a stalled flight degrades to an instant reveal, never a hidden tile.
 *
 * While flights are pending the scene registers an ANIMATION HOLD
 * ('tile-placement-remote', blocking) so notifications queue and mandatory
 * surfaces wait for the landing; the stage root `.con-tileplace` is already
 * a leak-detector serving surface, covering the held window.
 *
 * NO printed-bonus reward beat here: the cell's bonuses pay the ACTING
 * player, not the viewer — their impact rides the bot-turn / hostile
 * notification pipeline. The bonuses simply stay visible until touchdown
 * and are covered by the landed tile, like any pre-existing tile.
 *
 * DESKTOP SAFETY: every staging entry point gates on
 * `consoleModeState.enabled`, so on desktop the queue never fills and the
 * generic placement animation keeps its exact behaviour.
 */

import {reactive, nextTick} from 'vue';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {TileType} from '@/common/TileType';
import {SpaceModel} from '@/common/models/SpaceModel';
import {registerAnimationHoldSupplier} from '@/client/components/presentation/animationHold';
import {consoleModeState} from '@/client/console/consoleModeState';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  FreshPlacement, detectFreshPlacements, OWN_FLIGHT_PROFILE, REMOTE_FLIGHT_PROFILE,
  TILE_FLIGHT_MS, TILE_SETTLE_MS,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  placeTileProxy, playTileFlight, disposeTileProxy, killTileTweens,
} from '@/client/console/tilePlacement/tilePlacementDirector';
import {
  tilePlacementState, tileStageRemoteEls, measureBoardHexRect, tableSupplyPoint,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {
  holdRemoteReveal, releaseRemoteReveal, isRemoteRevealHeld, clearRemoteRevealHolds,
} from '@/client/console/tilePlacement/remoteRevealHold';
import {
  holdCubeForHeroPlacement, dropCubeForHeroPlacement, restCubeForHeroPlacement,
} from '@/client/components/board/cubeDropState';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';

/** A whole queue can legitimately take several seconds (N sequential
 *  flights) — far past that, something stalled and every held tile must
 *  become visible. Deliberately under the animation-hold 35 s ceiling. */
const REMOTE_STAGE_SAFETY_MS = 15000;

export const remotePlacementState = reactive({
  /** TRUE while a remote proxy is on stage (drives the layer's remote block). */
  active: false,
  /** The CURRENT flight's tile art (one remote flight at a time — the
   *  queue is sequential, so one proxy set suffices). */
  tileType: undefined as TileType | undefined,
  aresExtension: false,
  nonce: 0,
});

type RemoteEvent = FreshPlacement & {
  aresExtension: boolean,
  /** TRUE = the VIEWER's own tile that never went through a SelectSpace
   *  (an auto-placed reserved-slot city) — it departs from the viewer's
   *  own bottom supply with the OWN pose; provenance stays honest. */
  own: boolean,
};

const queue: Array<RemoteEvent> = [];
let draining = false;
/** Bumped by abort — a drain loop mid-await sees the change and exits
 *  without touching the (already cleaned) state. */
let epoch = 0;
let stageSafety: number | undefined;

export function isRemotePlacementActive(): boolean {
  return remotePlacementState.active || queue.length > 0;
}

// Queued/flying remote landings hold the presentation exactly like the own
// hero: notifications queue, mandatory surfaces wait for the touchdown.
registerAnimationHoldSupplier('tile-placement-remote', isRemotePlacementActive);

/**
 * STAGE (the diff form) — call in the SAME synchronous block as the commit,
 * BEFORE the displayed spaces change: diffs the fresh EMPTY → TILED cells
 * (hazards excluded — their ominous materialization is its own language)
 * and holds each behind its flight. The caller then commits normally.
 */
export type RemoteStageOpts = {
  aresExtension?: boolean,
  gamePhase?: string,
  /** The viewer's own colour: their own tile arriving WITHOUT a SelectSpace
   *  (an auto-placed reserved-slot city) keeps the OWN departure pose. */
  viewerColor?: Color,
};

export function stageRemotePlacements(
  prevSpaces: ReadonlyArray<SpaceModel> | undefined,
  newSpaces: ReadonlyArray<SpaceModel> | undefined,
  opts?: RemoteStageOpts,
): void {
  if (prevSpaces === undefined || newSpaces === undefined) {
    return;
  }
  stageRemoteTileEvents(detectFreshPlacements(prevSpaces, newSpaces), opts);
}

/**
 * STAGE (the explicit-events form) — for callers that carry the tile list
 * themselves (the bot staging's per-turn visual footprint). Same contract:
 * same synchronous block as the mutation that commits the tiles.
 */
export function stageRemoteTileEvents(
  events: ReadonlyArray<FreshPlacement>,
  opts?: RemoteStageOpts,
): void {
  if (events.length === 0 || typeof window === 'undefined' || !consoleModeState.enabled) {
    return;
  }
  if (consoleReducedMotionActive()) {
    return; // the honest reduced path: tiles ride the generic short fade
  }
  if (opts?.gamePhase === Phase.END) {
    return; // the endgame experience owns the screen — no flights under it
  }
  let queued = false;
  for (const e of events) {
    if (tilePlacementState.active && tilePlacementState.spaceId === e.spaceId) {
      continue; // the viewer's OWN armed hero owns that space
    }
    if (isRemoteRevealHeld(e.spaceId) || queue.some((q) => q.spaceId === e.spaceId)) {
      continue; // already staged (a poll/submit double-report of one tile)
    }
    holdRemoteReveal(e.spaceId);
    if (e.color !== undefined) {
      // Same synchronous block as the colour commit — observeCube keeps a
      // phase already in flight, so the cube waits for its explicit drop.
      holdCubeForHeroPlacement(e.spaceId);
    }
    queue.push({
      ...e,
      aresExtension: opts?.aresExtension === true,
      own: e.color !== undefined && e.color === opts?.viewerColor,
    });
    queued = true;
  }
  if (queued) {
    armStageSafety();
    void drainQueue();
  }
}

/**
 * ABORT — stage unmount (shell teardown / game switch) or the safety
 * ceiling. Every held tile becomes visible at once, every held cube rests;
 * the queue drops. There is no game state to restore — this scene never
 * mutates any.
 */
export function abortRemotePlacements(): void {
  epoch++;
  const els = tileStageRemoteEls();
  if (els !== undefined) {
    killTileTweens(els);
  }
  for (const ev of queue) {
    releaseRemoteReveal(ev.spaceId);
    if (ev.color !== undefined) {
      restCubeForHeroPlacement(ev.spaceId);
    }
  }
  queue.length = 0;
  clearRemoteRevealHolds(); // belt-and-braces: nothing may stay hidden
  draining = false;
  remotePlacementState.active = false;
  remotePlacementState.tileType = undefined;
  clearStageSafety();
}

// ── internals ───────────────────────────────────────────────────────────────

async function drainQueue(): Promise<void> {
  if (draining) {
    return;
  }
  draining = true;
  const myEpoch = epoch;
  try {
    while (queue.length > 0 && epoch === myEpoch) {
      const ev = queue[0];
      try {
        await flyRemote(ev, myEpoch);
      } finally {
        if (epoch === myEpoch) {
          // Whatever happened, the COMMITTED tile must be visible.
          releaseRemoteReveal(ev.spaceId);
          queue.shift();
        }
      }
    }
  } finally {
    if (epoch === myEpoch) {
      draining = false;
      remotePlacementState.active = false;
      remotePlacementState.tileType = undefined;
      clearStageSafety();
    }
  }
}

async function flyRemote(ev: RemoteEvent, myEpoch: number): Promise<void> {
  const hex = measureBoardHexRect(ev.spaceId);
  if (hex === undefined) {
    degradeReveal(ev); // the board isn't measurable (section hidden) — no flight
    return;
  }
  const ui = conUiScale();
  remotePlacementState.active = true;
  remotePlacementState.tileType = ev.tileType;
  remotePlacementState.aresExtension = ev.aresExtension;
  remotePlacementState.nonce++;
  await nextTick(); // the layer mounts the remote proxy
  if (epoch !== myEpoch) {
    return;
  }
  const els = tileStageRemoteEls();
  const profile = ev.own ? OWN_FLIGHT_PROFILE : REMOTE_FLIGHT_PROFILE;
  const from = ev.own ? tableSupplyPoint(ui) : remoteOriginPoint(ev.color, ui);
  if (els === undefined || !placeTileProxy(els, {hex, from, profile})) {
    degradeReveal(ev);
    return;
  }
  await playTileFlight(els, {
    hex,
    from,
    uiScale: ui,
    flightMs: motionMs(TILE_FLIGHT_MS),
    settleMs: motionMs(TILE_SETTLE_MS),
    profile,
  });
  if (epoch !== myEpoch) {
    return; // aborted mid-flight — abort already revealed everything
  }
  // Frame-perfect handoff: the COMMITTED tile becomes visible under the
  // settled proxy (identical geometry), the proxy dissolves on it, and the
  // owner cube drops — tile first, then the cube lands on it.
  releaseRemoteReveal(ev.spaceId);
  await nextTick();
  await disposeTileProxy(els, motionMs(110));
  if (epoch === myEpoch && ev.color !== undefined) {
    dropCubeForHeroPlacement(ev.spaceId);
  }
}

/** The degraded path (no stage / unmeasurable board): the committed tile
 *  and its cube simply show — never a hidden cell, never a stranded hold. */
function degradeReveal(ev: RemoteEvent): void {
  releaseRemoteReveal(ev.spaceId);
  if (ev.color !== undefined) {
    restCubeForHeroPlacement(ev.spaceId);
  }
}

/**
 * Where a remote tile departs FROM — the acting player's chip in the top
 * status strip (the opponents literally live in the top HUD), so the
 * direction itself says WHO placed. An ownerless tile (an opponent's
 * ocean) or an unmounted strip falls back to the neutral top table edge —
 * still the mirror of the viewer's own bottom-centre supply.
 */
function remoteOriginPoint(color: Color | undefined, ui: number): TransferPoint {
  if (typeof document !== 'undefined' && color !== undefined) {
    const dot = document.querySelector<HTMLElement>(`.con-status__player .player_bg_color_${color}`);
    if (dot !== null) {
      const r = dot.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) {
        return {x: r.left + r.width / 2, y: r.bottom + Math.round(16 * ui)};
      }
    }
  }
  return {x: window.innerWidth / 2, y: Math.round(72 * ui)};
}

function armStageSafety(): void {
  if (stageSafety !== undefined) {
    window.clearTimeout(stageSafety);
  }
  stageSafety = window.setTimeout(() => abortRemotePlacements(), REMOTE_STAGE_SAFETY_MS);
}

function clearStageSafety(): void {
  if (stageSafety !== undefined) {
    window.clearTimeout(stageSafety);
    stageSafety = undefined;
  }
}
