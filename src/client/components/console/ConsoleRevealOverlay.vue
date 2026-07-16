<template>
  <div class="con-reveal"
       :class="{
         'con-reveal--headless': headless,
         'con-reveal--bonus-mode': bonusMode,
         'con-reveal--bonus-veiled': bonusVeiled,
         'con-reveal--bonus-held': bonusHeld,
       }"
       role="dialog" :aria-label="titleText">
    <!--
      SINGLE-CARD drawn reveal is HEADLESS: the received card IS the reveal,
      shown DIRECTLY in the fullscreen viewer (auto-opened). Nothing renders
      here (the dialog owns the backdrop + the whole presentation); this
      invisible, non-blocking root keeps the reveal a registered serving
      surface and hosts the auto-open lifecycle. Multi-card / result / viewer
      render the modal frame below.
    -->
    <template v-if="!headless">
      <div class="con-reveal__backdrop" aria-hidden="true"></div>

      <transition name="con-task-swap" mode="out-in">
        <div class="con-reveal__card" :key="revealKey">
          <!-- ── Header ──────────────────────────────────────────────── -->
          <header class="con-reveal__head">
            <div class="con-task__kicker">
              <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
              <span>{{ $t(kickerText) }}</span>
            </div>
            <div class="con-reveal__headrow">
              <div class="con-reveal__headmain">
                <div class="con-reveal__title">{{ titleText }}</div>
                <div v-if="mode === 'drawn'" class="con-reveal__subtitle">
                  {{ $t('Cards were added from a draw source.') }}
                </div>
                <!--
                  Compact SOURCE chip — a navigation-context metadata element,
                  NEVER a second full card competing with the received cards.
                  An inspectable (card) source is a button (L3 opens it); a
                  colony / tile source is a plain informational chip.
                -->
                <button v-if="mode === 'drawn' && sourceChip !== undefined"
                        type="button"
                        class="con-reveal__source-chip"
                        :class="{'con-reveal__source-chip--inspectable': sourceChip.inspectable}"
                        :disabled="!sourceChip.inspectable"
                        @click="zoomSource">
                  <span class="con-reveal__source-chip-mark" aria-hidden="true">◈</span>
                  <span class="con-reveal__source-chip-label">{{ $t('Source') }}</span>
                  <span class="con-reveal__source-chip-sep" aria-hidden="true">·</span>
                  <span class="con-reveal__source-chip-name">{{ sourceChip.name }}</span>
                  <span v-if="sourceChip.inspectable" class="con-reveal__source-chip-l3">
                    <GamepadGlyph control="stickL" />
                  </span>
                </button>
              </div>
              <!-- Compact premium count chip (NEVER a full-width strip). -->
              <div v-if="mode === 'drawn' && drawnEvent !== undefined" class="con-reveal__count">
                <span class="con-reveal__count-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
                <span class="con-reveal__count-label">{{ $t('Received') }}</span>
                <b class="con-reveal__count-num">{{ drawnEvent.cards.length }}</b>
              </div>
              <div v-else-if="mode === 'viewer' && viewerReveal !== undefined" class="con-reveal__meta">
                <span v-if="viewerActor !== undefined" class="con-task__opt-player">
                  <span :class="'con-status__dot player_bg_color_' + viewerActor.color"></span>
                  <span>{{ viewerActor.name }}</span>
                </span>
                <span class="con-reveal__chip">{{ viewerReveal.cards.length }} {{ $t('cards') }}</span>
                <span class="con-reveal__chip">{{ $t(viewerOriginLabel) }}</span>
                <span class="con-reveal__chip">{{ $t(viewerResultLabel) }}</span>
              </div>
            </div>
          </header>

          <!-- ── DRAWN: take the received cards (source is the header chip) ── -->
          <div v-if="mode === 'drawn' && drawnEvent !== undefined" class="con-reveal__body con-reveal__body--drawn con-info__scroll">
            <div class="con-reveal__main">
              <div class="con-cards__strip con-reveal__strip"
                   :class="{'con-cards__strip--has-focus': drawnUntaken.length > 1}"
                   :style="stripZoomStyle">
                <div v-for="(entry, i) in drawnUntaken" :key="entry.card.name + '#' + entry.index"
                     class="con-cards__slot con-start__deal"
                     :style="dealDelay(i)"
                     :data-zoom-slot="entry.card.name + '#' + entry.index"
                     :class="{'con-cards__slot--focused': focusIdx === i}"
                     :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                  <Card :card="entry.card" :key="entry.card.name" lightweight />
                  <div v-if="focusIdx === i" class="con-start__slot-a">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Take card') }}</span>
                  </div>
                </div>
              </div>
              <div v-if="drawnUntaken.length > 4" class="con-reveal__pager" aria-hidden="true">
                <span class="con-reveal__pager-b">[</span>
                <span class="con-reveal__pager-i">{{ focusIdx + 1 }}</span>
                <span class="con-reveal__pager-s">/</span>
                <span class="con-reveal__pager-n">{{ drawnUntaken.length }}</span>
                <span class="con-reveal__pager-b">]</span>
              </div>
            </div>
            <!--
              The DISCARD tray of a conditional deck search — the cards the
              deck turned over and threw away to find these. Deliberately
              SECONDARY: a compact face-down pile in its own corner that never
              shrinks the received cards. It only exists when the search
              really discarded something, and inspecting it is the player's
              own choice (X), never part of the animation.
            -->
            <button v-if="discardedCards.length > 0"
                    type="button"
                    class="con-reveal__discard"
                    :class="{'con-reveal__discard--focused': discardFocused}"
                    @click="openDiscards">
              <span class="con-reveal__discard-pile" aria-hidden="true">
                <span v-if="discardedCards.length > 2" class="con-card-back con-reveal__discard-back con-reveal__discard-back--3"></span>
                <span v-if="discardedCards.length > 1" class="con-card-back con-reveal__discard-back con-reveal__discard-back--2"></span>
                <span class="con-card-back con-reveal__discard-back con-reveal__discard-back--1"></span>
                <span class="con-reveal__discard-count">{{ discardedCards.length }}</span>
              </span>
              <span class="con-reveal__discard-meta">
                <span class="con-reveal__discard-label">{{ $t('DISCARDED') }}</span>
                <span class="con-reveal__discard-hint">
                  <GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span>
                </span>
              </span>
            </button>
          </div>

          <!-- ── RESULT: the deck-check outcome (SearchForLife etc.) ─── -->
          <div v-else-if="mode === 'result' && lastReveal !== undefined" class="con-reveal__body con-info__scroll">
            <div class="con-reveal__source">
              <div class="con-start__section-title">{{ $t('Source') }}</div>
              <Card :card="{name: lastReveal.action}" :key="lastReveal.action" lightweight />
            </div>
            <div class="con-reveal__main">
              <div class="con-reveal__revealed"
                   :data-zoom-slot="'revealed:' + lastReveal.revealed.name"
                   :class="lastReveal.conditionMet ? 'con-reveal__revealed--met' : 'con-reveal__revealed--miss'">
                <Card :card="lastReveal.revealed" :key="lastReveal.revealed.name" />
              </div>
              <div class="con-reveal__outcome" :class="lastReveal.conditionMet ? 'con-reveal__outcome--met' : 'con-reveal__outcome--miss'">
                <span class="con-reveal__outcome-badge" aria-hidden="true">{{ lastReveal.conditionMet ? '✓' : '✕' }}</span>
                <span>{{ $t(lastReveal.conditionMet ? 'Condition met' : 'Condition not met') }}</span>
                <ActionEffectChip v-if="lastReveal.reward !== undefined" :effect="lastReveal.reward" />
                <span v-if="vpGain > 0" class="con-reveal__vp">+{{ vpGain }} {{ $t('VP') }}</span>
              </div>
            </div>
          </div>

          <!-- ── VIEWER: another player's public reveal (read-only) ──── -->
          <div v-else-if="mode === 'viewer' && viewerReveal !== undefined" class="con-reveal__body con-info__scroll">
            <div class="con-reveal__main">
              <div class="con-cards__strip">
                <div v-for="(name, i) in viewerReveal.cards" :key="name + '#' + i"
                     class="con-cards__slot con-start__deal"
                     :style="dealDelay(i)"
                     :data-zoom-slot="name + '#' + i"
                     :class="{'con-cards__slot--focused': focusIdx === i}"
                     :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                  <Card :card="{name}" :key="name" lightweight />
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- The gliding selection frame — THE primary focus indicator of card
           navigation (shared vocabulary with hand / draft / start scene).
           Self-resolving inside this overlay, so it can never target the
           task host's focused card underneath. -->
      <!-- The tray is a focus target like any card, so the SAME gliding frame
           lands on it (one focus vocabulary — never a second indicator). -->
      <ConsoleCardFocusFrame selector=":is(.con-cards__slot--focused > :is(.card-container, .pcard), .con-reveal__discard--focused .con-reveal__discard-pile)" />
    </template>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE REVEAL OVERLAY — CTS T6 row 25 (CONSOLE_MODE_CONCEPT.md). The
 * console-native surface for the three REVEAL flows, replacing the desktop
 * modals (gated off in console) with one calm card-reveal frame:
 *
 *  drawn  — «you received N cards». TWO presentation modes, decided by the
 *           batch's TOTAL card count at open time (stable — never flips
 *           mid-session):
 *             · MULTI-CARD (≥2) — the modal frame: a compact SOURCE CHIP in
 *               the header (never a second full card), the received cards as
 *               a focusable strip filling the freed space. A = take the
 *               focused card, RT/B = take all, X = inspect, L3 = source.
 *             · SINGLE-CARD (exactly 1) — HEADLESS: the received card IS the
 *               reveal, opened DIRECTLY in the fullscreen viewer (mandatory —
 *               it can only be completed by taking). L3 flips the fullscreen
 *               between the received card and the source (no nested viewer);
 *               A departs the card straight to the player. See the shell's
 *               zoom handlers for the take/swap/close-prevention wiring.
 *           Take/ack semantics are the SHARED drawnCardsState functions
 *           (byte-identical to the desktop flow).
 *  result — the deck-check outcome (SearchForLife / AsteroidDeflection-
 *           System): source card + the revealed card in a green/red frame
 *           + the ✓/✗ verdict + the reward chip + VP delta. OK marks it seen.
 *  viewer — another player's PUBLIC reveal (opened via a notification CTA):
 *           read-only browse + close.
 *
 * ONE hint zone: the bottom command bar (rendered above the modal by the
 * shell) carries the whole contract — this overlay has NO footer of its own,
 * so B never reads two conflicting labels. Priority drawn > result > viewer.
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleCardFocusFrame from '@/client/components/console/cardDeal/ConsoleCardFocusFrame.vue';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  DrawnCardEntry, closeAndReleaseEvent, currentRevealEvent, markAllTaken, markCardTaken,
} from '@/client/components/drawnCards/drawnCardsState';
import {CardName} from '@/common/cards/CardName';
import {runCardCollect, runCardTake} from '@/client/console/cardDeal/cardExitDirector';
import {RevealMeta} from '@/client/components/notifications/notificationTypes';
import {closeRevealViewer, revealViewerState} from '@/client/components/notifications/revealViewerState';
import {
  consoleCardZoom, ConsoleZoomReceive, ConsoleZoomSwap, openConsoleCardZoom, repointConsoleCardZoom, slotZoomOrigin,
} from '@/client/console/consoleCardZoom';
import {
  boardCardBonusState, bonusHoldingSingleZoom, bonusZoomOriginEl, isBoardCardBonusActive, isBonusRevealStaged,
} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {
  deckDrawHoldingSingleZoom, deckDrawState, deckDrawZoomOriginEl, isDeckDrawActive, isDeckDrawStaged,
} from '@/client/console/deckDraw/consoleDeckDraw';

