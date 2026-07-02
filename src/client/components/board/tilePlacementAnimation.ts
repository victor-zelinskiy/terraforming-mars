/*
 * Board Placement Animation Framework — centralised, cross-remount
 * coordinator for the "tile just appeared on Mars" visual.
 *
 * Goals (see CLAUDE.md goal #1–4 + the in-flight Action UI rework):
 *
 *   - Oceans / greeneries / cities / special tiles must not pop in
 *     instantly. The arrival is the player's reward for the action and
 *     should read as a discrete moment, not a frame flip.
 *
 *   - Animation runs once per real placement. The
 *     `<player-home :key="playerkey">` remount that WaitingFor.vue
 *     forces on every server response would otherwise re-trigger the
 *     `mounted()`-hook animation on every poll, replaying the same
 *     placement across N remounts. Module-level `tileBaseline` survives
 *     the remount (same trick as `accentBaseline` in AnimatedScaleMarker),
 *     so the second mount sees baseline === current → no replay.
 *
 *   - Resource / global-parameter / scale-marker updates land AFTER
 *     a brief perceptual hold (~280 ms) so the player perceives
 *       1. tile appears on the board
 *       2. ring radiates, settle pulse
 *       3. resource chips / scale marker travel kick in
 *     and not three things lighting up in the same frame.
 *
 *   - Reduced-motion users get a shortened fade-in and no ring.
 *
 * Counterpart to the WGT marker hold already in WaitingFor.vue:
 *   `shouldHoldForMarkerAnimation` + `applyGlobalParamPreview`. The two
 *   holds compose — when a single submit raises a global parameter AND
 *   places a tile (ocean placement, Lake Marineris, etc.), both previews
 *   apply and the actual hold duration is `max(marker, tile)`.
 */

import {SpaceId} from '@/common/Types';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType, HAZARD_TILES} from '@/common/TileType';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {motionMs} from '@/client/components/motion/motionTokens';

export type PlacementKind = 'ocean' | 'greenery' | 'city' | 'special' | 'hazard';

/*
 * Length of the "hold the rest of the UI" window. By the end of the
 * hold (~330 ms) the tile is fully formed (opacity 1, scale ~0.99,
 * about to pop at ~390 ms / 54 % of the 720 ms animation); resources /
 * scale markers / the next prompt then land while the damped spring
 * tail settles to rest. The settle tail is a calm transform-only
 * motion, so it doesn't compete with the right-hand panel chips.
 *
 * Reduced-motion path holds for substantially less since the animation
 * itself collapses to a brief fade.
 */
export const PLACEMENT_HOLD_MS = 330;
export const PLACEMENT_HOLD_REDUCED_MS = 100;

/*
 * Total CSS animation duration on the tile div. Driven by the
 * `tile-placement-impact` + `tile-placement-ring` keyframes in
 * board_placement_animation.less. 720 ms (trimmed from 930) — the
 * GPU-only transform/opacity rework lands a snappier, more responsive
 * "materialise + spring-settle" that no longer needs the longer window
 * the old filter/blend version used to mask its stepping. The scale
 * pop lands at ~54 % (~390 ms), with the damped spring tail settling
 * to rest by 720 ms.
 */
export const PLACEMENT_ANIMATION_MS = 720;
export const PLACEMENT_ANIMATION_REDUCED_MS = 280;
/**
 * A hazard APPEARING is a little heavier + slower than a calm tile placement —
 * an ominous "danger materialises" beat that matches the weight of the cleanup
 * sequence (and is distinct from a routine build).
 */
export const HAZARD_PLACEMENT_ANIMATION_MS = 940;

/*
 * Per-tile-type accent class. `special` covers everything that isn't
 * one of the three iconic player tiles — capital, mohole, ecological
 * zone, mining area, restricted area, dust storms, ocean variants
 * (Wetlands / Ocean City / New Holland), Moon tiles, Pathfinders, etc.
 *
 * Wetlands / Ocean City / New Holland visually count as oceans + X but
 * the player chose to place them deliberately as a single special
 * action, so they get the gold-purple "special tile" accent rather
 * than the cyan ocean accent — keeps the placement feel distinct from
 * a vanilla ocean placement.
 */
const OCEAN_KIND: ReadonlySet<TileType> = new Set([TileType.OCEAN]);

const GREENERY_KIND: ReadonlySet<TileType> = new Set([
  TileType.GREENERY,
]);

const CITY_KIND: ReadonlySet<TileType> = new Set([
  TileType.CITY,
  TileType.CAPITAL,
  TileType.RED_CITY,
  TileType.OCEAN_CITY,
  TileType.NEW_HOLLAND,
]);

