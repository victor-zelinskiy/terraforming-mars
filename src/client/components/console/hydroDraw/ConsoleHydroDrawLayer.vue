<template>
  <!--
    HYDRO DRAW LAYER — the app-level stage the «Гидромоделирование» draw
    cinematic plays on (mounted once in ConsoleShell). Four card backs lift
    out of the reached track stop, fan out, flip open and land in the pick-2-
    of-4 modal's exact slots; the modal (ConsoleTaskHost, veiled) then
    materializes AROUND the landed cards. Reuses the board card-bonus GSAP
    director; pointer-inert, clipped.
  -->
  <div class="con-hydrodraw-layer" aria-hidden="true">
    <div ref="cover" class="con-hydrodraw-cover">
      <div class="con-card-back"></div>
    </div>
    <div v-for="(name, i) in sceneCards" :key="sceneNonce + '|' + name + '#' + i"
         class="con-hydrodraw-proxy"
         :ref="(el) => setProxyRef(el, i)">
      <div class="con-deal-proxy__flip" :ref="(el) => setFlipRef(el, i)">
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="name" />
        </div>
        <div class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {hydroMarkerState} from '@/client/console/hydroMarker/consoleHydroMarker';
import {
  abortHydroDraw, endHydroDraw, hydroDrawState, registerHydroDrawHandle, setHydroDrawPhase,
} from '@/client/console/hydroDraw/consoleHydroDraw';
import {
  bonusSceneTimings, gatherPoint, reducedBonusSceneTimings, BonusSceneTimings, RectLike,
} from '@/client/console/boardCardBonus/boardCardBonusModel';
import {
  runBonusCoverLift, runBonusFanOut, runBonusHandoff,
  BonusCoverHandle, BonusSceneHandle,
} from '@/client/console/boardCardBonus/boardCardBonusDirector';

/** The card silhouette the cover lifts as (frame proportions 320×460 ≈ 0.696). */
const CARD_ASPECT = 320 / 460;
/** The select modal's slots must appear within this after the marker settles. */
const READY_TIMEOUT_TRIES = 260; // ~4.3 s @ 60 fps

