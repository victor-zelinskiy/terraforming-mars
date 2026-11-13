<template>
  <div class="con-board" :class="boardClasses" :data-framing="framingState" ref="root">
    <div class="con-board__stage" ref="stage">
      <GameBoardView :game="game" :players="playerView.players" :tileView="tileView" @toggleTileView="cycleTileView" />
    </div>
    <!-- THE PLACEMENT RETICLE — teleported INSIDE `.board-cont` so it is
         positioned in intrinsic board px and rides the planet's scale/pan
         transform for free. One persistent element that GLIDES between
         hexes; the hero scene taking the cell is what retires it. -->
    <ConsoleTeleport v-if="cursorHost !== undefined" :to="cursorHost">
      <!-- «МАРС ТЕРРАФОРМИРОВАН» (TR70): the ATMOSPHERE BREATHES on the real disc — a layer in board px over
           the alpha-measured circle (the placement frame), riding the planet's transform like the reticle; the
           limb's light and the mint rim are one-shot keyframes keyed on the scene's show, and the shared
           ceremony burst detonates over it. `mars.webp` itself is never touched. -->
      <div v-if="terraformedBreathUp"
           class="con-terraformed-breath"
           :class="{'con-terraformed-breath--lit': terraformedSceneState.phase === 'show'}"
           :style="terraformedBreathStyle"
           ref="terraformedBreath"
           data-terraformed-breath
           aria-hidden="true"></div>
      <!-- A MOVE (Turmoil Redux TR14) — the reticle's own family, same board
           px-space, same travel glide. THE ORIGIN: a dashed «leaving from here»
           contour on the lifted city's cell (the real tile stays — nothing has
           happened yet — only quieter). THE VECTOR: one thin line with a
           chevron from that cell toward the focused destination; it firms up
           amber at the lock. The origin yields to the hero scene with the
           reticle; the vector stays for the scene's own length and is EATEN
           behind the travelling tile (`--eaten` — one class, a CSS one-shot
           timed by the scene's own lift and carry). -->
      <div v-if="moveOriginPos !== undefined" class="con-bmove-origin" :style="moveOriginStyle" aria-hidden="true"></div>
      <div v-if="moveVector !== undefined" class="con-bmove"
           :class="{'con-bmove--locked': placementFlowState.phase !== 'navigate' || sceneMove !== undefined, 'con-bmove--eaten': sceneMove !== undefined}"
           :style="moveVector" aria-hidden="true">
        <span class="con-bmove__line"></span>
        <span class="con-bmove__head"></span>
      </div>
      <!-- WHERE THE CUBES WILL STAND (TR79 Ferrus Academy's first city): a SILHOUETTE of the player's own cube on every
           cell the focused preview reserves (`BoardFact.reservesSpaces` — the server's ring, the commit's predicate), seated
           exactly where the real owner cube will sit. Material, never light: the cube itself, translucent — no halo, no
           breath (invariant 15). It stands with the reticle (the lock included) and yields with it to the hero scene, whose
           cubes then land one by one on these very seats. -->
      <span v-for="ghost in reserveGhosts" :key="ghost.spaceId"
            class="con-reserve-ghost"
            :style="ghost.style"
            data-reserve-ghost
            :data-reserve-space="ghost.spaceId"
            aria-hidden="true">
        <PlayerCube class="board-owner-cube" :color="ghost.color" :size="12" />
      </span>
      <transition name="con-bcur-out">
        <ConsoleBoardCursor
          v-if="(cursorVisible || cursorMarker) && cursorPos !== undefined"
          :x="cursorPos.x" :y="cursorPos.y"
          :legal="cursorMarker || selectedAvailable"
          :phase="cursorMarker ? 'committing' : placementFlowState.phase"
          :tileArtClass="cursorArtClass"
          :cubeColor="cursorCubeColor"
          :bonusZone="cursorBonusZone"
          :pickup="!cursorMarker && (movePick || placementShape?.placementEffect === 'remove')"
          :afloat="placementShape?.placementType === 'city-over-ocean'"
          :marker="cursorMarker"
          :data-landing-marker="cursorMarker ? tilePlacementState.spaceId : undefined" />
      </transition>
    </ConsoleTeleport>
    <!-- Cell details live in the shell-level ConsoleContextPanel (feedback
         iteration 2) — this component owns the STAGE + selection only. -->
  </div>
</template>

<script setup lang="ts">
/*
 * P27: the selection spotlight paints ONLY while the board is LIVE
 *       (inspection mode / placement) — on the calm board home no cell reads
 *       as focused, so nothing competes with ocean/availability highlights.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/**
 * Console Board section (docs/CONSOLE_MODE_CONCEPT.md §7). Reuses the REAL board
 * (GameBoardView — auto-scaled, premium) and adds controller-native cell
 * selection: geometric hex traversal (spatialNav over cell rects), a
 * spotlight class on the selected cell, and the dossier panel fed by the
 * existing BoardInformation pipeline (boardInfoState → BoardCellInfo facts).
 *
 * Placement (SelectSpace active, hosted headless in the shell's WaitingFor):
 * navigation is CONSTRAINED to `.board-space--available` (P20: the R3
 * TOGGLE switches free-roam over everything — LT/RT keep their global
 * Info/Actions meaning), A clicks the selected cell — the existing
 * per-cell onclick contract, byte-identical submission.
 *
 * The shell drives this component through refs (move/seed/activate) — the
 * router owns WHEN, this component owns HOW (it has the DOM).
 */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import ConsoleTeleport from '@/client/components/console/foundation/ConsoleTeleport.vue';
import GameBoardView from '@/client/components/GameBoardView.vue';
import ConsoleBoardCursor from '@/client/components/console/ConsoleBoardCursor.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {SpaceId} from '@/common/Types';
import {Color} from '@/common/Color';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {NavRect, pickDirectional, pickNearest, pickStrictGrid, rectCenter} from '@/client/gamepad/spatialNav';
// `boardInfoState`: the hover pipeline's answer — the INSPECTION's relation layer follows it (TR67).
import {boardInfoState, hoverBoardCell, prefetchBoardCells, setBoardCellHoverQuiet} from '@/client/components/board/boardInfoState';
import {consoleState} from '@/client/console/consoleRouter';
import {TileView, nextTileView} from '@/client/components/board/TileView';
import {
  planetFocusState, captureGlobalParams, PlanetFocusPhase, PlanetFocusMode,
} from '@/client/console/planetFocus';
import {terraformedSceneState} from '@/client/console/terraformedScene/terraformedScene';
import {CeremonyBurstHandle, playCeremonyBurst} from '@/client/console/ceremony/ceremonyFx';
import {boardBeatDisplayParams, boardBeatDisplayClaims, boardBeatDisplayHeld} from '@/client/console/boardBeatPark';
import {registerBoardGeometryProbe, boardSpaceEpoch, bumpBoardSpaceEpoch} from '@/client/console/boardSpaceGeometry';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {deferSceneReveal, loadingScreenState} from '@/client/console/loadingScreenState';
import {cssLengthPx} from '@/client/console/cssUnits';
import {placementFlowState} from '@/client/console/tilePlacement/placementFlow';
import {tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import {PlacementShape, swatchForKind} from '@/client/console/placementDossier';
import {PlacementRelation, relationsFromInfo, relationsFromPreview, reservedSpacesOf} from '@/client/console/placementRelations';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {tileCssClassOf} from '@/client/components/board/boardSpaceTileModel';
import {TileType} from '@/common/TileType';
import {initialPlacementCursor} from '@/client/console/tilePlacement/placementCursorStart';
import type {BonusZone} from '@/client/components/console/ConsoleBoardCursor.vue';
import {boardLayoutKind} from '@/client/components/board/largeBoardLayout';

// The two measurement caches and the registry of marked cells — MODULE state, one of each per page (R25).
import {bonusZoneCache, cellPosCache, relationMarked} from '@/client/components/console/consoleBoardSectionState';

const SELECT_CLASS = 'con-cell-sel';

/** A MOVE's lifted city — its cell while the player picks where it lands (console.less § the move). */
const MOVE_SOURCE_CLASS = 'board-space--move-source';

/** P27: the focused global-parameter TRACK marker (inspection mode). */
const MARKER_CLASS = 'con-marker-sel';

/** A navigable target: a board CELL or a track MARKER (inspection only). */
type BoardCandidate = {kind: 'cell' | 'marker', id: string, el: HTMLElement, rect: NavRect};

/**
 * The full visual footprint of the board incl. its arc scales — the same
 * natural-size constants the desktop auto-scale engine uses
 * (useBoardAutoScale.ts). The console computes its OWN scale from the
 * actual stage box (the desktop engine reserves desktop chrome — left
 * panel / sidebar / bars — none of which exist here; using it clipped the
 * board top+bottom, the feedback-iteration bug #1).
 */
/**
 * The CONSOLE footprint — a STARTING approximation only (P29). The P27c
 * hand-measured constants kept drifting from the real content box (arcs /
 * off-Mars flanks / ocean scale recompose per expansion set), leaving dead
 * margins around the planet on the Deck. The fit engine now SELF-CALIBRATES:
 * after each fit it measures the union bbox of the actual stage content,
 * derives the effective natural size (union / applied scale) AND the true
 * visual centre, then re-fits + re-centres via CSS vars. The constants
 * below only seed the first frame.
 */
const BOARD_NATURAL_W = 644;
const BOARD_NATURAL_H = 556;

/** «Впритык»: just enough breathing room that edge glows aren't clipped
 *  by the stage's overflow:hidden. */
const STAGE_PAD = 4;
const STAGE_PAD_Y = 2;
const MIN_SCALE = 0.6;
const MAX_SCALE = 4;

/**
 * P29b — the calibration measures ONLY the SEMANTIC visible content, never
 * generic containers: every arc scale is a transparent 600×600 SVG CANVAS
 * (`.arc-scale__svg`) whose DOM rect is the whole square, not the visible
 * band — a generic `*` union over those quadrants OVERSTATED the natural
 * box and the board actually shrank. SVG *children* (paths / text) report
 * tight geometry bboxes, so the union below is the true visible footprint:
 * hex cells (incl. off-Mars), the arc band contours, the scale digits,
 * the identity glyphs and the bonus/event chips.
 */
const CONTENT_SELECTOR = [
  '.board-space[data_space_id]',
  '.arc-scale__rail',
  '.arc-scale__edge',
  '.arc-scale__digit',
  '.arc-scale__identity',
  '.arc-marker',
  '[data-arc-marker]',
  // Planetary-event chips (ocean/Ares thresholds) sit OUTSIDE the band.
  '.scale-event',
].join(', ');

/** The arc BAND alone — the ceremony's instrument frame (TR70) unites it with the disc; the flanks stay out. */
const ARC_BAND_SELECTOR = [
  '.arc-scale__rail',
  '.arc-scale__edge',
  '.arc-scale__digit',
  '.arc-scale__identity',
  '.arc-marker',
  '[data-arc-marker]',
  '.scale-event',
].join(', ');

/**
 * The arc CURSOR's overhang past the band it rides, in BOARD px — the one
 * piece of visible board content the union above deliberately does not
 * measure (see `publishArcBleed`). From `scale_marker.less`: the marker box
 * is 34px, its radial tick reaches 11px beyond that box (`--tick { bottom:
 * -11px }`) and carries a 12px glow — 17 + 11 + 12 = 40 from the digit
 * centre — while the fitted stage edge sits only ~10 past that same centre
 * (measured at 4K: digit centre 1897, stage bottom 1932, scale 3.36). So
 * 40 − 10, taken as 32.
 *
 * Being generous costs nothing (the room below is the dock's own reserved
 * clearance, ~122px at 4K, and above it the status strip occludes); being
 * short puts a hard line back through the glow.
 */
const ARC_MARKER_BLEED = 32; /* keep-px: board px-space */

/** Sanity clamps for the MEASURED natural box — a mid-transition / stray
 *  measurement can never explode or collapse the board. */
const NATURAL_W_MIN = 480;
const NATURAL_W_MAX = 760;
const NATURAL_H_MIN = 400;
const NATURAL_H_MAX = 620;

/** Re-fit only on a meaningful drift (px of natural size / px of offset). */
const CALIBRATE_SIZE_EPS = 3;
const CALIBRATE_OFFSET_EPS = 2;

/**
 * Bounded convergence per FRAME (see `fitKey`) — a runaway guard, not a
 * budget. It used to be 2 per "fit cycle", where a cycle was re-opened by any
 * stage resize: a board that measured mid-deal (arcs and off-Mars flanks not
 * composed yet) spent both passes on an incomplete union, locked in a natural
 * box several percent off, and then finished converging much later — at
 * whatever moment next re-opened the budget, which in practice was the player
 * coming back from the hand. Traced on the device: the disc re-framed itself
 * ~800ms after the board returned (997→902px wide over two round trips),
 * gliding all the way, because the transform transition is permanent now.
 * The convergence must therefore RUN TO STABILITY where it starts, and the
 * frame it converged for is what licenses it to run again.
 */
const CALIBRATE_MAX_PASSES = 6;

/**
 * P29c — the tuned console board scale multiplier. ×1.05 was dialled in
 * LIVE on the Deck against the OLD off-Mars layout; after the P29c cell
 * re-lay the self-calibration measures the TIGHTER union and the plain
 * fit already lands where ×1.05 used to — the honest multiplier is 1
 * (kept as the single knob should hardware tuning ever be needed again).
 */
const SCALE_BOOST = 1.0;

/**
 * PLANET FOCUS framing — the camera moves IN on the planet while the arc
 * scales / off-Mars flanks recede (planetFocus.ts owns the phases; the CSS
 * owns the motion). The Mars disc is a FIXED asset painted from
 * `.board-cont`'s top-left at 620×600 (board.less), so the focus fit is
 * fully DETERMINISTIC — no measurement, no calibration passes, nothing to
 * poison mid-transition.
 *
 * The frame is the ALPHA-MEASURED disc of mars.webp, not the asset canvas:
 * the visible planet is a 449×449 circle at (93..541, 85..533) inside the
 * mostly-transparent 620×600 box (measured off the real alpha channel —
 * the first frame targeted the canvas and burned a third of the growth on
 * empty pixels). One pixel of margin keeps the rim's antialiasing; the
 * fit puts this circle EDGE-TO-EDGE in the stage — the planet's border
 * lands on the border of the freed screen area, which is the mode's whole
 * promise.
 */
const PFOCUS_FRAME = {x: 92, y: 84, w: 451, h: 451}; /* keep-px: board-cont local space */

/**
 * The ELEVEN-ROW field's frames (Amazonis Planitia — `board_large_positions.less`): the planet grows ×1.147 behind
 * the grid (the visible disc r 258 around the ring's centre 316 / 312; the grid 12 px lower), and the grid's corner
 * hexes overhang the rim — so the focus frames the disc UNITED with the grid (x 48…584, y 93…555); the terraformed breath keeps the disc.
 */
const LARGE_PFOCUS_FRAME = {x: 48, y: 53, w: 536, h: 518}; /* keep-px: board-cont local space */
const LARGE_DISC_FRAME = {x: 58, y: 54, w: 516, h: 516}; /* keep-px: board-cont local space */

/**
 * THE INSTRUMENT FRAME — the ceremony's (TR70 «МАРС ТЕРРАФОРМИРОВАН»): the disc WITH its three arcs, because
 * the scales finishing their story IS the show. Measured ONCE per engagement off the arcs' own geometry
 * (`CONTENT_SELECTOR` minus the off-Mars flanks — the band's rails, edges, digits, identities, markers) in
 * board px while the board is at rest (the camera has not moved yet when the enter fit runs), cached for the
 * engagement so the ResizeObserver's later fits never re-measure a gliding board. The fallback is the
 * measured Tharsis band (every scale at its maximum — the ceremony's only state).
 */
const CEREMONY_FRAME_FALLBACK = {x: 8, y: 44, w: 586, h: 512}; /* keep-px: board-cont local space */

/** The burst detonates this long after the show starts — the markers are mid-glide, the rim is lit. */
const TERRAFORMED_BURST_DELAY_MS = 700;

/** `.board-cont`'s own box (the transform-origin is its centre). */
const BOARD_CONT_W = 670;
const BOARD_CONT_H = 600;

/**
 * The focus fit's own scale ceiling. The overview clamp (MAX_SCALE = 4)
 * protects the normal fit from degenerate measurements; the focus fit is
 * deterministic and legitimately exceeds it on 4K once the bleed below the
 * stage is counted in (disc 451 → usable ~1900px ⇒ ~4.2).
 */
const PFOCUS_MAX_SCALE = 4.8;

/** Painted transform must match its CSS target on consecutive frames before
 *  calibration may measure again. A duration timer is not sufficient here:
 *  under a saturated 4K renderer it can fire before the compositor has
 *  presented even the first transition frame. */
const TWEEN_STABLE_FRAMES = 2;
const TWEEN_SCALE_EPS = 0.001;
const TWEEN_OFFSET_EPS = 0.5;

/** Past the arc markers' own glide (≤1280ms) — see `armLateVerify`. */
const LATE_VERIFY_MS = 1500;

/** Rungs of the late-verification ladder (1.5s, 3s, 4.5s, 6s from each arm). */
const LATE_VERIFY_MAX = 4;

defineOptions({name: 'ConsoleBoardSection'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  placementActive: {type: Boolean, required: true},
  /** WHAT this placement puts down (the shell's one prompt resolver) —
   *  drives the reticle's tile projection. */
  placementShape: {type: Object as PropType<PlacementShape | undefined>, default: undefined},
  /**
   * The focused cell's placement preview — the SAME object the dossier
   * renders (the shell fetches it once), so the on-field relation marks and
   * the panel's arithmetic can never disagree. Undefined while none is
   * loaded / the cell is illegal.
   */
  cellPreview: {type: Object as PropType<BoardPlacementPreview | undefined>, default: undefined},
  /** P27: BOARD INSPECTION MODE (L3) — strict row/column cell traversal. */
  inspecting: {type: Boolean, default: false},
  /**
   * THE SERVER'S OWN LEGAL DESTINATIONS for the live placement (the shell's
   * one prompt resolver hands them down — never re-resolved here).
   *
   * ⚠️ Legality may NOT be read back out of the DOM inside a computed: the
   * `board-space--available` classes are painted imperatively by the board
   * binder, so `classList.contains(...)` has no reactive dependency and Vue
   * caches the verdict against whatever else the expression happens to read.
   * That froze `selectedAvailable` to `false` whenever the cursor was seeded
   * before the paint — the reticle drew ILLEGAL over an available hex and
   * the relation marks never rendered. Same defect, same fix, as the shell's
   * `selectedCellLegal`.
   */
  legalSpaces: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  /**
   * A MOVE's CITY LEVEL (Turmoil Redux TR14 — «which of your cities
   * leaves»): the reticle rings the REAL tile under it and projects nothing.
   */
  movePick: {type: Boolean, default: false},
  /** A move's LIFTED city (its cell) — the origin of the move's on-field marks; undefined when none is lifted. */
  moveFrom: {type: String as PropType<string | undefined>, default: undefined},
});

const flow = useFlowScope('board-section');
const stage = useTemplateRef<HTMLElement>('stage');
const terraformedBreath = useTemplateRef<HTMLElement>('terraformedBreath');
const root = useTemplateRef<HTMLElement>('root');
/** The ceremony's instrument frame, measured once per camera engagement (`planetFocusState.nonce`). */
const ceremonyFrame = ref<{x: number, y: number, w: number, h: number} | undefined>(undefined);
const ceremonyFrameNonce = ref(-1);
/** The terraformed scene's burst over the real disc (`ceremonyFx`) — stopped on the scene's end / unmount. */
let terraformedFx: CeremonyBurstHandle | undefined;
/** The reticle's teleport target (`.board-cont`) — resolved once at
 *  mount; the board never remounts (the console update model). */
const cursorHost = ref<HTMLElement | undefined>(undefined);
/** The move vector's running angle (deg) — kept continuous so a step across 360° turns the short way. */
const moveAngle = ref(0);
const tileView = ref('show' as TileView);
let stageObserver: ResizeObserver | undefined;
/** The pending fit frame — its cancel (`flow.afterFrame`); `undefined` = none owed (a REACTIVE mark: the framing
 *  verdicts below read it, as they read `calibrateRaf` and `lateVerifyTimer`). */
const fitRaf = ref<(() => void) | undefined>(undefined);
/** SCENE TRANSITION: the boot curtain's «board geometry converged»
 *  hold — released at the FIRST settled calibration pass (or when the
 *  stage is hidden behind a start scene), so the board is never
 *  revealed mid-convergence («планета сдвигается» after the reveal). */
let fitSettleRelease: (() => void) | undefined;
/** The stage's calibrated centring vars, saved at focus enter so the
 *  exit restores the exact pre-focus framing (calibration folds its
 *  offsets cumulatively — overwriting them would lose the truth). */
const savedBoardDx = ref<string | undefined>(undefined);
const savedBoardDy = ref<string | undefined>(undefined);
/** The EXACT pre-focus framing, captured at enter. The return is a
 *  REVERSAL, not a re-derivation: it restores these verbatim. */
const savedScale = ref(0);
const savedNaturalW = ref(0);
const savedNaturalH = ref(0);
/** The viewport at enter — the one honest "may I replay?" signal. */
const savedViewW = ref(0);
const savedViewH = ref(0);
/**
 * Calibration is LOCKED to this viewport: a replayed framing is
 * already the converged one, so any further "improvement" is just an
 * unanimated correction landing after the landing. Only a real
 * viewport change lifts the lock (the stage's own handback must not —
 * it goes through scheduleFit, which re-opens the pass budget).
 */
const calibrateLock = ref<{w: number, h: number} | undefined>(undefined);
/**
 * THE FRAME THE CURRENT FRAMING WAS DERIVED FOR — the stage box and the
 * viewport, as one key. The board is `v-show`n, so EVERY section round
 * trip (hand / colonies / hydro / the journal) takes the stage to 0×0
 * and back; the ResizeObserver sees two resizes and used to answer both
 * with a full re-derivation, calibration budget included. But a
 * visibility flip is not a geometry change: the framing the board comes
 * back to is the one it left with, already on screen and already
 * correct. Re-deriving it there is pure loss — it is how an unfinished
 * boot convergence surfaced as «планета сдвигается» when the player
 * closed the hand. Only a key CHANGE (a real resize, a profile flip)
 * licenses a new fit.
 */
const fitKey = ref<string | undefined>(undefined);
/**
 * WHICH FRAMING that key belongs to — the second half of the same
 * identity, and it is load-bearing.
 *
 * Planet Focus engages on the RAW prompt, which routinely arrives while
 * a WORKSPACE still owns the screen (a card played from the hand: the
 * placement is held behind the played-hero and the outcome's reward
 * beats, the board is `v-show`n away). The stage is 0×0 there, so the
 * focus fit is SKIPPED — and the mode's own `entering → active` re-fit
 * lands in that same hidden window whenever the outcome outlasts the
 * enter transition, which it routinely does. The board then comes back
 * to THE SAME BOX it left with, so the key alone said «already fitted»
 * and nothing ever fitted the focus: the player got the whole mode —
 * receded arcs, veil, compact dock — around a planet at OVERVIEW size.
 *
 * The mode is deliberately NOT folded into `fitKey`: an exit that lands
 * while the board is hidden cannot re-measure the box, and it must still
 * be able to say «this geometry is now a NORMAL framing» without
 * inventing one — see `restoreNormalFraming`.
 */
const fitMode = ref('normal' as 'normal' | 'focus');
/** The first fit has landed — from here every scale change GLIDES. */
const fitted = ref(false);
/** A board transform is in flight: measurements are meaningless until
 *  it rests (calibration would otherwise chase a moving planet). */
const boardTweening = ref(false);
let tweenRaf: (() => void) | undefined;
const tweenStableFrames = ref(0);
/** P29: the self-calibrated natural content box (seeded by constants). */
const naturalW = ref(BOARD_NATURAL_W);
const naturalH = ref(BOARD_NATURAL_H);
/** The scale the last fit actually applied (measure divides by it). */
const appliedScale = ref(1);
const calibrateRaf = ref<(() => void) | undefined>(undefined);
const calibratePasses = ref(0);
/**
 * The frame whose convergence has already had its LATE VERIFICATION.
 * The union bbox is bounded left and right by the ARC MARKERS, and a
 * marker GLIDES to its value (≤1280ms) — so a convergence that starts
 * while the board is composing can settle, self-consistently, on a
 * footprint that no longer exists a second later, and then never look
 * again. One deferred re-check per frame closes that: on a settled
 * board it is a no-op, and it can only ever fire while the entry
 * cinematic still covers the board — never during play, because the
 * frame key does not change during play.
 */
const lateVerifyKey = ref<string | undefined>(undefined);
const lateVerifyRuns = ref(0);
const lateVerifyTimer = ref<(() => void) | undefined>(undefined);
/** P27b: the vertical-run COLUMN anchor (set on horizontal moves /
 *  landings; keeps an up/down run in ONE visual hex column). */
const colAnchor = ref<number | undefined>(undefined);
/** The focused cell's bonus cluster (cell-local board px) — feeds the
 *  reticle's ghost quiet-zone mask; undefined = no printed bonuses. */
const cursorBonusZone = ref<BonusZone | undefined>(undefined);
/** The board-space geometry probe's unregister (boardSpaceGeometry). */
let offGeometryProbe: (() => void) | undefined;

/** Read-only convergence signal for diagnostics and the framing e2e.
 *  "Settled" means normal overview framing with no scheduled work left,
 *  not merely a quiet interval between late-verification rungs. */
const framingState = computed((): 'busy' | 'settled' => {
  const focusBusy = planetFocusState.phase !== 'idle' || planetFocusState.arcsReturning;
  return !fitted.value || fitKey.value === undefined || focusBusy || fitRaf.value !== undefined ||
    boardTweening.value || calibrateRaf.value !== undefined || lateVerifyTimer.value !== undefined ? 'busy' : 'settled';
});
/**
 * THE COORDINATE SPACE IS CALM — a board-bound flight may measure/launch
 * (`boardSpaceGeometry.ts`). Deliberately FINER than `framingState`: an
 * ACTIVE Planet Focus is a fully-grown, static stage (the placement's
 * own scenes measure against it all the time), so only the camera's
 * TRANSITIONS and a pending/running fit pass count as motion.
 */
const boardGeometryCalm = computed((): boolean => {
  const phase = planetFocusState.phase;
  return (phase === 'idle' || phase === 'active') &&
    !boardTweening.value && fitRaf.value === undefined && calibrateRaf.value === undefined;
});
/**
 * The game the board DISPLAYS. While Planet Focus holds the scene, the
 * four global parameters are served from the frozen snapshot — a commit
 * that lands mid-scene (the tile hero holds it through the flight, the
 * reward beats run after it) must not glide the arc scales behind the
 * receded band. The release (planetFocus's scale beat, after the exit
 * transition seats the arcs back) simply lets the live values through —
 * the existing AnimatedScaleMarker / ArcScale watchers then play the
 * glide exactly once, at the one moment it can be read.
 */
const game = computed((): GameModel => {
  // THE BOARD-BEAT PARK is the ONE presenter of this law
  // (`boardBeatPark.ts`, since the one-owner merge): a parameter that
  // moved while the board was COVERED — a workspace flow raised Venus,
  // or a commit landed inside an engaged Planet Focus (the watchable
  // probe counts the focused stage as covered) — keeps its pre-change
  // value, and its pre-change scale-bonus claim map, until the drain
  // releases them over a watchable board with the glide + the accent.
  // …and a PARAMETER SWING (TR47 «ОБРАТНЫЙ ХОД») presents its peak until each leg's turn — the same merge.
  if (!boardBeatDisplayHeld()) {
    return props.playerView.game;
  }
  return {
    ...props.playerView.game,
    ...boardBeatDisplayParams(captureGlobalParams(props.playerView.game)),
    scaleBonusClaims: boardBeatDisplayClaims(props.playerView.game.scaleBonusClaims),
  };
});
/** Planet-focus phase → root classes (the CSS owns the actual motion). */
const boardClasses = computed((): Record<string, boolean> => {
  const phase = planetFocusState.phase;
  return {
    'con-board--live': props.placementActive || props.inspecting,
    'con-board--inspecting': props.inspecting && !props.placementActive,
    // Placement flow poses (placementFlow.ts): the LOCK recedes every
    // other legal cell so the chosen one dominates without contest.
    'con-board--placing': props.placementActive,
    'con-board--locked': props.placementActive && placementFlowState.phase !== 'navigate',
    // A MOVE's two levels: picking the city / a city lifted.
    'con-board--move-pick': props.placementActive && props.movePick,
    // …the «leaving from here» pose lets go the moment the SCENE owns the move: the proxy is the object now.
    'con-board--move-lifted': props.placementActive && props.moveFrom !== undefined && !sceneOwnsMove.value,
    'con-board--pfocus': phase === 'entering' || phase === 'active' || phase === 'exit-prep',
    'con-board--pfocus-anim': phase === 'entering' || phase === 'exit-prep' || phase === 'exiting',
    'con-board--pfocus-settled': phase === 'active',
    // The CEREMONY's camera (TR70): the same mode, the arcs STAYING — they are the story. Kept through the
    // exit, so the return never re-materializes instruments that never left.
    'con-board--pfocus-ceremony': phase !== 'idle' && planetFocusState.mode === 'ceremony',
    // The RETURN, as its own state: the reclaimed chrome stays out and
    // the arc band stays hidden for the whole shrink, so the stage's
    // clip box always covers the board that is still oversized. Giving
    // the space back at the START of the return is what cut the
    // returning planet + arcs along the dock line.
    'con-board--pfocus-exit': phase === 'exit-prep' || phase === 'exiting',
    // The board has a real fitted scale → its transform may transition.
    // Withheld until then so the FIRST fit doesn't animate the planet up
    // from scale(1) on every mount.
    'con-board--fitted': fitted.value,
  };
});
const selectedSpaceId = computed((): string | undefined => {
  return consoleState.boardSpaceId;
});
/** The board's selection is a cursor the player SEES — an inspection or a placement is live. */
const cursorShown = computed((): boolean => {
  return props.inspecting || props.placementActive;
});
/** The breath layer stands from the camera's arrival to the scene's end (its keyframes play at the show). */
const terraformedBreathUp = computed((): boolean => {
  const phase = terraformedSceneState.phase;
  return phase === 'focus' || phase === 'show' || phase === 'return';
});
/** The alpha disc in board px (keep-px — the layer rides the planet's transform). */
const terraformedBreathStyle = computed((): Record<string, string> => {
  const disc = largeLayout.value ? LARGE_DISC_FRAME : PFOCUS_FRAME;
  return {left: `${disc.x}px`, top: `${disc.y}px`, width: `${disc.w}px`, height: `${disc.h}px`};
});
/** The eleven-row field (Amazonis Planitia) — its own planet and focus frame. */
const largeLayout = computed((): boolean => {
  return boardLayoutKind(props.playerView.game.gameOptions?.boardName) === 'large';
});
/** The placement focus frame of THIS board (the alpha disc; on the eleven-row field the disc ∪ the grid). */
const focusFrame = computed((): {x: number, y: number, w: number, h: number} => {
  return largeLayout.value ? LARGE_PFOCUS_FRAME : PFOCUS_FRAME;
});
const selectedAvailable = computed((): boolean => {
  const id = selectedSpaceId.value;
  return id !== undefined && props.legalSpaces.includes(id);
});
/**
 * The reticle exists for the whole placement and only the placement —
 * the moment the hero SCENE owns the cell (detect verified the server's
 * word and the flight/departure begins) the projection yields: the
 * arriving physical tile is the object now. `armed` (submit on the
 * wire, nothing visual yet) keeps the committing pose — that IS the
 * pending feedback.
 */
const cursorVisible = computed((): boolean => {
  if (!props.placementActive || selectedSpaceId.value === undefined) {
    return false;
  }
  const scene = tilePlacementState;
  if (scene.active && scene.phase !== 'armed' && scene.phase !== 'failed') {
    return false;
  }
  return true;
});
/**
 * THE LANDING MARKER (the tile language, W1 — the owner, 2026-10-20): past the commit, while the hero scene flies an
 * ORDINARY tile in (or grows it, or pays its price into the cell first), the reticle does not yield — it stays on the
 * armed cell as the tile's reserved place until the CONTACT (`touched` — the frame the tile touches it, never the
 * handoff ~0.4 s later), then leaves under the landed tile. A move,
 * a tier and a remove-and-replace keep their own scenes (the reticle yields to them as before).
 */
const cursorMarker = computed((): boolean => {
  const scene = tilePlacementState;
  return scene.active && (scene.phase === 'paying' || scene.phase === 'approaching') && !scene.touched &&
    scene.move === undefined && scene.stack === undefined && scene.departingTile === undefined &&
    scene.spaceId !== '';
});
/** The reticle's anchor cell: the LOCK freezes it on the locked cell (the marker, on the armed one). */
const cursorSpaceId = computed((): string | undefined => {
  if (cursorMarker.value) {
    return tilePlacementState.spaceId;
  }
  const flow = placementFlowState;
  if (flow.phase !== 'navigate' && flow.lockedSpaceId !== undefined) {
    return flow.lockedSpaceId;
  }
  return selectedSpaceId.value;
});
const cursorPos = computed((): {x: number, y: number} | undefined => {
  // THE MEASUREMENT IS LAYOUT, so this computed subscribes to the board's
  // own geometry epoch (bumped on every converged fit — `boardGeometryCalm`)
  // BEFORE it measures. A placement routinely becomes ACTIVE while the
  // stage is still `display: none` (the hand's landing ritual plays over
  // it — the staged cell is live from the press): measured then, the
  // stage is 0 px wide, the answer is «no position», and a computed whose
  // only other dependencies are the cell id and the host would keep that
  // answer for as long as the cursor stays on that cell. TR39 Canyon
  // Carving was the first placement whose first legal cell WAS the cell
  // seeded at boot (the ocean on 33) — the reticle never existed on its
  // source level, while TR14 escaped by moving the cursor to its city.
  // With the epoch read, the fit that follows the stage's reveal
  // re-evaluates the position.
  void boardSpaceEpoch();
  const id = cursorSpaceId.value;
  const host = cursorHost.value;
  if (id === undefined || host === undefined) {
    return undefined;
  }
  const key = `${props.playerView.game.gameOptions?.boardName ?? ''}|${id}`;
  const hit = cellPosCache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  const el = cellEl(id);
  if (el === undefined) {
    return undefined;
  }
  const hr = host.getBoundingClientRect();
  if (hr.width < 40) {
    return undefined; // board hidden — nothing to place the reticle on (re-asked on the next fit, see above)
  }
  const scale = hr.width / BOARD_CONT_W;
  const r = el.getBoundingClientRect();
  const pos = {x: (r.left - hr.left) / scale, y: (r.top - hr.top) / scale};
  cellPosCache.set(key, pos);
  return pos;
});
/** The projected tile's real board art ('' = a marker pick, ring only).
 *  Same resolution as the dossier's swatch: an explicit tileType wins,
 *  else the ordinary art of the placement KIND (convert plants arrives
 *  as `placementType: 'greenery'` with no tileType). */
const cursorArtClass = computed((): string => {
  const shape = props.placementShape;
  if (shape === undefined || shape.placementEffect === 'marker' || shape.placementEffect === 'bonus-only') {
    return '';
  }
  // A move's CITY LEVEL: the object is the real tile standing on the cell —
  // a ghost of a tile over a tile would be a second object.
  if (props.movePick) {
    return '';
  }
  // A REMOVAL (RX33, the Reds, TR47): the object is the real tile that LEAVES — the reticle rings it and the
  // see-through shows what lies under it; an ocean projected over the ocean was that second object (К-E2).
  if (shape.placementEffect === 'remove') {
    return '';
  }
  const tt = shape.tileType ?? swatchForKind(shape.placementType);
  if (tt === undefined) {
    return '';
  }
  const suffix = tileCssClassOf(tt, props.playerView.game.gameOptions?.expansions?.ares === true);
  return suffix === '' ? '' : 'board-space-tile--' + suffix;
});
/**
 * THE CUBE SILHOUETTES of a reserving placement (TR79 Ferrus Academy's first city): the cells the focused cell's own
 * preview names (`reservedSpacesOf` — never a client geometry), each seated at the cell's top-left in board px so the
 * owner cube's own rule (`.board-owner-cube`) puts the silhouette exactly where the real cube will stand. Only while
 * the reticle stands on a legal cell whose preview has arrived — a stale answer for another cell draws nothing.
 */
const reserveGhosts = computed((): ReadonlyArray<{spaceId: string, color: Color, style: Record<string, string>}> => {
  void boardSpaceEpoch();
  const preview = props.cellPreview;
  const id = cursorSpaceId.value;
  const color = props.playerView.thisPlayer?.color;
  if (!cursorVisible.value || !selectedAvailable.value || preview === undefined || preview.space !== id || color === undefined) {
    return [];
  }
  const out: Array<{spaceId: string, color: Color, style: Record<string, string>}> = [];
  for (const spaceId of reservedSpacesOf(preview)) {
    const centre = cellIntrinsicCentre(spaceId);
    if (centre === undefined) {
      continue;
    }
    const x = centre.x - 23; /* keep-px: half a 46×51 hex */
    const y = centre.y - 25.5;
    out.push({spaceId, color, style: {transform: `translate(${x}px, ${y}px)`}});
  }
  return out;
});
/** The ownership marker on the projection — every owned tile seats one;
 *  an ocean is neutral and never does (resolved tile, kind-only included). */
const cursorCubeColor = computed((): string | undefined => {
  const tt = props.placementShape?.tileType ?? swatchForKind(props.placementShape?.placementType);
  if (cursorArtClass.value === '' || tt === TileType.OCEAN) {
    return undefined;
  }
  return props.playerView.thisPlayer?.color;
});
/** The lifted city's cell (top-left, board px) while the move's marks may show — they yield with the reticle. */
const moveOriginPos = computed((): {x: number, y: number} | undefined => {
  if (!cursorVisible.value || props.moveFrom === undefined) {
    return undefined;
  }
  const centre = cellIntrinsicCentre(props.moveFrom);
  return centre === undefined ? undefined : {x: centre.x - 23, y: centre.y - 25.5}; /* keep-px: half a 46×51 hex */
});
const moveOriginStyle = computed((): Record<string, string> => {
  const pos = moveOriginPos.value;
  return pos === undefined ? {} : {transform: `translate(${pos.x}px, ${pos.y}px)`};
});
/**
 * THE SCENE OWNS THE MOVE — from the moment the hero verified the server's
 * word to the end of its transaction (the landing AND its rewards): the
 * pick's own «leaving from here» pose is released for that whole time. The
 * city is the proxy's, then the destination's — the cell it left is never
 * dimmed again while the pick's state is still winding down.
 */
const sceneOwnsMove = computed((): boolean => {
  const scene = tilePlacementState;
  return scene.active && scene.move !== undefined && scene.phase !== 'armed' && scene.phase !== 'failed';
});
/**
 * …and WHILE THE ONE PROXY TRAVELS, the two cells of the relocation, straight
 * from the transaction: the vector stays standing so the tile can eat it.
 * Undefined otherwise — reduced motion included (nothing travels, so there
 * is nothing to eat).
 */
const sceneMove = computed((): {from: string, to: string} | undefined => {
  const scene = tilePlacementState;
  if (!sceneOwnsMove.value || scene.move === undefined || scene.phase !== 'moving' || scene.reducedMotion) {
    return undefined;
  }
  return {from: scene.move.from, to: scene.spaceId};
});
/** The vector's geometry: from the lifted city's centre toward the focused LEGAL destination (board px). */
const moveVectorGeometry = computed((): {x: number, y: number, length: number, angle: number} | undefined => {
  const scene = sceneMove.value;
  if (scene === undefined && (moveOriginPos.value === undefined || !selectedAvailable.value)) {
    return undefined;
  }
  const a = cellIntrinsicCentre(scene?.from ?? props.moveFrom);
  const b = cellIntrinsicCentre(scene?.to ?? cursorSpaceId.value);
  if (a === undefined || b === undefined) {
    return undefined;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length < 1 ? undefined : {x: a.x, y: a.y, length, angle: Math.atan2(dy, dx) * 180 / Math.PI};
});
const moveVector = computed((): Record<string, string> | undefined => {
  const g = moveVectorGeometry.value;
  if (g === undefined) {
    return undefined;
  }
  return {
    width: `${g.length.toFixed(1)}px`,
    transform: `translate(${g.x.toFixed(1)}px, ${g.y.toFixed(1)}px) rotate(${moveAngle.value.toFixed(1)}deg)`,
  };
});

function cycleTileView(): void {
  tileView.value = nextTileView(tileView.value);
}
/** Fit the board to the console stage: write --board-scale ourselves. */
function fitBoard(): void {
  const stageNow = stage.value ?? undefined;
  if (stageNow === undefined) {
    return;
  }
  const r = stageNow.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) {
    return; // hidden (hand section) / not laid out yet — keep the last scale
  }
  const phase = planetFocusState.phase;
  if (phase === 'entering' || phase === 'active') {
    fitPlanetFocus(stageNow, r);
    // The FOCUS framing belongs to this frame just as the normal one does.
    // Stamping it is what makes a SKIPPED focus fit recoverable: while the
    // stage was hidden nothing was stamped, so the pair still names the
    // NORMAL framing, and the board's return is a genuine mode change that
    // re-opens the fit (see `fitMode`).
    fitKey.value = stageFrame(r);
    fitMode.value = 'focus';
    return;
  }
  // The stage's box is CONSTANT across the whole focus cycle now (the
  // mode bleeds instead of reclaiming layout), so the live rect is
  // always the honest destination — no stored target, nothing to go
  // stale between the two ends of the return.
  const scale = Math.min(
    (r.width - STAGE_PAD * 2) / naturalW.value,
    (r.height - STAGE_PAD_Y * 2) / naturalH.value,
  ) * SCALE_BOOST;
  const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
  applyBoardScale(clamped);
  // This framing now belongs to THIS frame — a later resize back to the
  // same box is a no-op (`scheduleFit`), and the convergence below is the
  // only thing still allowed to refine it.
  fitKey.value = stageFrame(r);
  fitMode.value = 'normal';
  // P29: refine against the REAL rendered content (next frame — the new
  // scale must paint first so the union bbox reflects it).
  scheduleCalibrate();
}
/**
 * Write `--board-scale` and, when it actually MOVED, arm the tween
 * guard for the transition that write just started (the CSS owns the
 * curve; this only records that the planet is in motion, so nothing
 * measures it mid-flight). The first write also unlocks the transition.
 */
function applyBoardScale(scale: number): void {
  const moved = Math.abs(scale - appliedScale.value) > 0.0005;
  appliedScale.value = scale;
  document.documentElement.style.setProperty('--board-scale', scale.toFixed(4));
  publishArcBleed(scale);
  if (moved && fitted.value) {
    armBoardTween();
  }
  fitted.value = true;
}
/**
 * THE INSTRUMENT BLEED — how far the stage's clip box reaches past its
 * padding box, in screen px (`--con-arc-bleed`, consumed by
 * `overflow-clip-margin` in console.less, where the rationale lives).
 *
 * It is the arc CURSOR's overhang: the marker's ring + its radial
 * ticks + their glow reach ~ARC_MARKER_BLEED board-px beyond the band
 * they ride, and the band is exactly what the fit frames — so without
 * this the ocean cursor is sliced along the stage's bottom edge. The
 * cursor cannot be measured into the natural box the way the band is:
 * it MOVES, so the planet would re-scale on every parameter tick.
 *
 * Written from JS because `overflow-clip-margin` rejects `calc()` in
 * Blink (a plain `var()` substitution of a finished length parses).
 */
function publishArcBleed(scale: number): void {
  const stageNow = stage.value ?? undefined;
  stageNow?.style.setProperty('--con-arc-bleed', `${(ARC_MARKER_BLEED * scale).toFixed(1)}px`);
}
/** Hold measurements off until the transform has actually PAINTED at its
 *  target. Timers describe intended CSS duration, not compositor
 *  progress; on a busy 4K frame they previously unlocked calibration
 *  while the old rect was still on screen, so the same offset was folded
 *  repeatedly (82px -> 160px -> ... -> 4300px). */
function armBoardTween(): void {
  boardTweening.value = true;
  tweenStableFrames.value = 0;
  scheduleBoardTweenCheck();
}
function scheduleBoardTweenCheck(): void {
  if (tweenRaf !== undefined) {
    return;
  }
  tweenRaf = flow.afterFrame('the board transform painted at its target — the next look', () => {
    tweenRaf = undefined;
    if (!boardTweening.value) {
      return;
    }
    const stageNow = stage.value ?? undefined;
    const board = stageNow?.querySelector<HTMLElement>(':scope > .board-cont');
    if (stageNow === undefined || board === null || board === undefined) {
      return;
    }
    const sr = stageNow.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    // A v-show section handoff is not a geometry frame. Pause polling;
    // scheduleFit resumes it when ResizeObserver sees the stage return.
    if (sr.width < 40 || sr.height < 40 || br.width < 40 || br.height < 40) {
      return;
    }
    const rawX = stageNow.style.getPropertyValue('--con-board-dx');
    const rawY = stageNow.style.getPropertyValue('--con-board-dy');
    const targetX = rawX !== '' ? parseFloat(rawX) : 6;
    const targetY = rawY !== '' ? parseFloat(rawY) : -4;
    const targetScale = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--board-scale'),
    ) || appliedScale.value;
    const paintedScaleX = br.width / BOARD_CONT_W;
    const paintedScaleY = br.height / BOARD_CONT_H;
    const paintedX = (br.left + br.width / 2) - (sr.left + sr.width / 2);
    const paintedY = (br.top + br.height / 2) - (sr.top + sr.height / 2);
    const atTarget = Math.abs(paintedScaleX - targetScale) <= TWEEN_SCALE_EPS &&
      Math.abs(paintedScaleY - targetScale) <= TWEEN_SCALE_EPS &&
      Math.abs(paintedX - targetX) <= TWEEN_OFFSET_EPS &&
      Math.abs(paintedY - targetY) <= TWEEN_OFFSET_EPS;
    tweenStableFrames.value = atTarget ? tweenStableFrames.value + 1 : 0;
    if (tweenStableFrames.value >= TWEEN_STABLE_FRAMES) {
      boardTweening.value = false;
      tweenStableFrames.value = 0;
      // The planet is at rest — NOW a calibration pass is meaningful.
      scheduleCalibrate();
      return;
    }
    scheduleBoardTweenCheck();
  });
}
/**
 * The PLANET FOCUS fit — deterministic: the frame is a fixed rectangle
 * of `.board-cont`'s local space (the Mars disc is a fixed asset), so
 * the scale and the centring offset are pure arithmetic. No calibration
 * runs in focus — there is nothing to measure, and a mid-transition
 * measurement would poison the vars anyway.
 */
function fitPlanetFocus(stage: HTMLElement, r: DOMRect): void {
  // The usable height is the stage PLUS the bleed the mode is allowed
  // below it (the dock's clearance — see `--pfocus-bleed`). The stage's
  // own box never changes: taking that space by shrinking layout moved
  // the centring flex and teleported the planet by half the reclaim on
  // the way back, which is the jump this whole approach exists to kill.
  const bleed = pfocusBleedPx();
  // THE FRAME by mode: the placement's alpha disc, or the ceremony's instrument frame (the disc with its arcs).
  const frame = planetFocusState.mode === 'ceremony' ? ceremonyFrameOf(stage) : focusFrame.value;
  // No breathing pads on purpose: the disc's border IS meant to land on
  // the stage border («буквально на границе экрана по высоте»).
  const scale = Math.min(r.width / frame.w, (r.height + bleed) / frame.h);
  const clamped = Math.min(PFOCUS_MAX_SCALE, Math.max(MIN_SCALE, scale));
  applyBoardScale(clamped);
  // Centre the FRAME in that virtual box: the flex centres the
  // .board-cont BOX in the STAGE, so the translate carries both the
  // frame-centre ↔ box-centre offset and half the bleed (screen px —
  // the translate sits OUTSIDE the scale in the transform, and being a
  // transform it is transitioned like the scale).
  const dx = (BOARD_CONT_W / 2 - (frame.x + frame.w / 2)) * clamped;
  const dy = (BOARD_CONT_H / 2 - (frame.y + frame.h / 2)) * clamped + bleed / 2;
  stage.style.setProperty('--con-board-dx', `${dx.toFixed(1)}px`);
  stage.style.setProperty('--con-board-dy', `${dy.toFixed(1)}px`);
}
/**
 * The CEREMONY's instrument frame (TR70) in board px — the alpha disc UNITED with the arc band's own content
 * (its rails, edges, digits, identities and markers — never the off-Mars flanks), measured off the DOM at the
 * engagement's first fit (the board is at rest then) and cached for the engagement: a later fit (the
 * ResizeObserver mid-glide) must never re-measure a travelling board. The fallback is the measured band.
 */
function ceremonyFrameOf(stage: HTMLElement): {x: number, y: number, w: number, h: number} {
  if (ceremonyFrame.value !== undefined && ceremonyFrameNonce.value === planetFocusState.nonce) {
    return ceremonyFrame.value;
  }
  const board = stage.querySelector<HTMLElement>(':scope > .board-cont');
  const br = board?.getBoundingClientRect();
  const scale = br !== undefined && br.width > 40 ? br.width / BOARD_CONT_W : 0;
  const disc = focusFrame.value;
  let left = disc.x;
  let top = disc.y;
  let right = disc.x + disc.w;
  let bottom = disc.y + disc.h;
  let measured = 0;
  if (br !== undefined && scale > 0) {
    for (const el of stage.querySelectorAll<HTMLElement>(ARC_BAND_SELECTOR)) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        continue;
      }
      measured++;
      left = Math.min(left, (r.left - br.left) / scale);
      top = Math.min(top, (r.top - br.top) / scale);
      right = Math.max(right, (r.right - br.left) / scale);
      bottom = Math.max(bottom, (r.bottom - br.top) / scale);
    }
  }
  const frame = measured > 0 ?
    {x: Math.floor(left), y: Math.floor(top), w: Math.ceil(right - left), h: Math.ceil(bottom - top)} :
    {...CEREMONY_FRAME_FALLBACK};
  ceremonyFrame.value = frame;
  ceremonyFrameNonce.value = planetFocusState.nonce;
  return frame;
}
/** The terraformed scene's burst (the shared `ceremonyFx`, accent `terra`) over the real disc — the breath layer hosts it. */
function playTerraformedBurst(): void {
  stopTerraformedBurst();
  const host = terraformedBreath.value ?? undefined;
  if (host === undefined || host === null) {
    return;
  }
  terraformedFx = playCeremonyBurst({
    host,
    accent: 'terra',
    reduced: consoleReducedMotionActive(),
    intensity: 'full',
    delayMs: TERRAFORMED_BURST_DELAY_MS,
  });
}
function stopTerraformedBurst(): void {
  terraformedFx?.stop();
  terraformedFx = undefined;
}
/** `--pfocus-bleed` in px (a length-valued custom property must go
 *  through cssLengthPx — getPropertyValue returns "2.9rem"). */
