<template>
  <!--
    HYDRO DRAW LAYER — the app-level stage the «Гидромоделирование» draw
    cinematic plays on (mounted once in ConsoleShell).

    The marker has just glided to its new stop, so THAT CELL is where the
    player is looking — the four cards come out of it: a face-down stack rises
    from the cell, opens into a fan that breathes for a beat, then travels as a
    group into the pick modal's exact slots, flipping face-up on the way. The
    modal (ConsoleTaskHost, veiled) materializes AROUND the landed cards and
    takes its real ones over. Pointer-inert, clipped; the plan is pure
    (hydroDrawModel), the GSAP is the director's.
  -->
  <div class="con-hydrodraw-layer" aria-hidden="true">
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
  hydroDrawTimings, hydroFanCentre, hydroSceneBudgetMs, reducedHydroDrawTimings, stackStartRect,
  HydroDrawTimings, RectLike,
} from '@/client/console/hydroDraw/hydroDrawModel';
import {
  runHydroCardFlight, runHydroFadeOut, runHydroHandoff, HydroFlightHandle,
} from '@/client/console/hydroDraw/hydroDrawDirector';

/** The card silhouette the stack starts as (frame proportions 320×460). */
const CARD_ASPECT = 320 / 460;
/**
 * How long the scene may wait for its stage (the marker to settle + the pick
 * modal to mount). Wall-clock, not frame counts: a throttled tab starves rAF.
 * Comfortably inside the controller's arm safety, so a scene that waits this
 * out still degrades through OUR path rather than being recalled from under us.
 */
const READY_TIMEOUT_MS = 8000;
/**
 * Consecutive polls that may see a task host carrying NO card slots before we
 * conclude the prompt on screen is somebody else's (a two-poll fence, since the
 * host's frame and its card strip render together — one empty read is a swap).
 */
const FOREIGN_HOST_POLLS = 2;
/** The fan is kept this far from the viewport edges. */
const FAN_MARGIN = 90;
/**
 * Grace on top of the flight's own budget before the scene is force-finished.
 * A killed/starved timeline would otherwise leave the modal veiled until the
 * controller's 15 s arm safety — i.e. a long dark screen for a scene that is
 * already over. This closes it to the flight's real length plus a breath.
 */
const SCENE_SAFETY_SLACK_MS = 900;

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

/** The select modal's card slots (the flight targets — the card element inside). */
function taskHostSlots(): Array<HTMLElement> {
  return Array.from(document.querySelectorAll<HTMLElement>('.con-task-host [data-zoom-slot]'));
}

/* Non-reactive scene context (module scope — GSAP handles must never be Vue-
   reactive; the layer is a singleton). */
