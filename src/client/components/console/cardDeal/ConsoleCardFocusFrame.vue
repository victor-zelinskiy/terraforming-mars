<template>
  <!--
    CONSOLE FOCUS FRAME — the gliding "targeting bracket" of console card
    selection. Instead of the highlight jumping from card to card, ONE
    frame of four L-corner ticks (the fork's signature card chrome) glides
    to the focused card with spring physics — fast d-pad chains re-target
    mid-flight with preserved velocity, which is what makes it feel
    console-native rather than web.

    Motion for Vue (motion-v) drives the ticks: transform-only springs,
    interruptible, honouring reduced motion (duration 0 → instant
    placement). The card's own soft glow (`.con-cards__slot--focused`)
    stays — the frame is the "aim", the glow is the "light"; together they
    read as one instrument.

    Geometry: a rAF measure loop (FPS-gated via createFrameGate) tracks the
    target's live viewport rect — it follows the focus lift/scale
    transition, grid scrolling and window resizes without observers. One
    getBoundingClientRect per frame for one element: negligible.
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

const TICK = 22; // tick box (px) — matches the card chrome scale
const PAD = 7; // breathing room between the card edge and the frame

type Tick = {id: 'tl' | 'tr' | 'bl' | 'br', x: number, y: number};

export default defineComponent({
  name: 'ConsoleCardFocusFrame',
  components: {Motion},
  props: {
    /** The focused card's element (`.card-container`); null hides the frame. */
    target: {
      type: Object as () => HTMLElement | null,
      required: false,
      default: null,
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
    measure(): void {
      const el = this.target;
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