export function kindFor(tileType: TileType): PlacementKind {
  // A hazard APPEARING (erosion / dust storm — planetary event or a card) gets a
  // dedicated red/amber "danger materialises" entrance, so the hazard lifecycle
  // (appear → intensify → cleanup) reads as one premium language. Checked first.
  if (HAZARD_TILES.has(tileType)) {
    return 'hazard';
  }
  if (OCEAN_KIND.has(tileType)) {
    return 'ocean';
  }
  if (GREENERY_KIND.has(tileType)) {
    return 'greenery';
  }
  if (CITY_KIND.has(tileType)) {
    return 'city';
  }
  return 'special';
}

/*
 * Cross-remount memory. `tileBaseline` is the canonical "what does this
 * client believe is on each space" snapshot — updated every time a
 * BoardSpaceTile observes its space. `activePlacements` tracks
 * animations in flight so a mid-animation remount can resume rather
 * than restart from frame 0.
 */
const tileBaseline = new Map<SpaceId, TileType | undefined>();

type ActivePlacement = {
  startedAt: number;
  duration: number;
  kind: PlacementKind;
};
const activePlacements = new Map<SpaceId, ActivePlacement>();

/*
 * "Animations armed?" gate. Without this, the first time the page
 * loads (F5 / direct navigation / share-link join) the baseline map
 * is empty and EVERY existing tile on the board reads as a fresh
 * placement — N parallel impact rings light up across Mars and the
 * scene looks like the game just started over. The gate keeps
 * observeTilePlacement silent (baseline-update only, no animation)
 * UNTIL someone explicitly opens a placement window via
 * `armPlacementAnimations()`. WaitingFor.fetchPlayerInput calls it
 * right before applyTilePlacementPreview — exactly when we know a
 * real placement is about to land — and the gate auto-disarms after
 * the animation duration so subsequent reactive updates (polling
 * from other players, follow-up server responses) don't spuriously
 * trigger animations again.
 *
 * Polling updates from OTHER players' tile placements currently fall
 * through this gate and stay silent. That's a deliberate trade-off
 * for now: F5 read-as-pristine is a real bug, polling-anim-for-
 * others is a deferred nice-to-have. If you add polling-driven
 * animations later, the right hook is a second arm-on-poll-diff
 * code path that calls armPlacementAnimations() before the polling
 * code mutates the displayed spaces.
 */
let placementAnimationsArmed = false;
let placementAnimationsDisarmTimer: number | null = null;

/*
 * Open the placement-animation window. While open, the next
 * undefined → defined transition observed by BoardSpaceTile will
 * trigger the impact + settle keyframes. Auto-closes after the
 * animation duration (+ buffer) so we don't leak the arming state
 * past the playerView update that triggered it.
 *
 * Idempotent — multiple calls within the same window reset the
 * disarm timer rather than stacking. This lets WaitingFor call
 * arm() inside the holdingForTilePlacement branch without worrying
 * about whether a previous arm is still running.
 */
export function armPlacementAnimations(): void {
  placementAnimationsArmed = true;
  if (placementAnimationsDisarmTimer !== null) {
    clearTimeout(placementAnimationsDisarmTimer);
  }
  const disarmAfter = motionMs(prefersReducedMotion() ? PLACEMENT_ANIMATION_REDUCED_MS : PLACEMENT_ANIMATION_MS) + 200;
  placementAnimationsDisarmTimer = window.setTimeout(() => {
    placementAnimationsArmed = false;
    placementAnimationsDisarmTimer = null;
  }, disarmAfter);
}

/*
 * Read-only view of the arming gate. The cube-drop coordinator
 * (`cubeDropState.ts`) reads this to tell a REAL in-play owned placement
 * (animate: hold the cube, then drop it after the tile lands) from the
 * initial page render / share-link join (show the cube immediately, no drop).
 */
export function arePlacementAnimationsArmed(): boolean {
  return placementAnimationsArmed;
}

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export type ObservationResult = {
  kind: PlacementKind;
  /*
   * How long this animation should still run. For a fresh placement
   * this equals the full animation duration. For a mid-flight remount
   * it's whatever is left of the original duration — the CSS animation
   * is applied with a negative `animation-delay` so the visual
   * fast-forwards to that elapsed point.
   */
  durationMs: number;
  delayMs: number;
};

/*
 * Called by BoardSpaceTile every mount and on every space.tileType
 * change. Returns a placement descriptor when the tile is freshly
 * appearing (or mid-flight after a remount), null otherwise.
 *
 * Updates the baseline as a side effect so subsequent observations of
 * the same space don't re-trigger the animation.
 */
