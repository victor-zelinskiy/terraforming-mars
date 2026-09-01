<template>
  <div class="con-status">
    <!-- P27: player chips = IDENTITY + live TURN STATUS. P27b: they sit on
         the LEFT (desktop parity — the player panels live on the left);
         the global parameters moved to the right flank. The cards/actions
         counters live in the right home panel; TR / M€ in the resource
         panel + Information Mode — the top chips answer ONE question:
         whose move is it and what is everyone doing. -->
    <div class="con-status__players">
      <span v-for="p in players"
            :key="p.color"
            class="con-status__player"
            :class="chipClasses(p)">
        <span :class="'con-status__dot player_bg_color_' + p.color"></span>
        <span class="con-status__pname">{{ displayName(p) }}</span>
        <span class="con-status__pstatus" :class="'con-status__pstatus--' + presentation(p).category">
          <span class="con-status__pstatus-glyph" aria-hidden="true">{{ statusGlyph(p) }}</span>
          <span v-if="presentation(p).textKey !== ''" class="con-status__pstatus-text">{{ $t(presentation(p).textKey) }}</span>
          <b v-if="presentation(p).showCounter" class="con-status__pstatus-counter">{{ actionCounter(p) }}</b>
        </span>
        <!-- Attention beacon: a mandatory decision awaits the VIEWER, is
             ANSWERABLE NOW (the same `active` status this chip's own pill
             shows — see `viewerAwaited`) and its CTA card is off-screen (they
             parked in another section / a sheet / a zoom) — the chip is then
             the ONE reminder. See `attention`. -->
        <transition name="con-beacon">
          <span v-if="attention && p.color === thisPlayerColor"
                class="con-status__beacon"
                aria-hidden="true">!</span>
        </transition>
      </span>
    </div>

    <div class="con-status__params">
      <!-- The GAME-END trio (Temperature · Oxygen · Oceans) reads as ONE
           instrument group: a compact total percent + a thin premium rail
           underline. Venus (below) sits OUTSIDE this group on purpose — it
           is a separate expansion parameter and never part of the total. -->
      <div class="con-status__terra"
           :class="{
             'con-status__terra--complete': progress.complete,
             'con-status__terra--celebrating': celebrating,
           }"
           role="group"
           :aria-label="terraAriaLabel">
        <!-- Every readout announces its change TWICE over: the premium
             flip-swap of the value itself (nested INSIDE the value cell —
             see ConsoleFlipValue's layering note) plus the delta chip. -->
        <span class="con-status__param" :class="{'con-status__param--ghost': ghostParam === 'temperature'}">
          <!-- data-wheel-anchor="temp": reserved acknowledgement anchor (the
               heat conversion's SERVER result animates here via the existing
               flip/delta pipeline — no scripted pre-timing). -->
          <i class="wgt-icon wgt-icon--temperature con-status__icon" data-wheel-anchor="temp" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.temperature" :text="`${game.temperature}°C`" />
          </span>
          <AnimatedMetricValue
            :value="game.temperature"
            metricKey="globals.temperature"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <span class="con-status__param" :class="{'con-status__param--ghost': ghostParam === 'oxygen'}">
          <i class="wgt-icon wgt-icon--oxygen con-status__icon" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.oxygenLevel" :text="`${game.oxygenLevel}%`" />
          </span>
          <AnimatedMetricValue
            :value="game.oxygenLevel"
            metricKey="globals.oxygen"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <span class="con-status__param" :class="{'con-status__param--ghost': ghostParam === 'oceans'}">
          <i class="wgt-icon wgt-icon--ocean con-status__icon" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.oceans" :text="`${game.oceans}/9`" />
          </span>
          <AnimatedMetricValue
            :value="game.oceans"
            metricKey="globals.oceans"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <!-- The percent is the trio's own mint readout — its beat follows
             the rail's colour (gold once terraforming is complete). -->
        <span class="con-status__terra-pct"><ConsoleFlipValue
            :value="progress.percent"
            :text="`${progress.percent}%`"
            :accent="progress.complete ? 'gold' : 'mint'" /><AnimatedMetricValue
            :value="progress.percent"
            metricKey="globals.terraforming-percent"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" /></span>
        <span class="con-status__terra-rail" aria-hidden="true">
          <span class="con-status__terra-fill" :style="{width: progress.percent + '%'}"></span>
        </span>
      </div>
      <span v-if="game.gameOptions.expansions.venus" class="con-status__param con-status__param--venus"
            :class="{'con-status__param--ghost': ghostParam === 'venus'}">
        <i class="wgt-icon wgt-icon--venus con-status__icon" aria-hidden="true"></i>
        <span class="con-status__value">
          <ConsoleFlipValue :value="game.venusScaleLevel" :text="`${game.venusScaleLevel}%`" />
        </span>
        <AnimatedMetricValue
          :value="game.venusScaleLevel"
          metricKey="globals.venus"
          scopeKey="global"
          :epoch="epoch"
          variant="global-parameter" />
      </span>
      <!-- The physical project draw pile — sits BETWEEN the global
           parameters and the generation block. Informational only: the
           count is the server's authoritative drawPile size. -->
      <ConsoleProjectDeck :deckSize="game.deckSize" :epoch="epoch" />
      <!-- The generation carries NO delta chip: the flip-swap alone is its
           announcement (and the console suppresses the desktop's "new
           generation" toast — the HUD tick IS the event). The FINAL
           generation changes COLOUR ONLY (the --final gold, matching the
           flip accent): the label stays the ordinary «ПКЛ.» — same text,
           same box, zero layout shift, no added word/badge/icon. -->
      <span class="con-status__gen" :class="{'con-status__gen--final': finalGeneration}">
        <span class="con-status__gen-label">{{ $t('GEN.') }}</span>
        <span class="con-status__value">
          <ConsoleFlipValue :value="game.generation" :accent="finalGeneration ? 'gold' : 'cyan'" />
        </span>
      </span>
      <!-- GENERIC PENDING-EVENTS SIGNAL — a PERMANENT compact HUD instrument
           right after «ПКЛ.» (hairline-separated so it never reads as one
           more global parameter). It ALWAYS renders the same three pieces —
           divider · the notification family's «◈» diamond (deliberately NOT
           a card/deck metaphor) · a fixed-width tabular count — so nothing
           ever appears, disappears or moves: DORMANT is a low-contrast «0»,
           WAITING raises contrast only (the --on modifier is paint-only).
           A non-zero count is admitted only after the 500 ms DWELL: the
           backlog must wait CONTINUOUSLY (no active card + queue non-empty +
           delivery genuinely blocked) for the whole window, so a sub-500 ms
           blocker never flashes a «1». Rapid enqueues coalesce into one calm
           digit crossfade. Purely presentational — real delivery/FIFO never
           waits on any of this. The contextual «ДАЛЬШЕ +N» owns the backlog
           under an active card; this slot then rests at «0» by construction. -->
      <span class="con-status__evq"
            :class="{'con-status__evq--on': pendingSignalShown}"
            role="status"
            :aria-label="pendingSignalShown ? $t('Pending events') : undefined"
            aria-hidden="false">
        <span class="con-status__evq-divider" aria-hidden="true"></span>
        <span class="con-status__evq-glyph" aria-hidden="true">◈</span>
        <span class="con-status__evq-count" aria-hidden="true">
          <Transition name="con-evq-num">
            <span :key="shownCountText" class="con-status__evq-num">{{ shownCountText }}</span>
          </Transition>
        </span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console status strip (docs/CONSOLE_MODE_CONCEPT.md §6; P27 rework) — the
 * TV-scale top HUD: global parameters + generation on the left, compact
 * premium PLAYER STATUS chips on the right. Read-only.
 *
 * The chips REUSE the desktop's status truth (playerLabels.actionLabelFor
 * Player + playerStatusPresenter) so console and desktop can never disagree
 * about who the server is waiting on: active (ДЕЙСТВИЕ 1/2 with the real
 * `actionsTakenThisRound` counter), research/draft picks, forced reactions,
 * ready, waiting, passed. The viewer's chip fires a one-shot TURN BURST
 * animation the moment their status becomes active — the premium
 * "your turn" transition that replaced the central «ВАШ ХОД» pill.
 */