function pfocusBleedPx(): number {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined || typeof getComputedStyle !== 'function') {
    return 0;
  }
  return cssLengthPx(getComputedStyle(rootNow).getPropertyValue('--pfocus-bleed'), 0);
}
/**
 * Leaving focus: put back the calibrated normal framing captured at
 * enter (empty saved value = the CSS fallback), then re-fit — the same
 * transition that grew the planet now carries it home.
 */
function restoreNormalFraming(): void {
  const stageNow = stage.value ?? undefined;
  // THE RETURN IS A REVERSAL. Replay the exact pre-focus framing —
  // scale, natural box and centring — so the planet glides back to the
  // pixel it came from and NOTHING corrects it afterwards. A fresh fit
  // is the fallback for the one case a replay cannot cover: the
  // viewport genuinely changed while focus was up.
  const saved = savedScale.value;
  savedScale.value = 0;
  if (saved > 0 && savedViewW.value === window.innerWidth && savedViewH.value === window.innerHeight) {
    naturalW.value = savedNaturalW.value;
    naturalH.value = savedNaturalH.value;
    restoreStageOffsets(stageNow);
    applyBoardScale(saved);
    // The replayed framing IS the reference. A calibration pass here
    // would "improve" it ~400ms after the landing — an unanimated
    // second correction, which is precisely the jump this replaces.
    calibrateLock.value = {w: window.innerWidth, h: window.innerHeight};
    // …and it belongs to the frame it was replayed into, so the stage's
    // own handback (which arrives as a resize) does not re-derive it. The
    // MODE is restored unconditionally: an exit that lands while the board
    // is hidden cannot measure a box, but the framing it just replayed is
    // a normal one all the same — leaving the mode on `focus` would make
    // the board's return a «mode change» and re-derive a framing that was
    // deliberately replayed rather than re-fitted.
    fitKey.value = stageKey() ?? fitKey.value;
    fitMode.value = 'normal';
    return;
  }
  restoreStageOffsets(stageNow);
  // A fresh calibration convergence once the exit settles (the gate
  // inside calibrate() keeps it out of the transition itself).
  calibratePasses.value = 0;
  fitBoard();
}
/** Put back the centring vars captured at enter (empty = CSS fallback). */
function restoreStageOffsets(stage: HTMLElement | undefined): void {
  if (stage !== undefined && savedBoardDx.value !== undefined) {
    if (savedBoardDx.value === '') {
      stage.style.removeProperty('--con-board-dx');
    } else {
      stage.style.setProperty('--con-board-dx', savedBoardDx.value);
    }
    if (savedBoardDy.value === '' || savedBoardDy.value === undefined) {
      stage.style.removeProperty('--con-board-dy');
    } else {
      stage.style.setProperty('--con-board-dy', savedBoardDy.value);
    }
  }
  savedBoardDx.value = undefined;
  savedBoardDy.value = undefined;
}
/**
 * WHICH FRAMING the fit engine would derive right now — mirrors the branch
 * in `fitBoard` exactly, and nothing else may decide it.
 */