export function observeTilePlacement(space: SpaceModel): ObservationResult | null {
  const incoming = space.tileType;
  const baseline = tileBaseline.get(space.id);

  if (baseline === incoming) {
    const active = activePlacements.get(space.id);
    if (active === undefined) {
      return null;
    }
    const elapsed = now() - active.startedAt;
    const remaining = active.duration - elapsed;
    if (remaining <= 0) {
      activePlacements.delete(space.id);
      return null;
    }
    return {kind: active.kind, durationMs: active.duration, delayMs: -elapsed};
  }

  tileBaseline.set(space.id, incoming);

  if (incoming === undefined) {
    activePlacements.delete(space.id);
    return null;
  }

  if (baseline !== undefined) {
    /*
     * Tile type changed without ever going through undefined — e.g.
     * an upgrade Wetlands → something, or a server-side correction.
     * Don't replay the placement animation; the new graphic just
     * swaps in. We could add a dedicated "upgrade flash" later, but
     * for now silence keeps surprises out.
     */
    activePlacements.delete(space.id);
    return null;
  }

  /*
   * Fresh placement candidate (undefined → defined). Only animate if
   * the animation window is currently armed — otherwise this is
   * almost certainly the page's initial render (F5 / direct nav /
   * share-link join) where the board already had these tiles before
   * the client loaded. Silent baseline update keeps the player from
   * watching a dozen impact rings on page load.
   */
  if (!placementAnimationsArmed) {
    return null;
  }

  const kind = kindFor(incoming);
  // Scaled by the motion speed preset (motionMs) so the JS-tracked lifetime
  // stays in lockstep with the CSS keyframes (which scale via --motion-scale).
  const duration = motionMs(prefersReducedMotion() ?
    PLACEMENT_ANIMATION_REDUCED_MS :
    (kind === 'hazard' ? HAZARD_PLACEMENT_ANIMATION_MS : PLACEMENT_ANIMATION_MS));
  activePlacements.set(space.id, {startedAt: now(), duration, kind});
  return {kind, durationMs: duration, delayMs: 0};
}

/*
 * Garbage-collect the active animation entry after the CSS animation
 * end fires. Without this the entry sticks around until the next state
 * change on that space.
 */
export function clearActivePlacement(spaceId: SpaceId): void {
  activePlacements.delete(spaceId);
}

/*
 * Did `newSpaces` add at least one new tile vs `oldSpaces`? Used by
 * WaitingFor.vue to decide whether the placement-hold path is worth
 * running. Mirrors `shouldHoldForMarkerAnimation`'s shape exactly.
 *
 * Spaces are reported in stable order, so index alignment is the
 * natural diff. We defensively guard against id mismatch (different
 * board variant or partial response) and just skip those entries.
 */
export function shouldHoldForTilePlacement(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): boolean {
  const len = Math.min(oldSpaces.length, newSpaces.length);
  for (let i = 0; i < len; i++) {
    const oldSpace = oldSpaces[i];
    const newSpace = newSpaces[i];
    if (oldSpace.id !== newSpace.id) {
      continue;
    }
    if (oldSpace.tileType === undefined && newSpace.tileType !== undefined) {
      return true;
    }
  }
  return false;
}

/*
 * Stage 1 of the placement-hold (mirrors `applyGlobalParamPreview` in
 * WaitingFor.vue). Mutates `oldSpaces` in place to apply just the
 * fresh tile placements — Vue reactivity propagates the change to the
 * BoardSpaceTile child, which fires `observeTilePlacement` from its
 * watcher and starts the CSS animation. The rest of the new view
 * (tableau resources, waitingfor, players, production) is held back
 * until Stage 2 (`updatePlayerView` after the hold).
 *
 * Also copies the player `color` and `rotated` flag for the placed
 * tile — the player cube and crashlanding rotation arrive in the same
 * frame as the tile graphic, otherwise the cube pops in late.
 */
export function applyTilePlacementPreview(
  oldSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): void {
  const len = Math.min(oldSpaces.length, newSpaces.length);
  for (let i = 0; i < len; i++) {
    const oldSpace = oldSpaces[i];
    const newSpace = newSpaces[i];
    if (oldSpace.id !== newSpace.id) {
      continue;
    }
    if (oldSpace.tileType === undefined && newSpace.tileType !== undefined) {
      oldSpace.tileType = newSpace.tileType;
      if (newSpace.color !== undefined) {
        oldSpace.color = newSpace.color;
      }
      if (newSpace.rotated !== undefined) {
        oldSpace.rotated = newSpace.rotated;
      }
    }
  }
}

/*
 * How long to hold the rest of the playerView before applying it. Reads
 * the reduced-motion preference so the hold collapses to a token wait
 * for users who opted out of motion (the framework still pre-applies
 * the tile change so they SEE the new tile before resources update —
 * just on a much tighter window).
 */
export function placementHoldDurationMs(): number {
  return motionMs(prefersReducedMotion() ? PLACEMENT_HOLD_REDUCED_MS : PLACEMENT_HOLD_MS);
}
