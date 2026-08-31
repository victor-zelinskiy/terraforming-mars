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
import {probeTick} from '@/client/console/probeTick';
import {currentRevealEvent, DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {
  colonyPayoutPending, colonyTradeClaimsReveal, colonyTradeGlidePlan, colonyTradeState,
  finishColonyTrackAdvance, finishColonyTrackReset, isColonyTradeRevealStaged,
  markColonyTradeZoomReady, registerColonyTradeZoomOrigin, setColonyTradeBeat,
  setColonyTradeCardScene, stageColonyTradeReveal, tradeLog,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {
  TRADE_COVER_FLIGHT_MS, TRADE_COVER_LIFT_MS, TRADE_FRAME_MS, TRADE_LIFTOFF_AT_F,
  tradeCoverPlan, TradeCoverPlanEntry,
} from '@/client/console/colonyTrade/colonyTradeModel';
import {colonyResolutionUi, clearColonyPayoutLiftOff, markColonyPayoutLiftOff} from '@/client/console/colonyTrade/colonyResolution';
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
        probeTick(poll);
      } else {
        done(ok ? r : undefined);
      }
    };
    probeTick(poll);
  });
}

/**
 * THE WHOLE DESTINATION ROW, MEASURED AT ONE INSTANT AND AT REST.
 *
 * ⚠️ Per-slot `stableRect` is not the same claim, and the difference shipped as
 * «карты летят по странной траектории»: each slot resolved as soon as ITS OWN
 * rect held for two frames, so slot 1 could be measured before the strip's fit
 * had solved and slot 4 after — one flight aimed at two different layouts. The
 * row is one object: every slot must exist, be non-degenerate, and hold the
 * SAME set of rects across two consecutive frames before anything takes off.
 * Bounded by its own net — a row that never settles degrades honestly rather
 * than stranding the batch.
 */