function framingMode(): 'focus' | 'normal' {
  const phase = planetFocusState.phase;
  return phase === 'entering' || phase === 'active' ? 'focus' : 'normal';
}
/** A measured stage box + the viewport, as one key. Rounded, so sub-pixel
 *  jitter is not a "change". */
function stageFrame(r: DOMRect): string {
  return `${Math.round(r.width)}x${Math.round(r.height)}` +
    `@${window.innerWidth}x${window.innerHeight}`;
}
/**
 * The frame the framing is derived for: the stage box + the viewport.
 * `undefined` while the board is hidden — there is nothing to fit, and
 * nothing to remember either (the framing it will come back to is the one
 * it left with).
 */
function stageKey(): string | undefined {
  const stageNow = stage.value ?? undefined;
  if (stageNow === undefined) {
    return undefined;
  }
  const r = stageNow.getBoundingClientRect();
  if (r.width < 40 || r.height < 40) {
    return undefined;
  }
  return stageFrame(r);
}
function scheduleFit(): void {
  if (fitRaf.value !== undefined) {
    return;
  }
  fitRaf.value = flow.afterFrame('the board\'s fit', () => {
    fitRaf.value = undefined;
    const key = stageKey();
    // HIDDEN: a section owns the screen. Keep the framing untouched — and
    // in particular do NOT re-open the calibration budget, or the board's
    // return becomes the moment an unfinished convergence plays out.
    if (key === undefined) {
      return;
    }
    // The SAME frame it was already fitted for (a v-show round trip):
    // nothing to re-derive. Re-fitting here is what moved the planet.
    // …the same frame IN THE SAME FRAMING MODE, that is: a board that
    // comes back while Planet Focus is engaged — its focus fit skipped,
    // because the stage was 0×0 when the mode took it (see `fitMode`) —
    // has the same box and the WRONG framing, and gets the fit here.
    if (key === fitKey.value && framingMode() === fitMode.value) {
      if (boardTweening.value) {
        scheduleBoardTweenCheck();
      }
      return;
    }
    // A real change (window resize / profile flip): a fresh convergence.
    calibratePasses.value = 0;
    calibrateLock.value = undefined;
    fitBoard();
  });
}
/**
 * ONE deferred re-measurement per frame, after the arc markers have
 * finished gliding to their values. A convergence that ran against a
 * composing board is otherwise final — that is how a boot could lock a
 * framing several percent off, which then surfaced as a "jump" the first
 * time anything re-opened the budget.
 */
