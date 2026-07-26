<template>
  <!--
    HYDRO DRAW LAYER — the app-level stage the «Гидромоделирование» draw
    cinematic plays on (mounted once in ConsoleShell). The reward's own CARD
    ICON separates from the «ВЫ ПОЛУЧИТЕ» panel at confirm and floats while the
    marker glides; then it unpacks into four card backs that fan out, flip open
    and land in the pick-2-of-4 modal's exact slots; the modal (ConsoleTaskHost,
    veiled) then materializes AROUND the landed cards. The same story — and the
    same GSAP director — as the board card-bonus; pointer-inert, clipped.
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
  abortHydroDraw, endHydroDraw, hydroDrawState, markHydroDrawClaimed, registerHydroDrawHandle,
  setHydroDrawPhase,
} from '@/client/console/hydroDraw/consoleHydroDraw';
import {
  bonusSceneTimings, gatherPoint, reducedBonusSceneTimings, BonusSceneTimings, RectLike,
} from '@/client/console/boardCardBonus/boardCardBonusModel';
import {
  runBonusAbortVisual, runBonusCoverLift, runBonusFanOut, runBonusHandoff,
  BonusCoverHandle, BonusSceneHandle,
} from '@/client/console/boardCardBonus/boardCardBonusDirector';

/** The card silhouette the cover lifts as (frame proportions 320×460 ≈ 0.696). */
const CARD_ASPECT = 320 / 460;
/**
 * How long the lifted cover may FLOAT waiting for its pick modal. Wall-clock,
 * not frame counts: a throttled tab starves rAF, and the honest pending pose
 * must be bounded by real time. Comfortably inside the controller's own arm
 * safety, so a scene that waits this out still degrades through OUR path (the
 * cover fades over the arriving modal) rather than being recalled from under us.
 */
const READY_TIMEOUT_MS = 8000;
/**
 * Consecutive polls that may see a task host carrying NO card slots before we
 * conclude the prompt on screen is somebody else's (a two-poll fence, since the
 * host's frame and its card strip render together — one empty read is a swap).
 */
const FOREIGN_HOST_POLLS = 2;

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

/**
 * Grow a small square-ish icon rect into a CARD silhouette around its own
 * centre (never smaller than the icon), so the cover reads as a sleeve
 * separating from the icon rather than a stretched glyph.
 */
