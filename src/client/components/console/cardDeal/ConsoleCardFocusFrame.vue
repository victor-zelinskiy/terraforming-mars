<template>
  <!--
    CONSOLE FOCUS FRAME — the gliding "targeting bracket", THE primary focus
    indicator of card navigation in console mode. Instead of the highlight
    jumping from card to card, ONE frame of four L-corner ticks (the fork's
    signature card chrome) glides to the focused card with spring physics —
    fast d-pad chains re-target mid-flight with preserved velocity, which is
    what makes it feel console-native rather than web.

    Used by EVERY console surface that navigates over real cards: the start
    wizard/ceremony (ConsoleStartScene), the draft/buy card browser
    (ConsoleTaskHost), the hand overlay (ConsoleHandSection), the received-
    cards reveal (ConsoleRevealOverlay). Wiring is ONE line — mount it as a
    direct child of the surface root with a `selector`:

      <ConsoleCardFocusFrame selector=".con-hand__slot--selected > .card-container" />

    The frame resolves the selector INSIDE its parent element on every
    measure tick (scoped — two card surfaces stacked on screen never steal
    each other's target), so hosts need no target-sync code at all. The
    `target` prop remains for hosts that prefer to hand the element over
    explicitly; `active=false` hides the frame (e.g. while a deal cinematic
    runs and selection isn't interactive yet).

    Motion for Vue (motion-v) drives the ticks: transform-only springs,
    interruptible, honouring reduced motion (duration 0 → instant
    placement). The card's own soft glow (`--focused`/`--selected` slot
    rings) stays — the frame is the "aim", the glow is the "light";
    together they read as one instrument.

    Geometry: a rAF measure loop (FPS-gated via createFrameGate) tracks the
    target's live viewport rect — it follows the focus lift/scale
    transition, grid scrolling and window resizes without observers. One
    querySelector + one getBoundingClientRect per frame: negligible.
  -->
  <div v-show="visible" class="con-focus-frame" aria-hidden="true">
    <Motion v-for="tick in ticks" :key="tick.id"
            as="span"
            class="con-focus-frame__tick"
            :class="'con-focus-frame__tick--' + tick.id"
            :animate="{x: tick.x, y: tick.y, opacity: 1}"
            :transition="tickTransition" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Motion} from 'motion-v';
import {createFrameGate} from '@/client/components/motion/motionTokens';
import {useConsoleReducedMotion} from '@/client/console/composables/useConsoleReducedMotion';
import {consoleCardZoom} from '@/client/console/consoleCardZoom';

const TICK = 22; // tick box (px) — matches the card chrome scale
const PAD = 7; // breathing room between the card edge and the frame

type Tick = {id: 'tl' | 'tr' | 'bl' | 'br', x: number, y: number};

export default defineComponent({
  name: 'ConsoleCardFocusFrame',
  components: {Motion},
  props: {
    /** Explicit target element (`.card-container`); null hides the frame. */
    target: {
      type: Object as () => HTMLElement | null,
      required: false,
      default: null,
    },
    /**
     * Self-resolving mode: a CSS selector for the focused card, resolved
     * inside this component's PARENT element on every measure tick. The
     * preferred wiring — hosts need no target-sync code.
     */
    selector: {
      type: String,
      required: false,
      default: '',
    },
    /** Gate (e.g. false while a deal cinematic owns the cards). */
    active: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  setup() {
    const {reduced} = useConsoleReducedMotion();
    return {reduced};
  },
  data() {
    return {
      rect: {x: 0, y: 0, w: 0, h: 0},
      visible: false,
      raf: 0,
      gate: createFrameGate(),
    };
  },
  computed: {
    ticks(): Array<Tick> {
      const {x, y, w, h} = this.rect;
      return [
        {id: 'tl', x: x - PAD, y: y - PAD},
        {id: 'tr', x: x + w + PAD - TICK, y: y - PAD},
        {id: 'bl', x: x - PAD, y: y + h + PAD - TICK},
        {id: 'br', x: x + w + PAD - TICK, y: y + h + PAD - TICK},
      ];
    },
    tickTransition(): Record<string, unknown> {
      // Reduced motion: instant placement (a SEPARATE axis from speed
      // presets — never "just faster").
      if (this.reduced) {
        return {duration: 0};
      }
      return {type: 'spring', stiffness: 420, damping: 34, mass: 0.85};
    },
  },
  mounted() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      if (!this.gate.shouldRender(now)) {
        return;
      }
      this.measure();
    };
    this.raf = requestAnimationFrame(loop);
  },
  beforeUnmount() {
    cancelAnimationFrame(this.raf);
  },
  methods: {
    resolveTarget(): HTMLElement | null {
      if (!this.active) {
        return null;
      }
      // The fullscreen inspector owns the ideological focus while open —
      // the background frame goes quiet (read fresh every measure tick,
      // so no watcher plumbing is needed).
      if (consoleCardZoom.card !== undefined) {
        return null;
      }
      if (this.target !== null) {
        return this.target;
      }
      if (this.selector === '') {
        return null;
      }
      // Scoped to the host surface (the frame's parent), so stacked card
      // surfaces (e.g. a reveal overlay above the task host) never steal
      // each other's focus target.
      const scope = (this.$el as HTMLElement | undefined)?.parentElement ?? null;
      return scope?.querySelector<HTMLElement>(this.selector) ?? null;
    },
    measure(): void {
      const el = this.resolveTarget();
      if (el === null || !el.isConnected) {
        this.visible = false;
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) {
        this.visible = false;
        return;
      }
      this.visible = true;
      // Sub-pixel churn guard: only push a new spring target on real moves.
      const {x, y, w, h} = this.rect;
      if (Math.abs(r.left - x) > 0.5 || Math.abs(r.top - y) > 0.5 ||
          Math.abs(r.width - w) > 0.5 || Math.abs(r.height - h) > 0.5) {
        this.rect = {x: r.left, y: r.top, w: r.width, h: r.height};
      }
    },
  },
});
</script>