function armLateVerify(): void {
  const key = fitKey.value;
  if (key === undefined) {
    return;
  }
  if (lateVerifyKey.value !== key) {
    lateVerifyKey.value = key;
    lateVerifyRuns.value = 0;
  }
  if (lateVerifyRuns.value >= LATE_VERIFY_MAX) {
    return;
  }
  lateVerifyRuns.value++;
  if (lateVerifyTimer.value !== undefined) {
    lateVerifyTimer.value();
  }
  // A WIDENING ladder, because "settled" has no single timestamp: the
  // deal cinematic, the arcs' travel and the start scene's handback all
  // finish at their own pace, and a convergence that ran before them is
  // measuring a board that no longer exists. Each rung starts from a
  // fresh budget; on an already-settled board a rung is one no-op sweep.
  lateVerifyTimer.value = flow.after(consoleMotionMs(LATE_VERIFY_MS * lateVerifyRuns.value), 'the board framing\'s late verification', () => {
    lateVerifyTimer.value = undefined;
    calibratePasses.value = 0;
    scheduleCalibrate();
  });
}
function scheduleCalibrate(): void {
  if (calibrateRaf.value !== undefined) {
    return;
  }
  if (calibratePasses.value >= CALIBRATE_MAX_PASSES) {
    // The convergence ran out of road — it did NOT finish. Looking again
    // once the board is quiet is the whole point of the ladder; without
    // this the framing simply froze wherever the budget happened to end,
    // and only a section round trip could ever re-open it (which is
    // exactly the re-framing the player saw as the planet shifting).
    armLateVerify();
    return;
  }
  calibrateRaf.value = flow.afterFrame('a calibration pass of the board\'s framing', () => {
    calibrateRaf.value = undefined;
    calibrate();
  });
}
/**
 * P29 — SELF-CALIBRATION: measure the union bbox of everything the
 * stage actually renders (planet, hex grid, arc scales, off-Mars
 * flanks, ocean scale — whatever the expansion set composed), derive
 * the EFFECTIVE natural box (union / applied scale) and the true
 * visual centre, then re-fit / re-centre. Kills the dead margins the
 * hand-tuned constants left AND keeps the board centred without
 * per-layout nudge constants. Bounded to CALIBRATE_MAX_PASSES per fit
 * cycle; the clamps make a stray mid-transition measurement harmless.
 */
