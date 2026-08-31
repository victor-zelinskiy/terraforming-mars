<template>
  <!-- THE COLONY WORKSPACE. `con-ws` = the workspace-family marker (rail
       lifted + ringed while this section lives); the `__frame` plate is the
       SAME chrome as `.con-hand__frame` / `.con-cardactions__frame` — one
       system, read from the plane before a word. When EMBEDDED (a step of
       another workspace) the shell comes off (rule 1) and the host's frame
       is the room. -->
  <div class="con-colonies"
       :class="[
         'con-colonies--' + layout,
         {
           'con-ws': !embedded,
           'con-colonies--embedded': embedded,
           'con-colonies--focus': focusState.open,
         },
       ]"
       :data-colony-mode="pick !== undefined ? 'pick' : 'browse'"
       :style="{'--coltile-scale': String(tileScale), '--con-colonies-seat': seatReservePx + 'px'}">
    <div class="con-colonies__frame">
      <!-- ── THE WORKSPACE HEADER — the shared ConsoleWsHead: root «КОЛОНИИ»
           + the fleet dock as the aux browse layer; descending into a colony
           grows the crumb tail «› <колония> › ТОРГОВЛЯ». When embedded, the
           host draws the crumb (rule 5) and only the fleet TOOLBAR remains. -->
      <!-- ── THE HEADER. The FLEET DOCK is ONE component in ONE place — the
           right edge — in EVERY mode (standalone / embedded / focus): spatial
           memory, no conflict with the crumb, and the launching ship's pad
           stays live through the focus descent (the trade resolves INSIDE the
           Focus Stage now). ── -->
      <ConsoleWsHead v-if="!embedded"
                     class="con-colonies__head"
                     root="Colonies"
                     emblem="colonies"
                     wheelAnchor="trading"
                     :subject="crumbSubject"
                     :stage="crumbStage"
                     :committed="crumbCommitted">
        <!-- The aux browse layer: the pick-mode chip only (crossfades away
             past the descent — the crumb tail then names the mode). -->
        <span v-if="pick !== undefined" class="con-colonies__mode-chip">{{ $t(pick.buttonLabel) }}</span>
        <template #trailing>
          <ConsoleColonyFleetBar :chips="fleetChips" :launchingColor="launchingFleetColor" />
        </template>
      </ConsoleWsHead>
      <!-- EMBEDDED: the host draws the crumb (rule 5), and the FLEET DOCK goes
           WHERE IT ALWAYS IS — the header's right edge. When the host offers a
           berth there the dock TELEPORTS into it (one instance, one owner of
           the data); otherwise this toolbar keeps it, exactly as before.
           A dock floating in the content area was the loudest tell that the
           player had arrived somewhere ELSE: same screen, ships in a different
           place, and a row of vertical space stolen from the grid — which is
           what shrank the tiles, because the fit is height-bound. -->
      <Teleport v-if="embedded && fleetBerth !== ''" :to="fleetBerth">
        <ConsoleColonyFleetBar :chips="fleetChips" :launchingColor="launchingFleetColor" />
      </Teleport>
      <div v-else-if="embedded && (pick !== undefined || fleetBerth === '')" class="con-colonies__toolbar">
        <span v-if="pick !== undefined" class="con-colonies__mode-chip"
              :class="{'con-colonies__mode-chip--held': focusState.open}">{{ $t(pick.buttonLabel) }}</span>
        <ConsoleColonyFleetBar class="con-colonies__toolbar-fleets" :chips="fleetChips" :launchingColor="launchingFleetColor" />
      </div>

      <!-- ── The stage wrap: the BROWSE layer (the colony surface — islands
           over open space) and the COLONY FOCUS stage occupy the same region.
           Descending recomposes the frame in place: the browse DOM is only
           parked (selection / scroll / fit survive by construction). ── -->
      <div class="con-colonies__stagewrap">
        <div class="con-colonies__browse"
             :class="{
               'con-colonies__browse--parked': focusState.open,
               'con-colonies__browse--yield': revealEmbedPresenting || handStepHosted || (resolutionUi.discardStage && !resolutionParked),
             }">
          <!-- The premium tile grid. The scroller + `margin: auto` wrapper is
               the anti-clip contract: content centres when it fits and scrolls
               FROM THE TOP when it doesn't. -->
          <div class="con-colonies__scroll" ref="scroll">
            <div class="con-colonies__grid" ref="grid" :style="gridStyle">
              <div v-for="(colony, i) in colonies"
                   :key="colony.name"
                   class="con-colonies__slot"
                   :class="{'con-colonies__slot--focused': i === index}"
                   :ref="i === index ? 'selectedSlot' : undefined">
                <ConsoleColonyTile :colony="colony"
                                   :tradeOffset="tradeOffset"
                                   :focused="i === index"
                                   :justDocked="colony.name === dockedColony"
                                   :status="tileStatus(colony)" />
              </div>
            </div>
          </div>

          <!-- COMPACT STATUS RAIL — ONE line, fixed height: the quick summary
               of the FOCUSED colony and the CONSEQUENCE of the primary action.
               Information architecture (iteration 2): name + track position
               lead (the anchor), then «→ what you get», then «· the owners'
               bonus», then the ONE critical warning. What the tile itself
               already states perfectly (its availability dot, its reward
               cells) is NOT repeated — a BLOCKED colony swaps the consequence
               for the ONE honest reason instead of adding a second badge. -->
          <footer v-if="focusedMeta !== undefined" class="con-colonies__rail">
            <span class="con-colonies__rail-name">{{ $t(colonies[index] !== undefined ? colonies[index].name : '') }}</span>
            <span v-if="railMode === 'trade'" class="con-colonies__rail-track">{{ focusedTrackDisplay }}</span>

            <!-- ── BLOCKED (trade window): the one reason, nothing else.
                 The guard states the POSITIVE fact. It used to read
                 `kind !== 'ok'`, and `'ok'` is only ever produced while a
                 trade TRANSACTION is narrating its beats — so during ordinary
                 browsing every focused colony fell into this arm, including
                 the ones the server is offering, and printed a hardcoded
                 «Торговля недоступна» over a colony the player was in the act
                 of choosing. `'none'` means «nothing to report», not «blocked
                 with no reason given». (Cross-cutting: never derive where the
                 player is by negating a rendering condition.) ── -->
            <template v-if="railMode === 'trade' && railBlocked">
              <span class="con-colonies__rail-reason" :class="'con-colonies__rail-reason--' + focusedStatus.kind">
                <span aria-hidden="true">{{ focusedStatus.kind === 'inactive' ? '○' : '✕' }}</span>
                <span>{{ focusedStatus.text }}</span>
              </span>
            </template>

            <!-- ── TRADE: the rail says ONLY what the tile cannot. The reward
                 and the owner bonus are printed on the tile in the very same
                 glyphs — restating them here made the rail an encyclopaedia
                 line that every colony repeated. What IS rail-only: a
                 standing offset (the tile shows the level, not why it moved)
                 and the one honest warning. ── -->
            <template v-else-if="railMode === 'trade'">
              <span v-if="focusedOffset > 0" class="con-colonies__rail-cell con-colonies__rail-cell--get">
                <span class="con-colonies__rail-label">{{ $t('Your trade advances the track first') }}</span>
                <b>+{{ focusedOffset }}</b>
              </span>
              <span v-if="focusedTradeLost" class="con-colonies__rail-warn">⚠ {{ $t('Resource will be lost — no card') }}</span>
            </template>

            <!-- ── BUILD pick: → build a colony · the placement grant. ── -->
            <template v-else-if="railMode === 'build'">
              <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
              <span class="con-colonies__rail-cell">
                <PlayerCube v-if="viewerColor !== undefined" class="con-colonies__rail-cube" :color="viewerColor" :size="16" />
                <span class="con-colonies__rail-label">{{ $t('You build') }}</span>
              </span>
              <template v-if="focusedBuildQty > 0">
                <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
                <span class="con-colonies__rail-cell con-colonies__rail-cell--get">
                  <b v-if="focusedBuildQty > 1">{{ focusedBuildQty }}</b>
                  <BenefitGlyph :benefit="focusedBuildBenefit" :idx="focusedBuildSlot" :cardResource="focusedMeta.cardResource" />
                </span>
              </template>
              <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
              <span class="con-colonies__rail-muted">{{ $t('Free slots') }}: {{ 3 - focusedOwners.length }}</span>
              <span v-if="focusedBuildLost" class="con-colonies__rail-warn">⚠ {{ $t('Resource will be lost — no card') }}</span>
              <span v-if="pick !== undefined && focusedStatus.kind === 'blocked'" class="con-colonies__rail-reason con-colonies__rail-reason--blocked">
                <span aria-hidden="true">✕</span><span>{{ focusedStatus.text }}</span>
              </span>
            </template>

            <!-- ── SELECT pick (setup remove / add-tile): verb + verdict. ── -->
            <template v-else>
              <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
              <span class="con-colonies__rail-note">{{ $t(pick ? pick.buttonLabel : '') }}</span>
              <span v-if="focusedStatus.kind === 'blocked'" class="con-colonies__rail-reason con-colonies__rail-reason--blocked">
                <span aria-hidden="true">✕</span><span>{{ focusedStatus.text }}</span>
              </span>
            </template>
          </footer>
        </div>

        <!-- ── EMBEDDED OUTCOME zone — the trade's drawn payout (Pluto)
             presents INSIDE the workspace: the shell's ONE reveal overlay is
             teleported here (claim: consoleWorkspaceOutcome, host 'colonies').
             Rendered from the CLAIM (submit time) so the target exists before
             the teleport resolves; empty and inert until the reveal mounts —
             the fleet flight and the reward chip waves play over the live
             grid beneath. The covers then fly from the traded tile into the
             reveal's own slots (the deck-draw targeting is document-wide), so
             «взлёт карт с колонии» IS the opening of this deeper scene. -->
        <div v-if="revealEmbedActive && !focusState.open" class="con-colonies__embed" data-embed-slot="colonies-reveal"></div>

        <!-- ── THE FULL-STAGE DISCARD (the resolution's mandatory pick). The
             whole central area belongs to the REAL hand — comparing every
             card is the phase's one job. The colony context lives INSIDE the
             hand's own ask plate (the planet mini leads «Сбросьте 1 карту ·
             Колония») — a separate green chip row above it said the same
             thing twice and cost the card grid a whole line (iteration 4). -->
        <div v-if="handStepHosted" class="con-colonies__embed con-colonies__embed--hand">
          <div class="con-colonies__handhost" data-embed-slot="colonies-hand"></div>
        </div>

        <!-- ── «СБРОШЕННЫЕ» — the resolution's discard seat, at SECTION level
             so it holds ONE spot through the focus ⇄ discard recompositions.
             The shared discard cinematic's tray teleports into the anchor;
             between cycles the receipt (count) stays. -->
        <div v-if="discardSeatLive"
             class="con-colonies__discardseat"
             :class="{'con-colonies__discardseat--live': trayStanding}"
             data-colony-discard-seat>
          <span class="con-colonies__discardseat-anchor" data-colony-discard-tray></span>
          <span v-if="!trayStanding" class="con-colonies__discardseat-done">
            <span class="con-colonies__discardseat-label">{{ $t('DISCARDED') }}</span>
            <b v-if="resolutionUi.discarded > 0" class="con-colonies__discardseat-count">{{ resolutionUi.discarded }}</b>
          </span>
        </div>

        <!-- ── THE COLONY FOCUS STAGE — the same frame, one level deeper.
             The descend hooks unfold it from the pressed tile's rect; the
             planet medallion is the carried subject. -->
        <transition :css="false"
                    @enter="onFocusEnter" @leave="onFocusLeave"
                    @enter-cancelled="onFocusEnterCancelled" @leave-cancelled="onFocusLeaveCancelled">
          <ConsoleColonyFocusStage v-if="focusState.open && focusColonyModel !== undefined"
                                   ref="focusStage"
                                   :colony="focusColonyModel"
                                   :intent="focusState.intent"
                                   :actionAvailable="focusActionAvailable"
                                   :blockReason="focusBlockReason"
                                   :blockTone="focusBlockTone"
                                   :pickLabel="pick !== undefined ? pick.buttonLabel : ''"
                                   :options="tradePaymentOptions"
                                   :disabledOptions="tradeDisabledPayments"
                                   :players="players"
                                   :preview="focusPreview"
                                   :thisPlayer="thisPlayer"
                                   :viewerColor="viewerColor"
                                   :tradeOffset="tradeOffset"
                                   :outcomeZone="focusOutcomeZone"
                                   @confirm="onFocusConfirm"
                                   @build-confirm="$emit('build-confirm', $event)"
                                   @pick-confirm="$emit('pick-confirm')"
                                   @cancel="closeFocus()" />
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console-native COLONY WORKSPACE (iteration 3 — the workspace-family
 * rework). The colony surface keeps its strongest ideas VERBATIM — separate
 * readable colony islands over open space, count-aware layouts
 * (consoleColoniesModel), the continuous fit-to-fill engine, 2D d-pad
 * stepping, server-authoritative availability — and gains the family shell:
 * the `__frame` plate, the shared `ConsoleWsHead` crumb
 * («КОЛОНИИ › <колония> › ТОРГОВЛЯ»), a COMPACT one-line status rail, and the
 * COLONY FOCUS STAGE (the trade/inspect modals merged into one embedded
 * descend — see ConsoleColonyFocusStage).
 *
 * Count-aware layouts: 1–3 = one centred row, 4 = 2×2, 5 = 3+2, 6 = 3×2,
 * >6 add-a-tile catalog = compact wrap. Tradeability is SERVER truth (the
 * trade AndOptions' SelectColony set); PICK MODE (a server SelectColony)
 * reuses the same grid with per-colony server reasons. Button hints live
 * ONLY in the shell's bottom command bar.
 */
import {defineComponent, PropType} from 'vue';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {
  colonyGridLayout, colonyGridCols, ColonyGridLayout, ColonyFocusIntent,
  colonyFleetBerth, colonyFocusState, openColonyFocus, closeColonyFocus,
} from '@/client/console/consoleColoniesModel';
import {workspaceOutcomeState, setWorkspaceOutcomeSlot, workspaceOutcomeClaimed} from '@/client/console/consoleWorkspaceOutcome';
import {
  setWorkspaceFrameSlot, setWorkspaceFrameStage, setWorkspaceFrameSubject,
  workspaceFrameHost, workspaceFrameParked, workspaceFrameStage,
} from '@/client/console/consoleWorkspaceStack';
import {colonyResolutionUi, revealIsOwnerBonus} from '@/client/console/colonyTrade/colonyResolution';
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {cardDiscardState} from '@/client/console/cardDiscard/cardDiscardState';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {freeTradeFleets, effectiveTradePosition, rewardAtPosition, TradeRewardAt, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleColonyFleetBar, {ColonyFleetChip} from '@/client/components/console/ConsoleColonyFleetBar.vue';
import ConsoleColonyTile, {ConsoleColonyTileStatus} from '@/client/components/console/ConsoleColonyTile.vue';
import ConsoleColonyFocusStage from '@/client/components/console/ConsoleColonyFocusStage.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {colonyTradeState, colonyTradeTileStatusText, presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import {colonyTradeReason, ColonyTradeReason} from '@/client/console/colonyTradeReason';
import {AvailabilityBlocker} from '@/common/availability/AvailabilityBlocker';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {cssLengthPx} from '@/client/console/cssUnits';
// The ONE source-seat reserve — the same arithmetic the drawn reveal and the
// deck pick honour, so a host's seat can never overlap whichever guest it
// happens to be standing beside.
import {sourceSeatReservePx} from '@/client/console/consoleWsStageLayout';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {
  armColonyFocusOrigin,
  playColonyStepEntry,
  colonyFocusEnterHook,
  colonyFocusLeaveHook,
  colonyFocusEnterCancelledHook,
  colonyFocusLeaveCancelledHook,
  resetColonyFocusMotion,
} from '@/client/console/consoleColonyFocusMotion';

/** PICK MODE (T4 — a server SelectColony drives the grid): the shell owns it. */
export type ConsoleColonyPick = {
  /** Names the server accepts (its `coloniesModel`). */
  selectable: ReadonlyArray<string>,
  /** Per-colony SERVER reason for the unpickable ones (translated). */
  reasons: Readonly<Record<string, string>>,
  /** The server verb ('Build' / 'Select' …) shown on the A chip. */
  buttonLabel: string,
};

/** The focus stage's confirm payload (forwarded verbatim to the shell). */
export type ColonyTradeConfirmPayload = {
  paymentIndex: number,
  steps: ReadonlyArray<TradeStep>,
  captures: Readonly<Record<number, unknown>>,
};


/** The tile-fit bounds: how far the base tile may shrink / grow to fill space.
 *  The grow cap is deliberately generous — on the 4K tv profile the grid's
 *  fit engine may raise tiles further into the freed stage (plan §3.5). */
const MIN_TILE_SCALE = 0.72;
const MAX_TILE_SCALE = 2.0;
// Grid gaps + padding — MUST match `.con-colonies__grid` in console.less.
const COL_GAP = 18;
const ROW_GAP = 16;
const GRID_PAD_X = 36; // 18 each side
const GRID_PAD_Y = 26; // 10 top + 16 bottom
/** Rounding room (logical px): CSS `zoom` quantizes every tile to whole
 *  device pixels, so a planned N-across row can render 2–3px wider than
 *  `N × baseW × scale` — without slack the LAST tile flex-wraps to an
 *  unplanned extra row that overflows the section (the 5-colony 2+2+1
 *  regression on 4K). Taken off the width fit AND added to the grid cap,
 *  same defense as cardSelectionFit.FIT_ROW_SLACK / handGrid.ROW_SLACK. */
const FIT_SLACK = 12;

/**
 * THE COMPLETION SETTLE. After the last physical change (the cube seated, the
 * guard latched, the marker landed) the scene holds for one short beat before
 * the screen moves on — long enough to read «yes, THAT is what changed»,
 * short enough that it never feels like waiting. A dwell, not a gate: nothing
 * is being waited FOR, so there is no completion signal to ride.
 */
const COMPLETION_SETTLE_MS = 300;

export default defineComponent({
  name: 'ConsoleColoniesSection',
  components: {ConsoleWsHead, ConsoleColonyFleetBar, ConsoleColonyTile, ConsoleColonyFocusStage, ColonyFleetIcon, BenefitGlyph, PlayerCube},
  props: {
    colonies: {type: Array as PropType<ReadonlyArray<ColonyModel>>, required: true},
    index: {type: Number, required: true},
    /** Server-tradeable colony names (empty when it's not the trade window). */
    tradeable: {type: Array as PropType<ReadonlyArray<string>>, required: true},
    /** Honest reason when trade is impossible right now ('' when tradeable). */
    tradeBlockReason: {type: String, default: ''},
    /**
     * The REAL turn signals feeding `colonyTradeReason`'s last two rungs. They
     * are props, not constants: pinning them `true` (as this component once did)
     * makes rung 3 always fire, so an off-turn player with a free fleet and an
     * empty active colony was told «не хватает ресурсов на оплату» — a blocker
     * that wasn't there. Rung 4 (the turn) was unreachable.
     */
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
    /** Set = SelectColony pick mode (shell submits; this only renders states). */
    pick: {type: Object as PropType<ConsoleColonyPick | undefined>, default: undefined},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    tradeOffset: {type: Number, default: 0},
    /** The colony whose fleet JUST docked (a one-shot settle glow; '' = none). */
    dockedColony: {type: String, default: ''},
    /** The trade window's payment paths (the AndOptions' inner OrOptions). */
    tradePaymentOptions: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    tradeDisabledPayments: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    /** The viewer (stocks / production / id for the focus stage's outcome). */
    thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
    /** The viewer's player id — the focus stage's server preview fetch. */
    playerId: {type: String, default: ''},
    /** The game-state version (`gameAge|undoCount`) — a moved state re-pulls
     *  the focused colony's trade preview, so the stage's candidate sets and
     *  captures are re-judged against CURRENT truth (never a stale pick). */
    viewVersion: {type: String, default: ''},
    /**
     * A STEP of another workspace (rule 1 — host-agnostic): the shell chrome
     * (frame plate, ConsoleWsHead, `con-ws` marker) comes off; grid, fit,
     * d-pad, focus stage and every capture are untouched.
     */
    embedded: {type: Boolean, default: false},
  },
  emits: ['trade-confirm', 'build-confirm', 'pick-confirm', 'flow-complete'],
  data() {
    return {
      /** The trade-launch controller — drives the launching-ship hide. */
      tradeFleetState,
      /** The reward transaction + build hero — the auto-fold watchers'
       *  mirrors (module reactives must sit in data for path watchers). */
      tradeState: colonyTradeState,
      buildState: colonyBuildState,
      /** The workspace flow state (module-level — the shell reads it too). */
      focusState: colonyFocusState,
      /** The embedded-outcome claim (the Pluto reveal re-homes into us). */
      outcomeState: workspaceOutcomeState,
      /** The resolution's presentation state (discard stage flag + receipt). */
      resolutionUi: colonyResolutionUi,
      /** The focus stage's server preview (fetched per focused colony). */
      focusPreview: undefined as ColonyTradePreviewModel | undefined,
      /** The fit-set zoom on every tile (grows them to fill the space). */
      tileScale: 1,
      /** The fit-set grid max-width so the layout's column count holds. */
      gridMaxW: 0,
      fitRaf: undefined as number | undefined,
      /** THE HOST'S SOURCE SEAT, reserved once for this whole surface — see
       *  `fit()`. Written by the fit (the one thing that runs on mount, on
       *  resize and on every zone change) and read straight into the root's
       *  padding. */
      seatReservePx: 0,
      /** VueUse stop-handles (auto-managed listeners; no raw addEventListener). */
      stopResize: undefined as (() => void) | undefined,
      stopResizeObs: undefined as (() => void) | undefined,
      /** The completion dwell (a breathing beat, never a gate). */
      completeTimer: undefined as number | undefined,
    };
  },
  computed: {
    layout(): ColonyGridLayout {
      return colonyGridLayout(this.colonies.length, this.pick !== undefined);
    },
    gridStyle(): Record<string, string> {
      // Catalog (>6) wraps freely; every other layout caps the width so the
      // intended column count holds around the fitted tiles.
      return this.gridMaxW > 0 && this.layout !== 'catalog' ? {maxWidth: this.gridMaxW + 'px'} : {};
    },
    /** Every player's fleet situation, the viewer first. */
    fleetChips(): Array<ColonyFleetChip> {
      const chips: Array<ColonyFleetChip> = this.players.map((player) => ({
        color: player.color,
        name: participantDisplayName(player),
        free: this.freeFleetsFor(player),
        total: player.fleetSize,
        me: player.color === this.viewerColor,
      }));
      return chips.sort((a, b) => Number(b.me) - Number(a.me));
    },
    /** The colour whose fleet is lifting off right now (the viewer's own —
     *  only the console shell arms flights for this client). */
    launchingFleetColor(): Color | '' {
      return this.tradeFleetState.active && this.viewerColor !== undefined ? this.viewerColor : '';
    },
    // ── The workspace crumb (ConsoleWsHead) ────────────────────────────────
    // Two depths share the one line: the FOCUS STAGE (pre-commit — cyan) and
    // the EMBEDDED PAYOUT (post-commit — amber): «КОЛОНИИ › ПЛУТОН › ДОБОР
    // КАРТ». Stable context before the mutable stage; only the tail moves.
    crumbSubject(): string {
      if (this.focusState.open && this.focusState.colonyName !== '') {
        return this.focusState.colonyName;
      }
      if (this.revealEmbedActive && this.outcomeState.sourceCard !== '') {
        return this.outcomeState.sourceCard;
      }
      return '';
    },
    crumbStage(): string {
      // THE NESTED HAND STEP is the deepest frame — its stage IS the crumb's
      // tail: «КОЛОНИИ › ПЛУТОН › СБРОС КАРТЫ». Stable context before the
      // mutable stage; only this tail advances through the resolution.
      if (this.handStepHosted) {
        const stage = workspaceFrameStage('hand');
        return stage !== '' ? stage : 'Discarding a card';
      }
      // The PAYOUT REVEAL is the deeper step — while it presents (over the
      // focus stage or over the grid alike) the tail names IT: «… › ПЛУТОН ›
      // ДОБОР КАРТ» for the trade income, «… › БОНУС ВЛАДЕЛЬЦА» for a colony
      // bonus wave (the batch's own role tag decides — never a title).
      if (this.revealEmbedPresenting) {
        if (this.outcomeState.phaseKey !== '') {
          return this.outcomeState.phaseKey;
        }
        return revealIsOwnerBonus(currentRevealEvent()?.source) ? 'Owner bonus' : 'Card draw';
      }
      if (this.focusState.open) {
        return this.focusState.stage;
      }
      if (this.revealEmbedActive) {
        return this.outcomeState.phaseKey !== '' ? this.outcomeState.phaseKey : 'Card draw';
      }
      return '';
    },
    /** The berth the HOST offers for our fleet dock ('' = keep it locally). */
    fleetBerth(): string {
      return colonyFleetBerth.selector;
    },
    /** The pair handed up to a HOSTING workspace's breadcrumb (see the watcher). */
    embeddedCrumb(): {embedded: boolean, subject: string, stage: string} {
      return {embedded: this.embedded, subject: this.crumbSubject, stage: this.crumbStage};
    },
    crumbCommitted(): boolean {
      return this.focusState.committing || this.tradeFleetState.active ||
        (this.tradeState.active && !this.resolutionParked) ||
        this.revealEmbedActive || this.handStepHosted;
    },
    // ── The nested HAND STEP (the resolution's mandatory discard) ──────────
    /** The hand workspace is standing INSIDE us as a step of the resolution. */
    handStepHosted(): boolean {
      return workspaceFrameHost('hand') === 'colonies';
    },
    /**
     * THE FRAME SLOT — the teleport target we publish for the hand step
     * (`workspaceFrameTarget('hand')` reads it). ONE zone, always the
     * SECTION-level full-stage host: the discard's whole job is comparing
     * every card, so the hand owns the central area outright — a hand
     * squeezed beside the hero planet was the reported broken intermediate
     * state, and that zone no longer exists.
     */
    handSlotSelector(): string {
      return this.handStepHosted ? '[data-embed-slot="colonies-hand"]' : '';
    },
    /** The discard cinematic's tray is standing in our seat right now. */
    trayStanding(): boolean {
      return cardDiscardState.trayVisible && cardDiscardColonyBonus() !== undefined;
    },
    /** The seat stands through the pick, the flight and as the receipt. */
    discardSeatLive(): boolean {
      return this.handStepHosted || cardDiscardColonyBonus() !== undefined ||
        (this.revealEmbedActive && this.resolutionUi.discarded > 0);
    },
    /**
     * THE RESOLUTION IS SET ASIDE — its whole chain (colonies ⊃ hand) lives in
     * the PARK, and THIS mount is a lateral browse visit the player made from
     * the wheel. The visit must not adopt the parked flow's presentation: the
     * claim, the discard-stage yield and the resolution crumb all belong to
     * the parked chain (its way back is the board-home restore card). Without
     * this gate the visit rendered the parked claim's crumb «ПЛУТОН › ДОБОР
     * КАРТ» over a yielded (empty) browse — the reported blank screen.
     */
    resolutionParked(): boolean {
      return workspaceFrameParked('colonies');
    },
    // ── The embedded-outcome zone (the Pluto payout reveal) ────────────────
    /** The claim is ours — the zone must stand (rendered from SUBMIT time).
     *  OURS means the LIVE chain's: a parked resolution keeps its claim, and
     *  a browse visit beside it must not stand the zone up (see above). */
    revealEmbedActive(): boolean {
      return this.outcomeState.host === 'colonies' && !this.resolutionParked;
    },
    /** The reveal is genuinely ON SCREEN inside the zone — the grid yields. */
    revealEmbedPresenting(): boolean {
      return this.revealEmbedActive && this.outcomeState.stage === 'presenting';
    },
    /**
     * The FOCUS STAGE hosts the follow-up while it stands — this is the
     * TELEPORT TARGET's existence, and nothing else. It must be true from
     * SUBMIT time (a teleport whose target does not exist yet drops its
     * content), which is precisely why it may not also mean «the follow-up is
     * on screen»: an owned-but-empty zone that paints itself is the empty
     * dimmed box a colony with no payout used to stand.
     */
    focusOutcomeZone(): boolean {
      return this.revealEmbedActive && this.focusState.open;
    },
    /**
     * THE ONE SLOT SELECTOR. Two elements can host the follow-up — the focus
     * stage's own zone (while the player is inside a colony) and the
     * section's zone (after the stage folded, e.g. a payout that returns from
     * a hand discard). Exactly ONE writer decides which, so the two can never
     * both claim the teleport and drop its content.
     *
     * DURING THE FULL-STAGE DISCARD the selector is EMPTY on purpose: the
     * next cycle's batch can ride the very response that answered the
     * discard, and presenting it while the hand still owns the room would
     * stack two scenes. An empty slot HOLDS the claimed reveal (render
     * nowhere — embed rule 4's provably-transient gap); the focus restore
     * republishes and the batch opens on the big stage.
     */
    outcomeSlotSelector(): string {
      if (!this.revealEmbedActive || this.resolutionUi.discardStage) {
        return '';
      }
      return this.focusState.open ?
        '[data-embed-slot="colonies-focus-reveal"]' :
        '[data-embed-slot="colonies-reveal"]';
    },
    // ── The focus stage's inputs ───────────────────────────────────────────
    focusColonyModel(): ColonyModel | undefined {
      if (this.focusState.colonyName === '') {
        return undefined;
      }
      return this.colonies.find((c) => c.name === this.focusState.colonyName);
    },
    focusTradeable(): boolean {
      const model = this.focusColonyModel;
      return this.pick === undefined && model !== undefined && this.tradeable.includes(model.name);
    },
    /** The focused intent's action is genuinely offerable (server truth):
     *  trade → the trade window names this colony; build/pick → the server's
     *  SelectColony accepts it. Inspect never acts. */
    focusActionAvailable(): boolean {
      const model = this.focusColonyModel;
      if (model === undefined) {
        return false;
      }
      if (this.focusState.intent === 'trade') {
        return this.focusTradeable;
      }
      if (this.focusState.intent === 'build' || this.focusState.intent === 'pick') {
        return this.pick !== undefined && this.pick.selectable.includes(model.name);
      }
      return false;
    },
    focusBlockReason(): string {
      if (this.focusActionAvailable) {
        return '';
      }
      const model = this.focusColonyModel;
      if (model === undefined) {
        return '';
      }
      if (this.pick !== undefined) {
        // A pick refused THIS colony: the server's own reason.
        if (this.focusState.intent === 'build' || this.focusState.intent === 'pick') {
          return this.pickReasonFor(model.name);
        }
        // Mid-pick the trade window simply is not open — the stage's verdict
        // states that plainly rather than inventing a colony-intrinsic fault.
        return 'Trade unavailable';
      }
      return this.reasonFor(model);
    },
    /**
     * The stage verdict's REGISTER. A trade blocked only by the turn is legal in
     * every rule sense — it wears «НЕ СЕЙЧАС», not the red ✕ that says the
     * colony refused the player. Read from the shared blocker model, never from
     * the reason's text.
     */
    focusBlockTone(): 'warning' | 'danger' {
      if (this.focusActionAvailable || this.pick !== undefined || this.focusColonyModel === undefined) {
        return 'danger';
      }
      return this.blockerFor(this.focusColonyModel)?.tone ?? 'danger';
    },
    // ── Focused-colony compact rail (mirrors ConsoleColonyTile's reward/bonus
    //    logic so the readout can never disagree with the tile). ──
    focusedMeta(): ColonyMetadata | undefined {
      const colony = this.colonies[this.index];
      return colony === undefined ? undefined : getColony(colony.name);
    },
    focusedPosition(): number {
      const colony = this.colonies[this.index];
      if (colony === undefined || this.focusedMeta === undefined) {
        return 0;
      }
      const offset = colony.isActive ? this.tradeOffset : 0;
      // The PRESENTED colony — mid-trade the committed track reset stays
      // frozen behind the transaction (same helper the tile reads), so the
      // rail readout can never leak the new position early.
      return effectiveTradePosition(presentedColonyModel(colony), this.focusedMeta, offset);
    },
    focusedTrackMax(): number {
      return this.focusedMeta === undefined ? 0 : this.focusedMeta.trade.quantity.length - 1;
    },
    focusedOffset(): number {
      const colony = this.colonies[this.index];
      if (colony === undefined) {
        return 0;
      }
      return Math.max(0, this.focusedPosition - Math.min(presentedColonyModel(colony).trackPosition, this.focusedTrackMax));
    },
    focusedReward(): TradeRewardAt {
      return rewardAtPosition(this.focusedMeta as ColonyMetadata, this.focusedPosition);
    },
    focusedTradeBenefit(): {type: ColonyMetadata['trade']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = (this.focusedMeta as ColonyMetadata).trade;
      const resource = Array.isArray(t.resource) ? t.resource[this.focusedPosition] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    focusedColonyBenefit(): {type: ColonyMetadata['colony']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = (this.focusedMeta as ColonyMetadata).colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    focusedBonusQty(): number {
      return this.focusedMeta === undefined ? 1 : (this.focusedMeta.colony.quantity ?? 1);
    },
    focusedTrackDisplay(): string {
      const colony = this.colonies[this.index];
      if (colony === undefined) {
        return '';
      }
      return `${Math.min(presentedColonyModel(colony).trackPosition, this.focusedTrackMax) + 1}/${this.focusedTrackMax + 1}`;
    },
    focusedStatus(): ConsoleColonyTileStatus {
      const colony = this.colonies[this.index];
      return colony === undefined ? {kind: 'none', text: ''} : this.tileStatus(colony);
    },
    /**
     * THE ONE POSITIVE FACT the rail's blocked arm stands on: this colony has
     * a real, named blocker. `tileStatus` produces exactly two such kinds
     * (`blocked` / `inactive`) and both carry their text by construction —
     * `none` ("nothing to report") and `ok` (a live transaction beat) are not
     * blockers and must never route here. Reading it as `kind !== 'ok'`
     * silently made every ordinary browse frame "blocked", which is how a
     * colony the server was actively offering announced «Торговля
     * недоступна» while the player was choosing it.
     */
    railBlocked(): boolean {
      return this.focusedStatus.kind === 'blocked' || this.focusedStatus.kind === 'inactive';
    },
    /** Settlement OWNERS on the focused colony — the recipients of the colony
     *  bonus when anyone trades here (empty ⇒ the bonus goes to no one). */
    focusedOwners(): ReadonlyArray<Color> {
      return this.colonies[this.index]?.colonies ?? [];
    },
    /** Which rail the compact readout shows: a SelectColony pick titled
     *  'Build' grants a settlement + placement bonus (NOT trade); other picks
     *  are identity-only; no pick ⇒ the trade rail. */
    railMode(): 'trade' | 'build' | 'select' {
      if (this.pick === undefined) {
        return 'trade';
      }
      return this.pick.buttonLabel === 'Build' ? 'build' : 'select';
    },
    /** The slot a new settlement lands in (next empty build slot, ≤ 2). */
    focusedBuildSlot(): number {
      return Math.min(2, this.focusedOwners.length);
    },
    focusedBuildBenefit(): {type: ColonyMetadata['build']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const b = (this.focusedMeta as ColonyMetadata).build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    focusedBuildQty(): number {
      return this.focusedMeta === undefined ? 0 : (this.focusedMeta.build.quantity[this.focusedBuildSlot] ?? 0);
    },
    /** A card-resource TRADE reward with no card to hold it ⇒ it is lost. */
    focusedTradeLost(): boolean {
      return this.focusedMeta !== undefined && this.benefitResourceLost(this.focusedMeta.trade.type);
    },
    /** A card-resource BUILD (placement) bonus with no card to hold it ⇒ lost
     *  (the placement bonus is a card resource — e.g. Miranda's animals). */
    focusedBuildLost(): boolean {
      return this.focusedMeta !== undefined && this.benefitResourceLost(this.focusedMeta.build.type);
    },
  },
  watch: {
    index() {
      void this.$nextTick(() => this.scrollSelectedIntoView());
    },
    /**
     * HAND THE CRUMB UP. Embedded, this section draws no header of its own —
     * the host does, and the host's subject slot is already spent on the card
     * that opened us. So the colony and its stage travel up as the FRAME's own
     * subject + stage and the host folds them into one tail («ГАНИМЕД ·
     * ТОРГОВЛЯ»). Publishing the pair rather than a finished phrase keeps the
     * grammar in the header, where it belongs, and keeps both parts i18n keys.
     */
    embeddedCrumb: {
      immediate: true,
      handler(crumb: {embedded: boolean, subject: string, stage: string}) {
        if (!crumb.embedded) {
          return;
        }
        setWorkspaceFrameSubject('colonies', crumb.subject);
        setWorkspaceFrameStage('colonies', crumb.stage !== '' ? crumb.stage : 'Colony selection');
      },
    },
    layout() {
      this.scheduleFit();
    },
    colonies() {
      this.scheduleFit();
    },
    // The focus stage's server preview follows the descended-into colony.
    'focusState.colonyName'(name: ColonyName | '') {
      this.focusPreview = undefined;
      if (name !== '') {
        void this.loadFocusPreview(name);
      }
    },
    // …and follows the GAME STATE: a response that moved the world (an undo,
    // a mid-turn effect) re-pulls the preview for the SAME colony, so the
    // stage's candidate lists — and through them every captured pick — are
    // re-validated against current truth instead of a snapshot. Quiet while
    // the trade is resolving: the commit-boundary freeze owns that window,
    // and the transaction's own conclusion folds the stage anyway.
    viewVersion() {
      const name = this.focusState.colonyName;
      if (name !== '' && !colonyTradeState.active) {
        void this.loadFocusPreview(name);
      }
    },
    // OWNERSHIP ≠ READINESS (embed rule 4): publish the zone's selector only
    // once the element genuinely stands (`flush: 'post'`), retract before it
    // unmounts. The teleport's target must exist before Vue resolves it.
    outcomeSlotSelector: {
      flush: 'post',
      handler(selector: string): void {
        setWorkspaceOutcomeSlot(selector);
      },
    },
    // The HAND STEP's teleport target — same law, the STACK channel: the
    // frame below publishes the zone the frame above teleports into.
    handSlotSelector: {
      flush: 'post',
      handler(selector: string): void {
        setWorkspaceFrameSlot('colonies', selector);
      },
    },
    // THE RESOLUTION'S FALLING EDGE auto-folds the focus stage back to the
    // overview: the trade (fleet → waves → payout → glide → settle) or the
    // build (cube seated, grant delivered) completed ON the stage — the fold
    // is the completion's own signal, never a timer. The updated overview
    // (new track position, the seated cube, the docked fleet) is what the
    // fold reveals. Embedded flows fold through their own latch finalize.
    'tradeState.active'(active: boolean, was: boolean): void {
      if (!active && was && this.focusState.open && !this.tradeFleetState.active) {
        this.completeFlow();
      }
    },
    'buildState.active'(active: boolean, was: boolean): void {
      if (!active && was && this.focusState.open) {
        this.completeFlow();
      }
    },
    /** A claimed FOLLOW-UP owned the screen; it has now released. THAT is the
     *  moment the whole action is over, so the completion runs here instead
     *  of at the transaction's edge (which fired while the payout was still
     *  standing). */
    'outcomeState.sourceCard'(now: string, was: string): void {
      if (now === '' && was !== '' && this.focusState.open &&
          !this.tradeState.active && !this.buildState.active) {
        this.completeFlow();
      }
    },
    /** …and the same for the PRESENTED CARD scene: its release is the last
     *  physical beat of a card-resource payout, so the completion belongs to
     *  its falling edge exactly as it belongs to the claim's. */
    'resolutionUi.cardSceneLive'(now: boolean, was: boolean): void {
      if (!now && was && this.focusState.open &&
          !this.tradeState.active && !this.buildState.active) {
        this.completeFlow();
      }
    },
  },
  methods: {
    /** A card-resource benefit (`ADD_RESOURCES_TO_CARD` / `…_VENUS_CARD`) is
     *  LOST when the viewer owns no card able to hold that resource — shared
     *  by the trade + build rails (and mirrored at the focus stage). */
    benefitResourceLost(type: ColonyBenefit): boolean {
      const meta = this.focusedMeta;
      if (meta === undefined || meta.cardResource === undefined) {
        return false;
      }
      if (type !== ColonyBenefit.ADD_RESOURCES_TO_CARD && type !== ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD) {
        return false;
      }
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      const tableau = viewer?.tableau ?? [];
      return !tableau.some((card) => getCard(card.name)?.resourceType === meta.cardResource);
    },
    /**
     * Size the tiles to FILL the free area for the count layout: the largest
     * uniform scale at which `cols × rows` base-size tiles (+ gaps + padding)
     * fit the scroll box, clamped to sane bounds. Applied as a `zoom` on every
     * tile (so the planet / docked fleet / fonts all grow together) plus a grid
     * max-width so the intended columns hold. Pure measure → no-op under JSDOM
     * (rects are 0), so the CSS base size is the graceful fallback.
     */
    /**
     * THE HOST'S SOURCE SEAT, RESERVED ONCE FOR THIS WHOLE SURFACE.
     *
     * A step hosted inside a workspace can stand BESIDE the card that caused it
     * («ПОВТОР ДЕЙСТВИЯ · Летающая платформа» on the Hydronetwork's stage 7).
     * The seat is `position: absolute` on purpose — context must not shrink the
     * thing it is context for — which means a guest laid out against the raw
     * zone simply renders UNDER it: the repeated trade drew its colony grid,
     * and then its focus stage's whole left column, beneath the card that was
     * explaining why it was being asked at all.
     *
     * Reserved as a PADDING on this surface's root, not inside one of its
     * layouts: the colonies have two (the grid and the focus stage) and both
     * were wrong. One reserve at the root is a property of the SURFACE, so a
     * third layout inherits it, and the grid fit needs no arithmetic — it reads
     * `clientWidth`, which the padding has already narrowed.
     *
     * BOTH sides, because what it contains is centred: that is what makes the
     * overlap inexpressible rather than merely unlikely, at any focus scale.
     * The measurement is the shared one (`sourceSeatReservePx`, off the seat's
     * real box) — never a second copy of the seat's own CSS width.
     */
    fit(): void {
      const scroll = this.$refs.scroll as HTMLElement | null | undefined;
      const root = this.$el as HTMLElement | null | undefined;
      const count = this.colonies.length;
      if (scroll === undefined || scroll === null || root === undefined || root === null || count === 0) {
        return;
      }
      // ── THE HOST'S SOURCE SEAT IS NOT FREE WIDTH ────────────────────────
      // A step hosted inside a workspace can stand BESIDE the card that caused
      // it («ПОВТОР ДЕЙСТВИЯ · Летающая платформа» on the Hydronetwork's stage
      // 7). The seat is `position: absolute` on purpose — context must not
      // shrink the thing it is context for — so a guest laid out against the
      // raw zone renders UNDER it: the repeated trade drew its colony grid, and
      // then its focus stage's whole left column, beneath the very card that
      // was explaining why it was being asked.
      //
      // Reserved as a PADDING on this surface's ROOT, not inside one of its
      // layouts: the colonies have two (the grid and the focus stage) and both
      // were wrong. At the root it is a property of the SURFACE, so a third
      // layout inherits it and the arithmetic below needs no term — the
      // `clientWidth` it reads has already been narrowed. BOTH sides, because
      // what it holds is centred: that is what makes the overlap inexpressible
      // rather than merely unlikely, at any focus scale. The measurement is the
      // SHARED one (off the seat's real box), never a copy of its CSS width.
      const seat = this.embedded ? Math.round(sourceSeatReservePx(conUiScale())) : 0;
      if (seat !== this.seatReservePx) {
        this.seatReservePx = seat;
        // The padding it just published is what the room below is measured
        // against — solve on the next frame, against the narrowed box.
        this.scheduleFit();
        return;
      }
      const availW = scroll.clientWidth;
      const availH = scroll.clientHeight;
      if (availW <= 0 || availH <= 0) {
        return; // not laid out yet / JSDOM / parked behind the focus stage
      }
      const cs = getComputedStyle(root);
      // The base-size vars are rem-authored (TV logical space) — resolve
      // them properly; a bare parseFloat would read "18.3rem" as 18.3px
      // and collapse the whole grid fit.
      const baseW = cssLengthPx(cs.getPropertyValue('--coltile-base-w'), 366);
      const baseH = cssLengthPx(cs.getPropertyValue('--coltile-base-h'), 220);
      const cols = Math.min(Math.max(1, colonyGridCols(this.layout, count)), count);
      const rows = Math.max(1, Math.ceil(count / cols));
      // The CSS grid gaps/padding are rem-authored (they scale with the TV
      // profile); these constants mirror them, so they must scale too. The
      // tile scale itself stays relative — baseW/baseH come from the CSS
      // vars via getComputedStyle, already in scaled px.
      const s = conUiScale();
      const slack = FIT_SLACK * s;
      // (The host's SOURCE SEAT is already out of `availW`: it is reserved as
      //  a padding on this surface's own root — see `seatReserveStyle` — so
      //  `scroll.clientWidth` is the room that is really free. One reserve,
      //  read by the grid and by the focus stage alike.)
      const scaleW = (availW - GRID_PAD_X * s - (cols - 1) * COL_GAP * s - slack) / (cols * baseW);
      const scaleH = (availH - GRID_PAD_Y * s - (rows - 1) * ROW_GAP * s) / (rows * baseH);
      const scale = Math.max(MIN_TILE_SCALE, Math.min(MAX_TILE_SCALE, Math.min(scaleW, scaleH)));
      this.tileScale = Math.round(scale * 1000) / 1000;
      // The cap gets the SAME slack on top — zoom-rounded tiles need the
      // room, and a whole extra column would need ~baseW, so the planned
      // column count still holds.
      this.gridMaxW = Math.ceil(cols * baseW * this.tileScale + (cols - 1) * COL_GAP * s + GRID_PAD_X * s + slack);
    },
    scheduleFit(): void {
      if (this.fitRaf !== undefined || typeof window === 'undefined') {
        return;
      }
      this.fitRaf = window.requestAnimationFrame(() => {
        this.fitRaf = undefined;
        this.fit();
      });
    },
    /**
     * How many of a player's fleets are truly FREE (in their supply, not
     * deployed). A fleet PHYSICALLY parked on a colony (its `visitor`) is OUT —
     * even when `usedTradeFleets` doesn't reflect it: the Automa sets colony
     * visitors DIRECTLY (AutomaColonies) without touching usedTradeFleets, so
     * `freeTradeFleets` alone showed a deployed bot fleet as a free ship (the
     * board's fleet-on-colony AND a home platform — the double-count bug). Take
     * the MORE restrictive of "used-trade-fleets" and "physically-deployed".
     */
    freeFleetsFor(player: PublicPlayerModel): number {
      const deployed = this.colonies.filter((c) => c.visitor === player.color).length;
      return Math.min(freeTradeFleets(player), Math.max(0, player.fleetSize - deployed));
    },
    isPickable(name: string): boolean {
      return this.pick !== undefined && this.pick.selectable.includes(name);
    },
    pickReasonFor(name: string): string {
      const reason = this.pick?.reasons[name];
      return reason !== undefined && reason !== '' ? reason : translateText('Unavailable right now');
    },
    /** The shared smart ladder's verdict for `colony` (undefined = tradeable). */
    tradeReasonFor(colony: ColonyModel): ColonyTradeReason | undefined {
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      return colonyTradeReason({
        colony,
        tradeable: this.tradeable,
        viewerColor: this.viewerColor ?? ('' as Color),
        availableFleets: viewer !== undefined ? this.freeFleetsFor(viewer) : 0,
        myTurn: this.myTurn,
        awaitingInput: this.awaitingInput,
        resolveName: (color) => {
          const p = this.players.find((x) => x.color === color);
          return p !== undefined ? participantDisplayName(p) : '';
        },
      });
    },
    /** Its structured semantics (undefined = nothing blocks the trade). */
    blockerFor(colony: ColonyModel): AvailabilityBlocker | undefined {
      return this.tradeReasonFor(colony)?.blocker;
    },
    /** The full «why can't I trade here» reason for `colony` (translated). */
    reasonFor(colony: ColonyModel): string {
      const reason = this.tradeReasonFor(colony);
      if (reason === undefined) {
        return this.tradeBlockReason;
      }
      return reason.params !== undefined ?
        translateTextWithParams(reason.key, reason.params.map(String)) :
        translateText(reason.key);
    },
    tileStatus(colony: ColonyModel): ConsoleColonyTileStatus {
      // The trade transaction narrates its own beats on the traded tile —
      // a short unobtrusive caption in the EXISTING status line (never a
      // toast): reward → bonus → the colony update.
      const beat = colonyTradeTileStatusText(colony.name);
      if (beat !== undefined) {
        return {kind: 'ok', text: beat};
      }
      if (this.pick !== undefined) {
        // A pickable colony is the NORMAL case in a pick — the focus ring and
        // the command bar already say so. Only a refusal earns a line.
        if (this.isPickable(colony.name)) {
          return {kind: 'none', text: ''};
        }
        return {kind: 'blocked', text: this.pickReasonFor(colony.name)};
      }
      // ONE smart source of truth for «why can't I trade here» — shared with the
      // shell's trade-attempt notice (colonyTradeReason) so a tile and the notice
      // over it can never disagree. On the TILE only COLONY-INTRINSIC blockers
      // (not built / a fleet already docked) get a hard ✕; a turn/fleet/afford
      // block stays CALM (its reason surfaces on the A-press notice) — except a
      // window open for OTHER colonies, which keeps the explicit «Trade unavailable».
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      const reason = colonyTradeReason({
        colony,
        tradeable: this.tradeable,
        viewerColor: this.viewerColor ?? ('' as Color),
        availableFleets: viewer !== undefined ? this.freeFleetsFor(viewer) : 0,
        // Non-intrinsic reasons are DISCARDED on the tile (mapped by tradeable
        // length below), so the turn scalars don't affect the tile's output.
        myTurn: false,
        awaitingInput: false,
        resolveName: (color) => {
          const p = this.players.find((x) => x.color === color);
          return p !== undefined ? participantDisplayName(p) : '';
        },
      });
      if (reason === undefined) {
        // NORMAL. Five tiles each announcing «Доступна торговля» is five times
        // the same non-information; the exception is what the eye needs.
        return {kind: 'none', text: ''};
      }
      if (reason.intrinsic) {
        // The tile keeps the COMPACT «Not active yet»; the fuller reason.key
        // ('This colony is not active yet') is for the notice/inspect.
        if (!colony.isActive) {
          return {kind: 'inactive', text: translateText('Not active yet')};
        }
        const text = reason.params !== undefined ?
          translateTextWithParams(reason.key, reason.params.map(String)) :
          translateText(reason.key);
        return {kind: 'blocked', text};
      }
      // A window open for other colonies → name it; otherwise stay calm.
      if (this.tradeable.length > 0) {
        return {kind: 'blocked', text: translateText('Trade unavailable')};
      }
      return {kind: 'none', text: ''};
    },
    scrollSelectedIntoView(): void {
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      el?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'smooth'});
    },
    // ── The COLONY FOCUS descend (browse → focus and back) ─────────────────
    /**
     * Descend into the FOCUSED colony (A = the act intent — trade / build /
     * pick, X = inspect — ONE stage either way; nothing irreversible happens
     * on the overview any more). Arms the descend origins SYNCHRONOUSLY at
     * the press: the tile's rect (the unfold source) plus the THREE carried
     * identities' rects — the planet medallion, the compact track strip and
     * the build-slot row — so each physically continues into its expanded
     * counterpart (never a new unrelated detail page).
     */
    enterFocus(intent: ColonyFocusIntent): void {
      const colony = this.colonies[this.index];
      if (colony === undefined || this.focusState.open) {
        return;
      }
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      const tile = el?.querySelector<HTMLElement>('.con-coltile');
      const planet = tile?.querySelector<HTMLElement>('.con-coltile__planet-berth');
      const track = tile?.querySelector<HTMLElement>('.con-coltile__track');
      const slots = tile?.querySelector<HTMLElement>('.con-coltile__build');
      const rectOf = (node: HTMLElement | null | undefined) => {
        const r = node?.getBoundingClientRect();
        return r === undefined || r.width < 10 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      armColonyFocusOrigin(rectOf(tile), rectOf(planet), rectOf(track), rectOf(slots));
      openColonyFocus(colony.name as ColonyName, intent);
    },
    /** Fold back to the browse surface (B / cancel) — PRE-commit only. */
    closeFocus(): void {
      closeColonyFocus();
    },
    /**
     * THE ACTION IS OVER. Give the scene a short breathing beat — the token
     * has just docked, the guard has just latched, the marker has just landed,
     * and folding on the same frame means the player never sees what changed —
     * then hand the screen FORWARD. Never back through the configuration
     * surface: a committed action does not travel backwards (the shell picks
     * the destination — the next unresolved effect, or the field).
     *
     * A live outcome CLAIM means a follow-up owns the screen; the completion
     * then belongs to the claim's own falling edge, not to this one.
     */
    completeFlow(): void {
      // A REWARD STILL ARRIVING ON A CARD IS THE ACT STILL HAPPENING. The
      // build's own transaction ends when the cube seats — its floaters are
      // still in the air — so routing home here tore the receiving card off
      // the screen mid-flight. The scene publishes its presence
      // (`cardSceneLive`, released by its own landing + read beat, with its
      // own bounded net), and the completion re-runs on that falling edge.
      if (this.completeTimer !== undefined || workspaceOutcomeClaimed() || this.resolutionUi.cardSceneLive) {
        return;
      }
      this.completeTimer = window.setTimeout(() => {
        this.completeTimer = undefined;
        if (workspaceOutcomeClaimed() || !this.focusState.open || this.resolutionUi.cardSceneLive) {
          return;
        }
        closeColonyFocus();
        this.$emit('flow-complete');
      }, motionMs(COMPLETION_SETTLE_MS));
    },
    /** The stage confirmed the trade — hand the payload UP. The stage STAYS:
     *  the fleet, the reward waves, the Pluto reveal and the track glide all
     *  resolve on the stage's own live anchors (iteration 2), and the
     *  transaction's falling edge auto-folds back to the overview. */
    onFocusConfirm(payload: ColonyTradeConfirmPayload): void {
      this.$emit('trade-confirm', payload);
    },
    /** The shell routes the pad here while the focus stage is open. */
    handleFocusIntent(intent: GamepadIntent): void {
      const stage = this.$refs.focusStage as InstanceType<typeof ConsoleColonyFocusStage> | undefined;
      stage?.handleIntent(intent);
    },
    /** The shell ACCEPTED a stage confirm — pin the stage's presentation
     *  across the commit boundary (see the stage's `holdPresentation`). */
    holdFocusStage(): void {
      const stage = this.$refs.focusStage as InstanceType<typeof ConsoleColonyFocusStage> | undefined;
      stage?.holdPresentation();
    },
    async loadFocusPreview(name: ColonyName): Promise<void> {
      if (this.playerId === '') {
        return;
      }
      const preview = await fetchColonyTradePreview(this.playerId, name);
      if (preview !== undefined && preview.colonyName === this.focusState.colonyName) {
        this.focusPreview = preview;
      }
    },
    // ── The descend transition hooks (consoleColonyFocusMotion) ────────────
    onFocusEnter(el: Element, done: () => void): void {
      colonyFocusEnterHook(el, done);
    },
    onFocusLeave(el: Element, done: () => void): void {
      colonyFocusLeaveHook(el, done);
    },
    onFocusEnterCancelled(el: Element): void {
      colonyFocusEnterCancelledHook(el);
    },
    onFocusLeaveCancelled(el: Element): void {
      colonyFocusLeaveCancelledHook(el);
    },
  },
  mounted() {
    this.scrollSelectedIntoView();
    this.fit();
    // AN EMBEDDED STEP OWNS ITS OWN ARRIVAL. Standalone, the band-surface
    // director plays the workspace switch; as a STEP that director passes
    // through by contract (no `data-motion-surface`), so this speaks the
    // workspace-descend phrase one level in instead — and it runs AFTER `fit`,
    // so the grid is already solved and no tile can resize under the opening.
    if (this.embedded) {
      playColonyStepEntry(this.$el as HTMLElement);
    }
    // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
    const scroll = this.$refs.scroll as HTMLElement | undefined;
    if (scroll !== undefined) {
      this.stopResizeObs = useResizeObserver(scroll, () => this.scheduleFit()).stop;
    }
    this.stopResize = useEventListener(window, 'resize', this.scheduleFit);
    // Embed rule 4, second half: a REMOUNT under a live claim (the Pluto
    // sequence returning home from the hand discard) re-creates the zone
    // while the claim value never changes — the watcher has nothing to fire
    // on, so the slot is published from here too.
    if (this.revealEmbedActive) {
      void this.$nextTick(() => {
        if (this.revealEmbedActive) {
          setWorkspaceOutcomeSlot(this.outcomeSlotSelector);
        }
      });
    }
    // Same for the hand step's frame slot (a restore mid-discard).
    if (this.handStepHosted) {
      void this.$nextTick(() => {
        if (this.handStepHosted) {
          setWorkspaceFrameSlot('colonies', this.handSlotSelector);
        }
      });
    }
  },
  beforeUnmount() {
    this.stopResizeObs?.();
    this.stopResize?.();
    if (this.completeTimer !== undefined) {
      window.clearTimeout(this.completeTimer);
      this.completeTimer = undefined;
    }
    if (this.fitRaf !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.fitRaf);
    }
    // Retract OUR zone before it unmounts (a stale selector teleports the
    // next batch into a detached node — embed rule 4). Checked on the RAW
    // claim, not `revealEmbedActive`: a COLLAPSE parks the frames BEFORE this
    // unmount runs, so the parked-gated computed is already false here — and
    // the slot this very mount published would survive as a selector into a
    // detached node.
    if (this.outcomeState.host === 'colonies') {
      setWorkspaceOutcomeSlot('');
    }
    // …and the hand step's frame slot, for the same reason.
    setWorkspaceFrameSlot('colonies', '');
    // Leaving the section closes the flow: reopening always lands on browse.
    closeColonyFocus();
    resetColonyFocusMotion();
  },
});
</script>
