<template>
  <div class="con-status">
    <!-- P27: player chips = IDENTITY + live TURN STATUS. P27b: they sit on
         the LEFT (desktop parity — the player panels live on the left);
         the global parameters moved to the right flank. The cards/actions
         counters live in the right home panel; TR / M€ in the resource
         panel + Information Mode — the top chips answer ONE question:
         whose move is it and what is everyone doing. -->
    <!-- Generation-order conveyor (statusChipConveyor.ts): on a server
         rotation of this list the chips glide one slot along a closed
         ribbon — the wrapped chip leaves through one edge and enters
         through the other, under the soft edge mask of the --conveyor
         state. The RIBBON wrapper is the belt's single moving part: one
         transform animation carries every chip, the entering chip and the
         exit ghost together (per-element WAAPI animations start on the
         compositor at measurably different times — one driver is what
         makes tearing unexpressible). data-color is the chips' stable
         identity for the FLIP measurement (the same identity as :key). -->
    <div class="con-status__players" ref="playersEl">
      <div class="con-status__ribbon" :class="{'con-status__ribbon--dense': denseSeats}">
      <span v-for="p in players"
            :key="p.color"
            class="con-status__player"
            :class="chipClasses(p)"
            :data-color="p.color">
        <span :class="'con-status__dot player_bg_color_' + p.color"></span>
        <span class="con-status__pname">{{ displayName(p) }}</span>
        <span class="con-status__pstatus" :class="'con-status__pstatus--' + presentation(p).category">
          <span class="con-status__pstatus-glyph" aria-hidden="true">{{ statusGlyph(p) }}</span>
          <!-- A crowded table (R-20): a WAITING seat's word gives way to its dot so the name stays whole («play…» ×4 at five seats); the active seat keeps its word and counter. -->
          <span v-if="presentation(p).textKey !== '' && !(denseSeats && presentation(p).category === 'waiting')" class="con-status__pstatus-text">{{ $t(presentation(p).textKey) }}</span>
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
      <!-- THE SEAT'S INTAKE (T06 — the owner's M1 «плашка-хвост», `console/statusIntake.ts`): another seat's gain off
           the field lands HERE — a plaque hanging from that seat's chip, in its tone, open BEFORE the token is born
           (a thin ring, «…»), ticking «+N» on the touchdown, folding back after one read. A SIBLING of the chips in
           the ribbon (never a child: a passed chip's opacity would fade its receiver), absolute — the chip's width and
           the ribbon never move — and riding the ribbon's one transform with its chip. -->
      <transition-group name="con-intake">
        <span v-for="intake in intakes"
              :key="intake.seat"
              class="con-status__intake"
              :class="'con-status__intake--' + intake.phase"
              :style="intakeStyle(intake)"
              :data-intake-seat="intake.seat"
              :data-intake-phase="intake.phase"
              aria-hidden="true">
          <span v-for="item in intake.items"
                :key="(item.production === true ? 'production:' : '') + item.resource"
                class="con-status__intake-item"
                :data-intake-resource="item.resource"
                :data-intake-production="item.production === true ? '' : undefined">
            <!-- PRODUCTION (a printed production bonus the seat's cell paid) wears the game's production frame. -->
            <span v-if="item.production === true" class="con-status__intake-prod"><i class="con-status__intake-icon" :class="intakeIconClass(item.resource)"></i></span>
            <i v-else class="con-status__intake-icon" :class="intakeIconClass(item.resource)"></i>
            <span class="con-status__intake-num">{{ intakeText(item) }}</span>
          </span>
        </span>
      </transition-group>
      </div>
    </div>

    <div class="con-status__params">
      <!-- The GAME-END trio (Temperature · Oxygen · Oceans) reads as ONE
           instrument group, its TOTAL the group's first dial — the PLANET (EW,
           2026-11-03: the thin rail that underlined the group painted over the
           dials and was retired). Venus (below) sits OUTSIDE this group on
           purpose — it is a separate expansion parameter and never part of the
           total. -->
      <div class="con-status__terra"
           :class="{
             'con-status__terra--complete': progress.complete,
             'con-status__terra--celebrating': celebrating,
           }"
           role="group"
           :aria-label="terraAriaLabel">
        <!-- Every readout announces its change TWICE over: the premium
             flip-swap of the value itself (nested INSIDE the value cell —
             see ConsoleFlipValue's layering note) plus the delta chip. A global
             parameter a card LOWERS (TR47 «ОБРАТНЫЙ ХОД») is an event too: the
             four parameters flip on a decrease, rolled the other way. -->
        <!-- THE PLANET (EW): the terraforming total as the group's first dial — the same round setting as the three
             beside it, its ring the trio's average (`terraformingProgress`), its value the same size as theirs. The
             value keeps the `__terra-pct` class: it IS the percent (the delta-chip anchor, the probes). -->
        <span class="con-status__param con-status__param--planet" :style="{'--con-param-fill': String(progress.percent / 100)}">
          <i class="con-status__icon con-status__icon--planet" aria-hidden="true"></i>
          <span class="con-status__value con-status__terra-pct"><ConsoleFlipValue
              :value="progress.percent"
              :text="`${progress.percent}%`"
              :accent="progress.complete ? 'gold' : 'mint'" /></span>
          <AnimatedMetricValue
            :value="progress.percent"
            metricKey="globals.terraforming-percent"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <!-- T05 · CG: each parameter is a DIAL round its own icon (`console_status_material.less`), read off the value shown. -->
        <span class="con-status__param con-status__param--temperature" :class="{'con-status__param--ghost': ghostParam === 'temperature'}"
              :style="{'--con-param-fill': paramFill('temperature')}">
          <!-- data-wheel-anchor="temp": reserved acknowledgement anchor (the
               heat conversion's SERVER result animates here via the existing
               flip/delta pipeline — no scripted pre-timing). -->
          <i class="wgt-icon wgt-icon--temperature con-status__icon" data-wheel-anchor="temp" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.temperature" :text="`${game.temperature}°C`" flip-on-decrease />
          </span>
          <AnimatedMetricValue
            :value="game.temperature"
            metricKey="globals.temperature"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <span class="con-status__param con-status__param--oxygen" :class="{'con-status__param--ghost': ghostParam === 'oxygen'}"
              :style="{'--con-param-fill': paramFill('oxygen')}">
          <i class="wgt-icon wgt-icon--oxygen con-status__icon" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.oxygenLevel" :text="`${game.oxygenLevel}%`" flip-on-decrease />
          </span>
          <AnimatedMetricValue
            :value="game.oxygenLevel"
            metricKey="globals.oxygen"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <span class="con-status__param con-status__param--oceans" :class="{'con-status__param--ghost': ghostParam === 'oceans'}"
              :style="{'--con-param-steps': String(Math.max(0, Math.min(maxima.oceans, game.oceans)))}">
          <i class="wgt-icon wgt-icon--ocean con-status__icon" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.oceans" :text="`${game.oceans}/${maxima.oceans}`" flip-on-decrease />
          </span>
          <AnimatedMetricValue
            :value="game.oceans"
            metricKey="globals.oceans"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
      </div>
      <span v-if="game.gameOptions.expansions.venus" class="con-status__param con-status__param--venus"
            :class="{'con-status__param--ghost': ghostParam === 'venus'}"
            :style="{'--con-param-fill': paramFill('venus')}">
        <i class="wgt-icon wgt-icon--venus con-status__icon" aria-hidden="true"></i>
        <span class="con-status__value">
          <ConsoleFlipValue :value="game.venusScaleLevel" :text="`${game.venusScaleLevel}%`" flip-on-decrease />
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
          <ConsoleFlipValue :value="shownGeneration" :accent="finalGeneration ? 'gold' : 'cyan'" @flip-end="onGenerationFlipEnd" />
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
      <!-- …and an OPT-IN since 2026-10-13 («Настройки» → ИНТЕРФЕЙС → «Счётчик событий», OFF by default —
           statusEventCounter.ts): a developer's window into the FIFO, not a player's instrument. -->
      <span v-if="eventCounterOn" class="con-status__evq"
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

<script setup vapor lang="ts">
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
import {computed, markRaw, onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, PropType, ref, useTemplateRef, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {MIN_TEMPERATURE} from '@/common/constants';
import {GlobalParameterMaximums, getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import {ActionLabel} from '@/client/components/overview/ActionLabel';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {presentPlayerStatus, statusCounterText, StatusPresentation, StatusGlyph} from '@/client/components/overview/playerStatusPresenter';
import {terraformingProgress, TerraformingProgress} from '@/client/components/gameProgress/terraformingProgress';
import {notificationState} from '@/client/components/notifications/notificationState';
import {statusEventCounterState} from '@/client/components/notifications/statusEventCounter';
import {isNotificationDeliveryBlocked} from '@/client/components/presentation/presentationFlow';
import {finalGenerationActive} from '@/client/components/gameProgress/terraformingCelebration';
import {terraformedSceneState} from '@/client/console/terraformedScene/terraformedScene';
import {motionMs} from '@/client/components/motion/motionTokens';
import {$t, translateText} from '@/client/directives/i18n';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';
import ConsoleProjectDeck from '@/client/components/console/ConsoleProjectDeck.vue';
import {boardBeatParkState} from '@/client/console/boardBeatPark';
import {createChipConveyor} from '@/client/console/statusChipConveyor';
import {noteGenerationFlipEnd} from '@/client/console/generationScene/generationScene';
import {SeatIntake, SeatIntakeItem, intakeItemText, statusIntakeState} from '@/client/console/statusIntake';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

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

defineOptions({name: 'ConsoleStatusStrip'});
const props = defineProps({
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
});

const flow = useFlowScope('console-status-strip');
const playersEl = useTemplateRef<HTMLElement>('playersEl');
/** One-shot "turn passed to YOU" attention burst on the viewer's chip. */
const turnBurst = ref(false);
let cancelBurst = (() => {}) as () => void;
/** Debounced RAW pending state — half of the beacon (see `attention`). */
const attentionEngaged = ref(false);
/** The dwell's cancel — `undefined` while no dwell stands. */
let cancelAttention: (() => void) | undefined;
/** One-shot terraforming-complete pulse on the Temp/O₂/Oceans group. */
const celebrating = ref(false);
let cancelCelebrate = (() => {}) as () => void;
/**
 * The generic pending-events signal, ENGAGED — the 500 ms dwell ran to
 * completion with the raw state continuously true. The raw state is
 * true for one flush during an ordinary promotion hand-over and for
 * the whole life of a SHORT blocker; neither may reach the player's
 * eye, so nothing shows until the dwell survives. Release is instant.
 */
const evqEngaged = ref(false);
/** The dwell's cancel — `undefined` while no dwell stands. */
let cancelEvq: (() => void) | undefined;
/** The DISPLAYED count («0» dormant / «N» / «9+») — follows the live
 *  queue through the coalescing window, never a stale number. */
const shownCountText = ref('0');
/** The coalescing window's cancel — `undefined` while no fire is pending. */
let cancelEvqCount: (() => void) | undefined;
/** The generation-order chip conveyor — DOM choreography state, kept
 *  out of reactivity (it holds Animations, clones and rects). */
const conveyor = ref(markRaw(createChipConveyor()));

/** The seats' INTAKE plaques standing now (T06 — `console/statusIntake.ts`). */
const intakes = computed((): ReadonlyArray<SeatIntake> => {
  return statusIntakeState.intakes;
});
/**
 * The game the strip DISPLAYS — THE TRUTH, AT ONCE (state delivery, 2026-10-28; the owner: «состояния в top bar
 * должны меняться сразу же, как только на сервере поменялось»).
 *
 * The four global parameters read the APPLIED view: a scale another seat moved while this player stood inside a
 * workspace flips on the strip the moment the view lands (ConsoleFlipValue + the globals delta chip), whatever
 * the board behind the workspace can show. The board-beat park keeps holding the BOARD's presented values — the
 * marker's glide, the capture flash and the parked bonus card still play when the board is uncovered, as the
 * board's own story of a change the HUD has already told. Until 2026-10-28 the strip merged the park's held
 * snapshot too («the HUD and the arcs can never disagree»), which held the HUD at a value the server had left
 * up to 30 s earlier — a lie the player made decisions on. The HUD is an instrument, the board is a stage: the
 * instrument reads true, the stage tells the story.
 *
 * The ONE merge kept: a PARAMETER SWING (TR47 «ОБРАТНЫЙ ХОД» — up and back in one response, the applied view's
 * net change ZERO): its peak is presented until each leg's turn, so the fall is seen as a fall — the view's
 * value is the scene's END, which the strip reaches with the last leg.
 */
/** The MAP's maximums (Amazonis Planitia's tracks are longer — +14 °C, 18 %, 11 oceans, 33 %). */
const maxima = computed((): Readonly<GlobalParameterMaximums> => {
  return getGlobalParameterMaximums(props.playerView.game.gameOptions.boardName);
});
const game = computed((): GameModel => {
  if (boardBeatParkState.swingParams === undefined) {
    return props.playerView.game;
  }
  return {
    ...props.playerView.game,
    ...boardBeatParkState.swingParams,
  };
});
/** Four seats and more: the ribbon is crowded — the names outrank the waiting seats' words (R-20). */
const denseSeats = computed((): boolean => {
  return players.value.length >= 4;
});
const players = computed((): ReadonlyArray<PublicPlayerModel> => {
  return props.playerView.players;
});
const thisPlayerColor = computed((): Color => {
  return props.playerView.thisPlayer.color;
});
/** The viewer's status category — drives the one-shot burst watcher. */
const myCategory = computed((): StatusPresentation['category'] => {
  const me = players.value.find((p) => p.color === thisPlayerColor.value);
  return me !== undefined ? presentation(me).category : 'none';
});
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
const viewerAwaited = computed((): boolean => {
  return myCategory.value === 'active';
});
/** The beacon: a debounced PENDING decision that is answerable NOW. */
const attention = computed((): boolean => {
  return attentionEngaged.value && viewerAwaited.value;
});
/** The SHARED terraforming-progress math (same helper the desktop
 *  sidebar gauge uses) — Temperature + Oxygen + Oceans ONLY. */
const progress = computed((): TerraformingProgress => {
  return terraformingProgress(game.value, maxima.value);
});
/**
 * THE GENERATION THIS SEAT IS IN (Turmoil Redux, the soft gates): the sitting's while the seat has not closed it —
 * the next generation already runs around it on the server, and the counter flips at the seat's own
 * «Закрыть заседание» (`presentedGeneration` — the server's per-seat sitting, never a client memory).
 */
const shownGeneration = computed((): number => {
  return game.value.parliament?.phase?.generation ?? game.value.generation;
});
/** This generation is authoritatively the game's last one. */
const finalGeneration = computed((): boolean => {
  return finalGenerationActive(props.playerView);
});
/**
 * The terraformed SCENE's show (TR70 — `terraformedScene.ts`): the one-shot pulse of the trio rides the
 * scene's tact 3 — the frame the held values let go and the chips flip — never the raw completion nonce,
 * which fires at the apply while the readouts still hold the previous numbers.
 */
const sceneShowNonce = computed((): number => {
  return terraformedSceneState.showNonce;
});
/**
 * RAW generic-signal state: prepared events wait in the FIFO, NO card is
 * active, and delivery is GENUINELY blocked (an animation / a reveal /
 * the theater / a ceremony own the screen). All three, deliberately:
 *  - with a card active the backlog belongs to «ДАЛЬШЕ +N» (mutual
 *    exclusion by construction);
 *  - with delivery open the next card presents in the same flush — that
 *    transitional shape must never light the slot.
 */
/** The pending-events instrument is shown at all (the opt-in — statusEventCounter.ts). */
const eventCounterOn = computed((): boolean => {
  return statusEventCounterState.enabled;
});
const pendingSignalRaw = computed((): boolean => {
  return notificationState.transient.length === 0 &&
    notificationState.queue.length > 0 &&
    isNotificationDeliveryBlocked();
});
/** The signal as SHOWN — the dwell latch AND the live conditions (the
 *  «re-check at expiry» of the contract is this conjunction). */
const pendingSignalShown = computed((): boolean => {
  return evqEngaged.value && pendingSignalRaw.value;
});
/** Absolute live backlog, 9+ capped (the truth the display follows). */
const pendingCountText = computed((): string => {
  const n = notificationState.queue.length;
  return n > 9 ? '9+' : String(n);
});
/** What the slot SHOULD read right now — «0» whenever it is not shown. */
const evqTarget = computed((): string => {
  return pendingSignalShown.value ? pendingCountText.value : '0';
});
const terraAriaLabel = computed((): string => {
  return `${translateText('Terraforming progress')}: ${progress.value.percent}%`;
});

/**
 * A DIAL's reading (T05 · CG) — how far the shown value stands along its scale, 0…1: the temperature from −30 to
 * the map's maximum (+8 °C; +14 °C on Amazonis Planitia), the oxygen from 0 to its maximum. The value is the one the cell prints (the board-beat park's display included).
 */
function paramFill(param: 'temperature' | 'oxygen' | 'venus'): string {
  const fill = param === 'temperature' ?
    (game.value.temperature - MIN_TEMPERATURE) / (maxima.value.temperature - MIN_TEMPERATURE) :
    param === 'oxygen' ? game.value.oxygenLevel / maxima.value.oxygen : game.value.venusScaleLevel / maxima.value.venus;
  return String(Math.max(0, Math.min(1, fill)));
}
/**
 * WHERE a seat's intake hangs: under its chip — the plaque's left edge on the chip's, its stem on the seat's dot,
 * its ring in the seat's tone (the dot's own paint). Measured in the ribbon's coordinates (the plaque rides the
 * ribbon's one transform with its chip); `seq` re-renders it on every change of the plaque.
 */
function intakeStyle(intake: SeatIntake): Record<string, string> {
  void intake.seq;
  const ribbon = playersEl.value?.querySelector<HTMLElement>('.con-status__ribbon');
  const chip = ribbon?.querySelector<HTMLElement>(`.con-status__player[data-color="${intake.seat}"]:not(.con-status__pghost)`);
  const dot = chip?.querySelector<HTMLElement>('.con-status__dot');
  if (ribbon === undefined || ribbon === null || chip === undefined || chip === null) {
    return {display: 'none'};
  }
  const style: Record<string, string> = {left: `${chip.offsetLeft}px`};
  if (dot !== null && dot !== undefined) {
    style['--con-intake-stem-x'] = `${dot.offsetLeft + dot.offsetWidth / 2}px`;
    style['--con-intake-tone'] = getComputedStyle(dot).backgroundColor;
  }
  return style;
}
function intakeIconClass(resource: string): string {
  return iconClassFor(resource);
}
function intakeText(item: SeatIntakeItem): string {
  return intakeItemText(item);
}
/** The generation readout finished its flip — the generation scene's FIRST beat is over (TR61). */
function onGenerationFlipEnd(generation: number): void {
  noteGenerationFlipEnd(generation);
}
/** The chips' identity sequence — the generation order as rendered. */
function chipOrder(): Array<string> {
  return players.value.map((p) => p.color as string);
}
function playersContainer(): HTMLElement | undefined {
  const el = playersEl.value;
  return el instanceof HTMLElement ? el : undefined;
}
function displayName(p: PublicPlayerModel): string {
  return participantDisplayName(p);
}
function actionLabel(p: PublicPlayerModel): ActionLabel {
  return actionLabelForPlayer(props.playerView, p, liveWaitingSignal(props.waitingOnPlayers));
}
function presentation(p: PublicPlayerModel): StatusPresentation {
  return presentPlayerStatus(actionLabel(p), p.isMarsBot === true);
}
function statusGlyph(p: PublicPlayerModel): string {
  return GLYPH_CHARS[presentation(p).glyph];
}
function actionCounter(p: PublicPlayerModel): string {
  // ONE derivation, shared with the desktop card: a BONUS action counts the
  // bonuses its card granted, a normal turn counts the turn's own actions.
  return statusCounterText(p, actionLabel(p));
}
function chipClasses(p: PublicPlayerModel): Record<string, boolean> {
  const category = presentation(p).category;
  const me = p.color === thisPlayerColor.value;
  return {
    'con-status__player--me': me,
    'con-status__player--active': category === 'active',
    'con-status__player--passed': category === 'passed',
    'con-status__player--burst': me && turnBurst.value,
    'con-status__player--attention': me && attention.value,
  };
}

watch(() => props.attentionPending, (pending: boolean): void => {
  if (pending) {
    if (attentionEngaged.value || cancelAttention !== undefined) {
      return;
    }
    cancelAttention = flow.after(props.attentionEngageMs, 'the attention beacon\'s dwell', () => {
      cancelAttention = undefined;
      attentionEngaged.value = true;
    });
  } else {
    if (cancelAttention !== undefined) {
      cancelAttention();
      cancelAttention = undefined;
    }
    attentionEngaged.value = false;
  }
}, {immediate: true});
watch(() => myCategory.value, (now: StatusPresentation['category'], before: StatusPresentation['category']) => {
  if (now === 'active' && before !== 'active') {
    turnBurst.value = true;
    cancelBurst();
    cancelBurst = flow.after(motionMs(2600), 'the turn burst ends', () => {
      turnBurst.value = false;
    });
  }
});
// The generic pending-events signal — the 500 ms DWELL. A rising raw
// state arms the timer; ANY interruption (blocker cleared, delivery
// started, a card presented, the queue emptied) cancels it on the falling
// edge, so «continuously waiting» is literal. The timer firing sets the
// latch only — whether anything SHOWS is re-derived from the LIVE raw
// state (`pendingSignalShown = engaged && raw`), which is the «re-check
// every condition at expiry» step by construction. Purely visual: the
// real queue/delivery never waits on any of this.
watch(() => pendingSignalRaw.value, (raw: boolean): void => {
  if (raw) {
    if (evqEngaged.value || cancelEvq !== undefined) {
      return;
    }
    cancelEvq = flow.after(props.pendingEngageMs, 'the pending-events signal\'s dwell', () => {
      cancelEvq = undefined;
      evqEngaged.value = true;
    });
  } else {
    if (cancelEvq !== undefined) {
      cancelEvq();
      cancelEvq = undefined;
    }
    evqEngaged.value = false;
  }
}, {immediate: true});
// The DISPLAYED count follows the target with a short coalescing window:
// dormant↔waiting edges apply IMMEDIATELY (the dwell already filtered the
// noise — engagement must show the real number at once, and the return to
// «0» must not lag the card that took over), while N→M churn inside the
// waiting state batches into one calm crossfade. The fire reads the LIVE
// target, so the digit shown is always the current truth.
watch(() => evqTarget.value, (target: string): void => {
  if (target === shownCountText.value) {
    return;
  }
  if (target === '0' || shownCountText.value === '0') {
    if (cancelEvqCount !== undefined) {
      cancelEvqCount();
      cancelEvqCount = undefined;
    }
    shownCountText.value = target;
    return;
  }
  if (cancelEvqCount !== undefined) {
    return; // the pending fire reads the live target — nothing to re-arm
  }
  cancelEvqCount = flow.after(props.pendingCoalesceMs, 'the pending count\'s coalescing window', () => {
    cancelEvqCount = undefined;
    shownCountText.value = evqTarget.value;
  });
}, {immediate: true});
// One-shot pulse on the Temp/O₂/Oceans group when the terraformed scene
// SHOWS (the scene plays once per live completion, never on a reload — the
// calm --complete state carries the persistent look).
watch(() => sceneShowNonce.value, () => {
  celebrating.value = true;
  cancelCelebrate();
  cancelCelebrate = flow.after(motionMs(3400), 'the terraformed pulse ends', () => {
    celebrating.value = false;
  });
});

onMounted(() => {
  // Seed the conveyor with the order that is on screen — the initial open
  // and a reconnect show the current order with no animation.
  conveyor.value.sync(chipOrder());
});
onBeforeUpdate(() => {
  // Pre-patch half of the reorder FLIP: measures only when the ORDER
  // itself changed (content updates — statuses, counters, params — are a
  // string compare and out).
  conveyor.value.beforePatch(playersContainer(), chipOrder());
});
onUpdated(() => {
  conveyor.value.afterPatch(playersContainer(), chipOrder());
});
onBeforeUnmount(() => {
  conveyor.value.dispose();
});
</script>
