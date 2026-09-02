<template>
  <!-- P27: the selection spotlight paints ONLY while the board is LIVE
       (inspection mode / placement) — on the calm board home no cell reads
       as focused, so nothing competes with ocean/availability highlights. -->
  <div class="con-board" :class="boardClasses" :data-framing="framingState" ref="root">
    <div class="con-board__stage" ref="stage">
      <GameBoardView :game="game" :players="playerView.players" :tileView="tileView" @toggleTileView="cycleTileView" />
    </div>
    <!-- THE PLACEMENT RETICLE — teleported INSIDE `.board-cont` so it is
         positioned in intrinsic board px and rides the planet's scale/pan
         transform for free. One persistent element that GLIDES between
         hexes; the hero scene taking the cell is what retires it. -->
    <Teleport v-if="cursorHost !== undefined" :to="cursorHost">
      <ConsoleBoardCursor
        v-if="cursorVisible && cursorPos !== undefined"
        :x="cursorPos.x" :y="cursorPos.y"
        :legal="selectedAvailable"
        :phase="placementFlowState.phase"
        :tileArtClass="cursorArtClass"
        :cubeColor="cursorCubeColor" />
    </Teleport>
    <!-- Cell details live in the shell-level ConsoleContextPanel (feedback
         iteration 2) — this component owns the STAGE + selection only. -->
  </div>
</template>

<script lang="ts">
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
import {defineComponent, PropType} from 'vue';
import GameBoardView from '@/client/components/GameBoardView.vue';
import ConsoleBoardCursor from '@/client/components/console/ConsoleBoardCursor.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {SpaceId} from '@/common/Types';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {NavRect, pickDirectional, pickNearest, pickStrictGrid, rectCenter} from '@/client/gamepad/spatialNav';
import {hoverBoardCell} from '@/client/components/board/boardInfoState';
import {consoleState} from '@/client/console/consoleRouter';
import {TileView, nextTileView} from '@/client/components/board/TileView';
import {
  planetFocusState, displayGlobalParams, PlanetFocusPhase,
} from '@/client/console/planetFocus';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {cssLengthPx} from '@/client/console/cssUnits';
import {placementFlowState} from '@/client/console/tilePlacement/placementFlow';
import {tilePlacementState} from '@/client/console/tilePlacement/consoleTilePlacement';
import {PlacementShape, swatchForKind} from '@/client/console/placementDossier';
import {tileCssClassOf} from '@/client/components/board/BoardSpaceTile.vue';
import {HAZARD_TILES, TileType} from '@/common/TileType';

const SELECT_CLASS = 'con-cell-sel';
/** P27: the focused global-parameter TRACK marker (inspection mode). */
const MARKER_CLASS = 'con-marker-sel';

/**
 * Intrinsic board-px coordinates per cell — measured ONCE per (map, cell):
 * every hex is absolutely positioned by a static per-id margin, so its
 * intrinsic position never changes for the life of a map. Measured through
 * rect division (cell rect vs `.board-cont` rect / the live scale), which
 * cancels the planet transform exactly — a mid-tween measurement is still
 * correct. Module-level: the section is a singleton and the key carries the
 * map name, so a rematch onto another board can never read a stale entry.
 */
const cellPosCache = new Map<string, {x: number, y: number}>();
/** Cells currently carrying a placement adjacency-hint class. */
const adjacencyMarked = new Set<HTMLElement>();
const ADJ_OCEAN_CLASS = 'con-adj-ocean';
const ADJ_HAZARD_CLASS = 'con-adj-hazard';

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