function calibrate(): void {
  // PLANET FOCUS: the focus fit is deterministic and the transitions
  // make live measurements meaningless — calibration is a normal-mode
  // instrument only. `arcsReturning` extends that ban past the phase:
  // the band is still CONDENSING there (its boxes are mid-transform), so
  // a measurement taken then reports a wrong natural box and re-fits the
  // planet WITHOUT a transition — the hard nudge in the landing's last
  // frame. It resumes a beat later (the arcsReturning watcher re-arms it).
  if (planetFocusState.phase !== 'idle' || planetFocusState.arcsReturning ||
      boardTweening.value) {
    return;
  }
  if (calibrateLock.value !== undefined) {
    if (calibrateLock.value.w === window.innerWidth && calibrateLock.value.h === window.innerHeight) {
      return; // a replayed framing is already converged — leave it alone
    }
    calibrateLock.value = undefined; // the viewport really moved: re-converge
  }
  const stageNow = stage.value ?? undefined;
  if (stageNow === undefined) {
    return;
  }
  const sr = stageNow.getBoundingClientRect();
  if (sr.width < 40 || sr.height < 40) {
    return;
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const el of stageNow.querySelectorAll<HTMLElement>(CONTENT_SELECTOR)) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) {
      continue; // hidden / collapsed
    }
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left) || right - left < 100 || bottom - top < 100) {
    return; // nothing meaningful rendered yet
  }
  const scale = appliedScale.value;
  const natW = Math.min(NATURAL_W_MAX, Math.max(NATURAL_W_MIN, (right - left) / scale));
  const natH = Math.min(NATURAL_H_MAX, Math.max(NATURAL_H_MIN, (bottom - top) / scale));
  // True-centre offset (screen px): where the content centre sits vs the
  // stage centre — folded into the child translate CSS vars.
  // The eleven-row field centres its RING across (Amazonis Planitia — the four rails are one circle round the
  // planet): its off-Mars flank is not symmetric (Aurora Station closes the right honeycomb only), and the content's
  // own middle would push the planet off the stage's by half that column. The width is never the binding axis.
  let midX = (left + right) / 2;
  if (largeLayout.value) {
    let ringLeft = Infinity;
    let ringRight = -Infinity;
    for (const el of stageNow.querySelectorAll<SVGElement>('.arc-scale__rail')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        ringLeft = Math.min(ringLeft, r.left);
        ringRight = Math.max(ringRight, r.right);
      }
    }
    if (Number.isFinite(ringLeft)) {
      midX = (ringLeft + ringRight) / 2;
    }
  }
  const dx = (sr.left + sr.width / 2) - midX;
  const dy = (sr.top + sr.height / 2) - (top + bottom) / 2;
  const sizeDrift = Math.abs(natW - naturalW.value) > CALIBRATE_SIZE_EPS ||
    Math.abs(natH - naturalH.value) > CALIBRATE_SIZE_EPS;
  const offsetDrift = Math.abs(dx) > CALIBRATE_OFFSET_EPS || Math.abs(dy) > CALIBRATE_OFFSET_EPS;
  if (!sizeDrift && !offsetDrift) {
    releaseFitSettleHold(); // the boot curtain may reveal a settled board
    armLateVerify(); // …unless the board was still composing
    return; // converged
  }
  calibratePasses.value++;
  if (offsetDrift) {
    // Written on the STAGE so the vars INHERIT to every board child —
    // GameBoardView is multi-root, so `firstElementChild` is its anchor
    // <a>, not the board (custom props don't reach siblings).
    // The CSS fallback translate is (6px, −4px) — start the fold from it
    // so the FIRST pass lands exactly (dx measured the current result).
    const rawX = stageNow.style.getPropertyValue('--con-board-dx');
    const rawY = stageNow.style.getPropertyValue('--con-board-dy');
    const prevX = rawX !== '' ? parseFloat(rawX) : 6;
    const prevY = rawY !== '' ? parseFloat(rawY) : -4;
    stageNow.style.setProperty('--con-board-dx', `${(prevX + dx).toFixed(1)}px`);
    stageNow.style.setProperty('--con-board-dy', `${(prevY + dy).toFixed(1)}px`);
    // ⚠ THE FOLD IS A TRANSFORM CHANGE, so it GLIDES like any other — the
    // planet's transition is permanent, and `--con-board-dx/dy` ride the
    // same declaration as the scale. Only a SCALE change used to arm the
    // tween guard, so the very next pass measured a planet mid-flight,
    // folded a partial correction on top of a partial correction (the
    // fold is cumulative!), and the convergence chased itself until the
    // pass budget ran out. Device trace, 4K: the boot stopped 371px
    // off-centre and stayed there — until a section round trip re-opened
    // the budget and the board visibly re-framed itself, which is the
    // «планета сдвигается» the player actually reported.
    armBoardTween();
  }
  if (sizeDrift) {
    naturalW.value = natW;
    naturalH.value = natH;
    fitBoard(); // re-fit at the honest natural box
  }
  if (!boardTweening.value) {
    // Nothing is in flight — the next measurement is honest right away.
    scheduleCalibrate();
  }
  // …otherwise the tween's own expiry re-schedules it, at rest.
}
function cellEl(spaceId: string | undefined): HTMLElement | undefined {
  if (spaceId === undefined) {
    return undefined;
  }
  const rootNow = root.value ?? undefined;
  return rootNow?.querySelector<HTMLElement>(`[data_space_id="${spaceId}"]`) ?? undefined;
}
/**
 * PLACEMENT RELATION MARKS — the on-field tie between the focused cell and
 * every cell that participates in the placement's outcome: paying oceans,
 * scored greeneries/cities, taxing hazards, Ares reward tiles, the hazards
 * a planetary event rewrites. DRIVEN BY THE PREVIEW, never re-derived: the
 * server names the participating cells on each spatial fact
 * (`BoardFact.spaces`), `relationsFromPreview` classifies them, and the
 * dossier renders the same facts — so field and panel agree by
 * construction. Geometry (the directional bias of each wash toward the
 * focused cell) is the intrinsic position cache — no layout reads per
 * step.
 */
