<template>
  <!--
    Track cursor for a board global-parameter dial (temperature / oxygen /
    venus). Mounts as a sibling of the `.global-numbers-value.val-*`
    anchors INSIDE the scale container so its offsetParent matches the
    anchors' offsetParent — coordinate space matches without translation
    math.

    Visual: a soft glass disc that hugs the active digit, with a hairline
    accent rim, two short tangent ticks (radial in/out — a "cursor" sat
    on the dial), and an ambient halo behind. The digit itself reads on
    top of the disc via the higher z-index on `.val-is-active` (see
    `src/styles/globs.less`).

    Driven by the JS in this file: WAAPI traverses the val-* anchor
    centres along the arc so the cursor glides instead of teleporting.
    Per-scale palette + active-digit text-glow live in
    `src/styles/scale_marker.less` + `src/styles/globs.less`.
  -->
  <div
    ref="marker"
    class="scale-marker"
    :class="markerClasses"
    aria-hidden="true">
    <!--
      Four-child layout, intentionally compact.

        __glass  the cursor body — warm scale-tinted inner rim + cool
                 silver outer rim (via ::before). Carries the main
                 arrival accent: a single rim flash via box-shadow
                 keyframes on settle.
        __ping   one cool-silver sonar ring, invisible at rest,
                 expands + fades outward on settle. The secondary,
                 calmer arrival accent.
        __tick   two tangent ticks (radial-out / radial-in). Static.

      Ambient glow is folded into the glass's box-shadow stack — no
      separate halo div, no extra paint. Two arrival effects total
      (rim flash + ping), no halo breath, no tick twinkle, no motion
      blur.
    -->
    <div class="scale-marker__glass"></div>
    <div class="scale-marker__ping"></div>
    <div class="scale-marker__tick scale-marker__tick--top"></div>
    <div class="scale-marker__tick scale-marker__tick--bottom"></div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {reducedMotionActive} from '@/client/utils/reducedMotion';

type AccentName = 'temperature' | 'oxygen' | 'venus' | 'oceans';

type Anchor = {
  value: number;
  x: number;
  y: number;
  rot: number;
};

/*
 * Travel easing for the arc traversal. easeInOutCubic — a stronger,
 * more cinematic S-curve than the earlier Material easeInOut. Premium
 * UIs (Apple, Asmodee Digital) lean on this curve for "weighted glide"
 * motion: a deliberate easing-in, full acceleration through the middle
 * of the path, decisive easing-out. Reads markedly more polished than
 * the front-loaded easeOutQuint the rest of the feedback framework uses
 * — that curve is built for chip pops, not for long arc traversals.
 *
 * The settle pulse keeps the project-standard easeOutQuint (defined in
 * scale_marker.less) — it's a brief halo breath, not a traversal.
 */
const EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
const BASE_DURATION_MS = 340;
const PER_STEP_DURATION_MS = 130;
const MAX_DURATION_MS = 1280;
const SETTLE_DURATION_MS = 1170;

/*
 * Visual contract:
 *
 *   During travel — the marker glides QUIETLY. No extra glow, no blur,
 *   no rim energise. Just position interpolation along the arc. This
 *   keeps motion calm and avoids the "soap smear" look motion blur
 *   produces. The eye notices the glide because the position changes,
 *   not because the marker shouts about itself.
 *
 *   On arrival — a crisp, premium "lock in" pulse fires: halo breath,
 *   accent rim flash, and an outward sonar-ping ring. The accent is
 *   concentrated at the destination, not spread across the whole path.
 *
 * All three scales (temperature / oxygen / venus) share the same
 * structure, same animation, same arrival ping — only the colour
 * variables differ. See scale_marker.less.
 */

/**
 * Per-accent baseline that SURVIVES the `<player-home :key="playerkey">`
 * remount that App.vue forces on every server poll. Without this the
 * marker re-mounts with no memory of the previous value — its `watch`
 * never fires and every change visually looks like a snap.
 *
 * On mount the component reads the stored `lastValue`, snaps the marker
 * to that previous position, then animates to its current `value` prop
 * over the freshly-snapshotted anchors. Mirrors the contract of
 * `changeFeedbackManager` (src/client/components/feedback/).
 *
 * Single store across all sessions is fine for global parameters —
 * temperature / oxygen / venus are game-wide and don't change between
 * displayed players. Worst case across a brand-new game: a one-time
 * long-range traversal from the last game's final value to MIN — quickly
 * capped by MAX_DURATION_MS, no further bleed.
 */