type SceneCtx = {
  flight?: HydroFlightHandle,
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
    timings(): HydroDrawTimings {
      return consoleReducedMotionActive() ? reducedHydroDrawTimings() : hydroDrawTimings();
    },
    proxyEls(): Array<HTMLElement> {
      return this.sceneCards.map((_, i) => this.proxyRefs[i]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    },
    flipEls(): Array<HTMLElement> {
      return this.sceneCards.map((_, i) => this.flipRefs[i]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    },
    /** This scene is still the current one (a re-arm orphans the old chain). */
    liveEpisode(episode: number): boolean {
      return hydroDrawState.active && hydroDrawState.nonce === episode;
    },
    /**
     * Wait for the stage: the marker has SETTLED on its new stop (that landing
     * is what puts the cell in focus — the cards must not pre-empt it) AND the
     * pick modal has mounted VEILED, so its slots are measurable. Bounded three
     * ways — a modal that never arrives, one that arrives as a DIFFERENT prompt,
     * and a scene recalled underneath us — each degrading honestly.
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
     * WHERE THE CARDS COME FROM: the track cell the marker has just moved into.
     * After the advance commits that is the stop the player is looking at (it
     * even carries the marker's settle glow), so the cards must be seen leaving
     * exactly it. A card-shaped rect INSIDE the cell, so they come OUT of it
     * rather than replace it.
     */
    async cellFromRect(): Promise<RectLike | undefined> {
      const pos = hydroDrawState.stopPosition;
      const r = await stableRect(() => document.querySelector<HTMLElement>(`[data-hydro-stop="${cssEscape(String(pos))}"]`));
      return r === undefined ? undefined : stackStartRect(r, CARD_ASPECT);
    },
    // ── The scene ────────────────────────────────────────────────────────
    /**
     * ONE continuous flight: the stack rises out of the reached cell, opens
     * into a fan, holds a beat, then travels into the modal's slots flipping
     * face-up. The modal materializes around the landed cards and takes over.
     */
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

      const ready = await this.waitForReady();
      if (!this.liveEpisode(episode)) {
        return;
      }
      if (!ready) {
        this.degradeToInstant();
        return;
      }
      void this.runFlight(episode);
    },
    async runFlight(episode: number): Promise<void> {
      const slots = taskHostSlots();
      const names = slots
        .map((s) => s.getAttribute('data-zoom-slot'))
        .filter((n): n is string => n !== null && n !== '');
      const from = await this.cellFromRect();
      if (!this.liveEpisode(episode)) {
        return;
      }
      if (names.length === 0 || from === undefined) {
        this.degradeToInstant();
        return;
      }
      setHydroDrawPhase('lift');
      this.sceneCards = names as Array<CardName>;
      this.sceneNonce++;
      await this.$nextTick();
      if (!this.liveEpisode(episode)) {
        return;
      }
      // Measure each slot's card rect (the modal is veiled — opacity keeps the
      // layout, so the slots are still measurable).
      const measured = await Promise.all(slots.map((s) => stableRect(() =>
        s.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? s)));
      if (!this.liveEpisode(episode)) {
        return;
      }
      const targets = measured.filter((r): r is DOMRect => r !== undefined);
      const proxies = this.proxyEls();
      const flips = this.flipEls();
      if (targets.length !== names.length || proxies.length !== names.length || flips.length !== names.length) {
        this.degradeToInstant();
        return;
      }
      const t = this.timings();
      // 'fan' is the veil's second pre-frame phase: the whole flight (emerge →
      // fan → travel) plays with the modal frame still transparent.
      setHydroDrawPhase('fan');
      ctx.flight = runHydroCardFlight({
        proxies,
        flips,
        from,
        targets,
        fan: hydroFanCentre(from, targets, {width: window.innerWidth, height: window.innerHeight}, FAN_MARGIN),
        t,
        reduced: consoleReducedMotionActive(),
        onAllLanded: () => {
          // The cards stand in the exact slots — the modal frame assembles
          // around them, then releases its real cards under the proxies.
          setHydroDrawPhase('frame');
          ctx.timers.push(setTimeout(() => {
            setHydroDrawPhase('handoff');
            ctx.flight = runHydroHandoff({
              proxies: this.proxyEls(),
              t,
              onDone: () => this.finishScene(),
            });
          }, motionMs(t.frameMs)));
        },
      });
      // The flight's own length is known — if it has not handed over by then,
      // something killed or starved the timeline; show the modal rather than
      // sit under the veil until the controller's arm safety.
      ctx.timers.push(setTimeout(() => {
        if (this.liveEpisode(episode)) {
          this.degradeToInstant();
        }
      }, motionMs(hydroSceneBudgetMs(names.length, t)) + SCENE_SAFETY_SLACK_MS));
    },
    /**
     * No anchors / a lost modal: drop the veil FIRST so the pick modal shows at
     * once — an honest degrade, never a stranded invisible UI. Anything already
     * flying fades out over the arriving modal instead of being cut mid-air.
     */
    degradeToInstant(): void {
      this.clearTimers();
      ctx.flight?.kill();
      ctx.flight = undefined;
      endHydroDraw();
      const live = this.proxyEls().filter((el) => Number(gsap.getProperty(el, 'opacity')) > 0);
      if (live.length === 0) {
        this.clearSceneDom();
        return;
      }
      ctx.flight = runHydroFadeOut({els: live, onDone: () => this.clearSceneDom()});
    },
    finishScene(): void {
      this.clearTimers(); // incl. the scene-budget safety it just beat
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
      this.proxyEls().forEach((el) => gsap.set(el, {autoAlpha: 0}));
      this.sceneCards = [];
      this.proxyRefs = [];
      this.flipRefs = [];
    },
    teardownVisuals(): void {
      this.clearTimers();
      ctx.flight?.kill();
      ctx.flight = undefined;
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
