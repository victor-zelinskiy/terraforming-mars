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
       :style="{'--coltile-scale': String(tileScale)}">
    <div class="con-colonies__frame">
      <!-- ── THE WORKSPACE HEADER — the shared ConsoleWsHead: root «КОЛОНИИ»
           + the fleet dock as the aux browse layer; descending into a colony
           grows the crumb tail «› <колония> › ТОРГОВЛЯ». When embedded, the
           host draws the crumb (rule 5) and only the fleet TOOLBAR remains. -->
      <component :is="embedded ? 'div' : 'ConsoleWsHead'"
                 :class="embedded ? ['con-colonies__toolbar', {'con-colonies__toolbar--held': focusState.open}] : 'con-colonies__head'"
                 v-bind="embedded ? {} : {
                   root: 'Colonies',
                   emblem: 'colonies',
                   wheelAnchor: 'trading',
                   subject: crumbSubject,
                   stage: crumbStage,
                   committed: crumbCommitted,
                 }">
        <!-- The aux browse layer: mode chip (pick) + EVERY player's trade
             fleets. Game state, not browse chrome — but the shared header
             still crossfades it away past the descent (the stage's own hero
             column carries the fleet facts then). -->
        <span v-if="pick !== undefined" class="con-colonies__mode-chip">{{ $t(pick.buttonLabel) }}</span>
        <!-- Fleet DOCK for ALL players (viewer first): every fleet is a physical
             SVG ship on its OWN launch pad. A free fleet berths (ship on the
             pad); an out/spent fleet leaves its pad EMPTY (the slot never
             collapses → no reflow, no gap). The viewer's launching fleet lifts
             off its OWN pad (`data-fleet-launch`) toward the colony. A very
             large fleet (>6, never in-game) degrades to a compact numeric. -->
        <div class="con-colonies__fleetbar" :aria-label="$t('Free trade fleets')">
          <span v-for="chip in fleetChips" :key="chip.color"
                class="con-colonies__fleetchip"
                :class="{
                  'con-colonies__fleetchip--me': chip.me,
                  'con-colonies__fleetchip--none': chip.free === 0,
                }">
            <span class="con-colonies__fleetchip-name">{{ chip.name }}</span>
            <span v-if="chip.total <= 6" class="con-colonies__fleetdock"
                  :class="['fleet-hue--' + chip.color, {'con-fleet-launching': tradeFleetState.active && chip.me}]"
                  :aria-label="chip.free + '/' + chip.total">
              <span v-for="n in chip.total" :key="n"
                    class="con-colonies__fleetberth"
                    :class="{'con-colonies__fleetberth--empty': n > chip.free}">
                <!-- The ship SLOT is always laid out (even when its ship is
                     hidden mid-launch) so it stays a stable launch anchor. -->
                <span class="con-colonies__fleetship"
                      :data-fleet-launch="isLaunchAnchor(chip, n) ? '' : undefined">
                  <ColonyFleetIcon v-if="n <= chip.free && !isLaunchingSlot(chip, n)"
                                   :color="chip.color" :free="true" />
                </span>
                <ColonyFleetPad :color="chip.color" :occupied="n <= chip.free" />
              </span>
            </span>
            <b v-else class="con-colonies__fleetchip-count">
              <ColonyFleetIcon :color="chip.color" :free="chip.free > 0" />{{ chip.free }}/{{ chip.total }}
            </b>
          </span>
        </div>
      </component>

      <!-- ── The stage wrap: the BROWSE layer (the colony surface — islands
           over open space) and the COLONY FOCUS stage occupy the same region.
           Descending recomposes the frame in place: the browse DOM is only
           parked (selection / scroll / fit survive by construction). ── -->
      <div class="con-colonies__stagewrap">
        <div class="con-colonies__browse"
             :class="{
               'con-colonies__browse--parked': focusState.open,
               'con-colonies__browse--yield': revealEmbedPresenting,
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

          <!-- COMPACT STATUS RAIL — one line, fixed height, the workspace
               family's language: what will happen if I confirm HERE. Never
               repeats what the focused tile already says (its name, its
               availability dot) — the rail carries the CONSEQUENCE. -->
          <footer v-if="focusedMeta !== undefined" class="con-colonies__rail">
            <!-- ── BUILD pick: what BUILDING here grants. ── -->
            <template v-if="railMode === 'build'">
              <span class="con-colonies__rail-cell">
                <PlayerCube v-if="viewerColor !== undefined" class="con-colonies__rail-cube" :color="viewerColor" :size="16" />
                <span class="con-colonies__rail-label">{{ $t('You build') }}</span>
              </span>
              <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
              <span class="con-colonies__rail-cell">
                <template v-if="focusedBuildQty > 0">
                  <b v-if="focusedBuildQty > 1">{{ focusedBuildQty }}</b>
                  <BenefitGlyph :benefit="focusedBuildBenefit" :idx="focusedBuildSlot" :cardResource="focusedMeta.cardResource" />
                </template>
                <span v-else class="con-colonies__rail-muted">{{ $t('No placement bonus') }}</span>
              </span>
              <span v-if="focusedBuildLost" class="con-colonies__rail-warn">⚠ {{ $t('Resource will be lost — no card') }}</span>
            </template>

            <!-- ── SELECT pick (setup remove / add-tile): identity only. ── -->
            <template v-else-if="railMode === 'select'">
              <span class="con-colonies__rail-note">{{ $t(pick ? pick.buttonLabel : '') }}</span>
            </template>

            <!-- ── TRADE: send a fleet → income at the effective position ·
                 the owners' bonus. ── -->
            <template v-else>
              <span class="con-colonies__rail-cell">
                <ColonyFleetIcon v-if="viewerColor !== undefined" :color="viewerColor" :free="true" />
                <span class="con-colonies__rail-track">{{ focusedTrackDisplay }}</span>
              </span>
              <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
              <span class="con-colonies__rail-cell con-colonies__rail-cell--get">
                <b v-if="focusedReward.quantity > 1">{{ focusedReward.quantity }}</b>
                <BenefitGlyph :benefit="focusedTradeBenefit" :idx="focusedPosition" :cardResource="focusedMeta.cardResource" />
                <span v-if="focusedOffset > 0" class="con-colonies__rail-offset">+{{ focusedOffset }}</span>
              </span>
              <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
              <span class="con-colonies__rail-cell">
                <span class="con-colonies__rail-label">{{ $t('Colony bonus') }}</span>
                <template v-if="focusedOwners.length > 0">
                  <b v-if="focusedBonusQty > 1">{{ focusedBonusQty }}</b>
                  <BenefitGlyph :benefit="focusedColonyBenefit" :idx="0" :cardResource="focusedMeta.cardResource" />
                  <span class="con-colonies__rail-owners">
                    <span v-for="c in focusedOwners" :key="c"
                          class="con-colonies__rail-owner" :class="{'con-colonies__rail-owner--me': c === viewerColor}">
                      <PlayerCube :color="c" :size="14" />
                    </span>
                  </span>
                </template>
                <span v-else class="con-colonies__rail-muted">{{ $t('No colony owners') }}</span>
              </span>
              <span v-if="focusedTradeLost" class="con-colonies__rail-warn">⚠ {{ $t('Resource will be lost — no card') }}</span>
            </template>

            <span class="con-colonies__rail-status" :class="'con-colonies__rail-status--' + focusedStatus.kind">
              {{ focusedStatus.text !== '' ? focusedStatus.text : $t('Trade available') }}
            </span>
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
        <div v-if="revealEmbedActive" class="con-colonies__embed" data-embed-slot="colonies-reveal"></div>

        <!-- ── THE COLONY FOCUS STAGE — the same frame, one level deeper.
             The descend hooks unfold it from the pressed tile's rect; the
             planet medallion is the carried subject. -->
        <transition :css="false"
                    @enter="onFocusEnter" @leave="onFocusLeave"
                    @enter-cancelled="onFocusEnterCancelled" @leave-cancelled="onFocusLeaveCancelled">
          <ConsoleColonyFocusStage v-if="focusState.open && focusColonyModel !== undefined"
                                   ref="focusStage"
                                   :colony="focusColonyModel"
                                   :tradeable="focusTradeable"
                                   :blockReason="focusBlockReason"
                                   :options="tradePaymentOptions"
                                   :disabledOptions="tradeDisabledPayments"
                                   :players="players"
                                   :preview="focusPreview"
                                   :thisPlayer="thisPlayer"
                                   :viewerColor="viewerColor"
                                   :tradeOffset="tradeOffset"
                                   @confirm="onFocusConfirm"
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
  colonyGridLayout, colonyGridCols, ColonyGridLayout,
  colonyFocusState, openColonyFocus, closeColonyFocus,
} from '@/client/console/consoleColoniesModel';
import {workspaceOutcomeState, setWorkspaceOutcomeSlot} from '@/client/console/consoleWorkspaceOutcome';
import {freeTradeFleets, effectiveTradePosition, rewardAtPosition, TradeRewardAt, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {fetchColonyTradePreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleColonyTile, {ConsoleColonyTileStatus} from '@/client/components/console/ConsoleColonyTile.vue';
import ConsoleColonyFocusStage from '@/client/components/console/ConsoleColonyFocusStage.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import ColonyFleetPad from '@/client/components/colonies/ColonyFleetPad.vue';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {colonyTradeTileStatusText, presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import {colonyTradeReason} from '@/client/console/colonyTradeReason';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {cssLengthPx} from '@/client/console/cssUnits';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {
  armColonyFocusOrigin,
  colonyFocusEnterHook,
  colonyFocusLeaveHook,
  colonyFocusEnterCancelledHook,
  colonyFocusLeaveCancelledHook,
  markColonyFocusConfirmLeave,
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

type FleetChip = {color: Color, name: string, free: number, total: number, me: boolean};

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

export default defineComponent({
  name: 'ConsoleColoniesSection',
  components: {ConsoleWsHead, ConsoleColonyTile, ConsoleColonyFocusStage, ColonyFleetIcon, ColonyFleetPad, BenefitGlyph, PlayerCube},
  props: {
    colonies: {type: Array as PropType<ReadonlyArray<ColonyModel>>, required: true},
    index: {type: Number, required: true},
    /** Server-tradeable colony names (empty when it's not the trade window). */
    tradeable: {type: Array as PropType<ReadonlyArray<string>>, required: true},
    /** Honest reason when trade is impossible right now ('' when tradeable). */
    tradeBlockReason: {type: String, default: ''},
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
    /**
     * A STEP of another workspace (rule 1 — host-agnostic): the shell chrome
     * (frame plate, ConsoleWsHead, `con-ws` marker) comes off; grid, fit,
     * d-pad, focus stage and every capture are untouched.
     */
    embedded: {type: Boolean, default: false},
  },
  emits: ['trade-confirm'],
  data() {
    return {
      /** The trade-launch controller — drives the launching-ship hide. */
      tradeFleetState,
      /** The workspace flow state (module-level — the shell reads it too). */
      focusState: colonyFocusState,
      /** The embedded-outcome claim (the Pluto reveal re-homes into us). */
      outcomeState: workspaceOutcomeState,
      /** The focus stage's server preview (fetched per focused colony). */
      focusPreview: undefined as ColonyTradePreviewModel | undefined,
      /** The fit-set zoom on every tile (grows them to fill the space). */
      tileScale: 1,
      /** The fit-set grid max-width so the layout's column count holds. */
      gridMaxW: 0,
      fitRaf: undefined as number | undefined,
      /** VueUse stop-handles (auto-managed listeners; no raw addEventListener). */
      stopResize: undefined as (() => void) | undefined,
      stopResizeObs: undefined as (() => void) | undefined,
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
    fleetChips(): Array<FleetChip> {
      const chips: Array<FleetChip> = this.players.map((player) => ({
        color: player.color,
        name: participantDisplayName(player),
        free: this.freeFleetsFor(player),
        total: player.fleetSize,
        me: player.color === this.viewerColor,
      }));
      return chips.sort((a, b) => Number(b.me) - Number(a.me));
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
      if (this.focusState.open) {
        return this.focusState.stage;
      }
      if (this.revealEmbedActive) {
        return this.outcomeState.phaseKey !== '' ? this.outcomeState.phaseKey : 'Card draw';
      }
      return '';
    },
    crumbCommitted(): boolean {
      return this.focusState.committing || this.tradeFleetState.active || this.revealEmbedActive;
    },
    // ── The embedded-outcome zone (the Pluto payout reveal) ────────────────
    /** The claim is ours — the zone must stand (rendered from SUBMIT time). */
    revealEmbedActive(): boolean {
      return this.outcomeState.host === 'colonies';
    },
    /** The reveal is genuinely ON SCREEN inside the zone — the grid yields. */
    revealEmbedPresenting(): boolean {
      return this.revealEmbedActive && this.outcomeState.stage === 'presenting';
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
    focusBlockReason(): string {
      if (this.focusTradeable) {
        return '';
      }
      const model = this.focusColonyModel;
      if (model === undefined) {
        return '';
      }
      if (this.pick !== undefined) {
        // Mid-pick the trade window simply is not open — the stage's verdict
        // states that plainly rather than inventing a colony-intrinsic fault.
        return 'Trade unavailable';
      }
      return this.reasonFor(model);
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
    // OWNERSHIP ≠ READINESS (embed rule 4): publish the zone's selector only
    // once the element genuinely stands (`flush: 'post'`), retract before it
    // unmounts. The teleport's target must exist before Vue resolves it.
    revealEmbedActive: {
      flush: 'post',
      handler(active: boolean): void {
        setWorkspaceOutcomeSlot(active ? '[data-embed-slot="colonies-reveal"]' : '');
      },
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
    fit(): void {
      const scroll = this.$refs.scroll as HTMLElement | null | undefined;
      const root = this.$el as HTMLElement | null | undefined;
      const count = this.colonies.length;
      if (scroll === undefined || scroll === null || root === undefined || root === null || count === 0) {
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
     * The viewer's LAUNCH berth — the last currently-free fleet slot (its ship
     * is what lifts off). `data-fleet-launch` marks its (always-laid-out) ship
     * slot so the flight proxy has a stable start rect even while the ship is
     * hidden mid-launch. Only the viewer's own fleet launches from here.
     */
    isLaunchAnchor(chip: FleetChip, n: number): boolean {
      return chip.me && chip.free > 0 && n === chip.free;
    },
    /**
     * The berth whose ship is CURRENTLY lifting off (hide it — the flight
     * proxy carries it). During the flight the server view is gated, so
     * `chip.free` is unchanged and `n === chip.free` is still the launch slot;
     * once the trade commits the slot is genuinely empty (no reflow — the
     * fixed `total` pads stay). Same slot as the launch anchor.
     */
    isLaunchingSlot(chip: FleetChip, n: number): boolean {
      return this.tradeFleetState.active && this.isLaunchAnchor(chip, n);
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
    /** The full «why can't I trade here» reason for `colony` (translated). */
    reasonFor(colony: ColonyModel): string {
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      const reason = colonyTradeReason({
        colony,
        tradeable: this.tradeable,
        viewerColor: this.viewerColor ?? ('' as Color),
        availableFleets: viewer !== undefined ? this.freeFleetsFor(viewer) : 0,
        myTurn: true,
        awaitingInput: true,
        resolveName: (color) => {
          const p = this.players.find((x) => x.color === color);
          return p !== undefined ? participantDisplayName(p) : '';
        },
      });
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
        if (this.isPickable(colony.name)) {
          return {kind: 'ok', text: translateText('Can select')};
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
        return {kind: 'ok', text: translateText('Trade available')};
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
     * Descend into the FOCUSED colony (A = trade intent, X = inspect intent —
     * one stage either way). Arms the descend origin SYNCHRONOUSLY at the
     * press: the tile's rect (the unfold source) + its planet medallion's
     * rect (the carried subject's FLIP source).
     */
    enterFocus(intent: 'trade' | 'inspect'): void {
      const colony = this.colonies[this.index];
      if (colony === undefined || this.focusState.open) {
        return;
      }
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      const tile = el?.querySelector<HTMLElement>('.con-coltile');
      const planet = tile?.querySelector<HTMLElement>('.con-coltile__planet-berth');
      const rectOf = (node: HTMLElement | null | undefined) => {
        const r = node?.getBoundingClientRect();
        return r === undefined || r.width < 10 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      armColonyFocusOrigin(rectOf(tile), rectOf(planet));
      openColonyFocus(colony.name as ColonyName, intent);
    },
    /** Fold back to the browse surface (B / cancel). */
    closeFocus(): void {
      closeColonyFocus();
    },
    /** The stage confirmed the trade: fold briskly (the confirm variant of the
     *  same phrase) and hand the payload UP — the shell arms the fleet flight
     *  + the reward transaction and submits, all against the browse surface
     *  the fold is revealing. */
    onFocusConfirm(payload: ColonyTradeConfirmPayload): void {
      markColonyFocusConfirmLeave();
      this.$emit('trade-confirm', payload);
    },
    /** The shell routes the pad here while the focus stage is open. */
    handleFocusIntent(intent: GamepadIntent): void {
      const stage = this.$refs.focusStage as InstanceType<typeof ConsoleColonyFocusStage> | undefined;
      stage?.handleIntent(intent);
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
          setWorkspaceOutcomeSlot('[data-embed-slot="colonies-reveal"]');
        }
      });
    }
  },
  beforeUnmount() {
    this.stopResizeObs?.();
    this.stopResize?.();
    if (this.fitRaf !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.fitRaf);
    }
    // Retract OUR zone before it unmounts (a stale selector teleports the
    // next batch into a detached node — embed rule 4).
    if (this.revealEmbedActive) {
      setWorkspaceOutcomeSlot('');
    }
    // Leaving the section closes the flow: reopening always lands on browse.
    closeColonyFocus();
    resetColonyFocusMotion();
  },
});
</script>