function applyRelationMarks(): void {
  clearRelationMarks();
  const id = cursorSpaceId.value;
  const relations = focusedRelations(id);
  if (id === undefined || relations === undefined) {
    return;
  }
  const centre = cellIntrinsicCentre(id);
  const adjacentReach = 46 * 1.5; /* keep-px: board px-space — one hex pitch */
  for (const rel of relations) {
    // A move's ORIGIN already wears its own pose (the quiet tile, the
    // dashed contour, the vector's foot) — a second mark on the same hex
    // would be two voices about one cell.
    if (rel.spaceId === props.moveFrom) {
      continue;
    }
    const el = cellEl(rel.spaceId);
    if (el === undefined) {
      continue;
    }
    const cls = `con-rel--${rel.tone}`;
    el.classList.add('con-rel', cls);
    relationMarked.set(el, cls);
    // Bias the wash toward the SHARED EDGE with the focused cell — the
    // neighbour answers on its facing side, which is what reads as a
    // spatial tie rather than a lit cell. A far cell (a board-wide
    // planetary event) keeps a centred, quieter wash.
    const c = cellIntrinsicCentre(rel.spaceId);
    if (centre !== undefined && c !== undefined) {
      const dx = centre.x - c.x;
      const dy = centre.y - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= adjacentReach) {
        el.style.setProperty('--rel-x', `${(50 + (dx / dist) * 22).toFixed(1)}%`);
        el.style.setProperty('--rel-y', `${(50 + (dy / dist) * 22).toFixed(1)}%`);
      } else {
        el.classList.add('con-rel--far');
      }
    }
  }
}
/**
 * WHICH relations the focused cell lights, or `undefined` for none. A
 * placement reads its own preview (a legal cell only); an INSPECTION (TR67
 * «КЛЕТКА — ОДНО ДОСЬЕ») reads the hover's own facts — the same tones, so
 * the field and the dossier's neighbour ring light ONE set. The stale-async
 * guard either way: an answer is only ever applied to ITS OWN cell.
 */
function focusedRelations(id: string | undefined): ReadonlyArray<PlacementRelation> | undefined {
  if (id === undefined) {
    return undefined;
  }
  if (props.placementActive) {
    const preview = props.cellPreview;
    return selectedAvailable.value && preview !== undefined && preview.space === id ? relationsFromPreview(preview) : undefined;
  }
  if (props.inspecting) {
    const info = boardInfoState.info;
    return info !== undefined && info.space === id ? relationsFromInfo(info) : undefined;
  }
  return undefined;
}
function clearRelationMarks(): void {
  for (const [el, cls] of relationMarked) {
    el.classList.remove('con-rel', cls, 'con-rel--far');
    el.style.removeProperty('--rel-x');
    el.style.removeProperty('--rel-y');
  }
  relationMarked.clear();
}
/**
 * The focused cell's printed-bonus cluster, measured once per (map, cell)
 * through the same rect-division the position cache rides — feeds the
 * ghost's quiet-zone mask so the projection never paints over the very
 * reward the player is weighing. `null` in the cache = measured, none.
 */
