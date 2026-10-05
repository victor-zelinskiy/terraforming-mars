<template>
  <!--
    THE FLEET-DOCK STAGE — a trade whose fleet goes to a CARD (Turmoil Redux
    TR06 Water Hauling and its sisters). The colony focus stage's neighbour in
    the same region, opened by the same descend phrase (the same hooks: it
    publishes the marks they read — the surface, the edge, the carried object),
    and it never titles itself: the crumb above reads «КОЛОНИИ › ПЕРЕВОЗКА ВОДЫ
    › ТОРГОВЛЯ», the stage hands its tail up.

    Two columns. The HERO is the card itself — the full premium face, because
    the ▲ of its printed effect is where the fleet lands and the row the card
    answers with. The WORK column is the trade: the payment paths (the SAME rows
    and the SAME model as the colony stage — `ConsoleTradePayRows` /
    `tradePayModel`), the M€ payment and the Delta Works mix through the shared
    payment panel, and the RESULT — only the server's chips (the reward's
    `current → resulting`, the TR step, the fleet leaving the supply) and the
    next step's note. No track, no settlements, no colony income: the colony
    takes no part.
  -->
  <div ref="rootEl"
       class="con-fleetdock"
       :class="{
         'con-fleetdock--held': held !== undefined,
         'con-fleetdock--blocked': !presentAvailable,
         'con-fleetdock--leaving': cardLeaving,
       }"
       data-unfold-surface
       :data-fleet-dock-stage="card"
       :data-fleet-dock-category="presentPlan.category"
       :data-fleet-dock-scene="scene.phase">
    <span class="con-fleetdock__edge" data-unfold-edge aria-hidden="true"></span>

    <div class="con-fleetdock__hero" ref="heroEl">
      <!-- The CARRIED object: the dock tile's face grows into this one (the
           descend hooks FLIP `data-colony-focus-planet` — the stage's carried
           identity, whatever the subject is). -->
      <!-- The carried box is UNZOOMED (a FLIP's translate inside a CSS `zoom`
           would be scaled by it); the face inside it takes the zoom. -->
      <div class="con-fleetdock__card" ref="cardEl" data-colony-focus-planet data-fleet-dock-hero>
        <div class="con-fleetdock__face" :style="{'--con-fleetdock-zoom': String(heroZoom)}">
          <ConsoleCardFaceLite :name="card" :card="model" />
        </div>
      </div>
    </div>

    <div class="con-fleetdock__main" ref="mainEl">
      <ConsoleScrollArea class="con-fleetdock__scroll" ref="scroll">
        <!-- THE ONE REASON a refused dock is not a destination — the server's,
             through the colony ladder. Nothing else replaces the work column:
             the rows below stay readable (the player sees the trade's
             structure), they just accept no press. -->
        <div v-if="!presentAvailable && blockReason !== ''"
             class="con-fleetdock__verdict"
             :class="'con-fleetdock__verdict--' + blockTone"
             data-unfold-item data-fleet-dock-verdict>
          <span aria-hidden="true">{{ blockTone === 'warning' ? '○' : '✕' }}</span>
          <span>{{ $t(blockReason) }}</span>
        </div>

        <!-- SUB: the M€ lanes — the SHARED payment panel, expanded. -->
        <div v-if="sub === 'lanes' && paymentView !== undefined" class="con-fleetdock__sub" data-unfold-item>
          <ConsolePaymentPanel :view="paymentView"
                               mode="expanded"
                               hint-mode="none"
                               :focus-unit="payFocusUnit"
                               :flash-nonce="payFlashNonce" />
        </div>
        <!-- SUB: the Delta Works composition — the same panel, the bumpers dial. -->
        <div v-else-if="sub === 'mix' && energyMixInfo !== undefined" class="con-fleetdock__sub" data-unfold-item>
          <ConsolePaymentPanel :view="tradeMixView"
                               mode="compact"
                               hint-mode="none"
                               title-key="Payment mix"
                               :source-card="energyMixInfo.card"
                               :flash-nonce="mixFlashNonce" />
        </div>
        <div v-else class="con-fleetdock__config" data-unfold-item>
          <ConsoleTradePayRows ref="payRows"
                               :heading="visibleRows.length + visibleDisabled.length > 0 || held !== undefined"
                               :rows="visibleRows"
                               :disabled="visibleDisabled"
                               :chosenIndex="payIdx"
                               :lockedIndex="lockedPayIdx"
                               :focusedIndex="focusedPayIndex"
                               :energyIndex="energyEntryIdx"
                               :energyMixLive="energyMixLive"
                               :mix="payRowMix"
                               :mixAdjustable="tradeMixAdjustable"
                               :held="held !== undefined ? held.entry : undefined" />
          <!-- The M€ path's own payment (heat, Helion, …) — one step row, A opens it. -->
          <div v-if="paymentStep !== undefined && held === undefined"
               class="con-colfocus__steprow"
               :class="{
                 'con-colfocus__steprow--focused': focusedZone === 'payment',
                 'con-colfocus__steprow--missing': paymentView !== undefined && !paymentView.status.ok,
               }"
               data-fleet-dock-payment>
            <div class="con-colfocus__steprow-label">{{ $t('Payment') }}</div>
            <div class="con-colfocus__steprow-value"><span>{{ paymentSummary }}</span></div>
          </div>
        </div>

        <!-- ═══ RESULT — what this trade does, from the SERVER only ═══ -->
        <section class="con-fleetdock__result" data-unfold-item data-fleet-dock-result>
          <div class="con-colfocus__sec-title">{{ $t('Result') }}</div>
          <div class="con-fleetdock__chips" data-unfold-late>
            <ActionEffectChip v-for="(chip, i) in resultChips" :key="'e' + i" :effect="chip" />
          </div>
          <div v-for="note in followUpNotes" :key="note" class="con-fleetdock__note" data-unfold-late data-fleet-dock-note>{{ $t(note) }}</div>
        </section>
      </ConsoleScrollArea>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Message} from '@/common/logs/Message';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {FleetDockPreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {TRADE_FLEET_ICON} from '@/common/colonies/tradeFleet';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {fleetDockUi, setColonyFocusStage} from '@/client/console/consoleColoniesModel';
import {
  paymentLanes, megacreditsAvailable, paymentFromCounts, initialCounts, dialLaneCount,
  buildPaymentView, buildEnergyMixView, clampEnergyMixSteel, editableRows, PaymentLane, PaymentView,
} from '@/client/console/paymentPlan';
import {afterConfirmNotes, tradeSteps, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {
  TradePayEntry, TradePayRow, tradePayDisabledEntries, tradePayEntries, visibleTradePayDisabled, visibleTradePayRows,
} from '@/client/console/colonyTrade/tradePayModel';
import {cardColonyTradeCard, lockedTradePaymentIndex, partyColonyTradeParty} from '@/client/console/colonyTrade/colonyTradeEntry';
import {fleetDockEffectNode, fleetDockScenePlan, FleetDockScenePlan} from '@/client/console/colonyTrade/fleetDockModel';
import {
  armFleetDockScene, disarmFleetDockScene, fleetDockSceneState, setFleetDockScenePhase, setFleetDockStageCard, endFleetDockScene,
} from '@/client/console/colonyTrade/fleetDockScene';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {runActionCommitMotion, ActionCommitMotionHandle} from '@/client/console/consoleActionCommitMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsoleTradePayRows from '@/client/components/console/ConsoleTradePayRows.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

function payIconClass(icon: string): string {
  return iconClassFor(icon) + ' con-task__opt-res';
}

/** The card's design size (`.pcard` at zoom 1). */
const CARD_W = 320;
const CARD_H = 460;
/** The colony stage's own read (`ConsoleColonyFocusStage` CARDLAND_READ_MS) — one rhythm for «the card answered». */
const DOCK_READ_MS = 680;
/** The card's departure beat (the colony stage's CARDLAND_LEAVE_MS). */
const DOCK_LEAVE_MS = 300;

type Zone = 'pay' | 'payment';
type Focusable = {zone: Zone, index: number};
type HeldView = {entry: TradePayEntry | undefined};

export type FleetDockConfirmPayload = {
  paymentIndex: number,
  steps: ReadonlyArray<TradeStep>,
  captures: Readonly<Record<number, unknown>>,
};

export default defineComponent({
  name: 'ConsoleFleetDockStage',
  components: {ActionEffectChip, ConsoleScrollArea, ConsolePaymentPanel, ConsoleTradePayRows, ConsoleCardFaceLite},
  props: {
    card: {type: String as PropType<CardName>, required: true},
    /** The live model from the viewer's tableau (its face carries the fleet mark). */
    model: {type: Object as PropType<CardModel | undefined>, default: undefined},
    /** The server offers this dock now (the pick's marker, in the trade window). */
    available: {type: Boolean, default: false},
    /** Why not (an English key — the colony ladder's), '' when available. */
    blockReason: {type: String, default: ''},
    blockTone: {type: String as PropType<'warning' | 'danger'>, default: 'danger'},
    /** The trade fee's paths (the AndOptions' inner OrOptions). */
    options: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    disabledOptions: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    /** The read-only dock preview (`?dock=`) — the fee's own prompts, the reward's chips. */
    preview: {type: Object as PropType<FleetDockPreviewModel | undefined>, default: undefined},
    /** The marker's chips — what the stage reads while the preview is on the wire. */
    offerEffects: {type: Array as PropType<ReadonlyArray<ActionEffect>>, default: () => []},
    thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
    /** The viewer's free trade fleets right now. */
    freeFleets: {type: Number, default: 0},
    /**
     * A card door's BARE pick (`SelectColony` — the card already paid the fee):
     * no payment paths to compose, A answers the destination alone.
     */
    pickMode: {type: Boolean, default: false},
  },
  emits: ['confirm', 'cancel', 'inspect', 'flow-complete'],
  data() {
    return {
      payIdx: 0,
      focusIdx: 0,
      sub: undefined as 'lanes' | 'mix' | undefined,
      subIdx: 0,
      steelMixPreference: 0,
      mixFlashNonce: 0,
      payFlashNonce: 0,
      paymentCounts: {} as Partial<Record<SpendableResource, number>>,
      /** The COMMIT BOUNDARY: the receipt the stage keeps showing past the answer. */
      held: undefined as HeldView | undefined,
      /** The pinned result chips (the answer re-prices the reward under the scene). */
      heldChips: undefined as ReadonlyArray<ActionEffect> | undefined,
      /** The pinned plan of the scene — the reward's category as the server's preview stated it AT THE PRESS. */
      heldPlan: undefined as FleetDockScenePlan | undefined,
      heroZoom: 1,
      cardLeaving: false,
      scene: fleetDockSceneState,
      fleet: tradeFleetState,
      sceneTimer: undefined as number | undefined,
      sceneMotion: undefined as ActionCommitMotionHandle | undefined,
      stopFitObs: undefined as (() => void) | undefined,
    };
  },
  computed: {
    /** Past the commit the stage is a RECEIPT: the live props flip under it (the trade is spent). */
    presentAvailable(): boolean {
      return this.held !== undefined || this.available;
    },
    payEntries(): Array<TradePayEntry> {
      return tradePayEntries(this.options, textOf, payIconClass);
    },
    disabledEntries(): ReturnType<typeof tradePayDisabledEntries> {
      return tradePayDisabledEntries(this.disabledOptions, textOf, payIconClass);
    },
    lockedPayIdx(): number {
      return lockedTradePaymentIndex(this.options, cardColonyTradeCard(), partyColonyTradeParty());
    },
    visibleRows(): Array<TradePayRow> {
      return visibleTradePayRows(this.payEntries, this.lockedPayIdx, this.held !== undefined);
    },
    visibleDisabled(): ReadonlyArray<ReturnType<typeof tradePayDisabledEntries>[number]> {
      return visibleTradePayDisabled(this.disabledEntries, this.lockedPayIdx, this.held !== undefined);
    },
    isMcSelected(): boolean {
      return this.options[this.payIdx]?.metadata?.icon === 'megacredits';
    },
    isEnergySelected(): boolean {
      return this.options[this.payIdx]?.metadata?.icon === 'energy';
    },
    steps(): Array<TradeStep> {
      return this.held !== undefined || !this.available ? [] :
        tradeSteps(this.preview, this.isMcSelected, this.isEnergySelected);
    },
    paymentStep(): Extract<TradeStep, {kind: 'payment'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'payment');
      return step?.kind === 'payment' ? step : undefined;
    },
    payLanes(): ReadonlyArray<PaymentLane> {
      const step = this.paymentStep;
      return step === undefined || this.thisPlayer === undefined ? [] : paymentLanes(step.model, this.thisPlayer);
    },
    paymentView(): PaymentView | undefined {
      const step = this.paymentStep;
      if (step === undefined || this.thisPlayer === undefined) {
        return undefined;
      }
      return buildPaymentView({
        cost: step.model.amount,
        lanes: this.payLanes,
        counts: this.paymentCounts,
        mcAvailable: megacreditsAvailable(this.thisPlayer),
      });
    },
    payFocusUnit(): string | undefined {
      const view = this.paymentView;
      return view === undefined || this.sub !== 'lanes' ? undefined : editableRows(view)[this.subIdx]?.unit;
    },
    paymentSummary(): string {
      const view = this.paymentView;
      if (view === undefined) {
        return '';
      }
      const parts: Array<string> = [];
      for (const row of view.rows) {
        if (!row.auto && row.used > 0) {
          parts.push(`${row.used} ${translateText(row.labelKey)}`);
        }
      }
      const mc = view.rows.find((r) => r.auto)?.used ?? 0;
      if (mc > 0 || parts.length === 0) {
        parts.push(`${mc} M€`);
      }
      return parts.join(' + ');
    },
    energyMixInfo(): FleetDockPreviewModel['energyMix'] {
      const mix = this.preview?.energyMix;
      return mix === undefined || !this.isEnergySelected || this.held !== undefined ? undefined : mix;
    },
    energyMixLive(): boolean {
      return this.held === undefined && this.preview?.energyMix !== undefined;
    },
    energyEntryIdx(): number {
      return this.options.findIndex((o) => o.metadata?.icon === 'energy');
    },
    tradeSteelMix(): number {
      const mix = this.energyMixInfo;
      return mix === undefined ? 0 : clampEnergyMixSteel(this.steelMixPreference, mix);
    },
    tradeMixAdjustable(): boolean {
      const mix = this.energyMixInfo;
      return mix !== undefined && mix.maxSteel > mix.minSteel;
    },
    tradeMixView(): PaymentView {
      const mix = this.energyMixInfo;
      return buildEnergyMixView({
        cost: mix?.cost ?? 0,
        energyAvailable: mix?.energyAvailable ?? 0,
        steelAvailable: mix?.steelAvailable ?? 0,
        minSteel: mix?.minSteel ?? 0,
        maxSteel: mix?.maxSteel ?? 0,
        steelUsed: this.tradeSteelMix,
      });
    },
    payRowMix(): {energy: number, steel: number} | undefined {
      const mix = this.energyMixInfo;
      return mix === undefined ? undefined : {energy: (mix.cost ?? 0) - this.tradeSteelMix, steel: this.tradeSteelMix};
    },
    /** The cursor's stops: the payment paths (never a locked fee) + the M€ payment row. */
    focusables(): Array<Focusable> {
      if (!this.presentAvailable || this.held !== undefined) {
        return [];
      }
      const out: Array<Focusable> = this.lockedPayIdx >= 0 ? [] : this.payEntries.map((_, index) => ({zone: 'pay' as const, index}));
      if (this.paymentStep !== undefined) {
        out.push({zone: 'payment', index: 0});
      }
      return out;
    },
    focused(): Focusable | undefined {
      return this.focusables[Math.min(this.focusIdx, Math.max(0, this.focusables.length - 1))];
    },
    focusedZone(): Zone | undefined {
      return this.sub === undefined ? this.focused?.zone : undefined;
    },
    focusedPayIndex(): number {
      return this.focusedZone === 'pay' ? (this.focused?.index ?? -1) : -1;
    },
    /** Every decision is in and the server offers the trade. */
    canConfirm(): boolean {
      if (this.held !== undefined || !this.available) {
        return false;
      }
      if (this.pickMode) {
        return true;
      }
      if (this.options[this.payIdx] === undefined) {
        return false;
      }
      return this.paymentView === undefined || this.paymentView.status.ok;
    },
    /** What A does on the cursor's row — the bar reads the label the stage publishes. */
    primary(): {label: string, enabled: boolean, commits: boolean} {
      if (this.sub === 'lanes') {
        return {label: 'Done', enabled: this.paymentView?.status.ok === true, commits: false};
      }
      if (this.sub === 'mix') {
        return {label: 'Trade', enabled: this.canConfirm, commits: true};
      }
      const focused = this.focused;
      if (focused?.zone === 'payment') {
        return {label: 'Select', enabled: this.payLanes.length > 0, commits: false};
      }
      if (focused?.zone === 'pay' && focused.index !== this.payIdx) {
        return {label: 'Select', enabled: true, commits: false};
      }
      return {label: this.tradeMixAdjustable ? 'Continue to payment' : 'Trade', enabled: this.canConfirm, commits: !this.tradeMixAdjustable};
    },
    /** THE RESULT — the server's chips (pinned past the commit) + the fleet leaving the supply. */
    resultChips(): ReadonlyArray<ActionEffect> {
      if (this.heldChips !== undefined) {
        return this.heldChips;
      }
      const effects = this.preview?.effects ?? this.offerEffects;
      const fleet: ActionEffect = {
        direction: 'cost',
        icon: TRADE_FLEET_ICON,
        amount: 1,
        current: this.freeFleets,
        resulting: Math.max(0, this.freeFleets - 1),
      };
      return [...effects, fleet];
    },
    /**
     * What the reward raises AFTER the confirm («После подтверждения: тайл океана на поле») — the server's own
     * follow-ups through the ONE table of their lines (`colonyTradePlan.afterConfirmNotes`). A reward that
     * raises nothing (a plain gain) has no line, and the block above it stands exactly where it stood.
     */
    followUpNotes(): Array<string> {
      return afterConfirmNotes(this.preview?.followUps ?? []);
    },
    /** The scene this trade will play — its reward's category, read off the server's preview (never off the card). */
    scenePlan(): FleetDockScenePlan {
      return fleetDockScenePlan(this.preview);
    },
    /** Past the commit the plan is the PINNED one: the answer re-prices the preview under the scene. */
    presentPlan(): FleetDockScenePlan {
      return this.heldPlan ?? this.scenePlan;
    },
    /**
     * The scene may start: the hold stands — seeded in the very block that applied the view, i.e. the
     * fleet has LANDED and the real mark stands on the ▲. The proxy's crossfade onto that mark overlaps
     * the card's answer (one gesture, never a pause between the touchdown and the answer).
     */
    sceneDue(): boolean {
      return this.scene.holding && this.scene.card === this.card && this.scene.phase === 'seeded';
    },
  },
  watch: {
    primary: {
      deep: true,
      handler(): void {
        this.syncUiMirror();
      },
    },
    sub(): void {
      this.syncUiMirror();
    },
    isMcSelected(): void {
      this.seedPaymentDefault();
    },
    preview(): void {
      this.seedPaymentDefault();
    },
    lockedPayIdx: {
      immediate: true,
      handler(): void {
        if (this.lockedPayIdx >= 0) {
          this.payIdx = this.lockedPayIdx;
        }
      },
    },
    tradeMixAdjustable(adjustable: boolean): void {
      if (!adjustable && this.sub === 'mix') {
        this.sub = undefined;
      }
    },
    sceneDue(due: boolean): void {
      if (due) {
        this.playScene();
      }
    },
    // A REFUSED submit: the fleet came home (the transport's abort battery) and
    // no scene was seeded — the stage is given back as it was, the choice intact.
    'fleet.active'(active: boolean, was: boolean): void {
      if (!active && was && this.held !== undefined && this.scene.phase === 'idle') {
        this.releasePresentation();
      }
    },
  },
  methods: {
    syncUiMirror(): void {
      fleetDockUi.sub = this.sub ?? '';
      fleetDockUi.primaryLabel = this.primary.label;
      fleetDockUi.primaryEnabled = this.primary.enabled && this.held === undefined;
      fleetDockUi.primaryCommits = this.primary.commits;
    },
    seedPaymentDefault(): void {
      const step = this.paymentStep;
      if (step === undefined || this.thisPlayer === undefined) {
        this.paymentCounts = {};
        return;
      }
      const lanes = paymentLanes(step.model, this.thisPlayer);
      this.paymentCounts = initialCounts(step.model.amount, lanes, megacreditsAvailable(this.thisPlayer));
    },
    /** The shell routes every intent here while the stage stands. */
    handleIntent(intent: GamepadIntent): void {
      // A commit on the wire or a scene playing owns the moment — input is absorbed.
      if (this.held !== undefined) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    onNav(dir: NavDirection): void {
      if (this.sub === 'lanes') {
        if (dir === 'up' || dir === 'down') {
          this.subIdx = Math.min(this.payLanes.length - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        } else {
          this.adjustPayLane(this.subIdx, dir === 'right' ? 1 : -1);
        }
        return;
      }
      if (this.sub !== undefined) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.focusIdx = Math.min(this.focusables.length - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        this.scrollFocusedIntoView();
      }
    },
    adjustPayLane(idx: number, step: number, toMax = false): void {
      const view = this.paymentView;
      const lane = this.payLanes[idx];
      if (view === undefined || lane === undefined) {
        return;
      }
      const before = this.paymentCounts[lane.unit] ?? 0;
      const next = dialLaneCount(view.cost, lane, this.payLanes, this.paymentCounts, toMax ? 'max' : step);
      if (next !== before) {
        this.paymentCounts = {...this.paymentCounts, [lane.unit]: next};
        this.payFlashNonce += 1;
      }
    },
    adjustTradeMix(delta: number): void {
      const mix = this.energyMixInfo;
      if (this.sub !== 'mix' || mix === undefined || !this.tradeMixAdjustable) {
        return;
      }
      const next = clampEnergyMixSteel(this.tradeSteelMix + delta, mix);
      if (next !== this.tradeSteelMix) {
        this.steelMixPreference = next;
        this.mixFlashNonce += 1;
      }
    },
    onPress(action: ConsoleAction): void {
      switch (action) {
      case 'primary':
        this.onPrimary();
        return;
      case 'inspect':
        // X = «Осмотреть» — the card (the shell opens the shared viewer over the stage).
        if (this.sub === undefined) {
          this.$emit('inspect');
        }
        return;
      case 'prevSection':
        this.adjustTradeMix(-1);
        return;
      case 'nextSection':
        this.adjustTradeMix(1);
        return;
      case 'nextTab':
        if (this.sub === 'lanes') {
          this.adjustPayLane(this.subIdx, 0, true);
        }
        return;
      case 'back':
        if (this.sub !== undefined) {
          this.sub = undefined;
          return;
        }
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
    /**
     * A — ONE verb whose meaning follows the cursor, and a choice is a press:
     * on another payment path it SELECTS it (the cursor alone selects nothing),
     * on the payment row it opens the M€ payment, on the chosen path it TRADES
     * (or opens the Delta Works composition when several mixes are valid).
     */
    onPrimary(): void {
      if (this.sub === 'lanes') {
        if (this.paymentView?.status.ok === true) {
          this.sub = undefined;
        }
        return;
      }
      if (this.sub === 'mix') {
        if (this.canConfirm) {
          this.emitConfirm();
        }
        return;
      }
      const focused = this.focused;
      if (focused?.zone === 'payment') {
        if (this.payLanes.length > 0) {
          this.sub = 'lanes';
          this.subIdx = 0;
        }
        return;
      }
      if (focused?.zone === 'pay' && focused.index !== this.payIdx && this.lockedPayIdx < 0) {
        this.payIdx = focused.index;
        return;
      }
      if (!this.canConfirm) {
        return;
      }
      if (this.tradeMixAdjustable) {
        this.sub = 'mix';
        return;
      }
      this.emitConfirm();
    },
    emitConfirm(): void {
      const captures: Record<number, unknown> = {};
      this.steps.forEach((step, i) => {
        if (step.kind === 'payment') {
          const view = this.paymentView;
          if (view !== undefined && this.thisPlayer !== undefined) {
            captures[i] = paymentFromCounts(view.cost, this.payLanes, this.paymentCounts, megacreditsAvailable(this.thisPlayer));
          }
        } else if (step.kind === 'energyMix') {
          captures[i] = this.tradeSteelMix;
        }
      });
      const payload: FleetDockConfirmPayload = {paymentIndex: this.payIdx, steps: this.steps, captures};
      this.$emit('confirm', payload);
    },
    /**
     * THE COMMIT BOUNDARY (the shell calls it once ITS guards accepted the
     * confirm): pin what the stage shows — the chosen path as a receipt (a mix
     * keeps the composition it was paid with), the result chips as priced at
     * the press — because the answer spends the trade under the scene.
     */
    holdPresentation(): void {
      const entry = this.payEntries[this.payIdx];
      const mix = this.payRowMix;
      this.held = {entry: entry === undefined ? undefined : (mix !== undefined ? {...entry, mix} : entry)};
      this.heldChips = this.resultChips;
      this.heldPlan = this.scenePlan;
      armFleetDockScene({card: this.card, plan: this.heldPlan});
      this.sub = undefined;
      this.syncUiMirror();
    },
    /** A refused submit gives the stage back as it was (the fleet returns to its pad). */
    releasePresentation(): void {
      this.held = undefined;
      this.heldChips = undefined;
      this.heldPlan = undefined;
      disarmFleetDockScene(this.card);
      this.syncUiMirror();
    },
    scrollFocusedIntoView(): void {
      void this.$nextTick(() => {
        const node = (this.$refs.payRows as {focusedEl?: () => HTMLElement | undefined} | undefined)?.focusedEl?.();
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
    /** The hero face is as large as its column allows (never larger than the composer's hero). */
    measureFit(): void {
      const hero = this.$refs.heroEl as HTMLElement | undefined;
      if (hero === undefined || hero === null) {
        return;
      }
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      if (w <= 0 || h <= 0) {
        return;
      }
      const zoom = Math.min(w / CARD_W, h / CARD_H);
      this.heroZoom = Math.max(0.3, Math.round(zoom * 1000) / 1000);
    },
    // ── THE SCENE (`fleetDockScene.ts`) — ANSWER → REWARD → READ → LEAVE → CONCLUDE, the slot by category ──
    playScene(): void {
      const cardEl = this.$refs.cardEl as HTMLElement | undefined;
      const plan = this.presentPlan;
      setFleetDockScenePhase('answer');
      const node = fleetDockEffectNode(getCard(this.card)?.metadata.renderData);
      this.sceneMotion = runActionCommitMotion({
        cardWrapEl: cardEl ?? undefined,
        ctaEl: undefined,
        actionNode: node,
        // Where the impulse lands follows from the reward (the printed parameter, the printed resource) — never a literal.
        kind: plan.answer,
        firstResource: plan.firstResource,
        onSettled: () => {
          this.sceneMotion = undefined;
          this.readScene();
        },
      });
    },
    readScene(): void {
      if (!this.scene.holding) {
        return;
      }
      setFleetDockScenePhase('read');
      this.sceneTimer = window.setTimeout(() => {
        this.sceneTimer = undefined;
        // A reward that is AHEAD needs the screen: the card departs first, as a beat of its own. A reward
        // delivered on the rail leaves nothing to make room for — the card goes WITH the workspace.
        if (this.presentPlan.category === 'rail') {
          this.concludeScene();
        } else {
          this.leaveScene();
        }
      }, consoleReducedMotionActive() ? 0 : motionMs(DOCK_READ_MS));
    },
    /** THE CARD'S DEPARTURE IS A BEAT, not a crossfade: it leaves on its own, the fleet mark with it. */
    leaveScene(): void {
      if (!this.scene.holding) {
        return;
      }
      setFleetDockScenePhase('leave');
      this.cardLeaving = true;
      this.sceneTimer = window.setTimeout(() => {
        this.sceneTimer = undefined;
        this.concludeScene();
      }, consoleReducedMotionActive() ? 0 : motionMs(DOCK_LEAVE_MS));
    },
    /** …and only then the workspace leaves as one surface; the shell concludes it and the hold falls at the END of that leave. */
    concludeScene(): void {
      if (!this.scene.holding) {
        return;
      }
      this.$emit('flow-complete', (this.$el as HTMLElement | null)?.closest('.con-ws') ?? (this.$el as HTMLElement | null)?.closest('.con-colonies'));
    },
  },
  mounted() {
    setFleetDockStageCard(this.card);
    setColonyFocusStage('Trading');
    this.seedPaymentDefault();
    this.measureFit();
    const hero = this.$refs.heroEl as HTMLElement | undefined;
    if (hero !== undefined && hero !== null) {
      this.stopFitObs = useResizeObserver(hero, () => this.measureFit()).stop;
    }
    this.focusIdx = Math.max(0, this.focusables.findIndex((f) => f.zone === 'pay' && f.index === this.payIdx));
    this.syncUiMirror();
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.sceneMotion?.kill();
    if (this.sceneTimer !== undefined) {
      window.clearTimeout(this.sceneTimer);
      this.sceneTimer = undefined;
    }
    setFleetDockStageCard('');
    // A scene the stage did not finish (the world moved, a collapse) ends here:
    // the placement is server state and comes up on its own. A CONCLUDING scene
    // is released by its root's detachment, which this unmount is part of.
    if (this.scene.holding && this.scene.card === this.card && this.scene.phase !== 'conclude') {
      endFleetDockScene('stage-unmounted');
    } else if (!this.scene.holding) {
      // A stage that left before its answer came: the plan it armed is void.
      disarmFleetDockScene(this.card);
    }
    fleetDockUi.sub = '';
    fleetDockUi.primaryEnabled = false;
    fleetDockUi.primaryCommits = false;
  },
});
</script>