/** Read a fresh, stable rect (bounded rAF double-probe — layout settled). */
function stableRect(resolve: () => HTMLElement | null): Promise<DOMRect | undefined> {
  return new Promise((done) => {
    let tries = 0;
    let last = '';
    const poll = () => {
      tries++;
      const el = resolve();
      const r = el !== null ? el.getBoundingClientRect() : undefined;
      const ok = r !== undefined && r.width > 2 && r.height > 2;
      const sig = ok ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` : '';
      if (ok && sig === last) {
        done(r);
        return;
      }
      last = sig;
      if (tries < 40) {
        requestAnimationFrame(poll);
      } else {
        done(ok ? r : undefined);
      }
    };
    requestAnimationFrame(poll);
  });
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

/** The select modal's card slots (the fan targets — the card element inside). */
function taskHostSlots(): Array<HTMLElement> {
  return Array.from(document.querySelectorAll<HTMLElement>('.con-task-host [data-zoom-slot]'));
}

/* Non-reactive scene context (module scope — GSAP handles must never be Vue-
   reactive; the layer is a singleton). */
type SceneCtx = {
  coverHandle?: BonusCoverHandle,
  sceneHandle?: BonusSceneHandle,
  timers: Array<ReturnType<typeof setTimeout>>,
};
const ctx: SceneCtx = {timers: []};

export default defineComponent({
  name: 'ConsoleHydroDrawLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {
      sceneCards: [] as Array<CardName>,
      sceneNonce: 0,
      proxyRefs: [] as Array<HTMLElement | null>,
      flipRefs: [] as Array<HTMLElement | null>,
    };
  },
  watch: {
    /** A fresh arm (the shell bumped the nonce): begin the scene. */
    'hydroDrawState.nonce'() {
      void this.beginScene();
    },
  },
  methods: {
    setProxyRef(el: unknown, i: number): void {
      this.proxyRefs[i] = (el as HTMLElement | null);
    },
    setFlipRef(el: unknown, i: number): void {
      this.flipRefs[i] = (el as HTMLElement | null);
    },
    timings(): BonusSceneTimings {
      return consoleReducedMotionActive() ? reducedBonusSceneTimings() : bonusSceneTimings();
    },
    proxyEls(): Array<HTMLElement> {
      return this.sceneCards.map((_, i) => this.proxyRefs[i]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    },
    flipEls(): Array<HTMLElement> {
      return this.sceneCards.map((_, i) => this.flipRefs[i]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    },
    /**
     * Wait until the cinematic can begin: the marker has settled on the draw
     * stop AND the select modal has mounted (VEILED) with measurable slots.
     * Bounded — a modal that never arrives degrades honestly.
     */
    waitForReady(): Promise<boolean> {
      return new Promise((done) => {
        let tries = 0;
        const poll = () => {
          if (!hydroDrawState.active) {
            done(false);
            return;
          }
          if (!hydroMarkerState.active && taskHostSlots().length > 0) {
            done(true);
            return;
          }
          if (tries++ > READY_TIMEOUT_TRIES) {
            done(false);
            return;
          }
          requestAnimationFrame(poll);
        };
        poll();
      });
    },
    /** A card-shaped source rect centred on the reached stop cell (the cover
     *  lifts off the «Гидромоделирование» stop — not a tiny marker dot). */
    async stopFromRect(): Promise<RectLike | undefined> {
      const pos = hydroDrawState.stopPosition;
      const r = await stableRect(() => document.querySelector<HTMLElement>(`[data-hydro-stop="${cssEscape(String(pos))}"]`));
      if (r === undefined) {
        return undefined;
      }
      const w = r.width * 0.74;
      const h = w / CARD_ASPECT;
      return {left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h};
    },
    // ── The scene ────────────────────────────────────────────────────────
    async beginScene(): Promise<void> {
      if (!hydroDrawState.active || typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') {
        return;
      }
      this.teardownVisuals();
      registerHydroDrawHandle({abort: () => this.onAbort()});
      const ready = await this.waitForReady();
      if (!ready || !hydroDrawState.active) {
        this.degradeToInstant();
        return;
      }
      const from = await this.stopFromRect();
      const cover = this.$refs.cover as HTMLElement | undefined;
      if (from === undefined || cover === undefined || cover === null) {
        this.degradeToInstant();
        return;
      }
      setHydroDrawPhase('lift');
      ctx.coverHandle = runBonusCoverLift({
        cover,
        from,
        t: this.timings(),
        reduced: consoleReducedMotionActive(),
        onLifted: () => {
          void this.startFan();
        },
      });
    },
    /** The cover's live rect at takeover; the hero hides as proxies appear. */
    takeOverCover(): RectLike | undefined {
      const rect = ctx.coverHandle?.rect();
      ctx.coverHandle?.kill();
      ctx.coverHandle = undefined;
      const cover = this.$refs.cover as HTMLElement | undefined;
      if (cover !== undefined && cover !== null) {
        gsap.set(cover, {autoAlpha: 0});
      }
      return rect;
    },
    async startFan(): Promise<void> {
      if (!hydroDrawState.active) {
        return;
      }
      const slots = taskHostSlots();
      const names = slots
        .map((s) => s.getAttribute('data-zoom-slot'))
        .filter((n): n is string => n !== null && n !== '');
      if (names.length === 0) {
        this.degradeToInstant();
        return;
      }
      setHydroDrawPhase('fan');
      this.sceneCards = names as Array<CardName>;
      this.sceneNonce++;
      await this.$nextTick();
      // Measure each slot's card rect (the modal is veiled — opacity 0 keeps
      // the layout, so the slots are still measurable).
      const targets = await Promise.all(slots.map((s) => stableRect(() =>
        s.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? s)));
      if (!hydroDrawState.active) {
        return;
      }
      const proxies = this.proxyEls();
      const flips = this.flipEls();
      const resolved = targets.filter((r): r is DOMRect => r !== undefined);
      if (resolved.length !== names.length || proxies.length !== names.length || flips.length !== names.length) {
        this.degradeToInstant();
        return;
      }
      const from = this.takeOverCover();
      if (from === undefined) {
        this.degradeToInstant();
        return;
      }
      const t = this.timings();
      ctx.sceneHandle = runBonusFanOut({
        proxies,
        flips,
        from,
        targets: resolved,
        gather: gatherPoint(from, resolved),
        t,
        reduced: consoleReducedMotionActive(),
        onAllLanded: () => {
          // The covers stand in the exact slots — the modal frame assembles
          // around them (the task host unveils via its phase-driven classes).
          setHydroDrawPhase('frame');
          ctx.timers.push(setTimeout(() => {
            // Handoff: the modal releases its held cards (they fade in UNDER
            // the proxies), the proxies dissolve above them.
            setHydroDrawPhase('handoff');
            ctx.sceneHandle = runBonusHandoff({
              proxies: this.proxyEls(),
              t,
              onDone: () => this.finishScene(),
            });
          }, motionMs(t.frameMs)));
        },
      });
    },
    /** No anchors / a lost modal: drop the veil so the pick modal shows at
     *  once — an honest degrade, never a stranded invisible UI. */
    degradeToInstant(): void {
      this.clearTimers();
      ctx.coverHandle?.kill();
      ctx.coverHandle = undefined;
      ctx.sceneHandle?.kill();
      ctx.sceneHandle = undefined;
      endHydroDraw();
      this.clearSceneDom();
    },
    finishScene(): void {
      endHydroDraw();
      this.clearSceneDom();
    },
    /** The controller's abort handle — kill the live beats + clear (the
     *  controller already dropped the veil / opened the input gate). */
    onAbort(): void {
      this.teardownVisuals();
    },
    // ── Cleanup ─────────────────────────────────────────────────────────
    clearTimers(): void {
      ctx.timers.forEach((timer) => clearTimeout(timer));
      ctx.timers = [];
    },
    clearSceneDom(): void {
      const cover = this.$refs.cover as HTMLElement | undefined;
      if (cover !== undefined && cover !== null) {
        gsap.set(cover, {autoAlpha: 0});
      }
      this.proxyEls().forEach((el) => gsap.set(el, {autoAlpha: 0}));
      this.sceneCards = [];
      this.proxyRefs = [];
      this.flipRefs = [];
    },
    teardownVisuals(): void {
      this.clearTimers();
      ctx.coverHandle?.kill();
      ctx.coverHandle = undefined;
      ctx.sceneHandle?.kill();
      ctx.sceneHandle = undefined;
      this.clearSceneDom();
    },
  },
  beforeUnmount() {
    this.teardownVisuals();
    registerHydroDrawHandle(undefined);
    if (hydroDrawState.active) {
      abortHydroDraw();
    }
  },
});
</script>