/** The scene phases during which the reveal frame stays fully veiled. */
const BONUS_PRE_FRAME_PHASES: ReadonlySet<string> = new Set(['lift', 'hover', 'gather', 'fan']);

/**
 * The deck-draw phases during which the frame stays veiled. Note 'search' and
 * 'settle' can't appear here — the shell withholds the overlay from mounting
 * at all until the search is over ([[deckDrawHolds]]); by the time this modal
 * exists the scene is already assembling into it.
 */
const DECK_DRAW_PRE_FRAME_PHASES: ReadonlySet<string> = new Set(['search', 'settle', 'assemble']);


export type ConsoleRevealMode = 'drawn' | 'result' | 'viewer';

/** The compact source chip descriptor (multi-card drawn header). */
type SourceChip = {name: string, inspectable: boolean};

export default defineComponent({
  name: 'ConsoleRevealOverlay',
  components: {Card, GamepadGlyph, ActionEffectChip, ConsoleCardFocusFrame},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    mode: {type: String as PropType<ConsoleRevealMode>, required: true},
  },
  emits: ['dismiss-result'],
  data() {
    return {
      focusIdx: 0,
    };
  },
  computed: {
    // ── drawn ────────────────────────────────────────────────────────
    drawnEvent(): DrawnCardEntry | undefined {
      return this.mode === 'drawn' ? currentRevealEvent() : undefined;
    },
    drawnSource(): CardDrawRevealSource | undefined {
      const source = this.drawnEvent?.source;
      return source !== undefined && source.type !== 'other' ? source : undefined;
    },
    /** Untaken cards paired with their FULL-array index (the take mapping). */
    drawnUntaken(): Array<{card: CardModel, index: number}> {
      const e = this.drawnEvent;
      if (e === undefined) {
        return [];
      }
      const out: Array<{card: CardModel, index: number}> = [];
      e.cards.forEach((card, index) => {
        if (!e.takenIndices.has(index)) {
          out.push({card, index});
        }
      });
      return out;
    },
    /** A card source opens fullscreen on L3 (colony/tile/other are not). */
    drawnSourceInspectable(): boolean {
      return this.drawnSource?.type === 'card';
    },
    /**
     * The compact source chip (multi-card drawn header). A card source shows
     * its name + is inspectable (L3); a colony source shows the colony name; a
     * tile bonus shows a label. Undefined = no meaningful source to show.
     */
    sourceChip(): SourceChip | undefined {
      const s = this.drawnSource;
      if (s === undefined) {
        return undefined;
      }
      if (s.type === 'card') {
        return {name: translateText(s.cardName), inspectable: true};
      }
      if (s.type === 'colony') {
        return {name: translateText(s.colonyName), inspectable: false};
      }
      if (s.type === 'tile') {
        return {name: translateText('Tile bonus'), inspectable: false};
      }
      if (s.type === 'globalParameter' && s.parameter === 'venus') {
        return {name: translateText('Venus scale bonus'), inspectable: false};
      }
      return undefined;
    },
    /**
     * SINGLE-CARD mode — keyed on the batch's TOTAL card count (stable; it
     * never shrinks as cards are taken), so a multi-card batch taken down to
     * one still stays multi (never a jarring mid-session mode flip).
     */
    singleCardMode(): boolean {
      return this.mode === 'drawn' && this.drawnEvent !== undefined && this.drawnEvent.cards.length === 1;
    },
    /** The single received card (single-card mode). */
    singleCard(): CardModel | undefined {
      return this.singleCardMode ? this.drawnEvent?.cards[0] : undefined;
    },
    /** In single-card mode the modal is headless — the fullscreen IS the reveal. */
    headless(): boolean {
      return this.singleCardMode;
    },
    /**
     * The single-card reveal SHOULD be showing its fullscreen but isn't (the
     * initial mount, or an unexpected close while the card is still untaken).
     * The watcher (re-)opens it, so the reveal can never be left "invisible".
     * HELD while the board card-bonus cover is still travelling — the viewer
     * then opens off the arrived cover (a physical origin), never over it.
     */
    singleCardNeedsFullscreen(): boolean {
      return this.singleCardMode && consoleCardZoom.card === undefined &&
        !bonusHoldingSingleZoom(this.drawnEvent?.id) &&
        !deckDrawHoldingSingleZoom(this.drawnEvent?.id);
    },
    // ── STAGED entrance (a scene owns this batch's arrival) ────────────
    /*
     * TWO scenes stage a reveal, and the contract is identical for both: the
     * cards physically arrive on their own stage and land in THESE slots, so
     * the modal must suppress its stock deal-in entrance and stay veiled
     * until the scene hands off.
     *   · boardCardBonus — the cover lifts off a board cell / the Venus marker
     *   · deckDraw       — the cards peel off the top-bar project deck
     * The classes keep their `bonus-*` names (the CSS contract is shared);
     * a batch can only ever be claimed by one scene, since they split on the
     * reveal's source.
     */
    /**
     * A scene owns this batch's entrance: the stock deal-in / frame rise are
     * suppressed for the batch's whole on-screen life (this persists after
     * the scene ends — see each controller's `stagedEventId` doc — otherwise
     * dropping it would replay the entrance).
     */
    bonusMode(): boolean {
      return this.mode === 'drawn' &&
        (isBonusRevealStaged(this.drawnEvent?.id) || isDeckDrawStaged(this.drawnEvent?.id));
    },
    /** Pre-frame: the modal is mounted for measurement but fully veiled. */
    bonusVeiled(): boolean {
      if (!this.bonusMode) {
        return false;
      }
      return (isBoardCardBonusActive() && BONUS_PRE_FRAME_PHASES.has(boardCardBonusState.phase)) ||
        (isDeckDrawActive() && DECK_DRAW_PRE_FRAME_PHASES.has(deckDrawState.phase));
    },
    /** The static cards stay hidden until the handoff releases them. */
    bonusHeld(): boolean {
      if (!this.bonusMode) {
        return false;
      }
      return (isBoardCardBonusActive() &&
          (BONUS_PRE_FRAME_PHASES.has(boardCardBonusState.phase) || boardCardBonusState.phase === 'frame')) ||
        (isDeckDrawActive() &&
          (DECK_DRAW_PRE_FRAME_PHASES.has(deckDrawState.phase) || deckDrawState.phase === 'frame'));
    },
    /**
     * Count-driven card scale so 1–4 cards stay roomy with a generous safe gap
     * (no overlap); larger batches compact and scroll as a focus carousel. The
     * strip's `.con-cards__slot` reads `--con-cards-zoom` (set on the strip).
     */
    stripZoom(): number {
      const n = this.drawnUntaken.length;
      if (n <= 2) {
        return 0.94;
      }
      if (n <= 3) {
        return 0.82;
      }
      if (n <= 4) {
        return 0.72;
      }
      if (n <= 6) {
        return 0.6;
      }
      return 0.52;
    },
    stripZoomStyle(): Record<string, string> {
      return {'--con-cards-zoom': String(this.stripZoom)};
    },
    // ── result ───────────────────────────────────────────────────────
    lastReveal(): RevealResultModel | undefined {
      return this.mode === 'result' ? this.playerView.lastReveal : undefined;
    },
    vpGain(): number {
      const vp = this.lastReveal?.vp;
      return vp !== undefined ? Math.max(0, vp.to - vp.from) : 0;
    },
    // ── viewer ───────────────────────────────────────────────────────
    viewerReveal(): RevealMeta | undefined {
      return this.mode === 'viewer' ? revealViewerState.reveal : undefined;
    },
    viewerActor(): {color: string, name: string} | undefined {
      const color = this.viewerReveal?.actor;
      if (color === undefined) {
        return undefined;
      }
      const p = this.playerView.players.find((pp) => pp.color === color);
      return {color, name: p !== undefined ? participantDisplayName(p) : color};
    },
    viewerOriginLabel(): string {
      return this.viewerReveal?.origin === 'hand' ? 'from hand' : 'from deck';
    },
    viewerResultLabel(): string {
      switch (this.viewerReveal?.result) {
      case 'discarded': return 'discarded';
      case 'shown': return 'shown';
      case 'kept': return 'kept';
      default: return 'revealed';
      }
    },
    // ── frame ────────────────────────────────────────────────────────
    kickerText(): string {
      switch (this.mode) {
      case 'drawn': return 'Cards received';
      case 'result': return 'Reveal result';
      default: return this.viewerReveal?.origin === 'hand' ? 'Shown cards' : 'Revealed cards';
      }
    },
    titleText(): string {
      switch (this.mode) {
      case 'drawn':
        return translateText('Cards received');
      case 'result':
        return this.lastReveal !== undefined ? translateText(this.lastReveal.action) : '';
      default:
        return translateText(this.viewerReveal?.origin === 'hand' ? 'Shown cards' : 'Revealed cards');
      }
    },
    revealKey(): string {
      switch (this.mode) {
      case 'drawn': return `drawn|${this.drawnEvent?.id ?? ''}`;
      case 'result': return `result|${this.lastReveal?.action ?? ''}|${this.lastReveal?.revealed.name ?? ''}`;
      default: return `viewer|${(this.viewerReveal?.cards ?? []).join(',')}`;
      }
    },
    focusCount(): number {
      switch (this.mode) {
      // The discard tray is ONE extra focus target at the end of the strip
      // (the played-events pile's shape) — so inspecting it needs no new
      // button and the command bar keeps its existing contract.
      case 'drawn': return this.drawnUntaken.length + (this.discardedCards.length > 0 ? 1 : 0);
      case 'viewer': return this.viewerReveal?.cards.length ?? 0;
      default: return 0;
      }
    },
    /**
     * The cards this batch's conditional search turned over and threw away.
     * Server truth (the reveal's own sequence) — the client neither derives
     * nor re-orders it. Empty for a plain draw: no tray, nothing to inspect.
     */
    discardedCards(): Array<CardModel> {
      const seq = this.drawnEvent?.sequence;
      if (seq === undefined) {
        return [];
      }
      return seq.filter((step) => !step.matched).map((step) => step.card);
    },
    /** The strip focus has walked past the last card, onto the tray. */
    discardFocused(): boolean {
      return this.mode === 'drawn' && this.discardedCards.length > 0 &&
        this.focusIdx === this.drawnUntaken.length;
    },
  },
  watch: {
    revealKey() {
      this.focusIdx = 0;
    },
    focusCount(now: number) {
      if (this.focusIdx >= now) {
        this.focusIdx = Math.max(0, now - 1);
      }
    },
    // Single-card reveal: (re-)open the fullscreen whenever it should be
    // showing but isn't — the initial mount is handled in mounted(); this
    // covers a multi→single batch transition and any unexpected close.
    singleCardNeedsFullscreen(needs: boolean) {
      if (needs) {
        this.openSingleCardFullscreen();
      }
    },
  },
  mounted() {
    if (this.singleCardNeedsFullscreen) {
      this.openSingleCardFullscreen();
    }
  },
  methods: {
    dealDelay(i: number): Record<string, string> {
      if (consoleReducedMotionActive()) {
        return {};
      }
      return {animationDelay: `calc(${Math.min(i, 12) * 55}ms * var(--motion-scale, 1))`};
    },
    /** The shell routes every intent here while the MULTI-CARD overlay owns
     *  input (single-card hands off to the shell's zoom handlers entirely). */
    handleIntent(intent: GamepadIntent): void {
      // Single-card: the fullscreen viewer owns the pad (the shell routes to
      // handleZoomIntent). If we're ever reached in the brief window before
      // the auto-open, do nothing — never a bare take without the flight.
      if (this.singleCardMode) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // L3 = inspect the DRAW SOURCE (screen-specific stick, drawn mode only).
      if (intent.button === 'stickL' && this.mode === 'drawn') {
        this.zoomSource();
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    onNav(dir: NavDirection): void {
      if (dir !== 'left' && dir !== 'right') {
        return;
      }
      const count = this.focusCount;
      if (count === 0) {
        return;
      }
      const next = Math.min(count - 1, Math.max(0, this.focusIdx + (dir === 'right' ? 1 : -1)));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        void this.$nextTick(() => {
          const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
          const el = Array.isArray(slot) ? slot[0] : slot;
          el?.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
        });
      }
    },
    // Foundation: SEMANTIC actions — A(primary) take/dismiss, X(inspect) zoom,
    // RT(nextTab)/B(back) take-all/dismiss. L3 source-zoom handled in handleIntent.
    onPress(action: ConsoleAction): void {
      switch (this.mode) {
      case 'drawn':
        // The tray is a focus target like any card: A / X open it, and it is
        // never taken (there is nothing to take — these cards are gone).
        if (this.discardFocused) {
          if (action === 'primary' || action === 'inspect') {
            this.openDiscards();
          } else if (action === 'nextTab' || action === 'back') {
            this.takeAll();
          }
          return;
        }
        if (action === 'primary') {
          this.takeFocused();
        } else if (action === 'inspect') {
          // P13 global rule: X reads the focused card fullscreen.
          this.zoomFocused();
        } else if (action === 'nextTab' || action === 'back') {
          this.takeAll();
        }
        return;
      case 'result':
        if (action === 'inspect') {
          this.zoomRevealed();
        } else if (action === 'primary' || action === 'nextTab' || action === 'back') {
          this.$emit('dismiss-result');
        }
        return;
      default:
        if (action === 'inspect') {
          this.zoomViewerCard();
        } else if (action === 'primary' || action === 'nextTab' || action === 'back') {
          closeRevealViewer();
        }
        return;
      }
    },
    /** PHYSICAL zoom origin over this overlay's `data-zoom-slot` tiles; the
     *  strip focus follows the fullscreen browse (drawn duplicates are keyed
     *  `name#i`, so two copies of one card resolve to distinct slots). */
    zoomOriginFor(keyOf: (i: number) => string, follow: boolean) {
      return slotZoomOrigin(
        () => this.$el as HTMLElement,
        keyOf,
        follow ? (i) => {
          this.focusIdx = i;
          void this.$nextTick(() => {
            const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
            const el = Array.isArray(slot) ? slot[0] : slot;
            el?.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
          });
        } : undefined,
      );
    },
    /** P13: X fullscreen for the focused card (MULTI-CARD only) — with the
     *  RECEIVE bridge so A takes the card / RT takes all WITHOUT leaving the
     *  viewer (until the last card, which closes it). Shared take logic. */
    zoomFocused(): void {
      const entries = this.drawnUntaken;
      const list = entries.map((e) => e.card);
      if (list.length === 0) {
        return;
      }
      openConsoleCardZoom(list, this.focusIdx, undefined, undefined, {
        receive: {
          takeLabel: 'Take card',
          takeAt: (idx) => this.takeFromZoom(idx),
          takeAllLabel: list.length > 1 ? 'Take all cards' : undefined,
          takeAll: list.length > 1 ? () => this.takeAllFromZoom() : undefined,
        },
        origin: this.zoomOriginFor((i) => {
          const e = this.drawnUntaken[i];
          return e !== undefined ? `${e.card.name}#${e.index}` : '';
        }, true),
      });
    },
    /**
     * Browse the cards the search discarded — READ-ONLY, and only ever on the
     * player's own initiative (the hero scene never stops to let them be
     * read). B returns to the modal with focus intact, exactly like the
     * played-events pile. No receive bridge: these cards are not takeable.
     */
    openDiscards(): void {
      const list = this.discardedCards;
      if (list.length === 0) {
        return;
      }
      openConsoleCardZoom(list, 0, undefined, undefined, {
        statusLabel: 'Discarded card',
        // The pile IS the physical origin — the viewer lifts out of it.
        origin: {
          kind: 'physical',
          resolve: () => (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-reveal__discard-pile') ?? null,
        },
      });
    },
    /** L3: inspect the DRAW SOURCE card fullscreen (multi-card modal). The
     *  read-only source names itself «ИСТОЧНИК ДОБОРА»; B returns to the modal
     *  (focus/scroll/selection preserved — the modal was never unmounted). */
    zoomSource(): void {
      const s = this.drawnSource;
      if (s === undefined || s.type !== 'card') {
        return;
      }
      openConsoleCardZoom([{name: s.cardName} as CardModel], 0, undefined, undefined, {
        statusLabel: 'Draw source',
        origin: {kind: 'textual'},
      });
    },
    zoomRevealed(): void {
      const r = this.lastReveal;
      if (r !== undefined) {
        openConsoleCardZoom([r.revealed], 0, undefined, undefined, {
          origin: this.zoomOriginFor(() => `revealed:${r.revealed.name}`, false),
        });
      }
    },
    zoomViewerCard(): void {
      const names = this.viewerReveal?.cards ?? [];
      if (names.length > 0) {
        openConsoleCardZoom(names.map((name) => ({name}) as CardModel), this.focusIdx, undefined, undefined, {
          origin: this.zoomOriginFor((i) => `${names[i]}#${i}`, true),
        });
      }
    },
    // ── SINGLE-CARD reveal (headless → fullscreen) ─────────────────────
    /**
     * Open the single received card DIRECTLY in the fullscreen viewer. The
     * reveal IS the fullscreen: mandatory (no close but a take), a textual
     * rise-from-depth entrance, the receive bridge (A departs the card to the
     * player), and — when the source is an inspectable card — the L3 swap
     * bridge (received ⇄ source). No card tile on screen → textual origin.
     */
    openSingleCardFullscreen(): void {
      const card = this.singleCard;
      if (card === undefined) {
        return;
      }
      // A STAGED batch: a scene's proxy already stands where the card should
      // be — the board card-bonus cover at its presentation point, or the
      // deck-draw card in its hold zone. The viewer opens with a PHYSICAL
      // origin resolving to that proxy, so the existing zoom FLIP lifts the
      // very card that flew (and `con-zoom-hold` hides the proxy the frame
      // the flight starts) — never a fresh copy over a dissolving one.
      const bonusEntrance = isBoardCardBonusActive() && isBonusRevealStaged(this.drawnEvent?.id);
      const deckEntrance = isDeckDrawActive() && isDeckDrawStaged(this.drawnEvent?.id);
      const physicalOrigin = bonusEntrance ? () => bonusZoomOriginEl() :
        (deckEntrance ? () => deckDrawZoomOriginEl() : undefined);
      openConsoleCardZoom([card], 0, undefined, undefined, {
        receive: this.singleReceiveBridge(),
        swap: this.singleSwapBridge('received'),
        sourceInfo: this.singleSourceInfo(),
        receivedCount: this.drawnEvent?.cards.length ?? 1,
        statusLabel: 'Received card',
        mandatory: true,
        origin: physicalOrigin !== undefined ? {kind: 'physical', resolve: physicalOrigin} : {kind: 'textual'},
      });
    },
    /**
     * The STATIC source chip for the single-card fullscreen when the source is
     * NOT an inspectable card (a tile / colony bonus — «ИСТОЧНИК · Бонус
     * клетки»). A card source is shown interactively via the swap bridge (L3)
     * instead, so this returns undefined for it.
     */
    singleSourceInfo(): {label: string, name: string} | undefined {
      const chip = this.sourceChip;
      return chip !== undefined && !chip.inspectable ? {label: 'Source', name: chip.name} : undefined;
    },
    /** The single-card receive bridge — A departs the card from fullscreen. */
    singleReceiveBridge(): ConsoleZoomReceive {
      return {
        takeLabel: 'Take card',
        takeAt: () => this.singleCardTake(),
        departFromFullscreen: true,
      };
    },
    /**
     * The L3 swap bridge — present only when the source is an inspectable
     * card. `showing` names the card CURRENTLY on screen, so the bridge points
     * L3 at the OTHER one (received ⇄ source).
     */
    singleSwapBridge(showing: 'received' | 'source'): ConsoleZoomSwap | undefined {
      const s = this.drawnSource;
      const received = this.singleCard;
      if (s === undefined || s.type !== 'card' || received === undefined) {
        return undefined;
      }
      return showing === 'received' ?
        {label: 'Source', otherName: s.cardName as CardName, swap: () => this.showSource()} :
        {label: 'Received card', otherName: received.name, swap: () => this.showReceived()};
    },
    /** L3 from the received card → show the SOURCE (read-only, no take). */
    showSource(): void {
      const s = this.drawnSource;
      if (s === undefined || s.type !== 'card') {
        return;
      }
      repointConsoleCardZoom({name: s.cardName} as CardModel, {
        swap: this.singleSwapBridge('source'),
        statusLabel: 'Draw source',
      });
    },
    /** L3 from the source → back to the RECEIVED card (take re-armed). */
    showReceived(): void {
      const card = this.singleCard;
      if (card === undefined) {
        return;
      }
      repointConsoleCardZoom(card, {
        receive: this.singleReceiveBridge(),
        swap: this.singleSwapBridge('received'),
        statusLabel: 'Received card',
      });
    },
    /**
     * A on the single received card — the BARE commit. The premium DEPART
     * flight (playZoomDepart) already ran on the fullscreen stage (the shell
     * owns it), so this only marks the card taken + releases + acks the batch;
     * the reveal then resolves (the overlay unmounts) and the dialog closes.
     */
    singleCardTake(): void {
      const e = this.drawnEvent;
      const entry = this.drawnUntaken[0];
      if (e === undefined || entry === undefined) {
        return;
      }
      closeAndReleaseEvent(this.playerView.id, e.id, () => markCardTaken(e.id, entry.index));
    },
    // ── MULTI-CARD take (from the strip / from fullscreen) ─────────────
    /** The live slot element for a drawn/viewer card (data-zoom-slot key). */
    exitSlotFor(key: string): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-zoom-slot="${esc}"]`);
    },
    /** A: take the focused card (last one closes + releases + acks).
     *  EXIT cinematic: the card physically lifts off the reveal surface and
     *  dives to the player zone — state commits the frame the proxy stands
     *  ready (onLift), so the real card never blinks. The flight lives on
     *  the shell's exit layer, surviving the overlay closing on the last
     *  take. Reduced motion / missing slot → the bare commit. */
    takeFocused(): void {
      const e = this.drawnEvent;
      const entry = this.drawnUntaken[this.focusIdx];
      if (e === undefined || entry === undefined) {
        return;
      }
      const commit = () => {
        if (this.drawnUntaken.length <= 1) {
          closeAndReleaseEvent(this.playerView.id, e.id, () => markCardTaken(e.id, entry.index));
        } else {
          markCardTaken(e.id, entry.index);
        }
      };
      const slot = this.exitSlotFor(`${entry.card.name}#${entry.index}`);
      if (slot === null) {
        commit();
        return;
      }
      void runCardTake({name: entry.card.name, el: slot}, commit);
    },
    /** RT / B: take everything — the premium GROUP collect: the fan
     *  collapses into a stack at the gather point, one confirmation pulse,
     *  the stack drops to the player as ONE object (cardExitDirector). */
    takeAll(): void {
      const e = this.drawnEvent;
      if (e === undefined) {
        return;
      }
      const commit = () => closeAndReleaseEvent(this.playerView.id, e.id, () => markAllTaken(e.id));
      const sources = this.drawnUntaken
        .map((entry) => ({name: entry.card.name, el: this.exitSlotFor(`${entry.card.name}#${entry.index}`)}))
        .filter((s): s is {name: CardName, el: HTMLElement} => s.el !== null);
      if (sources.length === 0) {
        commit();
        return;
      }
      void runCardCollect(sources, commit);
    },
    /**
     * A from FULLSCREEN (MULTI-CARD) — the shell has ALREADY choreographed the
     * viewer's close (the card flew back into its reveal slot), so this just
     * SYNCS the focus to the inspected card and runs the SAME premium take as
     * an in-modal A (`runCardTake` — lift off the slot + dive to the player).
     */
    takeFromZoom(idx: number): void {
      this.focusIdx = Math.max(0, Math.min(idx, this.drawnUntaken.length - 1));
      // nextTick: the dialog just closed — let the reveal strip settle so the
      // take reads the live focused slot rect.
      void this.$nextTick(() => this.takeFocused());
    },
    /** RT from FULLSCREEN (MULTI-CARD) — the shell already closed the viewer;
     *  run the SAME premium group collect as an in-modal RT (`runCardCollect`). */
    takeAllFromZoom(): void {
      void this.$nextTick(() => this.takeAll());
    },
  },
});
</script>