type AccentState = {lastValue: number | undefined};
const accentBaseline: Record<AccentName, AccentState> = {
  temperature: {lastValue: undefined},
  oxygen: {lastValue: undefined},
  venus: {lastValue: undefined},
  oceans: {lastValue: undefined},
};

/**
 * AnimatedScaleMarker — drives the per-scale active-value marker on the
 * Mars board's global-parameter dials.
 *
 * Reads coordinate anchors from the existing `.global-numbers-value.val-*`
 * elements (their positions encode the arc curve printed on the board).
 * When the bound `value` prop changes, the marker animates through every
 * intermediate anchor between old and new values — because each anchor
 * already sits on the arc, walking them produces an arc-following path
 * without any per-scale geometry duplication on the client.
 *
 * Mid-flight retargeting: a new `value` arriving during an active
 * animation cancels the running animation, captures the marker's CURRENT
 * visual transform via `getComputedStyle`, and uses it as the first
 * keyframe of the new trip — no snap.
 *
 * Resize handling: a ResizeObserver on the parent container re-snapshots
 * anchor coordinates whenever the container's layout changes (e.g.
 * `--board-scale` adjust, viewport resize, fullscreen toggle). If a
 * resize lands while no animation is running, the marker RECONCILES —
 * see below.
 *
 * Reduced motion: animations collapse to a short fade-step instead of a
 * multi-anchor traversal.
 *
 * ⭐ THE CURSOR MAY NEVER LAG THE DIAL IT SITS ON. The fill, the digits
 * and the HUD readout are plain reactive bindings — they cannot be late.
 * The cursor is the one element driven by imperative code, so it is the
 * only one that CAN be, and a ring pointing at 3 on a dial filled to 4
 * reads as a broken game, not as a late animation. Three rules keep it
 * honest, and each replaced a way it went out of sync:
 *
 *   1. THE ELEMENT'S INLINE TRANSFORM IS THE TRUTH, always written by us
 *      (`applyAnchor`) — never handed to `Animation.commitStyles()`,
 *      which throws whenever the target is not being rendered.
 *   2. A CHANGE IS NEVER DROPPED. `moveTo` is the single entry point and
 *      handles every state (no anchors yet · value off the printed dial ·
 *      hidden section) by RECOVERING, never by returning early. There is
 *      no latch that can leave the watcher permanently deaf.
 *   3. AN OFF-SCREEN CHANGE SNAPS. A traversal behind a `display: none`
 *      section is unreadable by definition, so the marker lands on the
 *      value immediately and the section handoff shows nothing but the
 *      truth.
 *
 * …and `reconcile()` re-asserts the invariant whenever the marker's world
 * moved underneath it (board re-fit, the section coming back).
 */