import {defineComponent, PropType} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import {ActionLabel} from '@/client/components/overview/ActionLabel';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {presentPlayerStatus, statusCounterText, StatusPresentation, StatusGlyph} from '@/client/components/overview/playerStatusPresenter';
import {terraformingProgress, TerraformingProgress} from '@/client/components/gameProgress/terraformingProgress';
import {notificationState} from '@/client/components/notifications/notificationState';
import {isNotificationDeliveryBlocked} from '@/client/components/presentation/presentationFlow';
import {finalGenerationActive, terraformingCelebrationState} from '@/client/components/gameProgress/terraformingCelebration';
import {motionMs} from '@/client/components/motion/motionTokens';
import {translateText} from '@/client/directives/i18n';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';
import ConsoleProjectDeck from '@/client/components/console/ConsoleProjectDeck.vue';
import {planetFocusState, displayGlobalParams} from '@/client/console/planetFocus';

/** Glyph → the chip's compact text mark (mirrors the desktop PlayerStatusGlyph;
 *  CSS animates the active dot via the --active class). MarsBot's active turn
 *  uses the SAME 'dot' as a human, so the bot reads as just another player. */
const GLYPH_CHARS: Record<StatusGlyph, string> = {
  dot: '●',
  check: '✓',
  clock: '◌',
  pause: '∥',
  none: '',
};