function waitForStandingSlots(
  resolve: () => Array<HTMLElement | null>,
  deadlineMs: number,
): Promise<Array<DOMRect> | undefined> {
  return new Promise((done) => {
    const start = performance.now();
    let last = '';
    const poll = () => {
      if (!colonyTradeState.active) {
        done(undefined);
        return;
      }
      const els = resolve();
      const rects: Array<DOMRect> = [];
      for (const el of els) {
        const r = el?.getBoundingClientRect();
        if (r !== undefined && r.width > 2 && r.height > 2) {
          rects.push(r);
        }
      }
      if (rects.length === els.length) {
        const sig = rects.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`).join('|');
        if (sig === last || deadlineMs <= 0) {
          done(rects);
          return;
        }
        last = sig;
      } else {
        last = '';
      }
      if (performance.now() - start > deadlineMs) {
        done(undefined);
        return;
      }
      probeTick(poll);
    };
    poll();
  });
}

/** How long the covers may wait for the reveal row to finish solving itself.
 *  Generous enough for the fit's own settle pass, short enough that a row that
 *  never stands degrades to the instant handoff instead of stranding a batch. */
const SLOTS_STANDING_WAIT_MS = 1_400;

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

/**
 * A cell the marker may honestly glide over: rendered AND visible — not
 * sitting inside an `opacity: 0` / `visibility: hidden` ancestor. A box alone
 * is not enough: the `--handing` pose keeps the whole working area (where the
 * track is drawn) at opacity 0, a yielded browse hides the tile, and a
 * measured-but-invisible rect is exactly the «маркер бежит по пустоте» bug.
 */
function honestlyVisible(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true});
  }
  return true;
}

/**
 * THE CLOSING GLIDE WAITS FOR A STANDING TRACK. The marker's return is the
 * trade's FINAL beat (official rules: the marker drops only after the rewards
 * fully resolve), and by the time it fires the track may still be COMING
 * BACK — the working area un-yielding from the payout, the focus stage
 * re-unfolding after the discard's hand trip. So the run does not measure
 * once and hope: it polls the WHOLE path until every cell exists, is
 * honestly visible and holds a stable rect for two consecutive frames —
 * bounded by its own net, so a track that never stands (a parked workspace,
 * a composition with no track at all) degrades to the instant commit instead
 * of flying a marker across emptiness.
 */
const TRACK_STANDING_WAIT_MS = 2_000;

function waitForStandingTrack(
  resolveCells: () => Array<HTMLElement | null>,
  deadlineMs: number,
): Promise<Array<DOMRect> | undefined> {
  return new Promise((done) => {
    const start = performance.now();
    let last = '';
    const poll = () => {
      if (!colonyTradeState.active) {
        done(undefined);
        return;
      }
      const els = resolveCells();
      const standing = els.every((el) => el !== null && honestlyVisible(el));
      if (standing) {
        const rects = els.map((el) => (el as HTMLElement).getBoundingClientRect());
        const ok = rects.every((r) => r.width > 2 && r.height > 2);
        const sig = ok ? rects.map((r) => `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}`).join('|') : '';
        // A zero deadline is the single-look mode (reduced motion): the first
        // honest measurement is accepted — there is no flight to protect.
        if (ok && (sig === last || deadlineMs <= 0)) {
          done(rects);
          return;
        }
        last = sig;
      } else {
        last = '';
      }
      if (performance.now() - start > deadlineMs) {
        done(undefined);
        return;
      }
      probeTick(poll);
    };
    poll();
  });
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

/*
 * Non-reactive scene context — GSAP handles must never enter Vue reactivity.
 *
 * ⚠️ TWO ACTORS, TWO LIFETIMES. The card covers belong to ONE payout cycle (a
 * Pluto resolution plays one per colony) and must be reset between cycles; the
 * white MARKER belongs to the transaction and legitimately runs while a cycle
 * starts — the pre-trade ADVANCE leg is exactly the beat the covers wait out.
 * One shared list would make the cycle reset kill the glide mid-flight, and its
 * `onLanded` is what releases the payout: the leg would only ever end on its
 * own safety net.
 */
type SceneCtx = {
  /** The current cover cycle's timelines + timers (reset per batch). */
  handles: Array<TradeDirectorHandle>,
  timers: Array<ReturnType<typeof setTimeout>>,
  /** The marker glide's own timeline + cell-pulse timers (transaction-lived). */
  glideHandles: Array<TradeDirectorHandle>,
  glideTimers: Array<ReturnType<typeof setTimeout>>,
};
const ctx: SceneCtx = {handles: [], timers: [], glideHandles: [], glideTimers: []};

/** Reset the COVER cycle only — the marker keeps its own. */
function clearCovers(): void {
  ctx.handles.forEach((h) => h.kill());
  ctx.handles = [];
  ctx.timers.forEach((t) => clearTimeout(t));
  ctx.timers = [];
}

function clearScene(): void {
  clearCovers();
  ctx.glideHandles.forEach((h) => h.kill());
  ctx.glideHandles = [];
  ctx.glideTimers.forEach((t) => clearTimeout(t));
  ctx.glideTimers = [];
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

    /**
     * THE CAUSE FINISHES BEFORE ITS CONSEQUENCE STARTS. Two beats precede the
     * cards, and the covers wait out BOTH:
     *  · `advance` — the marker is still travelling to the cell this payout is
     *    read at. Launching covers here (and, with them, the stage's dissolve)
     *    made the reveal open while the track was still moving — and the track
     *    the marker was crossing vanished from under it;
     *  · `chips`   — the resource waves are still leaving the tile.
     * Bounded by the same net as before: a stalled phase must never strand a
     * batch on the table.
     */
    waitForCause(): Promise<void> {
      // The phase list lives in the orchestrator (`colonyPayoutPending`) — the
      // layer asks the question, it does not re-state the ladder.
      const busy = () => colonyPayoutPending();
      return new Promise((done) => {
        if (!busy()) {
          done();
          return;
        }
        const started = Date.now();
        const poll = () => {
          if (!colonyTradeState.active || !busy() || Date.now() - started > CHIP_WAIT_MAX_MS) {
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
      // ⚠️ ONE RESOLUTION PLAYS SEVERAL SCENES, AND THE CONTEXT IS MODULE-WIDE.
      // A Pluto payout runs one cycle per colony, and every cycle used to
      // inherit the previous one's live GSAP handles and pending timers —
      // `clearScene` only ever ran on teardown (abort / transaction end). A
      // stale `setColonyTradeBeat('bonus')`, a stale `ascend` cue or a stale
      // cell pulse then fired INSIDE the next cycle, describing a wave that had
      // already been paid. Each scene starts from a clean context; the
      // transaction's own state (staged ids, phase) is untouched — and neither
      // is the MARKER's, which may legitimately be mid-advance right now.
      clearCovers();
      await this.waitForCause();
      if (!colonyTradeState.active || !isColonyTradeRevealStaged(e.id)) {
        return;
      }
      // EVERY PAYOUT RAISES ITS OWN LIFT-OFF CUE. A resolution pays in several
      // cycles (Pluto's cubes, one per colony), and a cue left standing from
      // the previous one would dissolve the stage the instant this batch's
      // zone opened — i.e. before a single card of it had moved, which is the
      // «dissolve at the claim» the whole cue exists to replace.
      clearColonyPayoutLiftOff();
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

      // Multi-card: the reveal is mounting VEILED — measure its real slots, as
      // ONE row and only once it stands still (see `waitForStandingSlots`).
      const keys = e.cards.map((c, i) => `${c.name}#${i}`);
      const targets = await waitForStandingSlots(
        () => keys.map((key) => document.querySelector<HTMLElement>(
          `.con-reveal [data-zoom-slot="${cssEscape(key)}"] :is(.card-container, .pcard)`)),
        colonyTradeState.reducedMotion ? 0 : motionMs(SLOTS_STANDING_WAIT_MS),
      );
      if (!colonyTradeState.active || !isColonyTradeRevealStaged(e.id)) {
        return;
      }
      if (targets === undefined) {
        tradeLog('cover scene degraded — unmeasurable reveal slots');
        this.degradeToInstant();
        return;
      }

      /*
       * EVERY CARD TURNS IN THE AIR — one flip language for the whole payout.
       *
       * The colony-bonus cover used to be delivered FACE DOWN so the «Бонус
       * колонии» zone could open it on the table. Two things were wrong with
       * that, and both were visible in one frame: the zone drew its own card
       * BACK from the moment it mounted, so while the cover was still airborne
       * there were TWO backs for one card (the flight had nothing left to
       * deliver); and the card that did land then played a SECOND, different
       * turn inside the zone while its neighbours had turned on the way. One
       * object, one turn, one grammar — the zone now receives an open card
       * exactly as the strip does.
       */
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
        // The cell answers the FAN (the stack physically peeling off it) —
        // the departure happens off the fan seat, away from the cell.
        pulseAt(p.role, p.fanDelayMs);
        const scaleTo = Math.max(0.05, target.width / CARD_NATURAL_W);
        ctx.handles.push(runTradeCoverFlight({
          proxy, flip,
          index: i,
          from: from as RectLike,
          toRect: target as RectLike,
          naturalH: target.height / scaleTo,
          delayMs: p.delayMs,
          fanDelayMs: p.fanDelayMs,
          fanIndex: p.fanIndex,
          fanCount: p.fanCount,
          reduced: colonyTradeState.reducedMotion,
          onLanded: () => {
            landed++;
            if (landed >= plan.length) {
              this.frameAndHandoff();
            }
          },
        }));
      });
      // ── TWO CUES, ONE PHRASE ────────────────────────────────────────────
      // The scene under the flight lets go IN STEP WITH THE CARDS, and the
      // destination materializes later, under the landing flight.
      const first = plan[0];
      // The stage dissolves with the LAST wave's separation — every wave's
      // covers (the bonus included) must leave a still-lit source. Keyed to
      // the first cover, the bonus wave once launched out of a cell that had
      // been at opacity 0 for half a second: a card appearing out of empty
      // space, visibly not part of the deal that had just played.
      const liftAnchor = (() => {
        if (plan.length === 0) {
          return undefined;
        }
        const lastRole = plan[plan.length - 1].role;
        let i = plan.length - 1;
        while (i > 0 && plan[i - 1].role === lastRole) {
          i--;
        }
        return plan[i];
      })();
      if (first !== undefined && liftAnchor !== undefined && !colonyTradeState.reducedMotion) {
        // 1 · LIFT-OFF — the last wave's first cover separates and STARTS TO
        //     TURN. That is the moment the colony stage begins to evaporate:
        //     the interface dissolves WITH the rising, turning cards over the
        //     whole lift (the pose's own long transition carries it), instead
        //     of blinking out at some point of their travel. Releasing only
        //     deep into the travel is what read as «интерфейс исчезает слишком
        //     резко»: by then the eye has already followed the cards away, so
        //     the change arrives as a cut rather than as part of their
        //     departure.
        ctx.timers.push(setTimeout(() => {
          if (colonyTradeState.active) {
            markColonyPayoutLiftOff();
          }
        }, motionMs(liftAnchor.delayMs + Math.round(TRADE_COVER_LIFT_MS * TRADE_LIFTOFF_AT_F))));
        // 2 · ASCEND — the first cover deep into its travel and almost grown:
        //     «Получены карты» materializes under it. One-shot, guarded — a
        //     fast scene that already reached 'frame' must not be pulled back.
        const ascendAtMs = first.delayMs + TRADE_COVER_LIFT_MS +
          Math.round((TRADE_COVER_FLIGHT_MS - TRADE_COVER_LIFT_MS) * 0.45);
        ctx.timers.push(setTimeout(() => {
          if (colonyTradeState.cardScene === 'fly') {
            setColonyTradeCardScene('ascend');
          }
        }, motionMs(ascendAtMs)));
      } else if (first !== undefined) {
        markColonyPayoutLiftOff(); // reduced motion: the cue is immediate
      }
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
        fanDelayMs: plan?.fanDelayMs ?? 0,
        fanIndex: plan?.fanIndex ?? 0,
        fanCount: plan?.fanCount ?? 1,
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
            // The card is delivered — this payout's lift-off cue is spent, the
            // same as on the multi path (a cue left standing would dissolve the
            // stage the instant the NEXT cycle's zone opened).
            clearColonyPayoutLiftOff();
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
            // The cards are delivered: this payout's cue is spent. (The stage
            // stays yielded on its own latch + the live batch — the pose rides
            // the payout, never the cue.)
            clearColonyPayoutLiftOff();
          },
        }));
      }, motionMs(TRADE_FRAME_MS)));
    },

    /** Honest degrade: unveil + release instantly, no flight, no teleport. */
    degradeToInstant(): void {
      this.covers = [];
      setColonyTradeCardScene('idle');
      // Nothing flew — the stage's cue belongs to the flight, so it must not
      // survive one that never happened (the fallback is `outcomeContentIn`).
      clearColonyPayoutLiftOff();
    },

    // ── the white-marker glide — ONE mechanism, two legs ─────────────────
    //    `advance` steps RIGHT before the reward is read (a trade-offset card
    //    moved the track), `reset` steps LEFT at the end. The layer measures
    //    and animates; only the finisher differs, and the state names which.
    async runTrackGlide(): Promise<void> {
      const advancing = colonyTradeState.glideKind === 'advance';
      const finish = () => advancing ? finishColonyTrackAdvance() : finishColonyTrackReset();
      const plan = colonyTradeGlidePlan();
      const name = colonyTradeState.colonyName;
      if (plan === undefined || name === '') {
        finish();
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
      // The FINAL beat waits for a STANDING track — every cell of the path
      // (origin included) rendered, honestly visible and geometrically at
      // rest — instead of measuring once into a working area that is still
      // un-yielding or a stage that is still unfolding. Reduced motion takes
      // one honest look (there is no flight to protect, only a snap).
      const standing = await waitForStandingTrack(
        () => [cellEl(plan.from), ...plan.path.map((pos) => cellEl(pos))],
        colonyTradeState.reducedMotion ? 0 : motionMs(TRACK_STANDING_WAIT_MS),
      );
      if (!colonyTradeState.active) {
        return;
      }
      if (standing === undefined) {
        // No visible track within the net (a parked workspace, a trackless
        // composition) — release the values honestly, fly nothing.
        tradeLog('track glide skipped — no standing visible track');
        finish();
        return;
      }
      const [fromRect, ...resolved] = standing;
      this.markerVisible = true;
      await this.$nextTick();
      const marker = this.$refs.marker as HTMLElement | undefined;
      if (marker === undefined) {
        this.markerVisible = false;
        finish();
        return;
      }
      const cellEls = plan.path.map((pos) => cellEl(pos));
      ctx.glideHandles.push(runColonyTrackGlide({
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
            ctx.glideTimers.push(setTimeout(() => cell.classList.remove('con-coltile__track-cell--sweep'), motionMs(360)));
          }
        },
        onLanded: () => {
          // Release the frozen readouts UNDER the settled proxy (the real
          // marker paints on the landed cell), then dissolve the proxy over
          // it. Same handoff for both legs — only the finisher differs.
          finish();
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
      // The next payout raises its OWN lift-off cue — inheriting this one
      // would dissolve the stage before its first card had moved.
      clearColonyPayoutLiftOff();
    },
  },
});
</script>
