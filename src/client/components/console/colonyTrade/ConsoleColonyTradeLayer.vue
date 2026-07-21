<template>
  <!--
    COLONY-TRADE LAYER — the app-level stage of the trade-reward cinematic
    (mounted once in ConsoleShell, next to the trade-fleet layer).

    Two kinds of actors live here:
      · CARD COVERS — one face-down flyer PER drawn card, born at the traded
        tile's own «ТОРГОВАТЬ» / «БОНУС» cell (the same card.webp sleeve the
        BenefitGlyph shows), arcing into the reveal modal's real slots with
        the shared premium tumble-open. Wave order = the batch's server
        segments (income first, then the colony bonuses), staggered so the
        player can COUNT their cards.
      · THE WHITE MARKER — the track-reset glide proxy that steps the traded
        colony's marker LEFT to its post-trade cell once every reward is
        confirmed.

    Pointer-inert; the controller (consoleColonyTrade) owns the phases, the
    director the GSAP. Resource chips are NOT here — they ride the shared
    ConsoleResourceTransferLayer.
  -->
  <div class="con-coltrade-layer" aria-hidden="true">
    <div v-for="(cover, i) in covers" :key="coverNonce + '|' + cover.name + '#' + i"
         class="con-coltrade-proxy"
         :ref="(el) => setProxyRef(el, i)">
      <div class="con-deal-proxy__flip" :ref="(el) => setFlipRef(el, i)">
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="cover.name" />
        </div>
        <div class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
    </div>
    <div v-if="markerVisible" class="con-coltrade-marker" ref="marker"></div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {presentationTarget} from '@/client/console/boardCardBonus/boardCardBonusModel';
