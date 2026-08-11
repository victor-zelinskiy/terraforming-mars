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
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {
  colonyTradeClaimsReveal, colonyTradeGlidePlan, colonyTradeState, finishColonyTrackReset,
  isColonyTradeRevealStaged, markColonyTradeZoomReady, registerColonyTradeZoomOrigin,
  setColonyTradeBeat, setColonyTradeCardScene, stageColonyTradeReveal, tradeLog,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {
  TRADE_FRAME_MS, tradeCoverPlan, TradeCoverPlanEntry,
} from '@/client/console/colonyTrade/colonyTradeModel';
import {colonyResolutionUi} from '@/client/console/colonyTrade/colonyResolution';
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

/**
 * The FIRST candidate that genuinely has a box.
 *
 * ⚠️ A MEASURED LADDER, NOT `a ?? b`. `??` falls through only on a MISSING
 * element, so a focus-stage anchor that exists but has collapsed (a fold in
 * flight, a host parked behind an embed) poisoned the whole lookup: the
 * still-visible overview tile was never tried, `stableRect` polled 40 frames
 * against the dead node and the scene silently degraded. Selectors are given
 * best-first; a candidate with no usable rect is simply skipped.
 */
function pickAnchor(selectors: ReadonlyArray<string>): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  let fallback: HTMLElement | null = null;
  for (const sel of selectors) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) {
        return el;
      }
      fallback = fallback ?? el;
    }
  }
  // Nothing measurable YET — hand back the best-named candidate so
  // `stableRect` can keep polling it while the layout settles.
  return fallback;
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
      // The FULL-STAGE DISCARD owns the room: a next-cycle batch that rode
      // the discard's own response WAITS (its reveal slot is held empty) and
      // launches from the RESTORED focus stage — reactive, so the restore
      // re-fires this computed and the covers fly then.
      if (colonyResolutionUi.discardStage) {
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
      preloadPremiumCardArt(e.cards.map((c) => c.name));
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
      const key = cssEscape(name);
      // THE CARDS SEPARATE FROM THEIR PRINTED BACKS. The income covers lift
      // off the CARD-BACK GLYPH of the EFFECTIVE reward cell — the exact
      // number the player just read on the track — and the bonus cover off
      // the «БОНУС ВЛАДЕЛЬЦА» zone's own printed card. The planet is only
      // the ladder's deep fallback (a closed stage degrades to the tile):
      // «карты летят откуда-то из зоны планеты» was the reported wrongness.
      const incomeLadder = [
        `.con-colfocus [data-colony-card-cell="${key}"]`,
        `.con-colfocus [data-colony-card-source="${key}"]`,
        `${tileSel} [data-colony-trade-source]`,
        tileSel,
      ];
      const bonusLadder = [
        `.con-colfocus [data-colony-bonus-cell="${key}"]`,
        `.con-colfocus [data-colony-bonus-source="${key}"]`,
        `${tileSel} [data-colony-bonus-source]`,
        tileSel,
      ];
      const incomeRect = await stableRect(() => pickAnchor(incomeLadder));
      const bonusRect = await stableRect(() => pickAnchor(bonusLadder));
      // The SOURCE CELL answers each departure: a one-shot press as every
      // card separates (the deck-tick idiom — direct classList, self-clean).
      const pulseTargets = {
        income: pickAnchor(incomeLadder)?.closest<HTMLElement>('.con-colfocus__xcell') ?? null,
        bonus: pickAnchor(bonusLadder)?.closest<HTMLElement>('.con-colfocus__ownerbonus') ?? null,
      };
      const pulseAt = (role: 'income' | 'bonus', delayMs: number) => {
        const el = pulseTargets[role];
        if (el === null || colonyTradeState.reducedMotion) {
          return;
        }
        ctx.timers.push(setTimeout(() => {
          el.classList.add('con-colcell--dealt');
          ctx.timers.push(setTimeout(() => el.classList.remove('con-colcell--dealt'), motionMs(420)));
        }, motionMs(delayMs)));
      };
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

      // A SINGLE-card batch flies to the CENTRE presentation pose ONLY on the
      // standalone/headless path (the fullscreen viewer lifts it from there).
      // An EMBEDDED reveal has a real slot for it — the centre detour landed
      // a huge card mid-screen and then released the real one in the slot,
      // which read as a teleport; the multi path below measures the one slot
      // and lands the cover pixel-perfect on it instead.
      const embeddedHost = typeof document !== 'undefined' &&
        document.querySelector('.con-reveal--embedded') !== null;
      if (e.cards.length === 1 && !embeddedHost) {
        pulseAt(plan[0]?.role ?? 'income', plan[0]?.delayMs ?? 0);
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
        pulseAt(p.role, p.delayMs);
        const scaleTo = Math.max(0.05, target.width / CARD_NATURAL_W);
        ctx.handles.push(runTradeCoverFlight({
          proxy, flip,
          index: i,
          from: from as RectLike,
          toRect: target as RectLike,
          naturalH: target.height / scaleTo,
          delayMs: p.delayMs,
          reduced: colonyTradeState.reducedMotion,
          // A colony-bonus card is opened ON THE TABLE by its zone, so its
          // cover must not turn in the air (see runTradeCoverFlight.faceDown).
          faceDown: p.role === 'bonus',
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
      // The FOCUS STAGE's expanded track leads when the stage is up — the
      // white marker physically steps home along the BIG rail the player is
      // looking at; the overview tile's strip is the fallback. Both hosts
      // publish the anchor on a MARKER SEAT (a round chip the size of the
      // resting marker), so the proxy is sized and posed from the very box it
      // lands on instead of from a stretched flex cell — which is what made
      // the same code read as a crisp dot on the tile and a blob on the stage.
      const cellEl = (pos: number) => pickAnchor([
        `.con-colfocus [data-colony-track-cell="${cssEscape(`${name}#${pos}`)}"]`,
        `[data-test="con-colony-${name}"] [data-colony-track-cell="${cssEscape(`${name}#${pos}`)}"]`,
      ]);
      const fromRect = await stableRect(() => cellEl(plan.from));
      const cellRects = await Promise.all(plan.path.map((pos) => stableRect(() => cellEl(pos))));
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
      const cellEls = plan.path.map((pos) => cellEl(pos));
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