function updateBonusZone(): void {
  if (!props.placementActive) {
    cursorBonusZone.value = undefined;
    return;
  }
  const id = cursorSpaceId.value;
  const host = cursorHost.value;
  if (id === undefined || host === undefined) {
    cursorBonusZone.value = undefined;
    return;
  }
  const key = `${props.playerView.game.gameOptions?.boardName ?? ''}|${id}`;
  let zone = bonusZoneCache.get(key);
  if (zone === undefined) {
    zone = null;
    const cell = cellEl(id);
    const hr = host.getBoundingClientRect();
    if (cell !== undefined && hr.width >= 40) {
      const scale = hr.width / BOARD_CONT_W;
      const cr = cell.getBoundingClientRect();
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const icon of cell.querySelectorAll<HTMLElement>('.board-space-bonus')) {
        const r = icon.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) {
          continue;
        }
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      }
      if (Number.isFinite(left)) {
        zone = {
          cx: ((left + right) / 2 - cr.left) / scale,
          cy: ((top + bottom) / 2 - cr.top) / scale,
          w: (right - left) / scale,
          h: (bottom - top) / scale,
        };
      }
      bonusZoneCache.set(key, zone);
    }
  }
  cursorBonusZone.value = zone ?? undefined;
}
/** A cell's intrinsic centre (board px), through the same cached measure
 *  the reticle rides. */
function cellIntrinsicCentre(spaceId: string | undefined): {x: number, y: number} | undefined {
  const host = cursorHost.value;
  if (spaceId === undefined || host === undefined) {
    return undefined;
  }
  const key = `${props.playerView.game.gameOptions?.boardName ?? ''}|${spaceId}`;
  let pos = cellPosCache.get(key);
  if (pos === undefined) {
    const el = cellEl(spaceId);
    if (el === undefined) {
      return undefined;
    }
    const hr = host.getBoundingClientRect();
    if (hr.width < 40) {
      return undefined;
    }
    const scale = hr.width / BOARD_CONT_W;
    const r = el.getBoundingClientRect();
    pos = {x: (r.left - hr.left) / scale, y: (r.top - hr.top) / scale};
    cellPosCache.set(key, pos);
  }
  return {x: pos.x + 23, y: pos.y + 25.5}; /* keep-px: half a 46×51 hex */
}
function applySpotlight(before: string | undefined, now: string | undefined): void {
  cellEl(before)?.classList.remove(SELECT_CLASS);
  const el = cellEl(now);
  el?.classList.add(SELECT_CLASS);
}
/** P27: a track marker's DOM element by its stable key. */
function markerEl(key: string | undefined): HTMLElement | undefined {
  if (key === undefined) {
    return undefined;
  }
  const rootNow = root.value ?? undefined;
  return rootNow?.querySelector<HTMLElement>(`[data-arc-marker="${CSS.escape(key)}"]`) ?? undefined;
}
/**
 * Collect navigable CELLS: legal-only during placement (unless
 * free-roam). Track markers are a SEPARATE surface (R3 scale
 * inspection cycles them — see trackMarkers), never mixed in here.
 */
function candidates(): Array<BoardCandidate> {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined) {
    return [];
  }
  const constrain = props.placementActive && !consoleState.freeRoam;
  const selector = constrain ? '.board-space--available[data_space_id]' : '.board-space[data_space_id]';
  const out: Array<BoardCandidate> = [];
  for (const el of rootNow.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      out.push({kind: 'cell', id: el.getAttribute('data_space_id') ?? '', el, rect: {left: r.left, top: r.top, width: r.width, height: r.height}});
    }
  }
  return out;
}
/**
 * P27b: the R3 SCALE-INSPECTION ring — every track marker (scale
 * bonuses + planetary-event chips) sorted by its angle around the
 * board centre, so prev/next walks the circle predictably.
 */
function trackMarkers(): Array<{id: string, el: HTMLElement, angle: number}> {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined) {
    return [];
  }
  const stage = rootNow.querySelector('.board-cont') ?? rootNow;
  const sr = stage.getBoundingClientRect();
  const cx = sr.left + sr.width / 2;
  const cy = sr.top + sr.height / 2;
  const out: Array<{id: string, el: HTMLElement, angle: number}> = [];
  for (const el of rootNow.querySelectorAll<HTMLElement>('.arc-marker[data-arc-marker]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      out.push({
        id: el.getAttribute('data-arc-marker') ?? '',
        el,
        angle: Math.atan2(r.top + r.height / 2 - cy, r.left + r.width / 2 - cx),
      });
    }
  }
  out.sort((a, b) => a.angle - b.angle);
  return out;
}
/** Enter scale inspection: focus the marker nearest 12 o'clock. */
function enterTrackInspect(): boolean {
  const markers = trackMarkers();
  if (markers.length === 0) {
    return false;
  }
  const top = -Math.PI / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < markers.length; i++) {
    const d = Math.abs(Math.atan2(Math.sin(markers[i].angle - top), Math.cos(markers[i].angle - top)));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  consoleState.trackMarker = markers[best].id;
  return true;
}
/** Step the scale-inspection cursor around the ring (wraps — «по кругу»). */
function stepTrackMarker(step: 1 | -1): void {
  const markers = trackMarkers();
  if (markers.length === 0) {
    return;
  }
  const at = markers.findIndex((m) => m.id === consoleState.trackMarker);
  if (at === -1) {
    enterTrackInspect();
    return;
  }
  consoleState.trackMarker = markers[(at + step + markers.length) % markers.length].id;
}
/**
 * Seed the selection. A PLACEMENT opens on the legal cell nearest the centre of the player's own tiles (the board's
 * centre with none — `initialPlacementCursor`, T15 · CD: one law for every pick, read off the board's geometry, so
 * it holds for a stage still hidden too); anything else — and a pick of off-grid cells only — on the available cell
 * (or any cell) nearest the board's on-screen centre.
 */
function seed(preferAvailable: boolean): void {
  const first = preferAvailable && props.placementActive && props.legalSpaces.length > 0 ?
    initialPlacementCursor({cells: props.playerView.game.spaces, legal: props.legalSpaces as ReadonlyArray<SpaceId>, viewer: props.playerView.thisPlayer.color}) :
    undefined;
  const cells = candidates().filter((c) => c.kind === 'cell');
  if (first !== undefined) {
    const seat = cells.find((c) => c.id === first);
    if (seat !== undefined) {
      landOn(seat);
    } else {
      select(first);
    }
    return;
  }
  if (cells.length === 0) {
    return;
  }
  const rootNow = root.value as HTMLElement;
  const stage = rootNow.querySelector('.board-cont') ?? rootNow;
  const r = stage.getBoundingClientRect();
  const center = {x: r.left + r.width / 2, y: r.top + r.height / 2};
  const pool = preferAvailable ?
    (cells.filter((c) => c.el.classList.contains('board-space--available')) as typeof cells) :
    cells;
  const usable = pool.length > 0 ? pool : cells;
  const idx = pickNearest(center, usable.map((c) => c.rect));
  landOn(usable[idx ?? 0]);
}
function select(target: BoardCandidate | string): void {
  const id = typeof target === 'string' ? target : target.id;
  consoleState.trackMarker = undefined;
  consoleState.boardSpaceId = id;
}
/**
 * Move the cell selection one step in `dir`.
 * INSPECTION mode AND tile PLACEMENT both traverse the hex grid STRICTLY
 * (P27b) — left/right never leaves the row, up/down never drifts to a
 * neighbouring column (the colAnchor). During placement the strict
 * traversal runs over the CONSTRAINED available-cell set, so pressing
 * right pages the next legal cell in the SAME row instead of the wide-cone
 * directional pick's diagonal neighbour. The generic directional pick is
 * only the fallback that reaches the off-grid (colony) cells at a
 * row/column end.
 */
function move(dir: NavDirection): void {
  const targets = candidates();
  if (targets.length === 0) {
    return;
  }
  const current = targets.find((c) => c.id === selectedSpaceId.value);
  if (current === undefined) {
    // Selection left the candidate set (e.g. constraint kicked in) —
    // glide to the nearest candidate instead of jumping to a corner.
    const prevEl = cellEl(selectedSpaceId.value);
    if (prevEl !== undefined) {
      const r = prevEl.getBoundingClientRect();
      const idx = pickNearest(rectCenter({left: r.left, top: r.top, width: r.width, height: r.height}), targets.map((c) => c.rect));
      landOn(targets[idx ?? 0]);
      return;
    }
    seed(props.placementActive);
    return;
  }
  const others = targets.filter((c) => c !== current);
  const rects = others.map((c) => c.rect);
  // Strict hex traversal now covers PLACEMENT too (was inspection-only):
  // left/right stay in the row, up/down keep the column anchor. The
  // off-grid leap fallback below can still break the row/column at an
  // end, but the guard blocks any adjacent diagonal drift — the exact
  // behaviour placement was missing.
  const strictMode = props.inspecting || props.placementActive;
  if (strictMode) {
    const anchor = colAnchor.value ?? rectCenter(current.rect).x;
    const strict = pickStrictGrid(current.rect, rects, dir, anchor);
    if (strict !== undefined) {
      const target = others[strict];
      if (dir === 'left' || dir === 'right') {
        colAnchor.value = rectCenter(target.rect).x; // a horizontal move re-anchors
      } else if (colAnchor.value === undefined) {
        colAnchor.value = anchor; // a vertical run keeps its column
      }
      select(target);
      return;
    }
    // End of the row/column — fall through ONLY to reach the OFF-GRID
    // colony cells (guarded below), never a diagonal grid neighbour.
  }
  const idx = pickDirectional(current.rect, rects, dir);
  if (idx === undefined) {
    return;
  }
  if (strictMode) {
    // The strict contract: a fallback target must be a genuine LEAP
    // (an off-grid colony cell), not the adjacent-row hex the generic
    // picker would drift to at a row end.
    const cc = rectCenter(current.rect);
    const tc = rectCenter(others[idx].rect);
    const horizontal = dir === 'left' || dir === 'right';
    if (horizontal && Math.abs(tc.x - cc.x) < current.rect.width * 1.4) {
      return;
    }
    if (!horizontal && Math.abs(tc.y - cc.y) < current.rect.height * 1.6) {
      return;
    }
  }
  landOn(others[idx]);
}
/**
 * Put the cursor on `spaceId` — the shell's own move (a move's level
 * change: onto the lifted city's first destination, back onto the city).
 * A landing, not a step: the column anchor follows. `false` when the cell
 * is not on this board's DOM.
 */
function focusSpace(spaceId: string): boolean {
  const el = cellEl(spaceId);
  if (el === undefined) {
    return false;
  }
  const r = el.getBoundingClientRect();
  colAnchor.value = r.left + r.width / 2;
  select(spaceId);
  return true;
}
/** A non-strict landing (seed / glide / diagonal) re-anchors the column. */
function landOn(target: BoardCandidate): void {
  colAnchor.value = rectCenter(target.rect).x;
  select(target);
}
/**
 * A on the selected cell during placement: the existing per-cell onclick
 * (SelectSpace) — the same submission contract as a mouse click.
 * Returns false when the cell isn't legal (the shell shows the refusal).
 */
function activate(): boolean {
  if (!props.placementActive) {
    return false;
  }
  const el = cellEl(selectedSpaceId.value);
  if (el === undefined || !el.classList.contains('board-space--available')) {
    return false;
  }
  el.click();
  return true;
}
/** Release the boot curtain's board-geometry hold (idempotent). */
function releaseFitSettleHold(): void {
  const release = fitSettleRelease;
  if (release !== undefined) {
    fitSettleRelease = undefined;
    release();
  }
}