import {currentRevealEvent, DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {premiumCardArt} from '@/client/cards/cardArt';
import {
  colonyTradeClaimsReveal, colonyTradeGlidePlan, colonyTradeState, finishColonyTrackReset,
  isColonyTradeRevealStaged, markColonyTradeZoomReady, registerColonyTradeZoomOrigin,
  setColonyTradeBeat, setColonyTradeCardScene, stageColonyTradeReveal, tradeLog,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {
  TRADE_FRAME_MS, tradeCoverPlan, TradeCoverPlanEntry,
} from '@/client/console/colonyTrade/colonyTradeModel';
import {
  RectLike, runColonyTrackGlide, runTradeCoverFlight, runTradeCoversHandoff, TradeDirectorHandle,
} from '@/client/console/colonyTrade/colonyTradeDirector';

/** The natural (unscaled) FaceLite height — the premium card frame (320×460). */
const CARD_NATURAL_H = 460;

/** How long we wait for the chip waves to clear the stage before the covers fly. */
const CHIP_WAIT_MAX_MS = 8_000;

type CoverCard = {name: CardName, role: 'income' | 'bonus'};

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

/** Warm the faces so the tumble never lands on a not-yet-decoded (black) art. */
function preloadFaceArt(names: ReadonlyArray<CardName>): void {
  if (typeof Image === 'undefined') {
    return;
  }
  for (const name of names) {
    new Image().src = premiumCardArt(name).url;
  }
}

/* Non-reactive scene context — GSAP handles must never enter Vue reactivity. */
type SceneCtx = {
  handles: Array<TradeDirectorHandle>,
  timers: Array<ReturnType<typeof setTimeout>>,
};
const ctx: SceneCtx = {handles: [], timers: []};

function clearScene(): void {
  ctx.handles.forEach((h) => h.kill());
  ctx.handles = [];
  ctx.timers.forEach((t) => clearTimeout(t));
  ctx.timers = [];
}

export default defineComponent({
  name: 'ConsoleColonyTradeLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {
      colonyTradeState,
      covers: [] as Array<CoverCard>,
      coverNonce: 0,
      proxyRefs: [] as Array<HTMLElement | null>,
      flipRefs: [] as Array<HTMLElement | null>,
      markerVisible: false,
    };
  },
  computed: {
    /**
     * The trade batch this layer should fly NOW. Watched PRE-FLUSH so the
     * claim lands before the overlay's first render (it must mount VEILED).
     * Reduced motion deliberately never claims — the modal then mounts with
     * its stock entrance, which is the honest short form (the deck-draw
     * scene is excluded from trade batches separately, so nothing else
     * grabs them).
     */
    revealToProcess(): DrawnCardEntry | undefined {
      if (!colonyTradeState.active || colonyTradeState.reducedMotion || colonyTradeState.cardScene !== 'idle') {
        return undefined;
      }
      const e = currentRevealEvent();
      if (e === undefined || isColonyTradeRevealStaged(e.id) || !colonyTradeClaimsReveal(e.source)) {
        return undefined;
      }
      return e;
    },
  },
  watch: {
    revealToProcess: {
      flush: 'pre',
      handler(e: DrawnCardEntry | undefined): void {
        if (e !== undefined) {
          this.claimBatch(e);
        }
      },
    },
    'colonyTradeState.glideNonce'(): void {
      void this.runTrackGlide();
    },
    // The transaction unwound (abort / ceiling) — drop every actor at once.
    'colonyTradeState.active'(active: boolean): void {
      if (!active) {
        this.teardown();
      }
    },
  },
  mounted() {
    // The single-card fullscreen lifts THIS flown cover (a physical origin),
    // never a fresh copy over it.
    registerColonyTradeZoomOrigin(() => this.proxyEls()[0] ?? null);
  },
  beforeUnmount() {
    registerColonyTradeZoomOrigin(undefined);
    this.teardown();
  },
  methods: {
    setProxyRef(el: unknown, i: number): void {
      this.proxyRefs[i] = (el as HTMLElement | null) ?? null;
    },
    setFlipRef(el: unknown, i: number): void {
      this.flipRefs[i] = (el as HTMLElement | null) ?? null;
    },
    proxyEls(): Array<HTMLElement> {
      return this.proxyRefs.filter((el): el is HTMLElement => el !== null);
    },

    /** CLAIM the batch synchronously (the veil must precede the first paint). */
    claimBatch(e: DrawnCardEntry): void {
      if (!stageColonyTradeReveal(e.id)) {
        return;
      }
      preloadFaceArt(e.cards.map((c) => c.name));
      void this.runCoverScene(e);
    },

    /** The chip waves finish first — consequences never overlap their cause. */
    waitForChips(): Promise<void> {
      return new Promise((done) => {
        if (colonyTradeState.phase !== 'chips') {
          done();
          return;
        }
        const started = Date.now();
        const poll = () => {
          if (!colonyTradeState.active || colonyTradeState.phase !== 'chips' ||
              Date.now() - started > CHIP_WAIT_MAX_MS) {
            done();
            return;
          }
          ctx.timers.push(setTimeout(poll, 90));
        };
        poll();
      });
    },

    /** The whole cover scene of ONE staged batch (multi or single card). */
    async runCoverScene(e: DrawnCardEntry): Promise<void> {
      await this.waitForChips();
      if (!colonyTradeState.active || !isColonyTradeRevealStaged(e.id)) {
        return;
      }
      const plan = tradeCoverPlan(e.cards.length, e.tradeSegments);
      this.covers = plan.map((p) => ({name: e.cards[p.index].name, role: p.role}));
      this.coverNonce++;
      this.proxyRefs = [];
      this.flipRefs = [];
      // Narrate the card waves on the tile's status line: the income covers
      // first, then — at the bonus wave's own launch time — the colony bonus.
      const firstIncome = plan.find((p) => p.role === 'income');
      const firstBonus = plan.find((p) => p.role === 'bonus');
      setColonyTradeBeat(firstIncome !== undefined ? 'income' : 'bonus');
      if (firstIncome !== undefined && firstBonus !== undefined) {
        ctx.timers.push(setTimeout(() => setColonyTradeBeat('bonus'), motionMs(firstBonus.delayMs)));
      }
      await this.$nextTick();

      const name = colonyTradeState.colonyName;
      const tileSel = `[data-test="con-colony-${name}"]`;
      const incomeRect = await stableRect(() => document.querySelector<HTMLElement>(
        `${tileSel} [data-colony-trade-source]`) ?? document.querySelector<HTMLElement>(tileSel));
      const bonusRect = await stableRect(() => document.querySelector<HTMLElement>(
        `${tileSel} [data-colony-bonus-source]`) ?? document.querySelector<HTMLElement>(tileSel));
      if (!colonyTradeState.active) {
        return;
      }
      if (incomeRect === undefined && bonusRect === undefined) {
        // No believable launch anchor (the colonies screen unmounted): hand
        // off honestly — the modal simply shows, no flight, never stranded.
        tradeLog('cover scene degraded — no tile anchor');
        this.degradeToInstant();
        return;
      }

      if (e.cards.length === 1) {
        this.flySingle(e, plan[0], (plan[0]?.role === 'bonus' ? bonusRect : incomeRect) ?? incomeRect ?? bonusRect);
        return;
      }

      // Multi-card: the reveal is mounting VEILED — measure its real slots.
      const keys = e.cards.map((c, i) => `${c.name}#${i}`);
      const targets = await Promise.all(keys.map((key) => stableRect(() => document.querySelector<HTMLElement>(
        `.con-reveal [data-zoom-slot="${cssEscape(key)}"] :is(.card-container, .pcard)`,
      ))));
      if (!colonyTradeState.active || !isColonyTradeRevealStaged(e.id)) {
        return;
      }
      const resolved = targets.filter((r): r is DOMRect => r !== undefined);
      if (resolved.length !== keys.length) {
        tradeLog('cover scene degraded — unmeasurable reveal slots');
        this.degradeToInstant();
        return;
      }

      let landed = 0;
      plan.forEach((p, i) => {
        const proxy = this.proxyRefs[i];
        const flip = this.flipRefs[i];
        const target = targets[p.index];
        const from = (p.role === 'bonus' ? bonusRect : incomeRect) ?? incomeRect ?? bonusRect;
        if (proxy === null || proxy === undefined || flip === null || flip === undefined ||
            target === undefined || from === undefined) {
          landed++;
          return;
        }
        const scaleTo = Math.max(0.05, target.width / CARD_NATURAL_W);
        ctx.handles.push(runTradeCoverFlight({
          proxy, flip,
          index: i,
          from: from as RectLike,
          toRect: target as RectLike,
          naturalH: target.height / scaleTo,
          delayMs: p.delayMs,
          reduced: colonyTradeState.reducedMotion,
          onLanded: () => {
            landed++;
            if (landed >= plan.length) {
              this.frameAndHandoff();
            }
          },
        }));
      });
      if (plan.length === 0) {
        this.frameAndHandoff();
      }
    },

    /** Single-card batch: the cover flies to the centre presentation pose and
     *  the fullscreen viewer lifts it from there (physical zoom origin). */
    flySingle(e: DrawnCardEntry, plan: TradeCoverPlanEntry | undefined, from: DOMRect | undefined): void {
      const proxy = this.proxyRefs[0];
      const flip = this.flipRefs[0];
      if (proxy === null || proxy === undefined || flip === null || flip === undefined || from === undefined) {
        this.degradeToInstant();
        return;
      }
      const pose = presentationTarget(window.innerWidth, window.innerHeight, CARD_NATURAL_W, CARD_NATURAL_H);
      ctx.handles.push(runTradeCoverFlight({
        proxy, flip,
        index: 0,
        from: from as RectLike,
        toCentre: pose,
        naturalH: CARD_NATURAL_H,
        delayMs: plan?.delayMs ?? 0,
        reduced: colonyTradeState.reducedMotion,
        onLanded: () => {
          if (!colonyTradeState.active || !isColonyTradeRevealStaged(e.id)) {
            return;
          }
          // The viewer takes over: it opens off THIS proxy (physical origin)
          // and the take belongs to it — the scene must release the input
          // gate promptly, never swallow the «A Взять» press.
          setColonyTradeCardScene('frame');
          markColonyTradeZoomReady();
          ctx.timers.push(setTimeout(() => {
            this.covers = [];
            setColonyTradeCardScene('idle');
          }, motionMs(320)));
        },
      }));
    },

    /** The frame materializes around the landed covers, then the real cards
     *  are released UNDER them and the proxies dissolve above. */
    frameAndHandoff(): void {
      if (!colonyTradeState.active) {
        return;
      }
      setColonyTradeCardScene('frame');
      ctx.timers.push(setTimeout(() => {
        if (!colonyTradeState.active) {
          return;
        }
        setColonyTradeCardScene('handoff');
        ctx.handles.push(runTradeCoversHandoff({
          proxies: this.proxyEls(),
          reduced: colonyTradeState.reducedMotion,
          onDone: () => {
            this.covers = [];
            setColonyTradeCardScene('idle');
          },
        }));
      }, motionMs(TRADE_FRAME_MS)));
    },

    /** Honest degrade: unveil + release instantly, no flight, no teleport. */
    degradeToInstant(): void {
      this.covers = [];
      setColonyTradeCardScene('idle');
    },

    // ── the white-marker reset glide ─────────────────────────────────────
    async runTrackGlide(): Promise<void> {
      const plan = colonyTradeGlidePlan();
      const name = colonyTradeState.colonyName;
      if (plan === undefined || name === '') {
        finishColonyTrackReset();
        return;
      }
      const cellSel = (pos: number) =>
        `[data-test="con-colony-${name}"] [data-colony-track-cell="${cssEscape(`${name}#${pos}`)}"]`;
      const fromRect = await stableRect(() => document.querySelector<HTMLElement>(cellSel(plan.from)));
      const cellRects = await Promise.all(plan.path.map((pos) => stableRect(() => document.querySelector<HTMLElement>(cellSel(pos)))));
      if (!colonyTradeState.active) {
        return;
      }
      const resolved = cellRects.filter((r): r is DOMRect => r !== undefined);
      if (fromRect === undefined || resolved.length !== plan.path.length) {
        // The colonies screen isn't on stage — release the values honestly.
        tradeLog('track glide skipped — track not measurable');
        finishColonyTrackReset();
        return;
      }
      this.markerVisible = true;
      await this.$nextTick();
      const marker = this.$refs.marker as HTMLElement | undefined;
      if (marker === undefined) {
        this.markerVisible = false;
        finishColonyTrackReset();
        return;
      }
      const cellEls = plan.path.map((pos) => document.querySelector<HTMLElement>(cellSel(pos)));
      ctx.handles.push(runColonyTrackGlide({
        marker,
        fromRect: fromRect as RectLike,
        cells: resolved as ReadonlyArray<RectLike>,
        perCellMs: plan.perCellMs,
        reduced: colonyTradeState.reducedMotion,
        onCellPassed: (i) => {
          // A light impulse on each passed cell — direct classList (the
          // colony-build precedent), one-shot, self-cleaning.
          const cell = cellEls[i];
          if (cell !== null && cell !== undefined) {
            cell.classList.add('con-coltile__track-cell--sweep');
            ctx.timers.push(setTimeout(() => cell.classList.remove('con-coltile__track-cell--sweep'), motionMs(360)));
          }
        },
        onLanded: () => {
          // Release the frozen readouts UNDER the settled proxy (the real
          // marker paints on the reset cell), then dissolve the proxy over it.
          finishColonyTrackReset();
          gsap.to(marker, {autoAlpha: 0, duration: motionMs(220) / 1000, ease: 'power1.out', onComplete: () => {
            this.markerVisible = false;
          }});
        },
      }));
    },

    teardown(): void {
      clearScene();
      const els = this.proxyEls();
      if (els.length > 0) {
        gsap.set(els, {autoAlpha: 0});
      }
      this.covers = [];
      this.markerVisible = false;
    },
  },
});
</script>