export default defineComponent({
  name: 'ConsoleStatusStrip',
  components: {AnimatedMetricValue, ConsoleFlipValue, ConsoleProjectDeck},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /**
     * The LIVE `/api/waitingFor` poll. Without it the chips read the frozen
     * `isWaitingForInput` snapshot, which goes STALE for the whole of a
     * simultaneous-pick phase: while the viewer holds their own prompt the
     * playerView is deliberately not refreshed (it would drop their partial
     * input), so an opponent who has since submitted still reads as picking.
     * The start scene's summary rail reads the same brain WITH the poll, so
     * omitting it here made the two surfaces visibly disagree.
     */
    waitingOnPlayers: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
    /** playerView.runId — drives the delta-chip feedback ('' disables). */
    epoch: {type: String, default: ''},
    /**
     * RAW "a mandatory decision awaits the viewer while its CTA surface is
     * NOT on screen" signal (ConsoleShell: gate held / deferred, announce
     * card hidden). The strip DEBOUNCES engagement (`attentionEngageMs`) so
     * a transient off-screen window — an animation about to end on the board
     * home, a section flip-through — never flashes the beacon; release is
     * INSTANT the moment the announce card shows or the decision resolves,
     * so the chip and the CTA card never double-signal.
     *
     * The beacon additionally requires the viewer's status to be ACTIONABLE
     * — see `viewerAwaited`. "Pending" and "answerable NOW" are two different
     * facts, and only the second one may raise an alarm.
     */
    attentionPending: {type: Boolean, default: false},
    /**
     * SPATIAL PRE-SELECT PREVIEW (std-projects §9): the global-parameter
     * readout the FOCUSED project would move gets a quiet ring — «this dial
     * is affected». Values never change, markers never move, and the ring is
     * gone the moment focus leaves — a hint, never a pre-played result. The
     * numbers themselves stay with the context chips (one source, no
     * duplication).
     */
    ghostParam: {type: String as PropType<'temperature' | 'oxygen' | 'oceans' | 'venus' | undefined>, default: undefined},
    /** Engagement debounce (ms). A prop so specs can shrink it. */
    attentionEngageMs: {type: Number, default: 1200},
    /**
     * The DWELL window (ms) before a non-zero count may show: the backlog
     * must wait CONTINUOUSLY for this long — a blocker that clears sooner, a
     * card presenting, or the queue emptying cancels the timer and the slot
     * never leaves its dormant «0». A prop so specs can shrink it.
     */
    pendingEngageMs: {type: Number, default: 500},
    /**
     * Rapid COUNT changes after engagement coalesce into one calm update
     * inside this window (the truth stays exact — the fire reads the LIVE
     * count). Dormant↔waiting edges apply immediately. A prop for specs.
     */
    pendingCoalesceMs: {type: Number, default: 120},
  },
  data() {
    return {
      /** One-shot "turn passed to YOU" attention burst on the viewer's chip. */
      turnBurst: false,
      burstTimer: undefined as number | undefined,
      /** Debounced RAW pending state — half of the beacon (see `attention`). */
      attentionEngaged: false,
      attentionTimer: undefined as number | undefined,
      /** One-shot terraforming-complete pulse on the Temp/O₂/Oceans group. */
      celebrating: false,
      celebrateTimer: undefined as number | undefined,
      /**
       * The generic pending-events signal, ENGAGED — the 500 ms dwell ran to
       * completion with the raw state continuously true. The raw state is
       * true for one flush during an ordinary promotion hand-over and for
       * the whole life of a SHORT blocker; neither may reach the player's
       * eye, so nothing shows until the dwell survives. Release is instant.
       */
      evqEngaged: false,
      evqTimer: undefined as number | undefined,
      /** The DISPLAYED count («0» dormant / «N» / «9+») — follows the live
       *  queue through the coalescing window, never a stale number. */
      shownCountText: '0',
      evqCountTimer: undefined as number | undefined,
    };
  },
  computed: {
    /**
     * The game the strip DISPLAYS. While Planet Focus owns the scene the
     * four global parameters come from the frozen snapshot — the SAME read
     * the board's arcs use (planetFocus.displayGlobalParams), so the top
     * HUD and the scales can never disagree. The release flips the values
     * (ConsoleFlipValue) and fires the globals delta chips exactly when
     * the arc markers glide — one synchronized beat.
     */
    game(): GameModel {
      if (planetFocusState.heldParams === undefined) {
        return this.playerView.game;
      }
      return {...this.playerView.game, ...displayGlobalParams(this.playerView.game)};
    },
    players(): ReadonlyArray<PublicPlayerModel> {
      return this.playerView.players;
    },
    thisPlayerColor(): Color {
      return this.playerView.thisPlayer.color;
    },
    /** The viewer's status category — drives the one-shot burst watcher. */
    myCategory(): StatusPresentation['category'] {
      const me = this.players.find((p) => p.color === this.thisPlayerColor);
      return me !== undefined ? this.presentation(me).category : 'none';
    },
    /**
     * IS THE PENDING DECISION ANSWERABLE RIGHT NOW? The server is waiting on
     * the viewer — the `active` category, which is exactly what this chip's
     * own pill says («ДЕЙСТВИЕ» / «ФАЗА ПРОЛОГОВ» / …).
     *
     * WHY THE BEACON NEEDS IT. «A mandatory action is pending» and «you can
     * answer it now» are two different facts, and only the second one is an
     * alarm. A prompt can be owed while the table is still busy elsewhere (the
     * corporation's first action while another player finishes their preludes;
     * a minimized start workspace whose «ждём остальных» is honest), and there
     * the player is legitimately free to walk the interface — pulsing amber at
     * them demands something they cannot do. Worse, it CONTRADICTS the chip it
     * sits on: the pill read «ОЖИДАЕТ» while the same chip flashed for
     * attention. So the beacon is derived from the SAME presentation the pill
     * renders — that contradiction is now unexpressible — and it lights the
     * instant the status turns active, with no further debounce (the pending
     * half has been engaged all along).
     *
     * The announcement card is deliberately NOT gated on this: it is a calm
     * plate on the player's own board home that says where to go, and A must
     * keep taking them there whenever they choose to look.
     */
    viewerAwaited(): boolean {
      return this.myCategory === 'active';
    },
    /** The beacon: a debounced PENDING decision that is answerable NOW. */
    attention(): boolean {
      return this.attentionEngaged && this.viewerAwaited;
    },
    /** The SHARED terraforming-progress math (same helper the desktop
     *  sidebar gauge uses) — Temperature + Oxygen + Oceans ONLY. */
    progress(): TerraformingProgress {
      return terraformingProgress(this.game);
    },
    /** This generation is authoritatively the game's last one. */
    finalGeneration(): boolean {
      return finalGenerationActive(this.playerView);
    },
    celebrationNonce(): number {
      return terraformingCelebrationState.celebrationNonce;
    },
    /**
     * RAW generic-signal state: prepared events wait in the FIFO, NO card is
     * active, and delivery is GENUINELY blocked (an animation / a reveal /
     * the theater / a ceremony own the screen). All three, deliberately:
     *  - with a card active the backlog belongs to «ДАЛЬШЕ +N» (mutual
     *    exclusion by construction);
     *  - with delivery open the next card presents in the same flush — that
     *    transitional shape must never light the slot.
     */
    pendingSignalRaw(): boolean {
      return notificationState.transient.length === 0 &&
        notificationState.queue.length > 0 &&
        isNotificationDeliveryBlocked();
    },
    /** The signal as SHOWN — the dwell latch AND the live conditions (the
     *  «re-check at expiry» of the contract is this conjunction). */
    pendingSignalShown(): boolean {
      return this.evqEngaged && this.pendingSignalRaw;
    },
    /** Absolute live backlog, 9+ capped (the truth the display follows). */
    pendingCountText(): string {
      const n = notificationState.queue.length;
      return n > 9 ? '9+' : String(n);
    },
    /** What the slot SHOULD read right now — «0» whenever it is not shown. */
    evqTarget(): string {
      return this.pendingSignalShown ? this.pendingCountText : '0';
    },
    terraAriaLabel(): string {
      return `${translateText('Terraforming progress')}: ${this.progress.percent}%`;
    },
  },
  watch: {
    attentionPending: {
      immediate: true,
      handler(pending: boolean): void {
        if (pending) {
          if (this.attentionEngaged || this.attentionTimer !== undefined) {
            return;
          }
          this.attentionTimer = window.setTimeout(() => {
            this.attentionTimer = undefined;
            this.attentionEngaged = true;
          }, this.attentionEngageMs);
        } else {
          if (this.attentionTimer !== undefined) {
            window.clearTimeout(this.attentionTimer);
            this.attentionTimer = undefined;
          }
          this.attentionEngaged = false;
        }
      },
    },
    myCategory(now: StatusPresentation['category'], before: StatusPresentation['category']) {
      if (now === 'active' && before !== 'active') {
        this.turnBurst = true;
        if (this.burstTimer !== undefined) {
          window.clearTimeout(this.burstTimer);
        }
        this.burstTimer = window.setTimeout(() => {
          this.turnBurst = false;
        }, motionMs(2600));
      }
    },
    // The generic pending-events signal — the 500 ms DWELL. A rising raw
    // state arms the timer; ANY interruption (blocker cleared, delivery
    // started, a card presented, the queue emptied) cancels it on the falling
    // edge, so «continuously waiting» is literal. The timer firing sets the
    // latch only — whether anything SHOWS is re-derived from the LIVE raw
    // state (`pendingSignalShown = engaged && raw`), which is the «re-check
    // every condition at expiry» step by construction. Purely visual: the
    // real queue/delivery never waits on any of this.
    pendingSignalRaw: {
      immediate: true,
      handler(raw: boolean): void {
        if (raw) {
          if (this.evqEngaged || this.evqTimer !== undefined) {
            return;
          }
          this.evqTimer = window.setTimeout(() => {
            this.evqTimer = undefined;
            this.evqEngaged = true;
          }, this.pendingEngageMs);
        } else {
          if (this.evqTimer !== undefined) {
            window.clearTimeout(this.evqTimer);
            this.evqTimer = undefined;
          }
          this.evqEngaged = false;
        }
      },
    },
    // The DISPLAYED count follows the target with a short coalescing window:
    // dormant↔waiting edges apply IMMEDIATELY (the dwell already filtered the
    // noise — engagement must show the real number at once, and the return to
    // «0» must not lag the card that took over), while N→M churn inside the
    // waiting state batches into one calm crossfade. The fire reads the LIVE
    // target, so the digit shown is always the current truth.
    evqTarget: {
      immediate: true,
      handler(target: string): void {
        if (target === this.shownCountText) {
          return;
        }
        if (target === '0' || this.shownCountText === '0') {
          if (this.evqCountTimer !== undefined) {
            window.clearTimeout(this.evqCountTimer);
            this.evqCountTimer = undefined;
          }
          this.shownCountText = target;
          return;
        }
        if (this.evqCountTimer !== undefined) {
          return; // the pending fire reads the live target — nothing to re-arm
        }
        this.evqCountTimer = window.setTimeout(() => {
          this.evqCountTimer = undefined;
          this.shownCountText = this.evqTarget;
        }, this.pendingCoalesceMs);
      },
    },
    // One-shot pulse on the Temp/O₂/Oceans group when terraforming completes
    // LIVE (the shared nonce never re-fires on reload — the calm --complete
    // state carries the persistent look).
    celebrationNonce() {
      this.celebrating = true;
      if (this.celebrateTimer !== undefined) {
        window.clearTimeout(this.celebrateTimer);
      }
      this.celebrateTimer = window.setTimeout(() => {
        this.celebrating = false;
      }, motionMs(3400));
    },
  },
  beforeUnmount() {
    if (this.burstTimer !== undefined) {
      window.clearTimeout(this.burstTimer);
    }
    if (this.celebrateTimer !== undefined) {
      window.clearTimeout(this.celebrateTimer);
    }
    if (this.attentionTimer !== undefined) {
      window.clearTimeout(this.attentionTimer);
    }
    if (this.evqTimer !== undefined) {
      window.clearTimeout(this.evqTimer);
    }
    if (this.evqCountTimer !== undefined) {
      window.clearTimeout(this.evqCountTimer);
    }
  },
  methods: {
    displayName(p: PublicPlayerModel): string {
      return participantDisplayName(p);
    },
    actionLabel(p: PublicPlayerModel): ActionLabel {
      return actionLabelForPlayer(this.playerView, p, liveWaitingSignal(this.waitingOnPlayers));
    },
    presentation(p: PublicPlayerModel): StatusPresentation {
      return presentPlayerStatus(this.actionLabel(p), p.isMarsBot === true);
    },
    statusGlyph(p: PublicPlayerModel): string {
      return GLYPH_CHARS[this.presentation(p).glyph];
    },
    actionCounter(p: PublicPlayerModel): string {
      // ONE derivation, shared with the desktop card: a BONUS action counts the
      // bonuses its card granted, a normal turn counts the turn's own actions.
      return statusCounterText(p, this.actionLabel(p));
    },
    chipClasses(p: PublicPlayerModel): Record<string, boolean> {
      const category = this.presentation(p).category;
      const me = p.color === this.thisPlayerColor;
      return {
        'con-status__player--me': me,
        'con-status__player--active': category === 'active',
        'con-status__player--passed': category === 'passed',
        'con-status__player--burst': me && this.turnBurst,
        'con-status__player--attention': me && this.attention,
      };
    },
  },
});
</script>
