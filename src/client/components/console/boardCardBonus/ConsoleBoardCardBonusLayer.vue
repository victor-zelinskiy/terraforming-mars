<template>
  <!--
    BOARD CARD-BONUS LAYER — the app-level stage the "card bonus lifts off
    the board cell" cinematic plays on (mounted once in ConsoleShell).

    The hero COVER takes over the board icon's exact rect (the SAME
    card.webp art — a pixel-perfect separation, never a new object), rises
    off the cell before the tile covers it, hovers while the server
    resolves, then the reveal PROXIES (one per received card — the deal
    flip plumbing + FaceLite faces) take over at its rect and travel into
    the reveal space. Pointer-inert, clipped; the controller owns the
    beats, the director the GSAP.
  -->
  <div class="con-bonusfly-layer" aria-hidden="true">
    <div ref="cover" class="con-bonusfly-cover">
      <div class="con-card-back"></div>
    </div>
    <div v-for="(name, i) in sceneCards" :key="sceneNonce + '|' + name + '#' + i"
         class="con-bonusfly-proxy"
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
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {currentRevealEvent, DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {
  abortBoardCardBonus, armBoardCardBonus, boardCardBonusState, endBoardCardBonus, isVenusScaleReveal,
  markBonusZoomEntryReady, registerBoardCardBonusHandle, registerBonusZoomOrigin, revealMatchesSource,
  setBoardCardBonusPhase, stageBoardCardBonusReveal, BoardCardBonusAbortMode,
} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {
  bonusSceneTimings, gatherPoint, presentationTarget, reducedBonusSceneTimings,
  BonusSceneTimings, RectLike,
} from '@/client/console/boardCardBonus/boardCardBonusModel';
import {
  runBonusAbortVisual, runBonusCoverLift, runBonusFanOut, runBonusHandoff,
  runBonusSingleFlight, BonusCoverHandle, BonusSceneHandle,
} from '@/client/console/boardCardBonus/boardCardBonusDirector';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';

/** The natural (unscaled) FaceLite height — mirrors the card frame. */
const CARD_NATURAL_H = 420;

/** The source icon hides under the lifting cover (one-object rule). */
const SOURCE_LIFTED_CLASS = 'con-bonus-source-lifted';

/** The Venus scale 8% card-bonus marker (a fixed anchor — [[scaleBonusZones]]). */
const VENUS_MARKER_SEL = '[data-arc-marker="venus-8"] .bonus-zone__icon';

/**
 * Commit arrived (gameAge moved) but no tile-source reveal followed within
 * this window → the bonus genuinely produced no cards (deck empty / a
 * non-placement pick): recall the cover honestly.
 */
const NO_REVEAL_GRACE_MS = 1600;

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

/*
 * Non-reactive scene context (module scope — the layer is a singleton,
 * and GSAP handles must never be wrapped in Vue reactivity).
 */
type SceneCtx = {
  coverHandle?: BonusCoverHandle,
  sceneHandle?: BonusSceneHandle,
  abortHandle?: BonusSceneHandle,
  cellRect?: RectLike,
  liftedEls: Array<HTMLElement>,
  timers: Array<ReturnType<typeof setTimeout>>,
  noRevealTimer?: ReturnType<typeof setTimeout>,
};
const ctx: SceneCtx = {liftedEls: [], timers: []};

export default defineComponent({
  name: 'ConsoleBoardCardBonusLayer',
  components: {ConsoleCardFaceLite},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  data() {
    return {
      boardCardBonusState,
      sceneCards: [] as Array<CardName>,
      sceneNonce: 0,
      proxyRefs: [] as Array<HTMLElement | null>,
      flipRefs: [] as Array<HTMLElement | null>,
    };
  },
  computed: {
    /**
     * The reveal batch this layer should drive NOW (the current one — the
     * batch the overlay is about to show). TWO paths, both watched pre-flush
     * so the staging lands BEFORE the overlay's first render (no flash of
     * the finished modal):
     *   · an ACTIVE scene (board, armed at submit) → the reveal matching its
     *     source (`tile`), while still at the source (lift/hover), unstaged;
     *   · NO scene yet → a VENUS-scale reveal SELF-ARMS a scene (no tile
     *     race → reactive is safe; the layer is console-only, so desktop is
     *     never touched).
     */
    revealToProcess(): DrawnCardEntry | undefined {
      const e = currentRevealEvent();
      if (e === undefined) {
        return undefined;
      }
      const s = this.boardCardBonusState;
      if (s.active) {
        if (s.stagedEventId !== undefined || (s.phase !== 'lift' && s.phase !== 'hover')) {
          return undefined;
        }
        return revealMatchesSource(e.source, s.source) ? e : undefined;
      }
      // No scene → a venus reveal SELF-ARMS. CRUCIAL: never re-arm the batch
      // this scene ALREADY handled (`stagedEventId` persists after the scene
      // ends). Without this, the venus reveal — untaken while the fullscreen
      // is open — would re-match every time the scene ends and re-arm in an
      // endless loop, keeping the input gate locked so the take never fires.
      return isVenusScaleReveal(e.source) && e.id !== s.stagedEventId ? e : undefined;
    },
    /** Commit heartbeat — drives the honest "no cards came" recall (board). */
    commitAge(): number {
      return this.playerView.game.gameAge;
    },
  },
  watch: {
    /** A fresh arm (the shell / self-arm bumped the nonce): begin the scene. */
    'boardCardBonusState.nonce'() {
      void this.beginScene();
    },
    revealToProcess(e: DrawnCardEntry | undefined) {
      if (e === undefined) {
        return;
      }
      // A venus-scale reveal with no scene yet SELF-ARMS (atomic: arm + the
      // stage below land in this one tick, so the overlay veils on first
      // render). A board scene is already armed → straight to staging.
      if (!boardCardBonusState.active) {
        armBoardCardBonus({kind: 'venus-scale'});
      }
      this.onRevealArrived(e);
    },
    commitAge() {
      // BOARD only: the commit landed but no tile reveal followed → the bonus
      // produced nothing (deck empty / a non-placement pick). Recall the
      // cover instead of hovering forever. (Venus self-arms FROM its reveal,
      // so a venus scene always has its batch — this path never applies.)
      if (!boardCardBonusState.active || boardCardBonusState.source.kind !== 'board-cell') {
        return;
      }
      if (boardCardBonusState.stagedEventId !== undefined) {
        return;
      }
      if (boardCardBonusState.phase !== 'lift' && boardCardBonusState.phase !== 'hover') {
        return;
      }
      if (ctx.noRevealTimer !== undefined) {
        return;
      }
      const spaceId = boardCardBonusState.source.spaceId;
      ctx.noRevealTimer = setTimeout(() => {
        ctx.noRevealTimer = undefined;
        if (!boardCardBonusState.active || boardCardBonusState.stagedEventId !== undefined) {
          return;
        }
        const space = this.playerView.game.spaces.find((sp) => sp.id === spaceId);
        abortBoardCardBonus(space?.tileType !== undefined ? 'absorb' : 'return');
      }, motionMs(NO_REVEAL_GRACE_MS));
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
    /** The single-card fullscreen's physical zoom origin (the cover proxy). */
    proxyCardEl(): HTMLElement | null {
      return this.proxyRefs[0] ?? null;
    },
    proxyEls(): Array<HTMLElement> {
      return this.sceneCards.map((_, i) => this.proxyRefs[i]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    },
    flipEls(): Array<HTMLElement> {
      return this.sceneCards.map((_, i) => this.flipRefs[i]).filter((el): el is HTMLElement => el !== null && el !== undefined);
    },
    /**
     * The real source-icon element(s) the cover lifts off — the SAME
     * card.webp art in both cases, so the takeover is pixel-perfect:
     *   · board-cell → the placed cell's `.board-space-bonus--card`;
     *   · venus-scale → the fixed Venus 8% marker pictogram.
     */
    resolveSourceIcons(): Array<HTMLElement> {
      const source = boardCardBonusState.source;
      const sel = source.kind === 'board-cell' ?
        `.board-space[data_space_id="${cssEscape(source.spaceId)}"] .board-space-bonus--card` :
        VENUS_MARKER_SEL;
      return Array.from(document.querySelectorAll<HTMLElement>(sel));
    },
    // ── The scene ────────────────────────────────────────────────────────
    async beginScene(): Promise<void> {
      if (!boardCardBonusState.active || typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') {
        return;
      }
      this.teardownVisuals();
      registerBoardCardBonusHandle({abort: (mode) => this.onAbort(mode)});
      registerBonusZoomOrigin(() => this.proxyCardEl());
      const icons = this.resolveSourceIcons();
      if (icons.length === 0) {
        abortBoardCardBonus('instant');
        return;
      }
      const from = await stableRect(() => icons[0]);
      if (from === undefined || !boardCardBonusState.active) {
        if (boardCardBonusState.active) {
          abortBoardCardBonus('instant');
        }
        return;
      }
      const cover = this.$refs.cover as HTMLElement | undefined;
      if (cover === undefined || cover === null) {
        abortBoardCardBonus('instant');
        return;
      }
      ctx.cellRect = from;
      // One-object rule: the real icons hide the same frame the cover
      // appears over them (same art, same rect — a seamless takeover).
      ctx.liftedEls = icons;
      icons.forEach((el) => el.classList.add(SOURCE_LIFTED_CLASS));
      ctx.coverHandle = runBonusCoverLift({
        cover,
        from,
        t: this.timings(),
        reduced: consoleReducedMotionActive(),
        onLifted: () => setBoardCardBonusPhase('hover'),
      });
    },
    onRevealArrived(e: DrawnCardEntry): void {
      if (!stageBoardCardBonusReveal(e.id, e.cards.length)) {
        return;
      }
      if (ctx.noRevealTimer !== undefined) {
        clearTimeout(ctx.noRevealTimer);
        ctx.noRevealTimer = undefined;
      }
      void this.startTransfer(e);
    },
    /** The lift must finish its rise before the transfer takes over. */
    waitForHover(): Promise<void> {
      return new Promise((done) => {
        let tries = 0;
        const poll = () => {
          if (!boardCardBonusState.active || boardCardBonusState.phase !== 'lift' || tries > 60) {
            done();
            return;
          }
          tries++;
          requestAnimationFrame(poll);
        };
        poll();
      });
    },
    async startTransfer(e: DrawnCardEntry): Promise<void> {
      await this.waitForHover();
      if (!boardCardBonusState.active || boardCardBonusState.stagedEventId !== e.id) {
        return;
      }
      if (e.cards.length === 1) {
        await this.startSingle(e);
      } else {
        await this.startMulti(e);
      }
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
      return rect ?? ctx.cellRect;
    },
    async startSingle(e: DrawnCardEntry): Promise<void> {
      setBoardCardBonusPhase('gather');
      this.sceneCards = [e.cards[0].name];
      this.sceneNonce++;
      await this.$nextTick();
      const proxy = this.proxyEls()[0];
      const flip = this.flipEls()[0];
      const from = this.takeOverCover();
      if (proxy === undefined || flip === undefined || from === undefined) {
        this.degradeToInstant();
        return;
      }
      const t = this.timings();
      const reduced = consoleReducedMotionActive();
      ctx.sceneHandle = runBonusSingleFlight({
        proxy,
        flip,
        from,
        to: presentationTarget(window.innerWidth, window.innerHeight, CARD_NATURAL_W, CARD_NATURAL_H),
        naturalW: CARD_NATURAL_W,
        naturalH: CARD_NATURAL_H,
        t,
        reduced,
        onArrived: () => {
          setBoardCardBonusPhase('frame');
          // Release the held fullscreen auto-open: the viewer opens with a
          // PHYSICAL origin resolving to this proxy — the existing zoom
          // FLIP lifts the real card out of the scene (and `con-zoom-hold`
          // hides the proxy the frame the flight starts).
          markBonusZoomEntryReady();
          if (reduced) {
            // The reduced zoom open is a bare fade (no slot hold) — fade
            // the proxy ourselves so the card never doubles.
            gsap.to(proxy, {autoAlpha: 0, duration: motionMs(140) / 1000, ease: 'power1.out'});
          }
          // END the scene once the fullscreen viewer has TAKEN OVER (the FLIP
          // has captured this proxy as its physical source — a few frames). The
          // TAKE belongs to the viewer now, so the input gate must NOT stay
          // locked through it (that swallowed the «A Взять» press). Short window
          // = the fly-in still can't be taken prematurely; cleanup follows.
          ctx.timers.push(setTimeout(() => this.finishScene(), motionMs(reduced ? 120 : 300)));
        },
      });
    },
    async startMulti(e: DrawnCardEntry): Promise<void> {
      setBoardCardBonusPhase('gather');
      this.sceneCards = e.cards.map((c) => c.name);
      this.sceneNonce++;
      await this.$nextTick();
      const keys = e.cards.map((c, i) => `${c.name}#${i}`);
      const targets = await Promise.all(keys.map((key) => stableRect(() => document.querySelector<HTMLElement>(
        `.con-reveal [data-zoom-slot="${cssEscape(key)}"] .card-container`,
      ))));
      if (!boardCardBonusState.active || boardCardBonusState.stagedEventId !== e.id) {
        return;
      }
      const proxies = this.proxyEls();
      const flips = this.flipEls();
      const resolved = targets.filter((r): r is DOMRect => r !== undefined);
      if (resolved.length !== keys.length || proxies.length !== keys.length || flips.length !== keys.length) {
        // The overlay never produced stable slots (a different batch is on
        // screen / edge layout) — honest degrade: no flight, instant reveal.
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
          // The covers stand in the exact slots — NOW the frame assembles
          // around them (the overlay unveils via its phase-driven classes).
          setBoardCardBonusPhase('frame');
          ctx.timers.push(setTimeout(() => {
            // Handoff: the overlay releases its held static cards (they
            // fade in UNDER the proxies), the proxies dissolve above them.
            setBoardCardBonusPhase('handoff');
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
     * The scene can't play (no anchors / a different batch on screen):
     * release everything so the standard reveal shows instantly — an
     * honest degrade, never a stranded invisible UI.
     */
    degradeToInstant(): void {
      const cover = this.$refs.cover as HTMLElement | undefined;
      const els = [...(cover !== undefined && cover !== null ? [cover] : []), ...this.proxyEls()];
      ctx.abortHandle = runBonusAbortVisual({
        els,
        mode: 'instant',
        cell: ctx.cellRect,
        t: this.timings(),
        onDone: () => this.clearSceneDom(),
      });
      this.restoreLifted();
      endBoardCardBonus();
    },
    finishScene(): void {
      this.restoreLifted();
      endBoardCardBonus();
      this.clearSceneDom();
    },
    /**
     * The controller's abort handle — kill the live beats, play the honest
     * recall visual, restore the board icon. The controller has already
     * cleared its state (gates open, overlay unveiled/released).
     */
    onAbort(mode: BoardCardBonusAbortMode): void {
      this.clearTimers();
      ctx.coverHandle?.kill();
      ctx.coverHandle = undefined;
      ctx.sceneHandle?.kill();
      ctx.sceneHandle = undefined;
      ctx.abortHandle?.kill();
      ctx.abortHandle = undefined;
      this.restoreLifted();
      const cover = this.$refs.cover as HTMLElement | undefined;
      const els = [...(cover !== undefined && cover !== null ? [cover] : []), ...this.proxyEls()];
      ctx.abortHandle = runBonusAbortVisual({
        els,
        mode,
        cell: ctx.cellRect,
        t: this.timings(),
        onDone: () => this.clearSceneDom(),
      });
    },
    // ── Cleanup ─────────────────────────────────────────────────────────
    restoreLifted(): void {
      // Deterministic restore — harmless when the tile unmounted the icon,
      // load-bearing when nothing covered the cell (abort / no-tile picks).
      ctx.liftedEls.forEach((el) => el.classList.remove(SOURCE_LIFTED_CLASS));
      ctx.liftedEls = [];
    },
    clearTimers(): void {
      ctx.timers.forEach((timer) => clearTimeout(timer));
      ctx.timers = [];
      if (ctx.noRevealTimer !== undefined) {
        clearTimeout(ctx.noRevealTimer);
        ctx.noRevealTimer = undefined;
      }
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
      ctx.abortHandle?.kill();
      ctx.abortHandle = undefined;
      this.restoreLifted();
      this.clearSceneDom();
    },
  },
  beforeUnmount() {
    this.teardownVisuals();
    registerBoardCardBonusHandle(undefined);
    registerBonusZoomOrigin(undefined);
  },
});
</script>