// Entering placement re-seats the selection on a LEGAL cell near the
// board center (predictable landing); leaving keeps the last cell.
watch(() => props.placementActive, (now: boolean) => {
  if (now) {
    void nextTick(() => {
      seed(true);
      // The placement is what BRINGS the board back (`goBoardHome`), and
      // a Planet Focus that engaged while the stage was hidden is still
      // owed its fit. Deterministic here rather than only on the
      // ResizeObserver's word; a framing that is already current is a
      // no-op (the key matches).
      scheduleFit();
      applyRelationMarks();
      updateBonusZone();
    });
  } else {
    clearRelationMarks();
    cursorBonusZone.value = undefined;
  }
});
watch(() => selectedSpaceId.value, (now: string | undefined, before: string | undefined) => {
  applySpotlight(before, now);
  if (now !== undefined) {
    // The facts are warmed whatever the mode; the cell's marker lights only while the cursor is SEEN.
    hoverBoardCell(now as SpaceId, undefined, {quiet: !cursorShown.value});
  }
  // A step clears the PREVIOUS cell's relation marks in the same press —
  // the new cell's marks arrive with its preview (the watcher below), so
  // a fast d-pad run never trails highlights and never lights a cell
  // the player has already left.
  clearRelationMarks();
  applyRelationMarks();
  updateBonusZone();
}, {immediate: true});
/**
 * The LIFTED city's cell wears `board-space--move-source` (its tile turns
 * quieter — it is «leaving from here», and nothing has happened yet).
 * Imperative like the spotlight: the board's cells are not this
 * component's to render.
 */
watch(() => props.moveFrom, (now: string | undefined, before: string | undefined) => {
  cellEl(before)?.classList.remove(MOVE_SOURCE_CLASS);
  cellEl(now)?.classList.add(MOVE_SOURCE_CLASS);
  // The origin never carries a relation mark of its own (see applyRelationMarks).
  applyRelationMarks();
});
/** Turn the vector the SHORT way: the running angle moves by the wrapped difference, never by the raw value. */
watch(() => moveVectorGeometry.value, (now: {angle: number} | undefined, before: {angle: number} | undefined) => {
  if (now === undefined) {
    return;
  }
  if (before === undefined) {
    moveAngle.value = now.angle;
    return;
  }
  const delta = ((now.angle - moveAngle.value) % 360 + 540) % 360 - 180;
  moveAngle.value += delta;
});
/**
 * The RELATION layer follows the focused cell's preview — the same server
 * answer the dossier explains. Async by nature (the shell fetches it), so
 * the apply is guarded by the preview's own `space`: a stale answer for a
 * cell the cursor already left marks nothing.
 */
watch(() => props.cellPreview, () => {
  applyRelationMarks();
});
/**
 * THE INSPECTION's relation layer follows the hover's answer for the
 * focused cell (TR67) — and that answer names the six neighbours, which are
 * warmed into the info cache right away: a d-pad step lands on one of them,
 * so the next dossier swaps in the same frame instead of blanking for a
 * fetch (decode ≠ mount — the TR58 law, for data).
 */
watch(() => boardInfoState.info, (): void => {
  const info = boardInfoState.info;
  if (info !== undefined && info.space === cursorSpaceId.value) {
    prefetchBoardCells((info.portrait?.neighbours ?? []).flatMap((n) => n === null ? [] : [n.space]));
  }
  if (props.inspecting && !props.placementActive) {
    applyRelationMarks();
  }
});
watch(() => cursorShown.value, (now: boolean): void => {
  setBoardCellHoverQuiet(!now);
}, {immediate: true});
watch(() => props.inspecting, (now: boolean): void => {
  if (!now && !props.placementActive) {
    clearRelationMarks();
  } else {
    applyRelationMarks();
  }
});
/**
 * PLANET FOCUS phases (planetFocus.ts) → framing. Enter/active apply
 * the deterministic focus fit (the CSS transition carries the growth,
 * `--pfocus-anim` gates it); exit/idle restore the calibrated normal
 * framing saved at enter. The module owns WHEN; this component owns
 * the geometry (it has the stage).
 */
watch(() => planetFocusState.phase, (now: PlanetFocusPhase): void => {
  if (now === 'entering' && savedBoardDx.value === undefined) {
    const stageNow = stage.value ?? undefined;
    savedBoardDx.value = stageNow?.style.getPropertyValue('--con-board-dx') ?? '';
    savedBoardDy.value = stageNow?.style.getPropertyValue('--con-board-dy') ?? '';
    // …and the framing ITSELF. The return replays these instead of
    // re-fitting: a re-derivation lands on whatever the fit engine
    // concludes NOW (and the calibration pass that follows "improves"
    // it again ~400ms after the landing) — which is the second,
    // unanimated correction the player reads as the planet jumping.
    savedScale.value = appliedScale.value;
    savedNaturalW.value = naturalW.value;
    savedNaturalH.value = naturalH.value;
    savedViewW.value = window.innerWidth;
    savedViewH.value = window.innerHeight;
  }
  if (now === 'entering' || now === 'active') {
    // AFTER the DOM patch: the focus classes also reclaim layout (the
    // banner row hides, the dock clearance drops), and the fit must
    // measure the GROWN stage — a sync call would read the old box.
    // The ResizeObserver double-checks a frame later either way.
    void nextTick(() => {
      fitBoard();
    });
    return;
  }
  if (now === 'exiting') {
    // ONLY here — the replay sets the final framing, and the stage's own
    // handback at idle is picked up by the ResizeObserver (which lands
    // on the same numbers, so it is a no-op). Re-running the restore at
    // idle used to re-arm calibration and undo the replay.
    void nextTick(() => restoreNormalFraming());
    return;
  }
  /*
   * …AND THE MODE CAN END WITHOUT EXITING. `resetPlanetFocus()` is a
   * legitimate HARD DROP (shell unmount, game switch, and — since the
   * end-of-game seal — the Phase.END boundary): it jumps the phase
   * straight to `idle` from wherever it stood, so the `exiting` branch
   * above never runs and the FOCUS framing is simply left applied. The
   * module owns WHEN the mode ends; this component owns the geometry, and
   * a geometry nobody restored is a planet the player finds zoomed in,
   * clipped by both bars, with the arcs cut off — the reported endgame
   * bug, one collapse later.
   *
   * `fitMode` is the honest witness: after a real exit the replay has
   * already set it to `normal`, so this can neither double-restore nor
   * undo it. Nothing re-derives it on its own either — the stage's box
   * does not change, so no resize reaches `scheduleFit`.
   */
  if (now === 'idle' && fitMode.value === 'focus') {
    void nextTick(() => restoreNormalFraming());
  }
});
/** The band has finished condensing — the board is measurable again, so
 *  let the deferred calibration pass run now (on a settled scene it is
 *  a no-op or a sub-pixel nudge; either way nothing is mid-flight). */
watch(() => planetFocusState.arcsReturning, (now: boolean, was: boolean): void => {
  if (!now && was) {
    calibratePasses.value = 0;
    scheduleCalibrate();
  }
});
/** The camera's MODE changed while engaged (the ceremony arriving over a placement camera): a re-fit to the mode's frame. */
watch(() => planetFocusState.mode, (now: PlanetFocusMode): void => {
  const phase = planetFocusState.phase;
  if (now === 'ceremony' && (phase === 'entering' || phase === 'active')) {
    void nextTick(() => fitBoard());
  }
});
/**
 * «МАРС ТЕРРАФОРМИРОВАН» (TR70): the show detonates the shared ceremony burst over the REAL disc (the breath
 * layer is its stage, in board px, riding the planet's transform); the scene's end tears it down.
 */
watch(() => terraformedSceneState.phase, (now: string): void => {
  if (now === 'show') {
    void nextTick(() => playTerraformedBurst());
  } else if (now === 'idle') {
    stopTerraformedBurst();
  }
});
/** The coordinate space moved (either edge): version it, so an in-flight
 *  board-bound aim knows its measured rect is stale (boardSpaceGeometry).
 *  Both edges bump — a consumer re-measures on ANY move, and the settle
 *  edge is when the re-measure is worth taking. */
watch(() => boardGeometryCalm.value, (): void => {
  bumpBoardSpaceEpoch();
});
/**
 * P27: the focused TRACK marker — spotlight ring + the SAME premium
 * ScaleTooltip the mouse hover shows (a synthetic mouseenter fires the
 * chip's own Vue handler, so there is exactly one tooltip source).
 * A focused marker suppresses the cell spotlight (one focus at a time).
 */
watch(() => consoleState.trackMarker, (now: string | undefined, before: string | undefined) => {
  const prev = markerEl(before);
  if (prev !== undefined) {
    prev.classList.remove(MARKER_CLASS);
    prev.dispatchEvent(new MouseEvent('mouseleave'));
  }
  const el = markerEl(now);
  if (el !== undefined) {
    el.classList.add(MARKER_CLASS);
    el.dispatchEvent(new MouseEvent('mouseenter'));
    cellEl(selectedSpaceId.value)?.classList.remove(SELECT_CLASS);
  } else {
    applySpotlight(undefined, selectedSpaceId.value);
  }
});

onMounted(() => {
  // P29c: the temporary LB/RB tuner persisted its value here — the tuned
  // ×1.05 is the compiled default now, drop the stale key.
  try {
    window.localStorage?.removeItem('tm_board_scale');
  } catch (err) {
    // storage unavailable — nothing to clean
  }
  // The reticle's home — Board.vue's root, which never remounts for the
  // session (the console update model), so resolving it once is safe.
  const stageEl = stage.value ?? undefined;
  cursorHost.value = stageEl?.querySelector<HTMLElement>('.board-cont') ?? undefined;
  if (selectedSpaceId.value === undefined) {
    seed(props.placementActive);
  } else {
    // Re-apply the spotlight to the freshly-rendered board DOM.
    applySpotlight(undefined, selectedSpaceId.value);
  }
  // SCENE TRANSITION: while the boot curtain covers, hold the reveal until
  // the board's self-calibration CONVERGES — the boot used to lock a
  // framing several percent off and visibly re-frame on the first budget
  // re-open, which under the old curtain played out in front of the
  // player. Registered BEFORE the first fit so the converged branch can
  // release it; a hidden stage (a start scene owns the boot frame) has no
  // geometry to converge and releases at once. Bounded by the director.
  if (loadingScreenState.phase === 'covering') {
    fitSettleRelease = deferSceneReveal('board-fit', 6000);
  }
  fitBoard();
  if (stageKey() === undefined) {
    releaseFitSettleHold();
  }
  const stageNow = stage.value ?? undefined;
  if (stageNow !== undefined && typeof ResizeObserver !== 'undefined') {
    stageObserver = new ResizeObserver(() => scheduleFit());
    stageObserver.observe(stageNow);
  }
  // The board-space geometry verdict (boardSpaceGeometry) — board-bound
  // flights gate their measure/launch on it and re-aim on its epoch.
  offGeometryProbe = registerBoardGeometryProbe(() => boardGeometryCalm.value);
});
onBeforeUnmount(() => {
  offGeometryProbe?.();
  stopTerraformedBurst(); // a burst never outlives its stage
  releaseFitSettleHold(); // never strand the curtain on an unmounting stage
  clearRelationMarks();
  cellEl(props.moveFrom)?.classList.remove(MOVE_SOURCE_CLASS);
  // (The late verification and the fit / calibration / tween frames are `flow`'s — taken back with it.)
  stageObserver?.disconnect();
  document.documentElement.style.removeProperty('--board-scale');
});
defineExpose({activate, enterTrackInspect, focusSpace, move, seed, stepTrackMarker});
</script>