export default defineComponent({
  name: 'AnimatedScaleMarker',
  props: {
    /**
     * Current scale value (e.g. temperature -22, oxygen 6, venus 14).
     * Must match the integer encoded in some `val-N` sibling class —
     * if it doesn't, the marker stays at its previous position rather
     * than jumping to an undefined coordinate.
     */
    value: {
      type: Number,
      required: true,
    },
    /**
     * Theme accent. Sets the marker's color tone via CSS custom
     * properties (see scale_marker.less for the per-accent palette).
     */
    accent: {
      type: String as PropType<AccentName>,
      required: true,
    },
  },
  data() {
    return {
      anchors: [] as Array<Anchor>,
      currentValue: undefined as number | undefined,
      activeAnimation: null as Animation | null,
      settleTimeout: null as ReturnType<typeof setTimeout> | null,
      resizeObserver: null as ResizeObserver | null,
      /**
       * The marker HAS a real position on the dial (an anchor was found for
       * the current value and the transform was written). Drives the opacity
       * class — and NOTHING else. It used to be a `ready` LATCH that also
       * gated the `value` watcher, which is how the ocean cursor died: the
       * ocean dial's digits are 1..9 (arcScaleConfigs.OCEAN_ARC), a game
       * starts at 0 oceans, so `mounted()` found no anchor, returned early
       * and left the latch false — and the watcher then ignored every
       * subsequent ocean for the rest of the session. A value outside the
       * dial's printed range is a normal, RECOVERABLE state now: the marker
       * hides, keeps watching, and arrives the moment the value lands on a
       * cell that exists.
       */
      placed: false,
    };
  },
  computed: {
    markerClasses(): Array<string> {
      const classes = [`scale-marker--${this.accent}`];
      classes.push(this.placed ? 'scale-marker--ready' : 'scale-marker--pending');
      return classes;
    },
  },
  watch: {
    value(newVal: number, oldVal: number): void {
      if (newVal === oldVal) {
        return;
      }
      /*
       * Keep the cross-remount baseline in sync with the latest value
       * we saw via prop change. Without this, an in-place mutation of
       * playerView.game.* (e.g. the WGT 2-stage transition in
       * WaitingFor.vue that mutates global params, holds, then later
       * triggers playerkey++) would leave the baseline stale at the
       * old value — and the post-remount mounted() hook would replay
       * the same animation a second time.
       */
      accentBaseline[this.accent].lastValue = newVal;
      this.moveTo(newVal);
    },
  },
  mounted(): void {
    this.snapshotAnchors();

    /*
     * Pull the previous value from the cross-remount baseline (see the
     * AccentState commentary above). App.vue's `<player-home :key>`
     * forces a fresh component on every poll, so the in-component
     * watch(value) NEVER sees an old → new transition — the only signal
     * for "value just changed" is comparing our mounted prop against the
     * persisted baseline.
     */
    const state = accentBaseline[this.accent];
    const prevValue = state.lastValue;
    state.lastValue = this.value;

    const targetIdx = this.findAnchorIndex(this.value);
    const prevIdx = prevValue !== undefined ? this.findAnchorIndex(prevValue) : -1;

    if (targetIdx >= 0) {
      if (prevValue === undefined || prevValue === this.value || prevIdx < 0) {
        // First mount of the session, or no change, or previous value
        // outside our anchor map (e.g. cross-game-session reset). Snap to
        // current value, no animation.
        this.placeAt(this.value);
      } else {
        // Cross-remount change detected — anchor the marker at the
        // PREVIOUS position so the arc traversal starts where the player
        // last saw it, then animate to the new value on the next tick.
        // Deferring by one tick gives the browser a chance to paint the
        // initial transform before WAAPI takes over, avoiding a flicker.
        this.placeAt(prevValue);
        this.$nextTick(() => {
          if (this.anchors.length === 0) {
            return;
          }
          this.animateTo(this.value);
        });
      }
    }
    /*
     * ⚠ THE OBSERVER IS INSTALLED UNCONDITIONALLY — it is the marker's only
     * self-heal channel, so the two states that most need it (no anchors
     * yet · value off the printed dial) may not be the two that skip it.
     * It is also the VISIBILITY signal the console needs for free: the
     * board section is a `v-show` sibling, so a section handoff flips it
     * `display: none` and back, and each flip resizes the observed box.
     */
    const container = this.$el.parentElement as HTMLElement | null;
    if (container !== null && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(container);
    }
  },
  beforeUnmount(): void {
    if (this.activeAnimation !== null) {
      this.activeAnimation.cancel();
      this.activeAnimation = null;
    }
    if (this.settleTimeout !== null) {
      clearTimeout(this.settleTimeout);
      this.settleTimeout = null;
    }
    if (this.resizeObserver !== null) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  },
  methods: {
    /**
     * Walk every `.global-numbers-value` sibling, stash its centre
     * coordinates, and DERIVE the marker rotation from the local arc
     * tangent — NOT from the val-* element's own CSS rotation.
     *
     * Why not just read getComputedStyle(node).transform like we used
     * to? The val-* CSS rotations were hand-tuned to make each printed
     * digit read tangentially around the arc. On Venus they happen to
     * align with the radial direction (so the marker's "top tick"
     * landed perpendicular to the arc), but on Oxygen and Temperature
     * the same rotation values make the digit's "top" point ALONG the
     * tangent — meaning the marker's ticks ended up running parallel
     * to the arc band instead of perpendicular to it. The user spotted
     * exactly this: Venus ticks looked right, Oxygen / Temperature
     * ticks merged into the dial direction.
     *
     * Geometric fix: compute the local tangent (centred difference
     * between neighbouring anchor positions) and use its perpendicular
     * as the marker's "up" direction. That guarantees the marker's
     * top-tick / bottom-tick axis lies along the arc's RADIAL
     * direction at every value, regardless of which scale's hand-tuned
     * CSS rotation convention was used.
     */
    snapshotAnchors(): void {
      const parent = this.$el.parentElement as HTMLElement | null;
      if (parent === null) {
        return;
      }
      if (this.anchors.length > 0 && !this.isRendered()) {
        /*
         * A `display: none` subtree reports offsetLeft/offsetTop 0 for
         * EVERY digit, so re-snapshotting there would collapse the whole
         * dial onto one point. The console flips the board section's
         * display on every section handoff and the ResizeObserver reports
         * that as a resize — keep the last honest map until the board is
         * back on screen (the return fires the observer again).
         */
        return;
      }
      const nodes = parent.querySelectorAll<HTMLElement>(':scope > .global-numbers-value');

      type RawAnchor = {value: number; x: number; y: number};
      const raw: Array<RawAnchor> = [];
      nodes.forEach((node) => {
        const match = /(?:^|\s)val-(-?\d+)(?=\s|$)/.exec(node.className);
        if (match === null) {
          return;
        }
        const value = parseInt(match[1], 10);
        if (Number.isNaN(value)) {
          return;
        }
        raw.push({
          value,
          x: node.offsetLeft + node.offsetWidth / 2,
          y: node.offsetTop + node.offsetHeight / 2,
        });
      });

      // The LESS mixin emits val-* in monotonic value order, so DOM order
      // already matches arc order — but sort defensively so the tangent
      // computation below is correct even if the source ever changes.
      raw.sort((a, b) => a.value - b.value);

      const anchors: Array<Anchor> = raw.map((r, i) => ({
        value: r.value,
        x: r.x,
        y: r.y,
        rot: this.computeRadialRotationDeg(raw, i),
      }));

      /*
       * Unwrap the rotation sequence so adjacent anchors never differ
       * by more than 180 deg. Without this, an arc whose tangent
       * sweeps past the −180 / +180 wrap (Venus does this near its
       * apex) makes WAAPI interpolate "the long way around the
       * circle" between two adjacent keyframes — the marker would
       * spin almost a full revolution between two anchors. Adding /
       * subtracting multiples of 360 keeps the sequence monotonic.
       */
      for (let i = 1; i < anchors.length; i++) {
        let diff = anchors[i].rot - anchors[i - 1].rot;
        while (diff > 180) {
          anchors[i].rot -= 360;
          diff -= 360;
        }
        while (diff < -180) {
          anchors[i].rot += 360;
          diff += 360;
        }
      }

      this.anchors = anchors;
    },
    /**
     * Compute the marker rotation (degrees) at anchor index `i` so the
     * marker's "up" direction (where the top tick is, before rotation)
     * points along the local RADIAL direction — perpendicular to the
     * arc tangent at that point.
     *
     * Uses a centred difference (raw[i+1] − raw[i−1]) for interior
     * anchors and a one-sided difference at the endpoints. The
     * perpendicular sign is chosen consistently (tangent rotated 90 °
     * CCW in screen coords) — since the marker has SYMMETRIC top /
     * bottom ticks, either perpendicular direction lays the tick axis
     * radially; flipping sign just swaps which tick is "outer" vs
     * "inner". Visually identical for our two-tick design.
     */
    computeRadialRotationDeg(
      raw: ReadonlyArray<{x: number; y: number}>,
      i: number,
    ): number {
      if (raw.length < 2) {
        return 0;
      }
      let tx: number;
      let ty: number;
      if (i === 0) {
        tx = raw[1].x - raw[0].x;
        ty = raw[1].y - raw[0].y;
      } else if (i === raw.length - 1) {
        tx = raw[i].x - raw[i - 1].x;
        ty = raw[i].y - raw[i - 1].y;
      } else {
        tx = raw[i + 1].x - raw[i - 1].x;
        ty = raw[i + 1].y - raw[i - 1].y;
      }
      // Perpendicular to the tangent (rotated 90 ° CCW in screen
      // coords): (tx, ty) → (−ty, tx).
      const px = -ty;
      const py = tx;
      // CSS rotation α such that the marker's "up" direction
      // (sin α, −cos α) lines up with the perpendicular vector.
      // Solving: α = atan2(px, −py).
      return Math.atan2(px, -py) * 180 / Math.PI;
    },
    findAnchorIndex(value: number): number {
      for (let i = 0; i < this.anchors.length; i++) {
        if (this.anchors[i].value === value) {
          return i;
        }
      }
      return -1;
    },
    transformFor(a: Anchor): string {
      // translate to anchor centre, then a -50%/-50% back-translate so
      // the marker's own centre lines up with the anchor centre. Each
      // anchor's rotation makes the marker tangent to the arc.
      return `translate(${a.x}px, ${a.y}px) translate(-50%, -50%) rotate(${a.rot}deg)`;
    },
    placeAt(value: number): void {
      const idx = this.findAnchorIndex(value);
      if (idx < 0) {
        return;
      }
      this.applyAnchor(this.anchors[idx]);
      this.currentValue = value;
      this.placed = true;
    },
    /**
     * Write a position to the element's OWN inline style — the marker's
     * single source of visual truth.
     *
     * ⚠ Everything that ends an animation routes through here instead of
     * `Animation.commitStyles()`. commitStyles throws `InvalidStateError`
     * the moment the target «is not being rendered», and the console board
     * section is a `v-show` sibling: every parameter change that lands
     * while the player is in their hand / a workspace / another section
     * animates a `display: none` marker. The throw was caught and ignored,
     * the `cancel()` that follows then dropped the `fill: forwards` result,
     * and the cursor SNAPPED BACK to the transform of the previous value —
     * while the arc fill and the digits (plain reactive style bindings)
     * already read the new one. That is the desync: the ring one value
     * behind the dial it sits on, most often in multiplayer, where the
     * changes arrive from somebody else's turn while this player is
     * looking somewhere other than the board.
     */
    applyAnchor(a: Anchor): void {
      const marker = this.$refs.marker as HTMLElement | undefined;
      if (marker === undefined) {
        return;
      }
      marker.style.transform = this.transformFor(a);
    },
    /**
     * The marker is actually being RENDERED (no `display: none` ancestor).
     * The marker is `position: absolute`, so a null offsetParent means
     * exactly that.
     */
    isRendered(): boolean {
      const marker = this.$refs.marker as HTMLElement | undefined;
      return marker !== undefined && marker.offsetParent !== null;
    },
    /**
     * THE ONE ENTRY POINT for "the dial now reads `value`" — snap, glide or
     * hide, and never lose the change. Every caller (the prop watcher, the
     * resize reconcile) goes through it, so a value can no longer be
     * dropped by a state the marker happened to be in.
     */
    moveTo(value: number): void {
      if (this.anchors.length === 0) {
        // Mounted before its digits existed (or measured while hidden) —
        // the map is cheap, take it now rather than stay dead forever.
        this.snapshotAnchors();
      }
      if (this.findAnchorIndex(value) < 0) {
        /*
         * OFF THE PRINTED DIAL — the ocean scale's digits start at 1 while
         * the parameter starts at 0. There is no cell to point at, so the
         * cursor steps off (the opacity transition carries it) and waits;
         * the first ocean brings it back on.
         */
        if (this.activeAnimation !== null) {
          this.activeAnimation.cancel();
          this.activeAnimation = null;
        }
        this.currentValue = undefined;
        this.placed = false;
        return;
      }
      if (!this.placed || this.currentValue === undefined) {
        // No position to travel FROM (first placement, or a return from
        // off-dial): arrive rather than glide out of nowhere. Off-dial →
        // on-dial is a real arrival, so it earns the settle accent.
        const arriving = !this.placed && this.currentValue === undefined;
        this.placeAt(value);
        if (arriving && this.isRendered()) {
          this.triggerSettle();
        }
        return;
      }
      this.animateTo(value);
    },
    /**
     * The displayed value must equal the prop — the invariant every
     * self-heal restores. Called whenever the marker's world changed
     * underneath it (resize, board re-fit, the section coming back).
     */
    reconcile(): void {
      if (this.currentValue !== this.value) {
        this.moveTo(this.value);
        return;
      }
      if (this.currentValue !== undefined) {
        // Same value, possibly new coordinates (board re-fit / re-scale).
        this.placeAt(this.currentValue);
      }
    },
    /**
     * Read the marker's CURRENT computed transform and return it as a
     * synthetic anchor. Used to seed a new animation when one is
     * already running so the marker doesn't snap back to the previous
     * waypoint. Returns undefined when the marker has no usable
     * transform (e.g. just mounted, never animated).
     */
    currentVisualAnchor(): Anchor | undefined {
      const marker = this.$refs.marker as HTMLElement | undefined;
      if (marker === undefined) {
        return undefined;
      }
      const transform = window.getComputedStyle(marker).transform;
      if (transform === 'none' || transform === '') {
        return undefined;
      }
      const numbers = transform.match(/-?\d*\.?\d+/g);
      if (numbers === null || numbers.length < 6) {
        return undefined;
      }
      const a = parseFloat(numbers[0]);
      const b = parseFloat(numbers[1]);
      const tx = parseFloat(numbers[4]);
      const ty = parseFloat(numbers[5]);
      const w = marker.offsetWidth;
      const h = marker.offsetHeight;
      const rot = Math.atan2(b, a) * 180 / Math.PI;
      // tx/ty are the matrix translation (marker top-left in offsetParent
      // coords because the -50% portion is baked into the matrix).
      // Add w/2, h/2 back to recover the visual centre we use as anchor.
      return {value: Number.NaN, x: tx + w / 2, y: ty + h / 2, rot};
    },
    animateTo(targetValue: number): void {
      const marker = this.$refs.marker as HTMLElement | undefined;
      if (marker === undefined) {
        return;
      }
      const targetIdx = this.findAnchorIndex(targetValue);
      if (targetIdx < 0) {
        return;
      }
      const startIdx = this.currentValue !== undefined ?
        this.findAnchorIndex(this.currentValue) :
        -1;
      if (startIdx < 0) {
        // No known previous position — just snap to target.
        this.placeAt(targetValue);
        this.triggerSettle();
        return;
      }
      if (startIdx === targetIdx) {
        return;
      }

      /*
       * OFF-SCREEN fast path — the board section is hidden (`v-show`), so
       * there is no glide for anyone to read. SNAP: a traversal nobody
       * sees is pure waste, and worse, it is the state whose landing
       * cannot be committed (see `applyAnchor`) — the marker used to come
       * back from the hand one value behind the dial. Landing on the
       * value NOW is what makes the section handoff invisible.
       */
      if (!this.isRendered()) {
        if (this.activeAnimation !== null) {
          this.activeAnimation.cancel();
          this.activeAnimation = null;
        }
        this.placeAt(targetValue);
        return; // no settle: the arrival accent would play to an empty room
      }

      /*
       * Reduced-motion fast path: skip the arc traversal entirely.
       * The OS / user has asked for less movement, so we don't animate
       * along the dial at all — just snap the marker to the new
       * position and trigger the subtle arrival accent (the
       * `prefers-reduced-motion` block in scale_marker.less drops the
       * ping ring and softens the rim flash to a brief opacity-safe
       * brightness bump). Cancel any in-flight animation cleanly so
       * we don't have a flying ghost from an old trip.
       */
      if (this.prefersReducedMotion()) {
        if (this.activeAnimation !== null) {
          this.activeAnimation.cancel();
          this.activeAnimation = null;
        }
        this.placeAt(targetValue);
        this.triggerSettle();
        return;
      }

      // Mid-flight retarget: capture current visual position before
      // cancelling so the new animation starts from where the eye sees
      // the marker, not from the previous logical waypoint. Coalesces
      // rapid-fire value changes into one continuous glide instead of
      // stacking parallel animations.
      let seedAnchor: Anchor | undefined;
      if (this.activeAnimation !== null) {
        seedAnchor = this.currentVisualAnchor();
        // Freeze the pose we just read into the inline style BEFORE the
        // cancel drops the running keyframes — our own write, never
        // commitStyles (see `applyAnchor`).
        if (seedAnchor !== undefined) {
          this.applyAnchor(seedAnchor);
        }
        this.activeAnimation.cancel();
        this.activeAnimation = null;
      }

      const direction = targetIdx > startIdx ? 1 : -1;
      const arcFrames: Array<Anchor> = [];
      for (let i = startIdx; i !== targetIdx + direction; i += direction) {
        arcFrames.push(this.anchors[i]);
      }

      /*
       * If the in-flight animation gave us a seed anchor, unwrap its
       * rotation so it sits within ±180 ° of the first arc frame's
       * rotation. The browser's matrix-readback collapses rotations to
       * the [-180, 180] range, but our anchor sequence is unwrapped to
       * keep WAAPI interpolating the short way around the circle.
       * Without this correction, a Venus retarget that lands the seed
       * at e.g. matrix-read-180 ° while the first frame is unwrapped to
       * +182 ° would spin the marker almost a full revolution.
       */
      if (seedAnchor !== undefined && arcFrames.length > 0) {
        let diff = seedAnchor.rot - arcFrames[0].rot;
        while (diff > 180) {
          seedAnchor.rot -= 360;
          diff -= 360;
        }
        while (diff < -180) {
          seedAnchor.rot += 360;
          diff += 360;
        }
      }

      const frames: Array<Anchor> = seedAnchor !== undefined && arcFrames.length > 0 ?
        [seedAnchor, ...arcFrames.slice(1)] :
        arcFrames;

      const stepsCount = Math.abs(targetIdx - startIdx);
      // Scaled by the motion speed preset — the WGT marker HOLD in
      // WaitingFor.vue scales through the same motionMs, so the hold window
      // and the glide stay proportioned across presets.
      const duration = motionMs(Math.min(
        MAX_DURATION_MS,
        BASE_DURATION_MS + stepsCount * PER_STEP_DURATION_MS));

      const keyframes = frames.map((a) => ({transform: this.transformFor(a)}));
      const anim = marker.animate(keyframes, {
        duration,
        easing: EASING,
        fill: 'forwards',
      });
      this.activeAnimation = anim;
      this.currentValue = targetValue;
      this.placed = true;
      const destination = this.anchors[targetIdx];

      const onFinish = () => {
        if (this.activeAnimation === anim) {
          // Land on the DESTINATION we computed, written by us. Anchors
          // may have been re-snapshotted mid-flight (a board re-fit while
          // the marker travelled), so re-read the value's current anchor —
          // the trip's own keyframes are the stale ones by then.
          const idx = this.findAnchorIndex(targetValue);
          this.applyAnchor(idx >= 0 ? this.anchors[idx] : destination);
          anim.cancel();
          this.activeAnimation = null;
        }
        this.triggerSettle();
      };
      anim.addEventListener('finish', onFinish);
      // `cancel` also surfaces via the promise — guard against unhandled
      // rejections without breaking the finish path.
      anim.finished.catch(() => undefined);
    },
    triggerSettle(): void {
      const marker = this.$refs.marker as HTMLElement | undefined;
      if (marker === undefined) {
        return;
      }
      marker.classList.remove('scale-marker--settling');
      // Force reflow so the keyframe animation restarts cleanly.

      void marker.offsetWidth;
      marker.classList.add('scale-marker--settling');
      if (this.settleTimeout !== null) {
        clearTimeout(this.settleTimeout);
      }
      this.settleTimeout = setTimeout(() => {
        marker.classList.remove('scale-marker--settling');
        this.settleTimeout = null;
      }, motionMs(SETTLE_DURATION_MS));
    },
    prefersReducedMotion(): boolean {
      return reducedMotionActive();
    },
    onResize(): void {
      this.snapshotAnchors();
      // If the resize lands mid-animation, the WAAPI keyframes are now
      // stale, but cancelling would yank the marker. Cheaper to let the
      // current trip finish — its landing re-reads the refreshed anchors
      // (see `onFinish`). Otherwise RECONCILE: the observed box also
      // changes when the console's `v-show` board section returns, which
      // is precisely when a value that arrived off-screen (or a dial the
      // value only just stepped onto) has to be caught up.
      if (this.activeAnimation === null) {
        this.reconcile();
      }
    },
  },
});
</script>
