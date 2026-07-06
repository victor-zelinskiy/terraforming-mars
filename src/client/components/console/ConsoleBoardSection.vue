<template>
  <!-- P27: the selection spotlight paints ONLY while the board is LIVE
       (inspection mode / placement) — on the calm board home no cell reads
       as focused, so nothing competes with ocean/availability highlights. -->
  <div class="con-board" :class="{'con-board--live': placementActive || inspecting, 'con-board--inspecting': inspecting && !placementActive}" ref="root">
    <div class="con-board__stage" ref="stage">
      <GameBoardView :game="game" :players="playerView.players" :tileView="tileView" @toggleTileView="cycleTileView" />
    </div>
    <!-- Cell details live in the shell-level ConsoleContextPanel (feedback
         iteration 2) — this component owns the STAGE + selection only. -->
  </div>
</template>

<script lang="ts">
/**
 * Console Board section (CONSOLE_MODE_CONCEPT.md §7). Reuses the REAL board
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
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {SpaceId} from '@/common/Types';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {NavRect, pickDirectional, pickNearest, pickStrictGrid, rectCenter} from '@/client/gamepad/spatialNav';
import {hoverBoardCell} from '@/client/components/board/boardInfoState';
import {consoleState} from '@/client/console/consoleRouter';
import {TileView, nextTileView} from '@/client/components/board/TileView';

const SELECT_CLASS = 'con-cell-sel';
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
/** Sanity clamps for the MEASURED natural box — a mid-transition / stray
 *  measurement can never explode or collapse the board. */
const NATURAL_W_MIN = 480;
const NATURAL_W_MAX = 760;
const NATURAL_H_MIN = 400;
const NATURAL_H_MAX = 620;
/** Re-fit only on a meaningful drift (px of natural size / px of offset). */
const CALIBRATE_SIZE_EPS = 3;
const CALIBRATE_OFFSET_EPS = 2;
/** Bounded convergence per fit cycle (measure → refit → measure → done). */
const CALIBRATE_MAX_PASSES = 2;

/**
 * P29c — the tuned console board scale multiplier. ×1.05 was dialled in
 * LIVE on the Deck against the OLD off-Mars layout; after the P29c cell
 * re-lay the self-calibration measures the TIGHTER union and the plain
 * fit already lands where ×1.05 used to — the honest multiplier is 1
 * (kept as the single knob should hardware tuning ever be needed again).
 */
const SCALE_BOOST = 1.0;

export default defineComponent({
  name: 'ConsoleBoardSection',
  components: {GameBoardView},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    placementActive: {type: Boolean, required: true},
    /** P27: BOARD INSPECTION MODE (L3) — strict row/column cell traversal. */
    inspecting: {type: Boolean, default: false},
  },
  data() {
    return {
      consoleState,
      tileView: 'show' as TileView,
      stageObserver: undefined as ResizeObserver | undefined,
      fitRaf: 0,
      /** P29: the self-calibrated natural content box (seeded by constants). */
      naturalW: BOARD_NATURAL_W,
      naturalH: BOARD_NATURAL_H,
      /** The scale the last fit actually applied (measure divides by it). */
      appliedScale: 1,
      calibrateRaf: 0,
      calibratePasses: 0,
      /** P27b: the vertical-run COLUMN anchor (set on horizontal moves /
       *  landings; keeps an up/down run in ONE visual hex column). */
      colAnchor: undefined as number | undefined,
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    selectedSpaceId(): string | undefined {
      return this.consoleState.boardSpaceId;
    },
    selectedAvailable(): boolean {
      const el = this.cellEl(this.selectedSpaceId);
      return el !== undefined && el.classList.contains('board-space--available');
    },
  },
  watch: {
    // Entering placement re-seats the selection on a LEGAL cell near the
    // board center (predictable landing); leaving keeps the last cell.
    placementActive(now: boolean) {
      if (now) {
        void this.$nextTick(() => this.seed(true));
      }
    },
    selectedSpaceId: {
      immediate: true,
      handler(now: string | undefined, before: string | undefined) {
        this.applySpotlight(before, now);
        if (now !== undefined) {
          hoverBoardCell(now as SpaceId);
        }
      },
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
      const scale = Math.min(
        (r.width - STAGE_PAD * 2) / this.naturalW,
        (r.height - STAGE_PAD_Y * 2) / this.naturalH,
      ) * SCALE_BOOST;
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
      this.appliedScale = clamped;
      document.documentElement.style.setProperty('--board-scale', clamped.toFixed(4));
      // P29: refine against the REAL rendered content (next frame — the new
      // scale must paint first so the union bbox reflects it).
      this.scheduleCalibrate();
    },
    scheduleFit(): void {
      if (this.fitRaf !== 0) {
        return;
      }
      this.fitRaf = window.requestAnimationFrame(() => {
        this.fitRaf = 0;
        // A fresh fit cycle (mount / stage resize) restarts the bounded
        // calibration convergence.
        this.calibratePasses = 0;
        this.fitBoard();
      });
    },
    scheduleCalibrate(): void {
      if (this.calibrateRaf !== 0 || this.calibratePasses >= CALIBRATE_MAX_PASSES) {
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
      }
      if (sizeDrift) {
        this.naturalW = natW;
        this.naturalH = natH;
        this.fitBoard(); // re-fit at the honest natural box (schedules the next pass)
      } else {
        this.scheduleCalibrate(); // verify the offset settled
      }
    },
    cellEl(spaceId: string | undefined): HTMLElement | undefined {
      if (spaceId === undefined) {
        return undefined;
      }
      const root = this.$refs.root as HTMLElement | undefined;
      return root?.querySelector<HTMLElement>(`[data_space_id="${spaceId}"]`) ?? undefined;
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
    /** RT: jump the selection to the NEXT legal cell (cyclic, DOM order). */
    nextAvailable(): boolean {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined) {
        return false;
      }
      const cells = Array.from(root.querySelectorAll<HTMLElement>('.board-space--available[data_space_id]'));
      if (cells.length === 0) {
        return false;
      }
      const ids = cells.map((el) => el.getAttribute('data_space_id') ?? '');
      const at = ids.indexOf(this.selectedSpaceId ?? '');
      this.select(ids[(at + 1) % ids.length]);
      return true;
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
    this.stageObserver?.disconnect();
    if (this.fitRaf !== 0) {
      window.cancelAnimationFrame(this.fitRaf);
    }
    if (this.calibrateRaf !== 0) {
      window.cancelAnimationFrame(this.calibrateRaf);
    }
    document.documentElement.style.removeProperty('--board-scale');
  },
});
</script>
