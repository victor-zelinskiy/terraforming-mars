<template>
  <!--
    DECK-DRAW LAYER — the app-level stage the "cards physically come off the
    top-bar project deck" cinematic plays on (mounted once in ConsoleShell).

    Every card is born at the deck's own top-card rect (the SAME card.webp
    sleeve the deck stack shows — a separation, never a new object), and is
    routed by the SERVER's verdict: a discard flows on into the compact tray,
    a match settles into the hold zone. Pointer-inert, clipped; the controller
    owns the beats, the director the GSAP.
  -->
  <div v-if="deckDrawState.active" class="con-deckdraw" aria-hidden="true">
    <!-- The DISCARD tray — secondary by construction: compact, off to the
         side, a face-down pile + a count. Only exists when the search really
         discarded something, and only once the scene is actually playing
         (never while we wait for the scene that earned this draw). -->
    <div v-if="deckDrawState.hasDiscards && sceneLive" class="con-deckdraw__tray" ref="tray">
      <div class="con-deckdraw__tray-pile" ref="trayPile"
           :class="{
             'con-deckdraw__tray-pile--pulse': trayPulse,
             'con-deckdraw__tray-pile--empty': deckDrawState.trayCount === 0,
           }">
        <!-- Thickness is capped at three backs; the count carries the rest
             (mirrors the played-events pile). -->
        <div v-if="deckDrawState.trayCount > 2" class="con-card-back con-deckdraw__tray-back con-deckdraw__tray-back--3"></div>
        <div v-if="deckDrawState.trayCount > 1" class="con-card-back con-deckdraw__tray-back con-deckdraw__tray-back--2"></div>
        <div v-if="deckDrawState.trayCount > 0" class="con-card-back con-deckdraw__tray-back con-deckdraw__tray-back--1"></div>
        <!-- The landing slot: the box the flying card aims at. Until the
             first card lands it is the only thing drawn — an empty berth, so
             the tray reads as "discards will land here", never as a stray
             label floating in space. -->
        <div class="con-deckdraw__tray-slot" ref="traySlot"></div>
      </div>
      <div class="con-deckdraw__tray-meta">
        <span class="con-deckdraw__tray-label">{{ $t('DISCARDED') }}</span>
        <span class="con-deckdraw__tray-count">{{ deckDrawState.trayCount }}</span>
      </div>
    </div>

    <!-- The hold zone's quiet base — the cards are the subject, this is only
         a hint that they are being gathered. -->
    <div v-if="showHoldBase" class="con-deckdraw__hold" :style="holdBaseStyle">
      <span class="con-deckdraw__hold-line"></span>
    </div>

    <!-- One flyer per revealed card (the shared deal flip chassis). A MATCH
         renders its FACE (it flips up to be seen + held); a DISCARD renders
         ONLY the back — it never turns face-up, it just flows past to the
         tray, so the heavy premium face is never built for it. -->
    <div v-for="(step, i) in sceneCards" :key="sceneNonce + '|' + step.name + '#' + i"
         class="con-deckdraw-proxy"
         :ref="(el) => setProxyRef(el, i)">
      <div class="con-deal-proxy__flip" :ref="(el) => setFlipRef(el, i)">
        <div v-if="step.matched" class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="step.name" />
        </div>
        <div class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The scene's lifecycle, in one place (the controller documents the gates):
 *
 *   ARM      a deck-sourced reveal batch arrives → armDeckDraw (self-arm; a
 *            draw has no single client submit point). The reveal overlay is
 *            WITHHELD from mounting while phase is search/settle.
 *   SEARCH   the server sequence is replayed VERBATIM, beat by beat.
 *   SETTLE   the found cards get one clean confirmation in the hold zone.
 *   ASSEMBLE the overlay mounts VEILED → its real slots are measured → the
 *            held cards fly into them.
 *   FRAME    the modal materializes around the landed cards.
 *   HANDOFF  the overlay releases its real cards under the proxies, which
 *            dissolve above them.
 *
 * Every failure degrades honestly: no believable anchor → the scene is
 * skipped and the stock modal shows immediately (never a stranded reveal).
 */
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {currentRevealEvent, DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {
  abortDeckDraw, armDeckDraw, deckDrawState, endDeckDraw, isDeckDrawSource, markDeckCardDrawn,
  markDeckDrawDiscarded, markDeckDrawZoomReady, registerDeckDrawHandle, registerDeckDrawZoomOrigin,
  setDeckDrawPhase,
} from '@/client/console/deckDraw/consoleDeckDraw';
import {isPlayedHeroActive} from '@/client/console/played/consolePlayedHero';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {tilePlacementHolding} from '@/client/console/tilePlacement/consoleTilePlacement';
import {isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {
  DeckDrawTimings, DrawBeat, RectLike, deckCountAfter, deckDrawTimings, holdScale, holdSlots,
  inspectPoint, inspectScale, planDeckDraw, reducedDeckDrawTimings,
} from '@/client/console/deckDraw/deckDrawModel';
import {
  DeckDrawHandle, runDeckDrawAssemble, runDeckDrawBeat, runDeckDrawHandoff, runDeckDrawSettle,
  runDeckSettleTick,
} from '@/client/console/deckDraw/deckDrawDirector';

/** The natural (unscaled) FaceLite height — mirrors the premium card frame (320×460). */
const CARD_NATURAL_H = 460;

/** The top-bar deck's own top card — the source every flight is born at. */
const DECK_SEL = '.con-deckstack__pile';

/**
 * How long we wait for the scene that EARNED this draw to finish before
 * playing anyway. Bounded on purpose: a stuck neighbour must never keep the
 * reveal withheld.
 */
const STAGE_WAIT_MAX_MS = 9_000;

/** One scene card: the name + the server's verdict. */
type SceneStep = {name: CardName, matched: boolean};

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
 * Non-reactive scene context (module scope — the layer is a singleton, and
 * GSAP handles must never be wrapped in Vue reactivity).
 */
type SceneCtx = {
  beatHandles: Array<DeckDrawHandle>,
  sceneHandle?: DeckDrawHandle,
  timers: Array<ReturnType<typeof setTimeout>>,
};
const ctx: SceneCtx = {beatHandles: [], timers: []};

function clearTimers(): void {
  ctx.timers.forEach((t) => clearTimeout(t));
  ctx.timers = [];
}

function killAll(): void {
  ctx.beatHandles.forEach((h) => h.kill());
  ctx.beatHandles = [];
  ctx.sceneHandle?.kill();
  ctx.sceneHandle = undefined;
  clearTimers();
}

export default defineComponent({
  name: 'ConsoleDeckDrawLayer',
  components: {ConsoleCardFaceLite},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  data() {
    return {
      deckDrawState,
      sceneCards: [] as Array<SceneStep>,
      sceneNonce: 0,
      proxyRefs: [] as Array<HTMLElement | null>,
      flipRefs: [] as Array<HTMLElement | null>,
      trayPulse: false,
      /**
       * The scene's own furniture (tray / hold base) appears only once the
       * cards actually start coming off the deck — while we wait for the
       * scene that earned the draw, the stage is claimed but empty.
       */
      sceneLive: false,
      /** The hold zone's base is only drawn once a card is actually resting. */
      showHoldBase: false,
      holdBaseStyle: {} as Record<string, string>,
    };
  },
  computed: {
    /**
     * The reveal batch this layer should drive NOW. Watched PRE-FLUSH so the
     * arm lands BEFORE the overlay's first render — otherwise the finished
     * modal would flash for a frame before the scene withheld it.
     *
     * A batch is ours when its cards came off the DECK; a tile / Venus-scale
     * bonus belongs to the board card-bonus scene. `id !== stagedEventId`
     * keeps a finished scene from re-arming its own batch forever (the
     * board-bonus layer documents that exact trap).
     *
     * NOTE it does NOT wait for another running scene here. The batch must be
     * CLAIMED the instant it lands (see the watcher) — waiting would let the
     * finished modal mount in the meantime, and the whole point is that it
     * doesn't exist yet. The waiting happens after the claim, inside the
     * scene.
     */
    revealToProcess(): DrawnCardEntry | undefined {
      const e = currentRevealEvent();
      if (e === undefined || deckDrawState.active) {
        return undefined;
      }
      if (e.id === deckDrawState.stagedEventId) {
        return undefined;
      }
      return isDeckDrawSource(e.source) ? e : undefined;
    },
    /**
     * Another cinematic is mid-story. A draw is nearly always EARNED by one
     * (the prelude / card being played, a tile landing, a sale): that scene
     * tells the CAUSE, this one the CONSEQUENCE — so ours waits its turn
     * rather than playing over it.
     */
    otherSceneOwnsScreen(): boolean {
      return isPlayedHeroActive() || isPatentSaleActive() || tilePlacementHolding() ||
        isBoardCardBonusActive();
    },
  },
  watch: {
    revealToProcess: {
      flush: 'pre',
      handler(e: DrawnCardEntry | undefined): void {
        if (e !== undefined) {
          this.claimScene(e);
        }
      },
    },
    'deckDrawState.trayCount'(): void {
      // A calm one-shot pulse as a card lands on the pile.
      this.trayPulse = false;
      void this.$nextTick(() => {
        this.trayPulse = true;
        ctx.timers.push(setTimeout(() => {
          this.trayPulse = false;
        }, motionMs(260)));
      });
    },
  },
  mounted() {
    registerDeckDrawHandle({abort: () => this.teardown()});
    // The single-card fullscreen lifts THIS proxy (the card that just flew),
    // rather than opening a fresh copy over it.
    registerDeckDrawZoomOrigin(() => this.heldEls()[0] ?? null);
    // A batch already on screen at mount (a reload straight into a reveal) is
    // deliberately NOT animated: the cards are already the player's, and a
    // cinematic replayed on refresh would be a lie.
    if (currentRevealEvent() !== undefined) {
      deckDrawState.stagedEventId = currentRevealEvent()?.id;
    }
  },
  beforeUnmount() {
    registerDeckDrawHandle(undefined);
    registerDeckDrawZoomOrigin(undefined);
    killAll();
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
    /** The proxies of the MATCHED cards, in hold-slot order. */
    heldEls(): Array<HTMLElement> {
      const out: Array<HTMLElement> = [];
      this.sceneCards.forEach((step, i) => {
        const el = this.proxyRefs[i];
        if (step.matched && el !== null && el !== undefined) {
          out.push(el);
        }
      });
      return out;
    },
    timings(): DeckDrawTimings {
      return deckDrawState.reducedMotion ? reducedDeckDrawTimings() : deckDrawTimings();
    },

    /**
     * CLAIM the batch — SYNCHRONOUSLY, in the same tick it lands.
     *
     * This is the load-bearing half: the claim closes `deckDrawHolds()`, and
     * that is what stops the reveal modal from ever mounting. Anything async
     * (measuring the deck, waiting for another scene to finish) must happen
     * AFTER it — a single awaited frame here and the finished modal appears
     * behind our back, which is exactly the thing this scene exists to
     * prevent.
     */
    claimScene(e: DrawnCardEntry): void {
      // The sequence is the server's own record of the search. Without one
      // (a plain draw, or a search that discarded nothing) every card simply
      // came off the deck — the simpler visual language, by design.
      const steps: Array<SceneStep> = e.sequence !== undefined && e.sequence.length > 0 ?
        e.sequence.map((s) => ({name: s.card.name, matched: s.matched})) :
        e.cards.map((c) => ({name: c.name, matched: true}));
      const plain = e.sequence === undefined || e.sequence.length === 0 ||
        !e.sequence.some((s) => !s.matched);
      if (steps.length === 0) {
        return;
      }
      // The authoritative deckSize already dropped by everything revealed.
      const preDraw = this.playerView.game.deckSize + steps.length;
      if (!armDeckDraw(e.id, {
        hasDiscards: !plain,
        preDrawSize: preDraw,
        reducedMotion: consoleReducedMotionActive(),
      })) {
        return;
      }
      void this.runScene(steps, plain);
    },

    /**
     * Wait for whatever scene earned this draw to finish telling its own
     * story. Bounded: if it somehow never ends, ours plays anyway rather than
     * withholding the reveal forever.
     */
    waitForStage(): Promise<void> {
      return new Promise((done) => {
        if (!this.otherSceneOwnsScreen) {
          done();
          return;
        }
        const started = Date.now();
        const poll = () => {
          if (!deckDrawState.active || !this.otherSceneOwnsScreen || Date.now() - started > STAGE_WAIT_MAX_MS) {
            done();
            return;
          }
          ctx.timers.push(setTimeout(poll, 120));
        };
        poll();
      });
    },

    /** Play the whole scene (the batch is already claimed + in the state). */
    async runScene(steps: Array<SceneStep>, plain: boolean): Promise<void> {
      const reduced = deckDrawState.reducedMotion;
      await this.waitForStage();
      if (!deckDrawState.active) {
        return;
      }
      const deckRect = await stableRect(() => document.querySelector<HTMLElement>(DECK_SEL));
      if (deckRect === undefined || !deckDrawState.active) {
        // No believable deck anchor (an unmounted HUD, JSDOM): abort, which
        // releases every gate — the stock modal shows at once. Never a
        // withheld reveal because a cinematic couldn't find its stage.
        abortDeckDraw();
        return;
      }
      const preDraw = deckDrawState.preDrawSize;
      // The stage is ours now — the tray may appear, ready to receive.
      this.sceneLive = true;

      this.sceneCards = steps;
      this.sceneNonce++;
      this.proxyRefs = [];
      this.flipRefs = [];
      await this.$nextTick();

      const t = this.timings();
      const beats = planDeckDraw(steps.map((s) => ({matched: s.matched})), t, plain);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const matches = steps.filter((s) => s.matched).length;
      const hScale = holdScale(vh, CARD_NATURAL_H);
      const slots = holdSlots(matches, vw, vh, CARD_NATURAL_W * hScale);
      const inspect = inspectPoint(vw, vh);
      const iScale = inspectScale(vh, CARD_NATURAL_H);

      // The tray's landing box, if this search has discards.
      const trayRect = deckDrawState.hasDiscards ?
        await stableRect(() => this.$refs.traySlot as HTMLElement | null) : undefined;
      if (!deckDrawState.active) {
        return; // aborted while probing
      }

      const deckAnchor = {rect: deckRect as RectLike, naturalH: CARD_NATURAL_H};
      let drawn = 0;
      let landed = 0;
      const total = beats.length;

      beats.forEach((beat) => {
        const proxy = this.proxyRefs[beat.index];
        const flip = this.flipRefs[beat.index];
        if (proxy === null || proxy === undefined || flip === null || flip === undefined) {
          landed++;
          return;
        }
        const timer = setTimeout(() => {
          if (!deckDrawState.active) {
            return;
          }
          const handle = runDeckDrawBeat({
            beat,
            els: {proxy, flip},
            deck: deckAnchor,
            targets: this.targetsFor(beat, {inspect, iScale, slots, hScale, trayRect}),
            t,
            reduced,
            onDrawn: () => {
              drawn++;
              markDeckCardDrawn(deckCountAfter(preDraw, drawn));
              this.tickDeck();
            },
            onLanded: () => {
              if (beat.kind === 'discard') {
                markDeckDrawDiscarded();
              }
              if (beat.kind !== 'discard') {
                this.revealHoldBase(slots, hScale);
              }
              landed++;
              if (landed >= total) {
                this.finishSearch();
              }
            },
          });
          ctx.beatHandles.push(handle);
        }, motionMs(beat.atMs));
        ctx.timers.push(timer);
      });

      if (total === 0) {
        this.finishSearch();
      }
    },

    /** Resolve one beat's destinations from the scene geometry. */
    targetsFor(beat: DrawBeat, geo: {
      inspect: {x: number, y: number},
      iScale: number,
      slots: ReadonlyArray<{x: number, y: number}>,
      hScale: number,
      trayRect: DOMRect | undefined,
    }) {
      const hold = beat.holdSlot !== undefined && geo.slots[beat.holdSlot] !== undefined ?
        {...geo.slots[beat.holdSlot], scale: geo.hScale} : undefined;
      return {
        inspect: {...geo.inspect, scale: geo.iScale},
        hold,
        tray: beat.trayDepth !== undefined && geo.trayRect !== undefined ?
          (geo.trayRect as RectLike) : undefined,
      };
    },

    /** The deck's own physical reaction to losing a card. */
    tickDeck(): void {
      const deck = document.querySelector<HTMLElement>(DECK_SEL);
      if (deck !== null) {
        runDeckSettleTick(deck, deckDrawState.reducedMotion);
      }
    },

    /** The hold zone's base fades in with its first resident card. */
    revealHoldBase(slots: ReadonlyArray<{x: number, y: number}>, hScale: number): void {
      if (this.showHoldBase || slots.length === 0) {
        return;
      }
      const w = CARD_NATURAL_W * hScale;
      const h = CARD_NATURAL_H * hScale;
      const left = slots[0].x - w / 2;
      const right = slots[slots.length - 1].x + w / 2;
      this.holdBaseStyle = {
        left: `${Math.round(left - 18)}px`,
        top: `${Math.round(slots[0].y + h / 2 + 10)}px`,
        width: `${Math.round(right - left + 36)}px`,
      };
      this.showHoldBase = true;
    },

    /** Every card has landed: the settle beat, then the reveal assembles. */
    finishSearch(): void {
      if (!deckDrawState.active) {
        return;
      }
      setDeckDrawPhase('settle');
      const t = this.timings();
      ctx.sceneHandle = runDeckDrawSettle({
        proxies: this.heldEls(),
        t,
        reduced: deckDrawState.reducedMotion,
        onDone: () => void this.assembleReveal(),
      });
    },

    /**
     * The reveal mounts VEILED (its slots are laid out but invisible), the
     * held cards fly into those exact rects, the frame materializes around
     * them, and only then are the real cards released under the proxies.
     */
    async assembleReveal(): Promise<void> {
      if (!deckDrawState.active) {
        return;
      }
      // Releasing the mount hold: from here the overlay exists, veiled.
      setDeckDrawPhase('assemble');
      await this.$nextTick();

      const e = currentRevealEvent();
      if (e === undefined || e.id !== deckDrawState.stagedEventId) {
        // The batch vanished under us (acked elsewhere / a game switch).
        this.teardown();
        endDeckDraw();
        return;
      }
      // A SINGLE received card is presented by the fullscreen viewer itself
      // (that reveal is HEADLESS — no modal, no slots to fly into). The hold
      // pose IS the hand-over: release the viewer's held auto-open, and it
      // lifts THIS proxy via the existing zoom FLIP (registerDeckDrawZoomOrigin).
      if (e.cards.length === 1) {
        setDeckDrawPhase('frame');
        markDeckDrawZoomReady();
        // End once the viewer has taken over: the input gate must not stay
        // closed through the take (that would swallow the «A Взять» press).
        ctx.timers.push(setTimeout(() => {
          this.teardown();
          endDeckDraw();
        }, motionMs(deckDrawState.reducedMotion ? 120 : 320)));
        return;
      }
      const keys = e.cards.map((c, i) => `${c.name}#${i}`);
      const targets = await Promise.all(keys.map((key) => stableRect(() => document.querySelector<HTMLElement>(
        `.con-reveal [data-zoom-slot="${cssEscape(key)}"] :is(.card-container, .pcard)`,
      ))));
      if (!deckDrawState.active || deckDrawState.stagedEventId !== e.id) {
        return;
      }
      const held = this.heldEls();
      const resolved = targets.filter((r): r is DOMRect => r !== undefined);

      if (resolved.length !== keys.length || held.length !== keys.length) {
        // The overlay produced no measurable slots (single-card headless
        // reveal, or a layout we can't trust): hand off honestly — unveil the
        // modal and dissolve the proxies where they stand. No teleport, no
        // duplicate; the player simply doesn't get the fly-in leg.
        this.releaseAndHandoff(held);
        return;
      }

      ctx.sceneHandle = runDeckDrawAssemble({
        proxies: held,
        targets: resolved as ReadonlyArray<RectLike>,
        naturalHs: resolved.map((r) => r.height / Math.max(0.05, r.width / CARD_NATURAL_W)),
        t: this.timings(),
        reduced: deckDrawState.reducedMotion,
        onAllLanded: () => {
          // The cards stand in the exact slots — NOW the frame assembles
          // around them (the overlay unveils via its phase-driven classes).
          setDeckDrawPhase('frame');
          ctx.timers.push(setTimeout(() => this.releaseAndHandoff(held), motionMs(this.timings().frameMs)));
        },
      });
    },

    /** Release the overlay's real cards, then dissolve the proxies over them. */
    releaseAndHandoff(held: ReadonlyArray<HTMLElement>): void {
      if (!deckDrawState.active) {
        return;
      }
      setDeckDrawPhase('handoff');
      ctx.sceneHandle = runDeckDrawHandoff({
        proxies: held,
        t: this.timings(),
        onDone: () => {
          endDeckDraw();
          this.sceneCards = [];
          this.showHoldBase = false;
          this.sceneLive = false;
        },
      });
    },

    /** Kill everything and drop the proxies (abort / unmount). */
    teardown(): void {
      killAll();
      const els = this.proxyEls();
      if (els.length > 0) {
        gsap.set(els, {autoAlpha: 0});
      }
      this.sceneCards = [];
      this.showHoldBase = false;
      this.sceneLive = false;
      this.trayPulse = false;
    },
  },
});
</script>