function cardShapedAround(r: RectLike): RectLike {
  const h = Math.max(r.height, r.width / CARD_ASPECT);
  const w = h * CARD_ASPECT;
  return {
    left: r.left + (r.width - w) / 2,
    top: r.top + (r.height - h) / 2,
    width: w,
    height: h,
  };
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
      /*
       * The module state MUST be mirrored on the instance: the `watch` key
       * below is a PATH resolved against `this`, so without this line
       * `this.hydroDrawState` is undefined, the path never resolves, the
       * watcher NEVER fires — the scene silently never runs while the task
       * host stays veiled on its behalf (a black, inert pick modal). Every
       * sibling scene layer (marker / board-bonus / deck-draw) mirrors its
       * state here for exactly this reason.
       */
      hydroDrawState,
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
     * Bounded three ways — a modal that never arrives, one that arrives as a
     * DIFFERENT prompt (which would leave the cover floating over somebody
     * else's screen), and a scene recalled underneath us — all degrade
     * honestly instead of hovering forever.
     */
    waitForReady(): Promise<boolean> {
      return new Promise((done) => {
        const deadline = Date.now() + READY_TIMEOUT_MS;
        let foreignHost = 0;
        const poll = () => {
          if (!hydroDrawState.active) {
            done(false);
            return;
          }
          if (!hydroMarkerState.active) {
            if (taskHostSlots().length > 0) {
              done(true);
              return;
            }
            // The advance resolved into a prompt that is NOT the card pick:
            // there is nothing for these cards to land in.
            if (document.querySelector('.con-task-host') !== null && ++foreignHost >= FOREIGN_HOST_POLLS) {
              done(false);
              return;
            }
          }
          if (Date.now() > deadline) {
            done(false);
            return;
          }
          requestAnimationFrame(poll);
        };
        poll();
      });
    },
    /**
     * WHERE THE CARDS COME FROM. Preferred: the reward's own CARD ICON in the
     * «ВЫ ПОЛУЧИТЕ» panel, captured synchronously at confirm (the commit
     * re-renders that panel to the next stage, so it can only be measured
     * BEFORE the submit) — the cover takes it over and the icon hides beneath
     * it, the same one-object separation the board card-bonus performs on the
     * cell icon. The icon is grown to a card silhouette so a sleeve lifts off,
     * never a squashed square. Fallback (a missing/degenerate capture): the
     * reached track stop — the cards still come out of the hydronetwork.
     */
    async sourceFromRect(): Promise<RectLike | undefined> {
      const captured = hydroDrawState.sourceRect;
      if (captured !== undefined && captured.width > 2 && captured.height > 2) {
        return cardShapedAround(captured);
      }
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
    /**
     * The scene runs in TWO acts, exactly like the board card-bonus:
     *  1. the cover separates from the reward icon AT ONCE and floats — the
     *     honest pending pose while the marker glides and the server resolves;
     *  2. once the marker has settled AND the pick modal has mounted (veiled,
     *     so its slots are measurable), the cover unpacks into N proxies that
     *     fan into those exact slots, flipping open; the modal then
     *     materializes around them and hands its real cards over.
     */
    /** This scene is still the current one (a re-arm orphans the old chain). */
    liveEpisode(episode: number): boolean {
      return hydroDrawState.active && hydroDrawState.nonce === episode;
    },
    async beginScene(): Promise<void> {
      if (!hydroDrawState.active) {
        return;
      }
      const episode = hydroDrawState.nonce;
      this.teardownVisuals();
      // CLAIM FIRST, synchronously: the task host veils only for a scene that
      // is actually on stage, so the claim must land in the same tick the arm
      // did — before any await can let the modal mount unattended.
      markHydroDrawClaimed();
      registerHydroDrawHandle({abort: () => this.onAbort()});
      if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') {
        // No frame clock (SSR / a headless DOM): this scene can never be
        // driven, so hand the pick modal over at once instead of veiling it
        // for a flight that will not happen.
        this.degradeToInstant();
        return;
      }

      // ── Act 1: the separation (immediate — the icon is still on screen) ──
      const from = await this.sourceFromRect();
      const cover = this.$refs.cover as HTMLElement | undefined;
      if (!this.liveEpisode(episode)) {
        return; // a re-arm already owns the stage
      }
      if (from === undefined || cover === undefined || cover === null) {
        this.degradeToInstant();
        return;
      }
      const t = this.timings();
      setHydroDrawPhase('lift');
      let lifted = () => {};
      // Time-bounded: a killed timeline never fires onComplete, and act 2 must
      // never park on a promise that can no longer resolve.
      const liftDone = new Promise<void>((resolve) => {
        lifted = resolve;
        ctx.timers.push(setTimeout(resolve, motionMs(t.liftMs) + 200));
      });
      ctx.coverHandle = runBonusCoverLift({
        cover,
        from,
        t,
        reduced: consoleReducedMotionActive(),
        onLifted: () => lifted(),
      });

      // ── Act 2: the fan, once the pick modal is on stage ──────────────────
      const ready = await this.waitForReady();
      if (!this.liveEpisode(episode)) {
        return;
      }
      if (!ready) {
        this.degradeToInstant();
        return;
      }
      await liftDone; // never fan out of a cover that is still separating
      if (!this.liveEpisode(episode)) {
        return;
      }
      void this.startFan();
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
    /**
     * No anchors / a lost modal: drop the veil FIRST so the pick modal shows at
     * once — an honest degrade, never a stranded invisible UI. Anything already
     * flying fades out over the arriving modal instead of being cut mid-air.
     */
    degradeToInstant(): void {
      this.clearTimers();
      ctx.coverHandle?.kill();
      ctx.coverHandle = undefined;
      ctx.sceneHandle?.kill();
      ctx.sceneHandle = undefined;
      endHydroDraw();
      const cover = this.$refs.cover as HTMLElement | undefined;
      const live = [
        ...(cover !== undefined && cover !== null ? [cover] : []),
        ...this.proxyEls(),
      ].filter((el) => Number(gsap.getProperty(el, 'opacity')) > 0);
      if (live.length === 0) {
        this.clearSceneDom();
        return;
      }
      ctx.sceneHandle = runBonusAbortVisual({
        els: live,
        mode: 'instant',
        cell: undefined,
        t: this.timings(),
        onDone: () => this.clearSceneDom(),
      });
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
