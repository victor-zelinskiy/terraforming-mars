<template>
  <!--
    DECK-DRAW LAYER — the app-level stage the "cards physically come off the
    top-bar project deck" cinematic plays on (mounted once in ConsoleShell).

    Every card is born at the deck's own top-card rect (the SAME card.webp
    sleeve the deck stack shows — a separation, never a new object), and is
    routed by the SERVER's verdict: a discard is tossed aside onto the table's
    discard pile (beside the deck — `ConsoleDiscardPile`), a match comes down
    into the HOST's zone and settles into the hold row. Pointer-inert, clipped;
    the controller owns the beats, the director the GSAP.
  -->
  <div v-if="deckDrawState.active || deckDrawState.streaming || guestRun" class="con-deckdraw" :data-dd-phase="deckDrawState.phase" :data-dd-run="assemblyRun" aria-hidden="true">
    <!-- THE TRIGGER CARDS of the assembly scene («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»): the card that answered the press
         SURFACES beside the row (a real lite face), deals its card from its own printed draw icon, and recedes. -->
    <div v-for="face in triggerFaces" :key="sceneNonce + '|trigger|' + face.key"
         class="con-deckdraw__trigger"
         :data-dd-trigger="face.name"
         :ref="(el) => setTriggerRef(el, face.run)">
      <ConsoleCardFaceLite :name="face.name" />
    </div>
    <!-- (The discard TRAY that used to stand here — at 66 % / 38vh of the VIEWPORT, wherever the host was — is gone:
         a thrown-away card now lands on the table's ONE pile, «СБРОШЕННЫЕ», beside the HUD deck it came from —
         `ConsoleDiscardPile` / discardPile.ts, TR52 PL-260.) -->

    <!-- The hold zone's quiet base — the cards are the subject, this is only
         a hint that they are being gathered. -->
    <div v-if="showHoldBase" class="con-deckdraw__hold" :style="holdBaseStyle">
      <span class="con-deckdraw__hold-line"></span>
    </div>

    <!-- One flyer per revealed card (the shared deal flip chassis). A MATCH
         renders its FACE (it flips up to be seen + held); a DISCARD renders
         ONLY the back — it never turns face-up, it is tossed aside onto the
         discard pile, so the heavy premium face is never built for it. -->
    <div v-for="(step, i) in sceneCards" :key="sceneNonce + '|' + step.name + '#' + i"
         class="con-deckdraw-proxy"
         :data-dd-card="step.name"
         :data-dd-matched="step.matched ? 'yes' : 'no'"
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
  abortDeckDraw, armDeckDraw, deckDrawState, deckDrawVerdict, DeckDrawVerdict, DiscardStreamRequest, endDeckDraw,
  releaseDeckDrawSeed, isDeckDrawSource, markDeckCardDrawn, markDeckDrawDealing, markDeckDrawDiscarded,
  markDeckDrawZoomReady, noteDeckDrawForeign, registerDeckDrawHandle, registerDeckDrawZoomOrigin,
  markDiscardStreaming, registerDiscardStreamPlayer, setDeckDrawPhase,
} from '@/client/console/deckDraw/consoleDeckDraw';
import {tickDeckDisplay} from '@/client/console/consoleDeckDisplay';
import {pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';
import {isPlayedHeroActive} from '@/client/console/played/consolePlayedHero';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {tilePlacementHolding} from '@/client/console/tilePlacement/consoleTilePlacement';
import {nomadMoveHolding} from '@/client/console/nomads/consoleNomadMove';
import {agendaTrackOnScreen, isAgendaReveal, isBoardCardBonusActive, boardCardBonusClaimsReveal, isBonusRevealStaged} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {parliamentParksReveal} from '@/client/console/parliament/parliamentRewardBeat';
import {rulingChangeParksReveal} from '@/client/console/parliament/rulingChangeDraw';
import {colonyBonusPayoutParksReveal} from '@/client/console/colonyLedger/colonyBonusPayout';
import {colonyTradeClaimsReveal, isColonyTradeRevealStaged, isPresentedTradeReveal} from '@/client/console/colonyTrade/consoleColonyTrade';
import {colonyResolutionUi, remoteColonyBonusHold} from '@/client/console/colonyTrade/colonyResolution';
import {adoptSettlementDeck, settlementClaimsBatch} from '@/client/console/colonyTrade/settlementTable';
import {probeTick} from '@/client/console/probeTick';
import {hydroStepQueuedFor} from '@/client/console/hydroMarker/consoleHydroMarker';
import {markWorkspaceOutcomeArrivalDone, workspaceClaimOwnsArrival, workspaceClaimsColonyRevealBatch, workspaceClaimsRevealBatch} from '@/client/console/consoleWorkspaceOutcome';
import {
  DeckDrawTimings, DrawBeat, RectLike, SceneStage, deckCountAfter, deckDrawTimings, holdScale, holdSlots,
  inspectPoint, inspectScale, planDeckDraw, reducedDeckDrawTimings, viewportStage,
} from '@/client/console/deckDraw/deckDrawModel';
import {
  DeckDrawHandle, runDeckDrawAssemble, runDeckDrawBeat, runDeckDrawHandoff, runDeckSettleTick,
} from '@/client/console/deckDraw/deckDrawDirector';
import {
  discardPileHeldBy, discardPileSlotEl, landOnDiscardPile, openDiscardPile, releaseDiscardPile,
} from '@/client/console/discardPile/discardPile';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {BatchArrivalHandle, runBatchArrival} from '@/client/console/consoleBatchArrivalMotion';
import {intakeAssemblyOwnsBatch, intakeAssemblyPresentsBatch, intakeSearchRun} from '@/client/console/cardIntake/intakeAssemblyPlan';
import {IntakeAssemblyHandle, IntakeTriggerFace, planAssemblyFor, playIntakeAssembly} from '@/client/console/cardIntake/intakeAssemblyDirector';
import {registerIntakeContinuation} from '@/client/console/cardIntake/intakeAssembly';
import {conWsPresence} from '@/client/console/conWsPresenceBridge';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {drawnBatchGoesFullscreen} from '@/client/console/consoleRevealPresentation';

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
/**
 * One flyer of the scene. `tail` marks a card of ANOTHER run of a merged batch (R4 — the search run plays the
 * theatre on its own tape, the runs before and after it come from their own places through the assembly): its proxy
 * is never held by the theatre and never judged.
 */
type SceneStep = {name: CardName, matched: boolean, tail?: true};

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
  /** The plain draw's single deck→slot batch flight (the shared director). */
  batchHandle?: BatchArrivalHandle,
  /**
   * The DISCARD STREAM in flight or handing its lease over (PL-261): what a teardown must still settle — the owner's
   * `onAllPeeled` (its flight waits on it) and the stream's lease on the pile. A killed timer must never strand either.
   */
  stream?: {lease: string, allPeeled: () => void},
  /** The assembly scene's director handle («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» — `cardIntake/intakeAssemblyDirector.ts`). */
  assemblyHandle?: IntakeAssemblyHandle,
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
  ctx.batchHandle?.kill();
  ctx.batchHandle = undefined;
  ctx.assemblyHandle?.kill();
  ctx.assemblyHandle = undefined;
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
      /** The batch this scene deals — the name of its lease on the discard pile (`scene:<id>`). */
      sceneEventId: undefined as number | undefined,
      /** The hold zone's base is only drawn once a card is actually resting. */
      showHoldBase: false,
      holdBaseStyle: {} as Record<string, string>,
      /** The assembly scene's trigger faces (one per `card`-origin run), and the run being dealt now (e2e probe). */
      triggerFaces: [] as Array<IntakeTriggerFace>,
      triggerRefs: {} as Record<number, HTMLElement | null>,
      assemblyRun: undefined as number | undefined,
      /**
       * THE SEARCH RUN of a merged batch (R4): its cards' span in the batch and its tape's length in `sceneCards` —
       * the theatre judges that span, the assembly deals the rest. `cardProxyIndex` maps a card of the batch to its
       * flyer (the tape's rejects have flyers of their own, so the two orders differ). `drawnSoFar` counts every card
       * that has left the deck in this scene (the HUD counter ticks per peel across the three legs).
       */
      searchSpan: undefined as {first: number, count: number, steps: number} | undefined,
      cardProxyIndex: undefined as Array<number> | undefined,
      drawnSoFar: 0,
      /**
       * A GUEST run: the board card-bonus scene opened a merged batch (its cover flew the cell's run) and handed
       * the remaining runs over (`continueIntakeAssembly`). The layer stands without its own scene — the cover
       * scene owns the gates and the handoff; this layer lends its trigger faces and flights.
       */
      guestRun: false,
    };
  },
  computed: {
    /**
     * The reveal batch this layer should drive NOW, and WHOSE it is. Watched
     * PRE-FLUSH so the arm lands BEFORE the overlay's first render — otherwise
     * the finished modal would flash for a frame before the scene withheld it.
     *
     * ONE computed, ONE watcher, deliberately: the verdict and the MEMORY of it
     * (`noteDeckDrawForeign`) have to be taken at the same instant. Split over
     * two watchers they would fire in registration order, and a memory that ran
     * second would already have missed the very fact it exists to remember.
     *
     * NOTE it does NOT wait for another running scene before deciding OWNERSHIP.
     * The batch must be CLAIMED the instant it lands (see the watcher) — waiting
     * would let the finished modal mount in the meantime, and the whole point is
     * that it doesn't exist yet. The waiting happens after the claim, inside the
     * scene.
     */
    revealVerdict(): {v: DeckDrawVerdict, e: DrawnCardEntry} | undefined {
      const e = currentRevealEvent();
      if (e === undefined) {
        return undefined;
      }
      // A colony BUILD card bonus (Pluto) is the board-card-bonus scene's — the
      // cover lifts off the COLONY, not off the deck; never grab it here too.
      // `isBonusRevealStaged` (persisted past the scene's end) is load-bearing:
      // the reveal stays `currentRevealEvent()` until the player TAKES the card,
      // so once board-card-bonus ends we must STILL not re-grab it from the deck.
      // The viewer's OWN colony-trade batch is the colony-trade scene's — its
      // covers leave the traded tile's «ТОРГОВАТЬ» / «БОНУС» cells;
      // `isPresentedTradeReveal` additionally covers a presented trade whose
      // transaction already closed (or whose flight reduced-motion skipped)
      // while the cards are still untaken. A FOREIGN trade's bonus batch
      // (an opponent traded, we own a cube) stays ours — those cards honestly
      // come off the deck.
      // …and a batch a workspace claimed WITH ITS OWN ARRIVAL BEAT (the
      // card-actions composer's prepared stage) is that workspace's: its
      // beat already pulls the card off this very pile and lands it in the
      // workspace's own zone — running this scene too means TWO flights for
      // one card. The GAME START host has no beat of its own: this scene
      // SERVES its claim, flying the cards from the HUD pile into the
      // embedded reveal's slots (`workspaceClaimOwnsArrival` draws the line).
      // ⚠️ That claim is the one owner here whose life is SHORTER than the
      // batch's — it is dropped one tick before the last card is dismissed
      // (`result-detached`) — which is why the verdict is REMEMBERED.
      // …and the Parliament's Agenda CARD reward, while its track is on screen,
      // is the cover scene's (it lifts off the step the marker reached — same
      // predicate the scene itself reads); off screen the deck honestly deals it.
      // …and a SETTLEMENT TABLE's later place: its card has been lying face-down on the table since the first
      // payout and turns over WHERE IT LIES (colony polish 1) — dealing it off the deck would be the second arrival.
      // …and a MERGED batch («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» — several causes) is the ASSEMBLY scene's whatever its
      // root: its runs start from their own places and this layer plays them (`runAssembly`) — unless the board
      // card-bonus scene has it (its cover lifted off the cell at the submit; it flies the cell's run and hands
      // the rest over), or a workspace flies its own arrival, or a settlement table turns it in place.
      const merged = intakeAssemblyOwnsBatch(e);
      const foreign = (!merged && !isDeckDrawSource(e.source)) ||
        settlementClaimsBatch(e.source, e) ||
        workspaceClaimOwnsArrival(e) ||
        boardCardBonusClaimsReveal(e.source) || isBonusRevealStaged(e.id) ||
        (!merged && isAgendaReveal(e.source) && agendaTrackOnScreen()) ||
        colonyTradeClaimsReveal(e.source) || isColonyTradeRevealStaged(e.id) ||
        isPresentedTradeReveal(e.source);
      // A FOREIGN trade's owner bonus waits for its ENTRY (the mandatory
      // announcement is the door): the cards must not start peeling off the
      // deck over whatever screen the player is on. Once the entry is armed
      // the hold drops and this scene SERVES the colony workspace's claim —
      // the cards honestly come off the deck, into the embedded slots.
      // …and during the FULL-STAGE DISCARD the next cycle's batch waits for
      // the focus restore (its reveal slot is held empty; flying into an
      // unmounted surface would only degrade). Reactive — the restore
      // re-fires this computed. NEITHER is remembered: they are «not yet».
      // …and a batch a HYDRONETWORK TRAVERSAL owes to a stage the marker has
      // not physically reached waits for that stage, for the same reason and
      // in the same slot. The server resolves a whole traversal inside ONE
      // request (the parked tail drains in the response that answers the
      // stage-5 deck pick), so a stage-7 «reuse a card action» reward puts its
      // draw on the wire while the token is still two cells back — and this
      // scene is the FIRST thing that reacts to a batch existing, well before
      // any modal. Holding only the modal left the cards visibly peeling off
      // the deck over the stage-5 scene, then vanishing, and the deal's own
      // hold (`deckDrawHolds` → `cardArrivalBusy`) even blocked the walk that
      // was supposed to reach stage 7 — so the wrong order was also the slow
      // one. `waiting`, never `foreign`: the batch IS ours, just not yet, and
      // the answer must be re-asked on arrival (a remembered verdict would
      // mean the cards never get their deal at all).
      // …and the Parliament's Agenda CARD batch PARKED by the reward ledger
      // (the political phase's sitting still owes the enactment glide that
      // reaches the step) is «not yet» in the same sense: released at the
      // glide's landing, on a track the player sees — never dealt off the
      // deck over the announce plate.
      // …and a batch of a CARD's colony-bonus payout («the ledger pays», TR23) whose
      // row has not come up yet: the rows before it are still paying on the
      // ledger — the deck deals it when the walk stands on its row.
      const waiting = remoteColonyBonusHold(this.playerView.waitingFor, e.source) ||
        hydroStepQueuedFor(e.source) ||
        parliamentParksReveal(e.source) ||
        // …and a card's answer to a change of power (TR62): the sitting deals it at its enactment's tail, off the same pile.
        rulingChangeParksReveal(e.source) ||
        colonyBonusPayoutParksReveal(e.source) ||
        (colonyResolutionUi.discardStage && workspaceClaimsColonyRevealBatch(e));
      const v = deckDrawVerdict({eventId: e.id, foreign, waiting});
      return v === undefined ? undefined : {v, e};
    },
    /**
     * Another cinematic is mid-story. A draw is nearly always EARNED by one
     * (the prelude / card being played, a tile landing, a sale): that scene
     * tells the CAUSE, this one the CONSEQUENCE — so ours waits its turn
     * rather than playing over it.
     */
    otherSceneOwnsScreen(): boolean {
      return isPlayedHeroActive() || isPatentSaleActive() || tilePlacementHolding() ||
        nomadMoveHolding() || isBoardCardBonusActive();
    },
  },
  watch: {
    revealVerdict: {
      flush: 'pre',
      handler(r: {v: DeckDrawVerdict, e: DrawnCardEntry} | undefined): void {
        if (r === undefined || r.v === undefined) {
          return;
        }
        if (r.v.kind === 'foreign') {
          noteDeckDrawForeign(r.v.eventId);
          // A SETTLEMENT TABLE's sealed card is not flown by anybody: it turns over in place, and the counter answers
          // with the turn — the table ADOPTS the seed instead of letting it go (colony polish 1).
          if (settlementClaimsBatch(r.e.source, r.e)) {
            adoptSettlementDeck();
            return;
          }
          // A WORKSPACE's own beat deals this batch (the card-actions composer — PL-261): it ADOPTS the seed at its
          // entry and ticks it per card; released here, the answered count showed a beat before anything had left the
          // deck whenever the answer beat the beat's entry (PL-281 — a fast local server, every run).
          if (workspaceClaimOwnsArrival(r.e)) {
            return;
          }
          // Somebody else flies it — the apply-block seed that kept its cards on the counter lets go (PL-088).
          releaseDeckDrawSeed();
          return;
        }
        this.claimScene(r.e);
      },
    },
  },
  mounted() {
    registerDeckDrawHandle({abort: () => this.teardown()});
    registerDiscardStreamPlayer((req) => this.playDiscardStream(req));
    registerIntakeContinuation((e, fromCard, onDone) => this.playGuestAssembly(e, fromCard, onDone));
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
    registerDiscardStreamPlayer(undefined);
    registerIntakeContinuation(undefined);
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
    setTriggerRef(el: unknown, run: number): void {
      this.triggerRefs[run] = (el as HTMLElement | null) ?? null;
    },
    proxyEls(): Array<HTMLElement> {
      return this.proxyRefs.filter((el): el is HTMLElement => el !== null);
    },
    /** The proxies of the MATCHED cards, in hold-slot order. */
    heldEls(): Array<HTMLElement> {
      const out: Array<HTMLElement> = [];
      this.sceneCards.forEach((step, i) => {
        const el = this.proxyRefs[i];
        if (step.matched && step.tail !== true && el !== null && el !== undefined) {
          out.push(el);
        }
      });
      return out;
    },
    /** Every flyer that stands on a real card at the end of a MIXED scene (the finds + the other runs' cards). */
    mixedProxies(): Array<HTMLElement> {
      const out: Array<HTMLElement> = [];
      this.sceneCards.forEach((step, i) => {
        const el = this.proxyRefs[i];
        if ((step.matched || step.tail === true) && el !== null && el !== undefined) {
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
      let steps: Array<SceneStep> = e.sequence !== undefined && e.sequence.length > 0 ?
        e.sequence.map((s) => ({name: s.card.name, matched: s.matched})) :
        e.cards.map((c) => ({name: c.name, matched: true}));
      let plain = e.sequence === undefined || e.sequence.length === 0 ||
        !e.sequence.some((s) => !s.matched);
      // THE SEARCH RUN of a MERGED batch («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» R4): ONE segment is a search that threw
      // cards away, the others are plain. The theatre judges THAT run on its own tape (the rejects of this press's
      // other causes do not exist); the cards of the other runs are flyers of their own (`tail`), dealt from their
      // places by the assembly before and after it. The batch-level tape (every card the deck turned over, in
      // order) stays the one-tape reading of the summary and of a batch with two searches.
      const span = intakeSearchRun(e);
      const searchSegment = span === undefined ? undefined : e.segments[span.index];
      if (span !== undefined && searchSegment?.sequence !== undefined) {
        const tape: Array<SceneStep> = searchSegment.sequence.map((s) => ({name: s.card.name, matched: s.matched}));
        steps = [
          ...e.cards.slice(0, span.first).map((c): SceneStep => ({name: c.name, matched: true, tail: true})),
          ...tape,
          ...e.cards.slice(span.first + span.count).map((c): SceneStep => ({name: c.name, matched: true, tail: true})),
        ];
        plain = false;
        this.searchSpan = {first: span.first, count: span.count, steps: tape.length};
        // A card of the batch → its flyer: the tails in place, the finds in the tape's order (the rejects skipped).
        this.cardProxyIndex = steps.flatMap((step, i) => step.tail === true || step.matched ? [i] : []);
      } else {
        this.searchSpan = undefined;
        this.cardProxyIndex = undefined;
      }
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
      // Warm each MATCHED card's art NOW so the webp is decoded before the
      // face turns into view — otherwise the flip can land on a not-yet-loaded
      // (black) art body, reading as a content switch. Discards never flip
      // face-up, so only matched cards need it.
      preloadPremiumCardArt(steps.filter((st) => st.matched).map((st) => st.name));
      void this.runScene(e, steps, plain);
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
    async runScene(e: DrawnCardEntry, steps: Array<SceneStep>, plain: boolean): Promise<void> {
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
      // The stage is ours now — a hosting workspace lets its own stage go on
      // this same fact, and a search that throws cards away brings the table's
      // DISCARD PILE out from under the strip in this very beat (its slide is
      // shorter than the first card's peel + pull, so the pile is home before
      // the first toss lands — the entry costs the scene nothing).
      markDeckDrawDealing();
      this.sceneEventId = e.id;
      if (deckDrawState.hasDiscards) {
        openDiscardPile(`scene:${e.id}`);
      }

      this.sceneCards = steps;
      this.sceneNonce++;
      this.proxyRefs = [];
      this.flipRefs = [];
      await this.$nextTick();

      // A PLAIN multi-card draw has nothing to judge and nothing to discard:
      // its cards' real destinations are the reveal's own slots, so they fly
      // there ONCE — deck → slot, opening on the way — instead of building a
      // hold-zone row they would only leave again. One flight, one language
      // (the same shared batch director every embedded draw plays). The
      // single-card HEADLESS reveal keeps the hold-zone path: the fullscreen
      // viewer lifts the arrived proxy, and there is no slot to fly into.
      const headlessSingle = drawnBatchGoesFullscreen(steps.length, workspaceClaimsRevealBatch(e));
      if (plain && !headlessSingle) {
        void this.runPlainBatch(e);
        return;
      }

      // A MIXED scene (the search run of a merged batch): the overlay stands VEILED from here (its slots are the
      // other runs' landing places), and the runs BEFORE the search deal from their own places first — the server's
      // order, never re-sorted. The theatre then judges the search run's own tape.
      const span = this.searchSpan;
      this.drawnSoFar = 0;
      if (span !== undefined && span.first > 0) {
        setDeckDrawPhase('assemble');
        await this.$nextTick();
        if (!deckDrawState.active || deckDrawState.stagedEventId !== e.id) {
          return;
        }
        const alive = () => deckDrawState.active && deckDrawState.stagedEventId === e.id;
        const geometry = await this.assemblyGeometry(e, alive);
        if (geometry === undefined) {
          this.releaseAndHandoff(this.mixedProxies());
          return;
        }
        await new Promise<void>((resolve) => {
          this.assemblyRun = 0;
          this.playAssemblyRuns(e, geometry, 0, {
            alive,
            untilCard: span.first,
            onCardPeeled: () => {
              this.drawnSoFar++;
              markDeckCardDrawn(deckCountAfter(preDraw, this.drawnSoFar));
            },
            onFirstApproach: () => setDeckDrawPhase('frame'),
            onDone: resolve,
          });
        });
        if (!alive()) {
          return;
        }
      }
      const searchSteps = span === undefined ? steps : steps.slice(span.first, span.first + span.steps);
      const proxyOffset = span?.first ?? 0;
      const t = this.timings();
      const beats = planDeckDraw(searchSteps.map((s) => ({matched: s.matched})), t, plain);
      const matches = searchSteps.filter((s) => s.matched).length;
      // THE HOST's stage (PL-263): the cards are judged where they will land.
      const stage = this.sceneStage();
      const hScale = holdScale(stage.height, CARD_NATURAL_H);
      const slots = holdSlots(matches, stage, CARD_NATURAL_W * hScale);
      const inspect = inspectPoint(stage);
      const iScale = inspectScale(stage.height, CARD_NATURAL_H);

      // The pile's landing box, at REST (the pile is still sliding out from
      // under the strip — `restingRectOf` un-maps its live entry), if this
      // search has discards. No pile measurable → the discard dives out
      // honestly (the director's degrade), never a toss at nothing.
      const pileSlot = deckDrawState.hasDiscards ? discardPileSlotEl() : undefined;
      const trayRect = pileSlot !== undefined ? restingRectOf(pileSlot) : undefined;
      if (!deckDrawState.active) {
        return; // aborted while probing
      }

      const deckAnchor = {rect: deckRect as RectLike, naturalH: CARD_NATURAL_H};
      let landed = 0;
      const total = beats.length;

      beats.forEach((beat) => {
        const proxy = this.proxyRefs[beat.index + proxyOffset];
        const flip = this.flipRefs[beat.index + proxyOffset];
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
              this.drawnSoFar++;
              markDeckCardDrawn(deckCountAfter(preDraw, this.drawnSoFar));
              this.tickDeck();
            },
            onLanded: () => {
              if (beat.kind === 'discard') {
                markDeckDrawDiscarded();
                landOnDiscardPile();
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

    /**
     * The PLAIN batch: deck → the reveal's REAL slots, one flight. The overlay
     * mounts VEILED from the start (the staged-entrance grammar every flown
     * batch already uses), the shared batch director deals the cards with its
     * landing cadence + in-flight turn, the frame materializes around the
     * arriving row, and the handoff releases the real cards under proxies that
     * already stand exactly on them.
     */
    async runPlainBatch(e: DrawnCardEntry): Promise<void> {
      // A merged batch — and a ONE-CAUSE batch whose cause is a card NOT on the stage (a single hook's draw: the
      // trigger rises beside the row and deals from its own printed icon — «СРАБАТЫВАНИЕ КАРТЫ», decision 5).
      if (intakeAssemblyPresentsBatch(e, workspaceClaimsRevealBatch(e) ? workspaceOutcomeState.sourceCard : undefined)) {
        await this.runAssembly(e);
        return;
      }
      setDeckDrawPhase('assemble');
      await this.$nextTick();
      if (!deckDrawState.active || deckDrawState.stagedEventId !== e.id) {
        return;
      }
      const keys = e.cards.map((c, i) => `${c.name}#${i}`);
      const slotOf = (key: string) => document.querySelector<HTMLElement>(
        `.con-reveal [data-zoom-slot="${cssEscape(key)}"] :is(.card-container, .pcard)`);
      // One stable probe on the first slot — the veiled overlay's fit pass has
      // settled once it answers; the director then measures RESTING rects for
      // every slot itself.
      await stableRect(() => slotOf(keys[0]));
      if (!deckDrawState.active || deckDrawState.stagedEventId !== e.id) {
        return;
      }
      const slots = keys.map(slotOf);
      const pairs: Array<{proxy: HTMLElement, flip: HTMLElement}> = [];
      const slotEls: Array<HTMLElement> = [];
      keys.forEach((_key, i) => {
        const proxy = this.proxyRefs[i];
        const flip = this.flipRefs[i];
        const slot = slots[i];
        if (proxy !== null && proxy !== undefined && flip !== null && flip !== undefined &&
            slot !== null) {
          pairs.push({proxy, flip});
          slotEls.push(slot);
        }
      });
      if (pairs.length !== keys.length) {
        // No believable stage (an unmeasurable overlay): hand over honestly —
        // unveil where things stand, never fake a flight.
        this.releaseAndHandoff(this.heldEls());
        return;
      }
      const preDraw = deckDrawState.preDrawSize;
      let peeled = 0;
      const handle = runBatchArrival({
        cards: pairs,
        slots: slotEls,
        mode: 'in-flight-reveal',
        onCardPeeled: () => {
          peeled++;
          markDeckCardDrawn(deckCountAfter(preDraw, peeled));
        },
        onSettled: () => {
          ctx.batchHandle = undefined;
          this.releaseAndHandoff(this.heldEls());
        },
      });
      ctx.batchHandle = handle;
      // The frame enters while the first card is on final approach — the row
      // lands into a materializing stage (the rise director's grammar).
      const firstLand = handle.plan.beats[0]?.landAtMs ?? 0;
      ctx.timers.push(setTimeout(
        () => setDeckDrawPhase('frame'),
        Math.max(0, motionMs(firstLand) - motionMs(70))));
    },

    /**
     * THE ASSEMBLY SCENE — a merged batch dealt RUN BY RUN from each cause's own place («ОДНО ДЕЙСТВИЕ — ОДИН
     * ЗАБОР», Ф3; the pure plan is `cardIntake/intakeAssemblyPlan.ts`). The stage card's own run comes off the
     * deck; a trigger card SURFACES beside the row and deals from its printed draw icon; a visible cell deals
     * from its printed bonus. One row, one frame (cued at the first run's first approach), one handoff.
     */
    async runAssembly(e: DrawnCardEntry): Promise<void> {
      setDeckDrawPhase('assemble');
      await this.$nextTick();
      if (!deckDrawState.active || deckDrawState.stagedEventId !== e.id) {
        return;
      }
      const geometry = await this.assemblyGeometry(e, () => deckDrawState.active && deckDrawState.stagedEventId === e.id);
      if (geometry === undefined) {
        // No believable stage (an unmeasurable overlay): hand over honestly — never fake a flight.
        this.releaseAndHandoff(this.heldEls());
        return;
      }
      const preDraw = deckDrawState.preDrawSize;
      let peeled = 0;
      let frameCued = false;
      this.assemblyRun = 0;
      this.playAssemblyRuns(e, geometry, 0, {
        alive: () => deckDrawState.active && deckDrawState.stagedEventId === e.id,
        onCardPeeled: () => {
          peeled++;
          markDeckCardDrawn(deckCountAfter(preDraw, peeled));
        },
        onFirstApproach: () => {
          if (!frameCued) {
            frameCued = true;
            setDeckDrawPhase('frame');
          }
        },
        onDone: () => this.releaseAndHandoff(this.heldEls()),
      });
    },

    /**
     * THE GUEST RUN (the continuation the board card-bonus scene asks for): the cell's run has landed under
     * that scene's covers; this layer renders the batch's proxies, flies the runs from `fromCard` on, dissolves
     * its own proxies over the real cards and reports back — the cover scene then plays its handoff.
     */
    playGuestAssembly(e: DrawnCardEntry, fromCard: number, onDone: () => void): void {
      if (deckDrawState.active || this.guestRun) {
        onDone();
        return;
      }
      this.guestRun = true;
      this.sceneCards = e.cards.map((c) => ({name: c.name, matched: true}));
      this.sceneNonce++;
      this.proxyRefs = [];
      this.flipRefs = [];
      preloadPremiumCardArt(e.cards.slice(fromCard).map((c) => c.name));
      let finished = false;
      const finish = () => {
        if (finished) {
          return;
        }
        finished = true;
        const own = this.proxyRefs.slice(fromCard).filter((el): el is HTMLElement => el !== null && el !== undefined);
        ctx.sceneHandle = runDeckDrawHandoff({
          proxies: own,
          t: this.timings(),
          onDone: () => {
            this.endGuestRun();
            onDone();
          },
        });
      };
      void this.$nextTick().then(async () => {
        const alive = () => this.guestRun && currentRevealEvent()?.id === e.id;
        const geometry = await this.assemblyGeometry(e, alive);
        if (geometry === undefined) {
          this.endGuestRun();
          onDone();
          return;
        }
        // The cover scene's own proxies stand on the first run's slots — ours for those cards stay hidden.
        this.proxyRefs.slice(0, fromCard).forEach((el) => {
          if (el !== null && el !== undefined) {
            gsap.set(el, {autoAlpha: 0});
          }
        });
        this.assemblyRun = fromCard;
        this.playAssemblyRuns(e, geometry, fromCard, {alive, onDone: finish});
      });
    },

    endGuestRun(): void {
      ctx.assemblyHandle?.kill();
      ctx.assemblyHandle = undefined;
      this.guestRun = false;
      this.assemblyRun = undefined;
      this.triggerFaces = [];
      this.sceneCards = [];
    },

    /** The slots and the flyers of every card of the batch, measured at rest; undefined = no believable stage. */
    async assemblyGeometry(e: DrawnCardEntry, alive: () => boolean): Promise<{pairs: Array<{proxy: HTMLElement, flip: HTMLElement}>, slots: Array<HTMLElement>} | undefined> {
      const keys = e.cards.map((c, i) => `${c.name}#${i}`);
      const slotOf = (key: string) => document.querySelector<HTMLElement>(
        `.con-reveal [data-zoom-slot="${cssEscape(key)}"] :is(.card-container, .pcard)`);
      await stableRect(() => slotOf(keys[0]));
      if (!alive()) {
        return undefined;
      }
      const slots = keys.map(slotOf);
      const pairs: Array<{proxy: HTMLElement, flip: HTMLElement}> = [];
      const slotEls: Array<HTMLElement> = [];
      keys.forEach((_key, i) => {
        // A mixed scene's flyers stand in the TAPE's order (the rejects have flyers too) — the map says which is this card's.
        const at = this.cardProxyIndex?.[i] ?? i;
        const proxy = this.proxyRefs[at];
        const flip = this.flipRefs[at];
        const slot = slots[i];
        if (proxy !== null && proxy !== undefined && flip !== null && flip !== undefined && slot !== null) {
          pairs.push({proxy, flip});
          slotEls.push(slot);
        }
      });
      return pairs.length === keys.length ? {pairs, slots: slotEls} : undefined;
    },

    /** The printed card-bonus icon of a board cell, measurable on screen (the board visible) — else undefined. */
    boardCellIconRect(spaceId: string): DOMRect | undefined {
      if (conWsPresence.wsOpen) {
        return undefined;
      }
      const el = document.querySelector<HTMLElement>(`.board-space[data_space_id="${cssEscape(spaceId)}"] .board-space-bonus--card`) ??
        document.querySelector<HTMLElement>(`.board-space[data_space_id="${cssEscape(spaceId)}"]`);
      const r = el?.getBoundingClientRect();
      return r !== undefined && r.width > 4 && r.height > 4 ? r : undefined;
    },

    /** Plan and play the runs from `fromCard` on through the ONE assembly director (`cardIntake/intakeAssemblyDirector.ts`). */
    playAssemblyRuns(e: DrawnCardEntry, geometry: {pairs: Array<{proxy: HTMLElement, flip: HTMLElement}>, slots: Array<HTMLElement>}, fromCard: number, hooks: {
      alive: () => boolean,
      /** Play the runs before this card only (a mixed scene's prologue — the search run and the rest follow). */
      untilCard?: number,
      onCardPeeled?: () => void,
      onFirstApproach?: () => void,
      onDone: () => void,
    }): void {
      const host = {
        stageRect: () => this.sceneStage(),
        triggerEl: (run: number) => this.triggerRefs[run] ?? null,
        cellIconRect: (spaceId: string) => this.boardCellIconRect(spaceId),
      };
      // The card STANDING on the stage this batch presents in — its own run comes off the deck, never a surfaced copy.
      const stageCard = workspaceClaimsRevealBatch(e) ? workspaceOutcomeState.sourceCard : undefined;
      const {plan, triggers} = planAssemblyFor(e.segments, host, stageCard);
      const until = hooks.untilCard ?? Number.POSITIVE_INFINITY;
      this.triggerFaces = triggers.filter((f) => plan.runs.some((r) => r.index === f.run && r.first >= fromCard && r.first < until));
      preloadPremiumCardArt(this.triggerFaces.map((f) => f.name));
      void this.$nextTick().then(() => {
        if (!hooks.alive()) {
          return;
        }
        ctx.assemblyHandle?.kill();
        ctx.assemblyHandle = playIntakeAssembly({
          plan, fromCard, untilCard: hooks.untilCard, pairs: geometry.pairs, slots: geometry.slots, host,
          alive: hooks.alive,
          onCardPeeled: hooks.onCardPeeled,
          onFirstApproach: hooks.onFirstApproach,
          onDone: () => {
            ctx.assemblyHandle = undefined;
            this.assemblyRun = undefined;
            hooks.onDone();
          },
        });
      });
    },

    /** Resolve one beat's destinations from the scene geometry. */
    targetsFor(beat: DrawBeat, geo: {
      inspect: {x: number, y: number},
      iScale: number,
      slots: ReadonlyArray<{x: number, y: number}>,
      hScale: number,
      trayRect: RectLike | undefined,
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

    /**
     * Every card has landed: the reveal assembles at once. (The old «settle»
     * beat — a staggered hop across the finished row — is gone: an arrived
     * card never re-animates, and each find already had its own confirmation
     * at the inspect point.)
     */
    finishSearch(): void {
      if (!deckDrawState.active) {
        return;
      }
      void this.assembleReveal();
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
      // Releasing the mount hold: from here the overlay exists, veiled. (A MIXED scene mounted it before its
      // prologue and may already have cued the frame — never veil it again.)
      if (deckDrawState.phase === 'search') {
        setDeckDrawPhase('assemble');
      }
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
      // NOT when a workspace claimed the batch: the EMBEDDED reveal renders a
      // real slot even for one card (the card belongs inside the workspace,
      // never in a fullscreen hand-over) — fall through to the slot flight.
      if (drawnBatchGoesFullscreen(e.cards.length, workspaceClaimsRevealBatch(e))) {
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

      // A MIXED scene: the finds fly into the SEARCH RUN's own slots; the runs after it follow from their places.
      const span = this.searchSpan;
      if (span !== undefined) {
        const mine = targets.slice(span.first, span.first + span.count).filter((r): r is DOMRect => r !== undefined);
        if (resolved.length !== keys.length || mine.length !== span.count || held.length !== span.count) {
          this.releaseAndHandoff(this.mixedProxies());
          return;
        }
        ctx.sceneHandle = runDeckDrawAssemble({
          proxies: held,
          targets: mine as ReadonlyArray<RectLike>,
          naturalHs: mine.map((r) => r.height / Math.max(0.05, r.width / CARD_NATURAL_W)),
          t: this.timings(),
          reduced: deckDrawState.reducedMotion,
          onFrameCue: () => setDeckDrawPhase('frame'),
          onAllLanded: () => void this.finishMixedSearch(e, span),
        });
        return;
      }

      if (resolved.length !== keys.length || held.length !== keys.length) {
        // The overlay produced no measurable slots (single-card headless
        // reveal, or a layout we can't trust): hand off honestly — unveil the
        // modal and dissolve the proxies where they stand. No teleport, no
        // duplicate; the player simply doesn't get the fly-in leg.
        this.releaseAndHandoff(held);
        return;
      }

      // (The discard pile does not travel any more: it is the table's, it
      // stays home beside the deck, and the reveal holds it out for as long
      // as it presents this batch — PL-260.)
      ctx.sceneHandle = runDeckDrawAssemble({
        proxies: held,
        targets: resolved as ReadonlyArray<RectLike>,
        naturalHs: resolved.map((r) => r.height / Math.max(0.05, r.width / CARD_NATURAL_W)),
        t: this.timings(),
        reduced: deckDrawState.reducedMotion,
        // The frame materializes AROUND the arriving row (just before the
        // first touchdown), so the last card lands onto a finished stage and
        // the handoff owes the player nothing further.
        onFrameCue: () => setDeckDrawPhase('frame'),
        onAllLanded: () => this.releaseAndHandoff(held),
      });
    },

    /**
     * THE EPILOGUE of a mixed scene: the finds stand in their slots; the runs AFTER the search run deal from their
     * own places, then every flyer dissolves over the real cards at once.
     */
    async finishMixedSearch(e: DrawnCardEntry, span: {first: number, count: number, steps: number}): Promise<void> {
      const alive = () => deckDrawState.active && deckDrawState.stagedEventId === e.id;
      if (!alive()) {
        return;
      }
      const fromCard = span.first + span.count;
      if (fromCard >= e.cards.length) {
        this.releaseAndHandoff(this.mixedProxies());
        return;
      }
      const geometry = await this.assemblyGeometry(e, alive);
      if (!alive()) {
        return;
      }
      if (geometry === undefined) {
        this.releaseAndHandoff(this.mixedProxies());
        return;
      }
      const preDraw = deckDrawState.preDrawSize;
      this.assemblyRun = fromCard;
      this.playAssemblyRuns(e, geometry, fromCard, {
        alive,
        onCardPeeled: () => {
          this.drawnSoFar++;
          markDeckCardDrawn(deckCountAfter(preDraw, this.drawnSoFar));
        },
        onDone: () => this.releaseAndHandoff(this.mixedProxies()),
      });
    },

    /** Release the overlay's real cards, then dissolve the proxies over them. */
    releaseAndHandoff(held: ReadonlyArray<HTMLElement>): void {
      if (!deckDrawState.active) {
        return;
      }
      setDeckDrawPhase('handoff');
      // A workspace-claimed batch (the Game Start host) has physically
      // ARRIVED — the real cards release under the proxies in this phase.
      // Open the claim's arrival gate NOW (its 5 s backstop is a failure
      // path, not the schedule).
      // …and so has a COLONY batch a workspace claimed and THIS scene dealt (a
      // card's «all your colony bonuses» — the take standing in the action
      // composer's ledger zone): nobody else will say its card has landed. The
      // colony workspace's own claims open their gate at the claim (their
      // scenes carry the input lock), so for them this is a no-op.
      if (workspaceClaimsRevealBatch(currentRevealEvent())) {
        markWorkspaceOutcomeArrivalDone();
      }
      ctx.sceneHandle = runDeckDrawHandoff({
        proxies: held,
        t: this.timings(),
        onDone: () => {
          endDeckDraw();
          this.releasePile();
          this.sceneCards = [];
          this.triggerFaces = [];
          this.assemblyRun = undefined;
          this.searchSpan = undefined;
          this.cardProxyIndex = undefined;
          this.showHoldBase = false;
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
      this.triggerFaces = [];
      this.assemblyRun = undefined;
      this.searchSpan = undefined;
      this.cardProxyIndex = undefined;
      this.guestRun = false;
      this.showHoldBase = false;
      // The pile is NOT cut here: the scene's lease lets go, and whatever
      // presents the batch now (the stock reveal an abort unveils) holds it —
      // the pile leaves with its own phrase only when nobody does.
      this.releasePile();
      this.settleStream();
    },
    /** A stream cut short (teardown / unmount): its owner is told every card has left, and its lease lets go. */
    settleStream(): void {
      const stream = ctx.stream;
      ctx.stream = undefined;
      markDiscardStreaming(false);
      if (stream !== undefined) {
        stream.allPeeled();
        releaseDiscardPile(stream.lease);
      }
    },
    /**
     * THE DISCARD STREAM (PL-261): a workspace's own beat deals the batch's FOUND cards; this layer deals its
     * thrown-away ones — the scene's own dealer's gesture (off the HUD deck, aside onto the table's pile), the counter
     * ticking one card per peel under the owner's hold. `onAllPeeled` fires exactly once, when the last thrown-away
     * card has LEFT the deck (bounded: a beat with no proxy counts as peeled, and a net past the plan's own length
     * fires it anyway — the owner's flight can never wait on a stream that stalled).
     */
    playDiscardStream(req: DiscardStreamRequest): boolean {
      if (deckDrawState.active || deckDrawState.streaming) {
        return false;
      }
      const deck = document.querySelector<HTMLElement>(DECK_SEL)?.getBoundingClientRect();
      if (deck === undefined || deck.width < 2) {
        return false;
      }
      markDiscardStreaming(true);
      const lease = `stream:${req.eventId}`;
      openDiscardPile(lease);
      this.sceneCards = req.cards.map((name) => ({name, matched: false}));
      this.sceneNonce++;
      this.proxyRefs = [];
      this.flipRefs = [];
      const t = this.timings();
      const reduced = consoleReducedMotionActive();
      const beats = planDeckDraw(req.cards.map(() => ({matched: false})), t, false);
      let peeled = 0;
      let landed = 0;
      let released = false;
      const allPeeled = () => {
        if (!released) {
          released = true;
          req.onAllPeeled();
        }
      };
      ctx.stream = {lease, allPeeled};
      // THE NET CATCHES A STALL, never a SLOW stream. The peels run on GSAP's frames, which lag-smooth on a starved
      // renderer (a software-rastered 4K: a frame over 500 ms advances the timeline 33 ms), while a plain net at the
      // plan's length runs on the wall clock — it fired before the peels, the owner's flight released the deck's
      // hold, and the counter jumped 283 → 280 in one step (CI, the box without a GPU). So the net re-arms while the
      // stream is still making progress (a beat starting, a card leaving the deck), and a hard cap keeps «the owner's
      // flight never waits on a stream that stalled» bounded.
      const lastPeelMs = beats.length > 0 ? beats[beats.length - 1].atMs + t.peelMs : 0;
      const streamStart = performance.now();
      let lastProgress = streamStart;
      const stallMs = motionMs(t.peelMs) + motionMs(600);
      const capMs = motionMs(lastPeelMs) * 3 + 2_000;
      const net = () => {
        if (released) {
          return;
        }
        const now = performance.now();
        if (peeled < beats.length && now - lastProgress < stallMs && now - streamStart < capMs) {
          ctx.timers.push(setTimeout(net, motionMs(150)));
          return;
        }
        allPeeled();
      };
      ctx.timers.push(setTimeout(net, motionMs(lastPeelMs) + motionMs(400)));
      void this.$nextTick(() => {
        const slot = discardPileSlotEl();
        const trayRect = slot !== undefined ? restingRectOf(slot) : undefined;
        const deckAnchor = {rect: deck as RectLike, naturalH: CARD_NATURAL_H};
        const done = () => {
          landed++;
          if (landed >= beats.length) {
            this.endDiscardStream(req.eventId, lease);
          }
        };
        beats.forEach((beat) => {
          const proxy = this.proxyRefs[beat.index];
          const flip = this.flipRefs[beat.index];
          if (proxy === null || proxy === undefined || flip === null || flip === undefined) {
            peeled++;
            if (peeled >= beats.length) {
              allPeeled();
            }
            done();
            return;
          }
          ctx.timers.push(setTimeout(() => {
            lastProgress = performance.now();
            const handle = runDeckDrawBeat({
              beat,
              els: {proxy, flip},
              deck: deckAnchor,
              targets: {inspect: {x: 0, y: 0, scale: 1}, tray: trayRect},
              t,
              reduced,
              onDrawn: () => {
                lastProgress = performance.now();
                tickDeckDisplay();
                this.tickDeck();
                peeled++;
                if (peeled >= beats.length) {
                  allPeeled();
                }
              },
              onLanded: () => {
                landOnDiscardPile();
                done();
              },
            });
            ctx.beatHandles.push(handle);
          }, motionMs(beat.atMs)));
        });
      });
      return true;
    },
    /**
     * The stream is over: its proxies go, and its lease on the pile is HANDED to the reveal that presents the batch
     * (the pile must not slide in and out between the stream's last toss and the surface's arrival) — released once
     * the reveal holds the pile or the batch is no longer owed, bounded by a short net.
     */
    endDiscardStream(eventId: number, lease: string): void {
      if (!deckDrawState.active) {
        this.sceneCards = [];
      }
      // Every toss has LANDED (the caller's `done`) — only now may a reveal read the server's count onto the pile.
      markDiscardStreaming(false);
      const started = Date.now();
      const handOver = () => {
        const owed = pendingRevealEvents().some((e) => e.id === eventId);
        if (discardPileHeldBy(`reveal:${eventId}`) || !owed || Date.now() - started > 4_000) {
          releaseDiscardPile(lease);
          if (ctx.stream?.lease === lease) {
            ctx.stream = undefined;
          }
          return;
        }
        ctx.timers.push(setTimeout(handOver, 100));
      };
      handOver();
    },
    /** The scene's lease on the discard pile ends with the scene. */
    releasePile(): void {
      if (this.sceneEventId !== undefined) {
        releaseDiscardPile(`scene:${this.sceneEventId}`);
        this.sceneEventId = undefined;
      }
    },
    /**
     * THE STAGE the search plays in (PL-263): the workspace that hosts the
     * draw — the band surface around the claim's own zone, else the band
     * surface on screen — or the board's free area when nothing hosts it;
     * the viewport only when none of them can be measured.
     */
    sceneStage(): SceneStage {
      const measure = (el: Element | null | undefined): SceneStage | undefined => {
        if (el === null || el === undefined) {
          return undefined;
        }
        const r = el.getBoundingClientRect();
        return r.width > 200 && r.height > 200 ? {left: r.left, top: r.top, width: r.width, height: r.height} : undefined;
      };
      const slot = workspaceOutcomeState.embedSlot;
      const host = slot !== '' ? document.querySelector(slot)?.closest('.con-ws') : undefined;
      const band = Array.from(document.querySelectorAll('.con-ws')).find((el) => measure(el) !== undefined);
      return measure(host) ?? measure(band) ?? measure(document.querySelector('.con-main')) ??
        viewportStage(window.innerWidth, window.innerHeight);
    },
  },
});
</script>