export default defineComponent({
  name: 'ConsoleBoardSection',
  components: {GameBoardView, ConsoleBoardCursor},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    placementActive: {type: Boolean, required: true},
    /** WHAT this placement puts down (the shell's one prompt resolver) —
     *  drives the reticle's tile projection. */
    placementShape: {type: Object as PropType<PlacementShape | undefined>, default: undefined},
    /** P27: BOARD INSPECTION MODE (L3) — strict row/column cell traversal. */
    inspecting: {type: Boolean, default: false},
  },
  data() {
    return {
      consoleState,
      planetFocusState,
      placementFlowState,
      tilePlacementState,
      /** The reticle's teleport target (`.board-cont`) — resolved once at
       *  mount; the board never remounts (the console update model). */
      cursorHost: undefined as HTMLElement | undefined,
      tileView: 'show' as TileView,
      stageObserver: undefined as ResizeObserver | undefined,
      fitRaf: 0,
      /** The stage's calibrated centring vars, saved at focus enter so the
       *  exit restores the exact pre-focus framing (calibration folds its
       *  offsets cumulatively — overwriting them would lose the truth). */
      savedBoardDx: undefined as string | undefined,
      savedBoardDy: undefined as string | undefined,
      /** The EXACT pre-focus framing, captured at enter. The return is a
       *  REVERSAL, not a re-derivation: it restores these verbatim. */
      savedScale: 0,
      savedNaturalW: 0,
      savedNaturalH: 0,
      /** The viewport at enter — the one honest "may I replay?" signal. */
      savedViewW: 0,
      savedViewH: 0,
      /**
       * Calibration is LOCKED to this viewport: a replayed framing is
       * already the converged one, so any further "improvement" is just an
       * unanimated correction landing after the landing. Only a real
       * viewport change lifts the lock (the stage's own handback must not —
       * it goes through scheduleFit, which re-opens the pass budget).
       */
      calibrateLock: undefined as {w: number, h: number} | undefined,
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
      fitKey: undefined as string | undefined,
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
      fitMode: 'normal' as 'normal' | 'focus',
      /** The first fit has landed — from here every scale change GLIDES. */
      fitted: false,
      /** A board transform is in flight: measurements are meaningless until
       *  it rests (calibration would otherwise chase a moving planet). */
      boardTweening: false,
      tweenRaf: 0,
      tweenStableFrames: 0,
      /** P29: the self-calibrated natural content box (seeded by constants). */
      naturalW: BOARD_NATURAL_W,
      naturalH: BOARD_NATURAL_H,
      /** The scale the last fit actually applied (measure divides by it). */
      appliedScale: 1,
      calibrateRaf: 0,
      calibratePasses: 0,
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
      lateVerifyKey: undefined as string | undefined,
      lateVerifyRuns: 0,
      lateVerifyTimer: 0,
      /** P27b: the vertical-run COLUMN anchor (set on horizontal moves /
       *  landings; keeps an up/down run in ONE visual hex column). */
      colAnchor: undefined as number | undefined,
    };
  },
  computed: {
    /** Read-only convergence signal for diagnostics and the framing e2e.
     *  "Settled" means normal overview framing with no scheduled work left,
     *  not merely a quiet interval between late-verification rungs. */
    framingState(): 'busy' | 'settled' {
      const focusBusy = this.planetFocusState.phase !== 'idle' || this.planetFocusState.arcsReturning;
      return !this.fitted || this.fitKey === undefined || focusBusy || this.fitRaf !== 0 ||
        this.boardTweening || this.calibrateRaf !== 0 || this.lateVerifyTimer !== 0 ? 'busy' : 'settled';
    },
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
    game(): GameModel {
      if (this.planetFocusState.heldParams === undefined) {
        return this.playerView.game;
      }
      return {...this.playerView.game, ...displayGlobalParams(this.playerView.game)};
    },
    /** Planet-focus phase → root classes (the CSS owns the actual motion). */
    boardClasses(): Record<string, boolean> {
      const phase = this.planetFocusState.phase;
      return {
        'con-board--live': this.placementActive || this.inspecting,
        'con-board--inspecting': this.inspecting && !this.placementActive,
        // Placement flow poses (placementFlow.ts): the LOCK recedes every
        // other legal cell so the chosen one dominates without contest.
        'con-board--placing': this.placementActive,
        'con-board--locked': this.placementActive && this.placementFlowState.phase !== 'navigate',
        'con-board--pfocus': phase === 'entering' || phase === 'active' || phase === 'exit-prep',
        'con-board--pfocus-anim': phase === 'entering' || phase === 'exit-prep' || phase === 'exiting',
        'con-board--pfocus-settled': phase === 'active',
        // The RETURN, as its own state: the reclaimed chrome stays out and
        // the arc band stays hidden for the whole shrink, so the stage's
        // clip box always covers the board that is still oversized. Giving
        // the space back at the START of the return is what cut the
        // returning planet + arcs along the dock line.
        'con-board--pfocus-exit': phase === 'exit-prep' || phase === 'exiting',
        // The board has a real fitted scale → its transform may transition.
        // Withheld until then so the FIRST fit doesn't animate the planet up
        // from scale(1) on every mount.
        'con-board--fitted': this.fitted,
      };
    },
    selectedSpaceId(): string | undefined {
      return this.consoleState.boardSpaceId;
    },
    selectedAvailable(): boolean {
      const el = this.cellEl(this.selectedSpaceId);
      return el !== undefined && el.classList.contains('board-space--available');
    },
    /**
     * The reticle exists for the whole placement and only the placement —
     * the moment the hero SCENE owns the cell (detect verified the server's
     * word and the flight/departure begins) the projection yields: the
     * arriving physical tile is the object now. `armed` (submit on the
     * wire, nothing visual yet) keeps the committing pose — that IS the
     * pending feedback.
     */
    cursorVisible(): boolean {
      if (!this.placementActive || this.selectedSpaceId === undefined) {
        return false;
      }
      const scene = this.tilePlacementState;
      if (scene.active && scene.phase !== 'armed' && scene.phase !== 'failed') {
        return false;
      }
      return true;
    },
    /** The reticle's anchor cell: the LOCK freezes it on the locked cell. */
    cursorSpaceId(): string | undefined {
      const flow = this.placementFlowState;
      if (flow.phase !== 'navigate' && flow.lockedSpaceId !== undefined) {
        return flow.lockedSpaceId;
      }
      return this.selectedSpaceId;
    },
    cursorPos(): {x: number, y: number} | undefined {
      const id = this.cursorSpaceId;
      const host = this.cursorHost;
      if (id === undefined || host === undefined) {
        return undefined;
      }
      const key = `${this.playerView.game.gameOptions?.boardName ?? ''}|${id}`;
      const hit = cellPosCache.get(key);
      if (hit !== undefined) {
        return hit;
      }
      const el = this.cellEl(id);
      if (el === undefined) {
        return undefined;
      }
      const hr = host.getBoundingClientRect();
      if (hr.width < 40) {
        return undefined; // board hidden — nothing to place the reticle on
      }
      const scale = hr.width / BOARD_CONT_W;
      const r = el.getBoundingClientRect();
      const pos = {x: (r.left - hr.left) / scale, y: (r.top - hr.top) / scale};
      cellPosCache.set(key, pos);
      return pos;
    },
    /** The projected tile's real board art ('' = a marker pick, ring only).
     *  Same resolution as the dossier's swatch: an explicit tileType wins,
     *  else the ordinary art of the placement KIND (convert plants arrives
     *  as `placementType: 'greenery'` with no tileType). */
    cursorArtClass(): string {
      const shape = this.placementShape;
      if (shape === undefined || shape.placementEffect === 'marker' || shape.placementEffect === 'bonus-only') {
        return '';
      }
      const tt = shape.tileType ?? swatchForKind(shape.placementType);
      if (tt === undefined) {
        return '';
      }
      const suffix = tileCssClassOf(tt, this.playerView.game.gameOptions?.expansions?.ares === true);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
    /** The ownership marker on the projection — every owned tile seats one;
     *  an ocean is neutral and never does (resolved tile, kind-only included). */
    cursorCubeColor(): string | undefined {
      const tt = this.placementShape?.tileType ?? swatchForKind(this.placementShape?.placementType);
      if (this.cursorArtClass === '' || tt === TileType.OCEAN) {
        return undefined;
      }
      return this.playerView.thisPlayer?.color;
    },
  },
  watch: {
    // Entering placement re-seats the selection on a LEGAL cell near the
    // board center (predictable landing); leaving keeps the last cell.
    placementActive(now: boolean) {
      if (now) {
        void this.$nextTick(() => {
          this.seed(true);
          // The placement is what BRINGS the board back (`goBoardHome`), and
          // a Planet Focus that engaged while the stage was hidden is still
          // owed its fit. Deterministic here rather than only on the
          // ResizeObserver's word; a framing that is already current is a
          // no-op (the key matches).
          this.scheduleFit();
          this.updateAdjacencyHints();
        });
      } else {
        this.clearAdjacencyHints();
      }
    },
    selectedSpaceId: {
      immediate: true,
      handler(now: string | undefined, before: string | undefined) {
        this.applySpotlight(before, now);
        if (now !== undefined) {
          hoverBoardCell(now as SpaceId);
        }
        this.updateAdjacencyHints();
      },
    },
    /**
     * PLANET FOCUS phases (planetFocus.ts) → framing. Enter/active apply
     * the deterministic focus fit (the CSS transition carries the growth,
     * `--pfocus-anim` gates it); exit/idle restore the calibrated normal
     * framing saved at enter. The module owns WHEN; this component owns
     * the geometry (it has the stage).
     */
    'planetFocusState.phase'(now: PlanetFocusPhase): void {
      if (now === 'entering' && this.savedBoardDx === undefined) {
        const stage = this.$refs.stage as HTMLElement | undefined;
        this.savedBoardDx = stage?.style.getPropertyValue('--con-board-dx') ?? '';
        this.savedBoardDy = stage?.style.getPropertyValue('--con-board-dy') ?? '';
        // …and the framing ITSELF. The return replays these instead of
        // re-fitting: a re-derivation lands on whatever the fit engine
        // concludes NOW (and the calibration pass that follows "improves"
        // it again ~400ms after the landing) — which is the second,
        // unanimated correction the player reads as the planet jumping.
        this.savedScale = this.appliedScale;
        this.savedNaturalW = this.naturalW;
        this.savedNaturalH = this.naturalH;
        this.savedViewW = window.innerWidth;
        this.savedViewH = window.innerHeight;
      }
      if (now === 'entering' || now === 'active') {
        // AFTER the DOM patch: the focus classes also reclaim layout (the
        // banner row hides, the dock clearance drops), and the fit must
        // measure the GROWN stage — a sync call would read the old box.
        // The ResizeObserver double-checks a frame later either way.
        void this.$nextTick(() => {
          this.fitBoard();
        });
        return;
      }
      if (now === 'exiting') {
        // ONLY here — the replay sets the final framing, and the stage's own
        // handback at idle is picked up by the ResizeObserver (which lands
        // on the same numbers, so it is a no-op). Re-running the restore at
        // idle used to re-arm calibration and undo the replay.
        void this.$nextTick(() => this.restoreNormalFraming());
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
      if (now === 'idle' && this.fitMode === 'focus') {
        void this.$nextTick(() => this.restoreNormalFraming());
      }
    },
    /** The band has finished condensing — the board is measurable again, so
     *  let the deferred calibration pass run now (on a settled scene it is
     *  a no-op or a sub-pixel nudge; either way nothing is mid-flight). */
    'planetFocusState.arcsReturning'(now: boolean, was: boolean): void {
      if (!now && was) {
        this.calibratePasses = 0;
        this.scheduleCalibrate();
      }
    },
    /**
     * P27: the focused TRACK marker — spotlight ring + the SAME premium
     * ScaleTooltip the mouse hover shows (a synthetic mouseenter fires the
     * chip's own Vue handler, so there is exactly one tooltip source).
     * A focused marker suppresses the cell spotlight (one focus at a time).
     */
    'consoleState.trackMarker'(now: string | undefined, before: string | undefined) {
      const prev = this.markerEl(before);
      if (prev !== undefined) {
        prev.classList.remove(MARKER_CLASS);
        prev.dispatchEvent(new MouseEvent('mouseleave'));
      }
      const el = this.markerEl(now);
      if (el !== undefined) {
        el.classList.add(MARKER_CLASS);
        el.dispatchEvent(new MouseEvent('mouseenter'));
        this.cellEl(this.selectedSpaceId)?.classList.remove(SELECT_CLASS);
      } else {
        this.applySpotlight(undefined, this.selectedSpaceId);
      }
    },
  },
  methods: {
    cycleTileView(): void {
      this.tileView = nextTileView(this.tileView);
    },
    /** Fit the board to the console stage: write --board-scale ourselves. */
    fitBoard(): void {
      const stage = this.$refs.stage as HTMLElement | undefined;
      if (stage === undefined) {
        return;
      }
      const r = stage.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) {
        return; // hidden (hand section) / not laid out yet — keep the last scale
      }
      const phase = this.planetFocusState.phase;
      if (phase === 'entering' || phase === 'active') {
        this.fitPlanetFocus(stage, r);
        // The FOCUS framing belongs to this frame just as the normal one does.
        // Stamping it is what makes a SKIPPED focus fit recoverable: while the
        // stage was hidden nothing was stamped, so the pair still names the
        // NORMAL framing, and the board's return is a genuine mode change that
        // re-opens the fit (see `fitMode`).
        this.fitKey = this.stageFrame(r);
        this.fitMode = 'focus';
        return;
      }
      // The stage's box is CONSTANT across the whole focus cycle now (the
      // mode bleeds instead of reclaiming layout), so the live rect is
      // always the honest destination — no stored target, nothing to go
      // stale between the two ends of the return.
      const scale = Math.min(
        (r.width - STAGE_PAD * 2) / this.naturalW,
        (r.height - STAGE_PAD_Y * 2) / this.naturalH,
      ) * SCALE_BOOST;
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
      this.applyBoardScale(clamped);
      // This framing now belongs to THIS frame — a later resize back to the
      // same box is a no-op (`scheduleFit`), and the convergence below is the
      // only thing still allowed to refine it.
      this.fitKey = this.stageFrame(r);
      this.fitMode = 'normal';
      // P29: refine against the REAL rendered content (next frame — the new
      // scale must paint first so the union bbox reflects it).
      this.scheduleCalibrate();
    },
    /**
     * Write `--board-scale` and, when it actually MOVED, arm the tween
     * guard for the transition that write just started (the CSS owns the
     * curve; this only records that the planet is in motion, so nothing
     * measures it mid-flight). The first write also unlocks the transition.
     */
    applyBoardScale(scale: number): void {
      const moved = Math.abs(scale - this.appliedScale) > 0.0005;
      this.appliedScale = scale;
      document.documentElement.style.setProperty('--board-scale', scale.toFixed(4));
      this.publishArcBleed(scale);
      if (moved && this.fitted) {
        this.armBoardTween();
      }
      this.fitted = true;
    },
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
    publishArcBleed(scale: number): void {
      const stage = this.$refs.stage as HTMLElement | undefined;
      stage?.style.setProperty('--con-arc-bleed', `${(ARC_MARKER_BLEED * scale).toFixed(1)}px`);
    },
    /** Hold measurements off until the transform has actually PAINTED at its
     *  target. Timers describe intended CSS duration, not compositor
     *  progress; on a busy 4K frame they previously unlocked calibration
     *  while the old rect was still on screen, so the same offset was folded
     *  repeatedly (82px -> 160px -> ... -> 4300px). */
    armBoardTween(): void {
      this.boardTweening = true;
      this.tweenStableFrames = 0;
      this.scheduleBoardTweenCheck();
    },
    scheduleBoardTweenCheck(): void {
      if (this.tweenRaf !== 0) {
        return;
      }
      this.tweenRaf = window.requestAnimationFrame(() => {
        this.tweenRaf = 0;
        if (!this.boardTweening) {
          return;
        }
        const stage = this.$refs.stage as HTMLElement | undefined;
        const board = stage?.querySelector<HTMLElement>(':scope > .board-cont');
        if (stage === undefined || board === null || board === undefined) {
          return;
        }
        const sr = stage.getBoundingClientRect();
        const br = board.getBoundingClientRect();
        // A v-show section handoff is not a geometry frame. Pause polling;
        // scheduleFit resumes it when ResizeObserver sees the stage return.
        if (sr.width < 40 || sr.height < 40 || br.width < 40 || br.height < 40) {
          return;
        }
        const rawX = stage.style.getPropertyValue('--con-board-dx');
        const rawY = stage.style.getPropertyValue('--con-board-dy');
        const targetX = rawX !== '' ? parseFloat(rawX) : 6;
        const targetY = rawY !== '' ? parseFloat(rawY) : -4;
        const targetScale = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--board-scale'),
        ) || this.appliedScale;
        const paintedScaleX = br.width / BOARD_CONT_W;
        const paintedScaleY = br.height / BOARD_CONT_H;
        const paintedX = (br.left + br.width / 2) - (sr.left + sr.width / 2);
        const paintedY = (br.top + br.height / 2) - (sr.top + sr.height / 2);
        const atTarget = Math.abs(paintedScaleX - targetScale) <= TWEEN_SCALE_EPS &&
          Math.abs(paintedScaleY - targetScale) <= TWEEN_SCALE_EPS &&
          Math.abs(paintedX - targetX) <= TWEEN_OFFSET_EPS &&
          Math.abs(paintedY - targetY) <= TWEEN_OFFSET_EPS;
        this.tweenStableFrames = atTarget ? this.tweenStableFrames + 1 : 0;
        if (this.tweenStableFrames >= TWEEN_STABLE_FRAMES) {
          this.boardTweening = false;
          this.tweenStableFrames = 0;
          // The planet is at rest — NOW a calibration pass is meaningful.
          this.scheduleCalibrate();
          return;
        }
        this.scheduleBoardTweenCheck();
      });
    },
    /**
     * The PLANET FOCUS fit — deterministic: the frame is a fixed rectangle
     * of `.board-cont`'s local space (the Mars disc is a fixed asset), so
     * the scale and the centring offset are pure arithmetic. No calibration
     * runs in focus — there is nothing to measure, and a mid-transition
     * measurement would poison the vars anyway.
     */
    fitPlanetFocus(stage: HTMLElement, r: DOMRect): void {
      // The usable height is the stage PLUS the bleed the mode is allowed
      // below it (the dock's clearance — see `--pfocus-bleed`). The stage's
      // own box never changes: taking that space by shrinking layout moved
      // the centring flex and teleported the planet by half the reclaim on
      // the way back, which is the jump this whole approach exists to kill.
      const bleed = this.pfocusBleedPx();
      // No breathing pads on purpose: the disc's border IS meant to land on
      // the stage border («буквально на границе экрана по высоте»).
      const scale = Math.min(r.width / PFOCUS_FRAME.w, (r.height + bleed) / PFOCUS_FRAME.h);
      const clamped = Math.min(PFOCUS_MAX_SCALE, Math.max(MIN_SCALE, scale));
      this.applyBoardScale(clamped);
      // Centre the FRAME in that virtual box: the flex centres the
      // .board-cont BOX in the STAGE, so the translate carries both the
      // frame-centre ↔ box-centre offset and half the bleed (screen px —
      // the translate sits OUTSIDE the scale in the transform, and being a
      // transform it is transitioned like the scale).
      const dx = (BOARD_CONT_W / 2 - (PFOCUS_FRAME.x + PFOCUS_FRAME.w / 2)) * clamped;
      const dy = (BOARD_CONT_H / 2 - (PFOCUS_FRAME.y + PFOCUS_FRAME.h / 2)) * clamped + bleed / 2;
      stage.style.setProperty('--con-board-dx', `${dx.toFixed(1)}px`);
      stage.style.setProperty('--con-board-dy', `${dy.toFixed(1)}px`);
    },
    /** `--pfocus-bleed` in px (a length-valued custom property must go
     *  through cssLengthPx — getPropertyValue returns "2.9rem"). */
    pfocusBleedPx(): number {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined || typeof getComputedStyle !== 'function') {
        return 0;
      }
      return cssLengthPx(getComputedStyle(root).getPropertyValue('--pfocus-bleed'), 0);
    },
    /**
     * Leaving focus: put back the calibrated normal framing captured at
     * enter (empty saved value = the CSS fallback), then re-fit — the same
     * transition that grew the planet now carries it home.
     */
    restoreNormalFraming(): void {
      const stage = this.$refs.stage as HTMLElement | undefined;
      // THE RETURN IS A REVERSAL. Replay the exact pre-focus framing —
      // scale, natural box and centring — so the planet glides back to the
      // pixel it came from and NOTHING corrects it afterwards. A fresh fit
      // is the fallback for the one case a replay cannot cover: the
      // viewport genuinely changed while focus was up.
      const saved = this.savedScale;
      this.savedScale = 0;
      if (saved > 0 && this.savedViewW === window.innerWidth && this.savedViewH === window.innerHeight) {
        this.naturalW = this.savedNaturalW;
        this.naturalH = this.savedNaturalH;
        this.restoreStageOffsets(stage);
        this.applyBoardScale(saved);
        // The replayed framing IS the reference. A calibration pass here
        // would "improve" it ~400ms after the landing — an unanimated
        // second correction, which is precisely the jump this replaces.
        this.calibrateLock = {w: window.innerWidth, h: window.innerHeight};
        // …and it belongs to the frame it was replayed into, so the stage's
        // own handback (which arrives as a resize) does not re-derive it. The
        // MODE is restored unconditionally: an exit that lands while the board
        // is hidden cannot measure a box, but the framing it just replayed is
        // a normal one all the same — leaving the mode on `focus` would make
        // the board's return a «mode change» and re-derive a framing that was
        // deliberately replayed rather than re-fitted.
        this.fitKey = this.stageKey() ?? this.fitKey;
        this.fitMode = 'normal';
        return;
      }
      this.restoreStageOffsets(stage);
      // A fresh calibration convergence once the exit settles (the gate
      // inside calibrate() keeps it out of the transition itself).
      this.calibratePasses = 0;
      this.fitBoard();
    },
    /** Put back the centring vars captured at enter (empty = CSS fallback). */
    restoreStageOffsets(stage: HTMLElement | undefined): void {
      if (stage !== undefined && this.savedBoardDx !== undefined) {
        if (this.savedBoardDx === '') {
          stage.style.removeProperty('--con-board-dx');
        } else {
          stage.style.setProperty('--con-board-dx', this.savedBoardDx);
        }
        if (this.savedBoardDy === '' || this.savedBoardDy === undefined) {
          stage.style.removeProperty('--con-board-dy');
        } else {
          stage.style.setProperty('--con-board-dy', this.savedBoardDy);
        }
      }
      this.savedBoardDx = undefined;
      this.savedBoardDy = undefined;
    },
    /**
     * WHICH FRAMING the fit engine would derive right now — mirrors the branch
     * in `fitBoard` exactly, and nothing else may decide it.
     */
    framingMode(): 'focus' | 'normal' {
      const phase = this.planetFocusState.phase;
      return phase === 'entering' || phase === 'active' ? 'focus' : 'normal';
    },
    /** A measured stage box + the viewport, as one key. Rounded, so sub-pixel
     *  jitter is not a "change". */
    stageFrame(r: DOMRect): string {
      return `${Math.round(r.width)}x${Math.round(r.height)}` +
        `@${window.innerWidth}x${window.innerHeight}`;
    },
    /**
     * The frame the framing is derived for: the stage box + the viewport.
     * `undefined` while the board is hidden — there is nothing to fit, and
     * nothing to remember either (the framing it will come back to is the one
     * it left with).
     */
    stageKey(): string | undefined {
      const stage = this.$refs.stage as HTMLElement | undefined;
      if (stage === undefined) {
        return undefined;
      }
      const r = stage.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) {
        return undefined;
      }
      return this.stageFrame(r);
    },
    scheduleFit(): void {
      if (this.fitRaf !== 0) {
        return;
      }
      this.fitRaf = window.requestAnimationFrame(() => {
        this.fitRaf = 0;
        const key = this.stageKey();
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
        if (key === this.fitKey && this.framingMode() === this.fitMode) {
          if (this.boardTweening) {
            this.scheduleBoardTweenCheck();
          }
          return;
        }
        // A real change (window resize / profile flip): a fresh convergence.
        this.calibratePasses = 0;
        this.calibrateLock = undefined;
        this.fitBoard();
      });
    },
    /**
     * ONE deferred re-measurement per frame, after the arc markers have
     * finished gliding to their values. A convergence that ran against a
     * composing board is otherwise final — that is how a boot could lock a
     * framing several percent off, which then surfaced as a "jump" the first
     * time anything re-opened the budget.
     */
    armLateVerify(): void {
      const key = this.fitKey;
      if (key === undefined) {
        return;
      }
      if (this.lateVerifyKey !== key) {
        this.lateVerifyKey = key;
        this.lateVerifyRuns = 0;
      }
      if (this.lateVerifyRuns >= LATE_VERIFY_MAX) {
        return;
      }
      this.lateVerifyRuns++;
      if (this.lateVerifyTimer !== 0) {
        window.clearTimeout(this.lateVerifyTimer);
      }
      // A WIDENING ladder, because "settled" has no single timestamp: the
      // deal cinematic, the arcs' travel and the start scene's handback all
      // finish at their own pace, and a convergence that ran before them is
      // measuring a board that no longer exists. Each rung starts from a
      // fresh budget; on an already-settled board a rung is one no-op sweep.
      this.lateVerifyTimer = window.setTimeout(() => {
        this.lateVerifyTimer = 0;
        this.calibratePasses = 0;
        this.scheduleCalibrate();
      }, consoleMotionMs(LATE_VERIFY_MS * this.lateVerifyRuns));
    },
    scheduleCalibrate(): void {
      if (this.calibrateRaf !== 0) {
        return;
      }
      if (this.calibratePasses >= CALIBRATE_MAX_PASSES) {
        // The convergence ran out of road — it did NOT finish. Looking again
        // once the board is quiet is the whole point of the ladder; without
        // this the framing simply froze wherever the budget happened to end,
        // and only a section round trip could ever re-open it (which is
        // exactly the re-framing the player saw as the planet shifting).
        this.armLateVerify();
        return;
      }
      this.calibrateRaf = window.requestAnimationFrame(() => {
        this.calibrateRaf = 0;
        this.calibrate();
      });
    },
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
    calibrate(): void {
      // PLANET FOCUS: the focus fit is deterministic and the transitions
      // make live measurements meaningless — calibration is a normal-mode
      // instrument only. `arcsReturning` extends that ban past the phase:
      // the band is still CONDENSING there (its boxes are mid-transform), so
      // a measurement taken then reports a wrong natural box and re-fits the
      // planet WITHOUT a transition — the hard nudge in the landing's last
      // frame. It resumes a beat later (the arcsReturning watcher re-arms it).
      if (this.planetFocusState.phase !== 'idle' || this.planetFocusState.arcsReturning ||
          this.boardTweening) {
        return;
      }
      if (this.calibrateLock !== undefined) {
        if (this.calibrateLock.w === window.innerWidth && this.calibrateLock.h === window.innerHeight) {
          return; // a replayed framing is already converged — leave it alone
        }
        this.calibrateLock = undefined; // the viewport really moved: re-converge
      }
      const stage = this.$refs.stage as HTMLElement | undefined;
      if (stage === undefined) {
        return;
      }
      const sr = stage.getBoundingClientRect();
      if (sr.width < 40 || sr.height < 40) {
        return;
      }
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const el of stage.querySelectorAll<HTMLElement>(CONTENT_SELECTOR)) {
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
      const scale = this.appliedScale;
      const natW = Math.min(NATURAL_W_MAX, Math.max(NATURAL_W_MIN, (right - left) / scale));
      const natH = Math.min(NATURAL_H_MAX, Math.max(NATURAL_H_MIN, (bottom - top) / scale));
      // True-centre offset (screen px): where the content centre sits vs the
      // stage centre — folded into the child translate CSS vars.
      const dx = (sr.left + sr.width / 2) - (left + right) / 2;
      const dy = (sr.top + sr.height / 2) - (top + bottom) / 2;
      const sizeDrift = Math.abs(natW - this.naturalW) > CALIBRATE_SIZE_EPS ||
        Math.abs(natH - this.naturalH) > CALIBRATE_SIZE_EPS;
      const offsetDrift = Math.abs(dx) > CALIBRATE_OFFSET_EPS || Math.abs(dy) > CALIBRATE_OFFSET_EPS;
      if (!sizeDrift && !offsetDrift) {
        this.armLateVerify(); // …unless the board was still composing
        return; // converged
      }
      this.calibratePasses++;
      if (offsetDrift) {
        // Written on the STAGE so the vars INHERIT to every board child —
        // GameBoardView is multi-root, so `firstElementChild` is its anchor
        // <a>, not the board (custom props don't reach siblings).
        // The CSS fallback translate is (6px, −4px) — start the fold from it
        // so the FIRST pass lands exactly (dx measured the current result).
        const rawX = stage.style.getPropertyValue('--con-board-dx');
        const rawY = stage.style.getPropertyValue('--con-board-dy');
        const prevX = rawX !== '' ? parseFloat(rawX) : 6;
        const prevY = rawY !== '' ? parseFloat(rawY) : -4;
        stage.style.setProperty('--con-board-dx', `${(prevX + dx).toFixed(1)}px`);
        stage.style.setProperty('--con-board-dy', `${(prevY + dy).toFixed(1)}px`);
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
        this.armBoardTween();
      }
      if (sizeDrift) {
        this.naturalW = natW;
        this.naturalH = natH;
        this.fitBoard(); // re-fit at the honest natural box
      }
      if (!this.boardTweening) {
        // Nothing is in flight — the next measurement is honest right away.
        this.scheduleCalibrate();
      }
      // …otherwise the tween's own expiry re-schedules it, at rest.
    },
    cellEl(spaceId: string | undefined): HTMLElement | undefined {
      if (spaceId === undefined) {
        return undefined;
      }
      const root = this.$refs.root as HTMLElement | undefined;
      return root?.querySelector<HTMLElement>(`[data_space_id="${spaceId}"]`) ?? undefined;
    },
    /**
     * PLACEMENT ADJACENCY HINTS — the calm on-field tie between the focused
     * cell and the neighbours that make its price/reward true: adjacent
     * OCEANS (each pays the flat placement income) and adjacent HAZARDS
     * (what the toll in the dossier is about). Geometry is the intrinsic
     * position cache (pure math after warm-up — no layout reads per step);
     * the tile identity comes from the authoritative view model, never from
     * DOM classes. Deliberately only the two always-true adjacencies — the
     * exact arithmetic stays the dossier's job.
     */
    updateAdjacencyHints(): void {
      this.clearAdjacencyHints();
      if (!this.placementActive || !this.selectedAvailable) {
        return;
      }
      const id = this.cursorSpaceId;
      const centre = this.cellIntrinsicCentre(id);
      if (id === undefined || centre === undefined) {
        return;
      }
      const reach = 46 * 1.5; /* keep-px: board px-space — one hex pitch */
      for (const space of this.playerView.game.spaces ?? []) {
        if (space.id === id || space.tileType === undefined) {
          continue;
        }
        const isOcean = space.tileType === TileType.OCEAN;
        const isHazard = HAZARD_TILES.has(space.tileType);
        if (!isOcean && !isHazard) {
          continue;
        }
        const c = this.cellIntrinsicCentre(space.id);
        if (c === undefined || Math.hypot(c.x - centre.x, c.y - centre.y) > reach) {
          continue;
        }
        const el = this.cellEl(space.id);
        if (el !== undefined) {
          el.classList.add(isOcean ? ADJ_OCEAN_CLASS : ADJ_HAZARD_CLASS);
          adjacencyMarked.add(el);
        }
      }
    },
    clearAdjacencyHints(): void {
      for (const el of adjacencyMarked) {
        el.classList.remove(ADJ_OCEAN_CLASS, ADJ_HAZARD_CLASS);
      }
      adjacencyMarked.clear();
    },
    /** A cell's intrinsic centre (board px), through the same cached measure
     *  the reticle rides. */
    cellIntrinsicCentre(spaceId: string | undefined): {x: number, y: number} | undefined {
      const host = this.cursorHost;
      if (spaceId === undefined || host === undefined) {
        return undefined;
      }
      const key = `${this.playerView.game.gameOptions?.boardName ?? ''}|${spaceId}`;
      let pos = cellPosCache.get(key);
      if (pos === undefined) {
        const el = this.cellEl(spaceId);
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
    },
    applySpotlight(before: string | undefined, now: string | undefined): void {
      this.cellEl(before)?.classList.remove(SELECT_CLASS);
      const el = this.cellEl(now);
      el?.classList.add(SELECT_CLASS);
    },
    /** P27: a track marker's DOM element by its stable key. */
    markerEl(key: string | undefined): HTMLElement | undefined {
      if (key === undefined) {
        return undefined;
      }
      const root = this.$refs.root as HTMLElement | undefined;
      return root?.querySelector<HTMLElement>(`[data-arc-marker="${CSS.escape(key)}"]`) ?? undefined;
    },
    /**
     * Collect navigable CELLS: legal-only during placement (unless
     * free-roam). Track markers are a SEPARATE surface (R3 scale
     * inspection cycles them — see trackMarkers), never mixed in here.
     */
    candidates(): Array<BoardCandidate> {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined) {
        return [];
      }
      const constrain = this.placementActive && !this.consoleState.freeRoam;
      const selector = constrain ? '.board-space--available[data_space_id]' : '.board-space[data_space_id]';
      const out: Array<BoardCandidate> = [];
      for (const el of root.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          out.push({kind: 'cell', id: el.getAttribute('data_space_id') ?? '', el, rect: {left: r.left, top: r.top, width: r.width, height: r.height}});
        }
      }
      return out;
    },
    /**
     * P27b: the R3 SCALE-INSPECTION ring — every track marker (scale
     * bonuses + planetary-event chips) sorted by its angle around the
     * board centre, so prev/next walks the circle predictably.
     */
    trackMarkers(): Array<{id: string, el: HTMLElement, angle: number}> {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined) {
        return [];
      }
      const stage = root.querySelector('.board-cont') ?? root;
      const sr = stage.getBoundingClientRect();
      const cx = sr.left + sr.width / 2;
      const cy = sr.top + sr.height / 2;
      const out: Array<{id: string, el: HTMLElement, angle: number}> = [];
      for (const el of root.querySelectorAll<HTMLElement>('.arc-marker[data-arc-marker]')) {
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
    },
    /** Enter scale inspection: focus the marker nearest 12 o'clock. */
    enterTrackInspect(): boolean {
      const markers = this.trackMarkers();
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
      this.consoleState.trackMarker = markers[best].id;
      return true;
    },
    /** Step the scale-inspection cursor around the ring (wraps — «по кругу»). */
    stepTrackMarker(step: 1 | -1): void {
      const markers = this.trackMarkers();
      if (markers.length === 0) {
        return;
      }
      const at = markers.findIndex((m) => m.id === this.consoleState.trackMarker);
      if (at === -1) {
        this.enterTrackInspect();
        return;
      }
      this.consoleState.trackMarker = markers[(at + step + markers.length) % markers.length].id;
    },
    /** Seed the selection: available cell (or any cell) nearest the board center. */
    seed(preferAvailable: boolean): void {
      const cells = this.candidates().filter((c) => c.kind === 'cell');
      if (cells.length === 0) {
        return;
      }
      const root = this.$refs.root as HTMLElement;
      const stage = root.querySelector('.board-cont') ?? root;
      const r = stage.getBoundingClientRect();
      const center = {x: r.left + r.width / 2, y: r.top + r.height / 2};
      const pool = preferAvailable ?
        (cells.filter((c) => c.el.classList.contains('board-space--available')) as typeof cells) :
        cells;
      const usable = pool.length > 0 ? pool : cells;
      const idx = pickNearest(center, usable.map((c) => c.rect));
      this.landOn(usable[idx ?? 0]);
    },
    select(target: BoardCandidate | string): void {
      const id = typeof target === 'string' ? target : target.id;
      this.consoleState.trackMarker = undefined;
      this.consoleState.boardSpaceId = id;
    },
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
    move(dir: NavDirection): void {
      const targets = this.candidates();
      if (targets.length === 0) {
        return;
      }
      const current = targets.find((c) => c.id === this.selectedSpaceId);
      if (current === undefined) {
        // Selection left the candidate set (e.g. constraint kicked in) —
        // glide to the nearest candidate instead of jumping to a corner.
        const prevEl = this.cellEl(this.selectedSpaceId);
        if (prevEl !== undefined) {
          const r = prevEl.getBoundingClientRect();
          const idx = pickNearest(rectCenter({left: r.left, top: r.top, width: r.width, height: r.height}), targets.map((c) => c.rect));
          this.landOn(targets[idx ?? 0]);
          return;
        }
        this.seed(this.placementActive);
        return;
      }
      const others = targets.filter((c) => c !== current);
      const rects = others.map((c) => c.rect);
      // Strict hex traversal now covers PLACEMENT too (was inspection-only):
      // left/right stay in the row, up/down keep the column anchor. The
      // off-grid leap fallback below can still break the row/column at an
      // end, but the guard blocks any adjacent diagonal drift — the exact
      // behaviour placement was missing.
      const strictMode = this.inspecting || this.placementActive;
      if (strictMode) {
        const anchor = this.colAnchor ?? rectCenter(current.rect).x;
        const strict = pickStrictGrid(current.rect, rects, dir, anchor);
        if (strict !== undefined) {
          const target = others[strict];
          if (dir === 'left' || dir === 'right') {
            this.colAnchor = rectCenter(target.rect).x; // a horizontal move re-anchors
          } else if (this.colAnchor === undefined) {
            this.colAnchor = anchor; // a vertical run keeps its column
          }
          this.select(target);
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
      this.landOn(others[idx]);
    },
    /** A non-strict landing (seed / glide / diagonal) re-anchors the column. */
    landOn(target: BoardCandidate): void {
      this.colAnchor = rectCenter(target.rect).x;
      this.select(target);
    },
    /**
     * A on the selected cell during placement: the existing per-cell onclick
     * (SelectSpace) — the same submission contract as a mouse click.
     * Returns false when the cell isn't legal (the shell shows the refusal).
     */
    activate(): boolean {
      if (!this.placementActive) {
        return false;
      }
      const el = this.cellEl(this.selectedSpaceId);
      if (el === undefined || !el.classList.contains('board-space--available')) {
        return false;
      }
      el.click();
      return true;
    },
  },
  mounted() {
    // P29c: the temporary LB/RB tuner persisted its value here — the tuned
    // ×1.05 is the compiled default now, drop the stale key.
    try {
      window.localStorage?.removeItem('tm_board_scale');
    } catch (err) {
      // storage unavailable — nothing to clean
    }
    // The reticle's home — Board.vue's root, which never remounts for the
    // session (the console update model), so resolving it once is safe.
    const stageEl = this.$refs.stage as HTMLElement | undefined;
    this.cursorHost = stageEl?.querySelector<HTMLElement>('.board-cont') ?? undefined;
    if (this.selectedSpaceId === undefined) {
      this.seed(this.placementActive);
    } else {
      // Re-apply the spotlight to the freshly-rendered board DOM.
      this.applySpotlight(undefined, this.selectedSpaceId);
    }
    this.fitBoard();
    const stage = this.$refs.stage as HTMLElement | undefined;
    if (stage !== undefined && typeof ResizeObserver !== 'undefined') {
      this.stageObserver = new ResizeObserver(() => this.scheduleFit());
      this.stageObserver.observe(stage);
    }
  },
  beforeUnmount() {
    this.clearAdjacencyHints();
    if (this.lateVerifyTimer !== 0) {
      window.clearTimeout(this.lateVerifyTimer);
    }
    this.stageObserver?.disconnect();
    if (this.fitRaf !== 0) {
      window.cancelAnimationFrame(this.fitRaf);
    }
    if (this.calibrateRaf !== 0) {
      window.cancelAnimationFrame(this.calibrateRaf);
    }
    if (this.tweenRaf !== 0) {
      window.cancelAnimationFrame(this.tweenRaf);
    }
    document.documentElement.style.removeProperty('--board-scale');
  },
});
</script>
