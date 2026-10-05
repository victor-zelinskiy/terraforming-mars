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
    `current → resulting`, the TR step, the fleet leaving the supply), what the
    TABLE answers to that reward («⚡ сработает» — the forecast engine's own
    facts, named before the press) and the next step's note when the reward
    raises one. No track, no settlements, no colony income: the colony takes
    no part.

    A reward that LANDS ON A CARD (TR27 Aurora Station: 2 floaters onto a Venus
    card) names its card before the press: a «КУДА» row (the colony stage's own
    reading — `ConsoleTradeTargetValue`) and, with several holders, the trade's
    TARGET STEP one level deeper (`ConsoleTradeTargetStep` — the colony stage's
    own host of the shared selector; the dock itself stands in it as «ЭТА
    КАРТА»). The choice is a press and rides the trade's ONE POST. Past the
    commit the receiving card stands on the stage (`ConsoleTradeReceivingCards`
    — the colony stage's own presentation), or the tokens land on the hero
    itself, its counter frozen until they touch down.
  -->
  <div ref="rootEl"
       class="con-fleetdock"
       :class="{
         'con-fleetdock--held': held !== undefined,
         'con-fleetdock--blocked': !presentAvailable,
         'con-fleetdock--leaving': cardLeaving,
         'con-fleetdock--targeting': sub === 'targets',
         'con-fleetdock--carding': presentedTargets.length > 0,
         'con-fleetdock--claimed': outcomeZone && claimPresenting,
       }"
       data-unfold-surface
       :data-fleet-dock-stage="card"
       :data-fleet-dock-category="presentPlan.category"
       :data-fleet-dock-degraded="rewardDegraded"
       :data-fleet-dock-scene="scene.phase">
    <span class="con-fleetdock__edge" data-unfold-edge aria-hidden="true"></span>

    <div class="con-fleetdock__hero" ref="heroEl">
      <!-- The CARRIED object: the dock tile's face grows into this one (the
           descend hooks FLIP `data-colony-focus-planet` — the stage's carried
           identity, whatever the subject is). -->
      <!-- The carried box is UNZOOMED (a FLIP's translate inside a CSS `zoom`
           would be scaled by it); the face inside it takes the zoom. -->
      <!-- `data-played-key`: a reward that lands on the dock ITSELF (TR27 with one holder) aims at this face's own
           counter — the destination ladder's fleet-dock rung (`consoleResourceTransfer.targetPointFor`). -->
      <div class="con-fleetdock__card" ref="cardEl" data-colony-focus-planet data-fleet-dock-hero :data-played-key="card">
        <div class="con-fleetdock__face" :style="{'--con-fleetdock-zoom': String(heroZoom)}">
          <ConsoleCardFaceLite :name="card" :card="heroModel" />
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
          <!-- «КУДА» — the card the reward lands on. With several holders it is a decision (a cursor stop; A
               descends into the target step, nothing pre-chosen); with one it is a statement (the holder named
               with its «n → n + k», no stop). The colony stage's own reading. -->
          <div v-if="targetRow !== undefined"
               class="con-colfocus__steprow"
               :class="{
                 'con-colfocus__steprow--focused': focusedZone === 'target',
                 'con-colfocus__steprow--missing': targetRow.missing,
               }"
               data-fleet-dock-target
               :data-fleet-dock-target-card="targetRow.card ?? ''">
            <div class="con-colfocus__steprow-label">{{ $t('Trade reward target') }}</div>
            <div class="con-colfocus__steprow-value">
              <ConsoleTradeTargetValue :iconClass="targetRow.iconClass"
                                       :card="targetRow.card"
                                       :impact="targetRow.impact"
                                       :changeable="focusedZone === 'target' && targetRow.pickable && held === undefined" />
            </div>
          </div>
        </div>

        <!-- ═══ RESULT — what this trade does, from the SERVER only ═══ -->
        <section class="con-fleetdock__result" data-unfold-item data-fleet-dock-result>
          <div class="con-colfocus__sec-title">{{ $t('Result') }}</div>
          <div class="con-fleetdock__chips" data-unfold-late>
            <ActionEffectChip v-for="(chip, i) in resultChips" :key="'e' + i" :effect="chip" />
            <!-- WHAT THE TABLE ANSWERS to the reward (the ruling Greens' M€ on a TR step) — the composers' own
                 «⚡ сработает» group, on the chips' line: read BEFORE the press, never a surprise after it. -->
            <ConsoleForecastReactions :reaction="presentReaction" />
          </div>
          <div v-for="note in followUpNotes" :key="note" class="con-fleetdock__note" data-unfold-late data-fleet-dock-note>{{ $t(note) }}</div>
        </section>
      </ConsoleScrollArea>

      <!-- THE TARGET STEP — one level deeper in the same flow (the colony stage's own host). -->
      <ConsoleTradeTargetStep v-if="sub === 'targets' && targetStepModel !== undefined"
                              ref="targetStep"
                              :model="targetStepModel"
                              :lockedCard="targetCapture"
                              @pick="targetPicked($event)" />

      <!-- THE RECEIVING CARD — standing before the first token leaves the dock, receiving, read; it goes with the
           workspace (the colony stage's own presentation). Absent when the dock receives on its own face. -->
      <ConsoleTradeReceivingCards v-if="presentedTargets.length > 0"
                                  :targets="presentedTargets"
                                  :landings="landings.by"
                                  :players="players"
                                  data-fleet-dock-receiving />

      <!-- A QUESTION RE-ASKED LIVE (the pre-collected target went stale, or the tail was parked) is THIS card's —
           its source is the dock — and it is answered here, inside the colonies workspace, never as a band over it
           (the claim's zone — the colony stage's selector). -->
      <section v-if="outcomeZone" class="con-fleetdock__outcome"
               data-outcome-zone data-embed-slot="colonies-focus-reveal"></section>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {useResizeObserver} from '@vueuse/core';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Color} from '@/common/Color';
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
import {
  fleetDockCardTarget, FleetDockCardTarget, fleetDockEffectNode, fleetDockScenePlan, FleetDockScenePlan, printedRewardUnits, tradeKnownRailMoves,
} from '@/client/console/colonyTrade/fleetDockModel';
import {
  ColonyTradePresentedTarget, buildColonyTradeTargetModel, openTradeTargetFocus, presentedTargetModel,
} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import {PlayedTargetModel} from '@/client/console/played/consolePlayedTargetModel';
import {cardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {
  armFleetDockScene, armedFleetDockScene, disarmFleetDockScene, fleetDockRewardKey, fleetDockSceneState, setFleetDockScenePhase,
  setFleetDockStageCard, endFleetDockScene,
} from '@/client/console/colonyTrade/fleetDockScene';
import {flyRailReward, railRewardState} from '@/client/console/resourceTransfer/railReward';
import {reactionChipsOf, VariantReaction} from '@/client/console/effectForecastModel';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {
  runActionCommitMotion, resolveActionCommitAnchors, resolveGainIconOrigins, ActionCommitMotionHandle,
} from '@/client/console/consoleActionCommitMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsoleTradePayRows from '@/client/components/console/ConsoleTradePayRows.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleForecastReactions from '@/client/components/console/ConsoleForecastReactions.vue';
import ConsoleTradeTargetStep from '@/client/components/console/ConsoleTradeTargetStep.vue';
import ConsoleTradeTargetValue from '@/client/components/console/ConsoleTradeTargetValue.vue';
import ConsoleTradeReceivingCards from '@/client/components/console/ConsoleTradeReceivingCards.vue';

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

type Zone = 'pay' | 'payment' | 'target';
type Focusable = {zone: Zone, index: number};
type HeldView = {entry: TradePayEntry | undefined};
/** The «КУДА» row's reading. */
type TargetRow = {card: string | undefined, impact: string, iconClass: string, pickable: boolean, missing: boolean};
/** What the stage asks of its target step's host (`ConsoleTradeTargetStep`). */
type TradeTargetStepHandle = {nav: (dir: NavDirection) => void, cycleOwner: (delta: number) => void, confirm: () => void, inspect: () => void, close: (done: () => void) => void};

export type FleetDockConfirmPayload = {
  paymentIndex: number,
  steps: ReadonlyArray<TradeStep>,
  captures: Readonly<Record<number, unknown>>,
  /**
   * The reward lands on a CARD (a card target in the preview): the shell claims
   * the trade's `pick` for the colonies workspace, so a question re-asked live
   * stands inside it — never as a band over it.
   */
  asksCard: boolean,
};

export default defineComponent({
  name: 'ConsoleFleetDockStage',
  components: {
    ActionEffectChip, ConsoleScrollArea, ConsolePaymentPanel, ConsoleTradePayRows, ConsoleCardFaceLite, ConsoleForecastReactions,
    ConsoleTradeTargetStep, ConsoleTradeTargetValue, ConsoleTradeReceivingCards,
  },
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
    /** Every player — owners for the target step, and the live models of a receiving card. */
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The colonies workspace hosts a claimed follow-up — the zone a re-asked question is teleported into. */
    outcomeZone: {type: Boolean, default: false},
  },
  emits: ['confirm', 'cancel', 'inspect', 'flow-complete'],
  data() {
    return {
      payIdx: 0,
      focusIdx: 0,
      sub: undefined as 'lanes' | 'mix' | 'targets' | undefined,
      /** The card the player CHOSE for the reward ('' = none — a choice is a press, never seeded). */
      targetCapture: '',
      /** Past the commit: the receiving card as chosen AT THE PRESS ('' when the dock pays no card). */
      heldTarget: '',
      /** Past the commit: the viewer's card counters as they stood AT THE PRESS — the frozen «было» of a receiving card. */
      heldCounts: {} as Record<string, number>,
      landings: cardResourceLandings,
      outcome: workspaceOutcomeState,
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
      /** The pinned answer of the table (the receipt keeps naming what the press was promised). */
      heldReaction: undefined as VariantReaction | undefined,
      railReward: railRewardState,
      heroZoom: 1,
      cardLeaving: false,
      scene: fleetDockSceneState,
      fleet: tradeFleetState,
      /**
       * The scene's pending wait between two beats — on the ANIMATION clock (see `sceneWait`). A plain handle,
       * never the tween itself: component data is a reactive proxy, and a proxied GSAP tween is not the object
       * its own timeline holds.
       */
      sceneCall: undefined as {kill: () => void} | undefined,
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
    /** The reward's card target as the server's preview states it (absent = the reward lands on no card). */
    cardTarget(): FleetDockCardTarget | undefined {
      return fleetDockCardTarget(this.preview?.followUps);
    },
    /** The target STEP — present only when the server will ASK (several holders; one holder is named, not asked). */
    targetStep(): Extract<TradeStep, {kind: 'cardTarget'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'cardTarget');
      return step?.kind === 'cardTarget' ? step : undefined;
    },
    targetIcon(): string {
      const resource = this.cardTarget?.resource;
      return resource === undefined ? '' : cardResourceKey(resource);
    },
    /**
     * THE CARD THAT RECEIVES — past the commit, the card the paying response named (else the press-time choice);
     * before it, the player's own choice (a choice is a press: nothing is pre-selected), or the one holder the
     * server names when there is no choice to make.
     */
    chosenTarget(): string | undefined {
      if (this.held !== undefined) {
        const named = this.scene.card === this.card && this.scene.target !== '' ? this.scene.target : this.heldTarget;
        return named !== '' ? named : undefined;
      }
      if (this.targetStep !== undefined) {
        return this.targetCapture !== '' ? this.targetCapture : undefined;
      }
      return this.cardTarget !== undefined && !this.cardTarget.lost ? this.cardTarget.auto : undefined;
    },
    /** The «КУДА» row — undefined when the reward lands on no card. */
    targetRow(): TargetRow | undefined {
      const target = this.cardTarget;
      if (target === undefined || target.lost) {
        return undefined;
      }
      const card = this.chosenTarget;
      const before = card === undefined ? 0 : this.countOf(card);
      return {
        card,
        impact: card === undefined ? '' : `${before} → ${before + target.amount}`,
        iconClass: this.targetIcon === '' ? '' : payIconClass(this.targetIcon),
        pickable: this.targetStep !== undefined,
        missing: this.targetStep !== undefined && card === undefined,
      };
    },
    /**
     * THE STEP'S MODEL — the colony stage's own translation of the trade step (`buildColonyTradeTargetModel`),
     * with the two things only this stage has: its hero is a card that is itself a candidate («ЭТА КАРТА»), and
     * each candidate reads what the floaters do to its points.
     */
    targetStepModel(): PlayedTargetModel | undefined {
      const step = this.targetStep;
      if (step === undefined || this.viewerColor === undefined) {
        return undefined;
      }
      return buildColonyTradeTargetModel({
        step,
        ask: textOf(step.pick.title) || translateText('Choose a card'),
        players: this.players,
        viewerColor: this.viewerColor,
        typeOf: (name) => getCard(name)?.type,
        resourceOf: (name) => getCard(name)?.resourceType,
        sourceCardName: this.card,
        victoryPoints: true,
      });
    },
    /** The units the reward lays on its card (the plan's own tokens, summed). */
    rewardUnits(): number {
      return this.presentPlan.specs.filter((spec) => spec.channel === 'card-resource').reduce((sum, spec) => sum + spec.amount, 0);
    },
    /** A follow-up embedded in the colonies' zone is ON SCREEN (a question re-asked live). */
    claimPresenting(): boolean {
      return this.outcome.host === 'colonies' && this.outcome.stage === 'presenting';
    },
    /**
     * THE RECEIVING CARD on the stage, past the commit — standing before the first token leaves the dock, frozen
     * at its press-time count. None when the dock receives on its own face, and none while a re-asked question
     * stands in the zone (the card it names is not decided yet).
     */
    presentedTargets(): ReadonlyArray<ColonyTradePresentedTarget> {
      const target = this.chosenTarget;
      if (this.held === undefined || this.presentPlan.category !== 'card' || target === undefined || target === this.card || this.claimPresenting) {
        return [];
      }
      return [{
        card: target as CardName,
        role: 'tradeReward',
        icon: this.presentPlan.firstResource ?? '',
        amount: this.rewardUnits,
        before: this.heldCounts[target] ?? 0,
      }];
    },
    /** The hero's face: FROZEN at its press-time count while its own counter is the one receiving (TR27 with one holder). */
    heroModel(): CardModel | undefined {
      if (this.held === undefined || this.presentPlan.category !== 'card' || this.chosenTarget !== this.card) {
        return this.model;
      }
      return presentedTargetModel(
        {card: this.card, role: 'tradeReward', icon: this.presentPlan.firstResource ?? '', amount: this.rewardUnits, before: this.heldCounts[this.card] ?? 0},
        this.model,
        this.landings.by[this.card] ?? 0);
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
      if (this.targetStep !== undefined) {
        out.push({zone: 'target', index: 0});
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
      // A CHOICE IS A PRESS: with several holders the trade waits for the card to be named (a card door's bare
      // pick too — its fee was the card's, its reward is still this one).
      if (this.targetStep !== undefined && this.targetCapture === '') {
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
      if (this.sub === 'targets') {
        return {label: 'Select', enabled: true, commits: false};
      }
      const focused = this.focused;
      if (focused?.zone === 'payment') {
        return {label: 'Select', enabled: this.payLanes.length > 0, commits: false};
      }
      if (focused?.zone === 'target') {
        return {label: 'Select', enabled: this.targetStepModel !== undefined, commits: false};
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
      const effects = this.cardEffects(this.preview?.effects ?? this.offerEffects);
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
      const target = this.cardTarget;
      return fleetDockScenePlan(this.preview, target === undefined ? undefined : {
        target: this.chosenTarget as CardName | undefined,
        tokens: printedRewardUnits(fleetDockEffectNode(getCard(this.card)?.metadata.renderData), target.resource, target.amount),
      });
    },
    /** Past the commit the plan is the PINNED one: the answer re-prices the preview under the scene. */
    presentPlan(): FleetDockScenePlan {
      return this.heldPlan ?? this.scenePlan;
    },
    /**
     * WHAT THE TABLE ANSWERS to the reward — the server's own forecast facts (`FleetDockPreviewModel.reactions`)
     * as the «⚡ сработает» chips every composer draws. Nothing is derived here: no fact, no group.
     */
    presentReaction(): VariantReaction {
      return this.heldReaction ?? reactionChipsOf(this.preview?.reactions ?? []);
    },
    /** A rail reward of THIS dock that was not shown as promised — named (`railReward.ts`), never silent. */
    rewardDegraded(): string | undefined {
      const degraded = this.railReward.degraded;
      return degraded !== undefined && degraded.key === fleetDockRewardKey(this.card) ? degraded.why : undefined;
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
      // The step is one level DEEPER in the same flow — only the crumb's tail advances, and B walks it back.
      setColonyFocusStage(this.sub === 'targets' ? 'Reward target' : 'Trading');
    },
    // A fresh preview re-judges the choice: a card no longer offered is dropped (the row asks again), a step that
    // vanished folds the target step back.
    targetStep(step: Extract<TradeStep, {kind: 'cardTarget'}> | undefined): void {
      if (this.held !== undefined) {
        return;
      }
      if (this.targetCapture !== '' && (step === undefined || !step.pick.cards.some((c) => c.name === this.targetCapture))) {
        this.targetCapture = '';
      }
      if (step === undefined && this.sub === 'targets') {
        this.sub = undefined;
      }
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
      fleetDockUi.answered = this.held !== undefined;
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
      if (this.sub === 'targets') {
        this.targetHost()?.nav(dir);
        return;
      }
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
      // THE TARGET STEP SPEAKS THE SHARED SELECTOR'S GRAMMAR — A chooses, X inspects the focused candidate, LB/RB
      // the owner axis, B one level back with the previous choice intact.
      if (this.sub === 'targets') {
        switch (action) {
        case 'primary': this.targetHost()?.confirm(); return;
        case 'inspect': this.targetHost()?.inspect(); return;
        case 'prevSection': this.targetHost()?.cycleOwner(-1); return;
        case 'nextSection': this.targetHost()?.cycleOwner(1); return;
        case 'back': this.closeTargetStep(); return;
        default: return;
        }
      }
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
      if (focused?.zone === 'target') {
        this.openTargetStep();
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
        } else if (step.kind === 'cardTarget' && this.targetCapture !== '') {
          captures[i] = this.targetCapture;
        }
      });
      const payload: FleetDockConfirmPayload = {
        paymentIndex: this.payIdx, steps: this.steps, captures,
        asksCard: this.cardTarget !== undefined && !this.cardTarget.lost,
      };
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
      // The trade's OTHER moves on the rail, as priced at the press (the fee of the chosen path, the flat
      // bonuses): the reward's diff check allows for exactly these. Read BEFORE the receipt pins the rows.
      const paid = this.paymentStep !== undefined && this.paymentView !== undefined && this.thisPlayer !== undefined ?
        paymentFromCounts(this.paymentView.cost, this.payLanes, this.paymentCounts, megacreditsAvailable(this.thisPlayer)) :
        undefined;
      // (A card door's bare pick has no path of its own: its fee was the card's, and is no rail row.)
      const known = tradeKnownRailMoves({
        option: this.pickMode ? undefined : this.options[this.payIdx], payment: paid, mix, flatBonuses: this.preview?.flatBonuses,
      });
      // The receiving card and every counter as they stand AT THE PRESS — read before `held` flips the readings.
      const target = this.chosenTarget ?? '';
      const counts: Record<string, number> = {};
      for (const model of this.thisPlayer?.tableau ?? []) {
        counts[model.name] = model.resources ?? 0;
      }
      const plan = this.scenePlan;
      const chips = this.resultChips;
      this.heldTarget = target;
      this.heldCounts = counts;
      this.held = {entry: entry === undefined ? undefined : (mix !== undefined ? {...entry, mix} : entry)};
      this.heldChips = chips;
      this.heldPlan = plan;
      this.heldReaction = this.presentReaction;
      armFleetDockScene({card: this.card, plan: this.heldPlan, known});
      this.sub = undefined;
      this.syncUiMirror();
    },
    /** A refused submit gives the stage back as it was (the fleet returns to its pad). */
    releasePresentation(): void {
      this.held = undefined;
      this.heldTarget = '';
      this.heldCounts = {};
      this.heldChips = undefined;
      this.heldPlan = undefined;
      this.heldReaction = undefined;
      disarmFleetDockScene(this.card);
      this.syncUiMirror();
    },
    /** A card's counter: frozen at the press past the commit; before it, the pick's own reading, else the viewer's tableau. */
    countOf(name: string): number {
      if (this.held !== undefined) {
        return this.heldCounts[name] ?? 0;
      }
      const fromPick = this.targetStep?.pick.cards.find((c) => c.name === name);
      if (fromPick !== undefined) {
        return fromPick.resources ?? 0;
      }
      if (name === this.card) {
        return this.model?.resources ?? 0;
      }
      return this.thisPlayer?.tableau.find((c) => c.name === name)?.resources ?? 0;
    },
    /**
     * THE RESULT, card by card: the server's «+2 [floater] на карту» chip names WHERE it lands — the chosen card
     * with its own «n → n + 2» (re-aimed with the choice; «выберите карту», with no number, before one is made)
     * and, when the move shifts that card's points, its «ПО from → to» beside it (the server's per-unit reading).
     */
    cardEffects(effects: ReadonlyArray<ActionEffect>): ReadonlyArray<ActionEffect> {
      const target = this.cardTarget;
      if (target === undefined || target.lost) {
        return effects;
      }
      const out: Array<ActionEffect> = [];
      for (const effect of effects) {
        if (effect.direction !== 'gain' || effect.note !== 'to a card' || effect.icon !== this.targetIcon) {
          out.push(effect);
          continue;
        }
        const card = this.chosenTarget;
        if (card === undefined) {
          out.push({direction: 'gain', icon: effect.icon, amount: effect.amount, note: 'Choose a card'});
          continue;
        }
        const before = this.countOf(card);
        // The card is named by the «КУДА» row right above (a chip note is lowercase type — never a proper name).
        out.push({direction: 'gain', icon: effect.icon, amount: effect.amount, current: before, resulting: before + effect.amount, note: 'to a card'});
        const steps = target.vpSteps?.[card as CardName];
        const last = steps?.[Math.max(0, Math.min(steps.length, target.amount) - 1)];
        if (last !== undefined && last.to !== last.from) {
          out.push({direction: 'gain', icon: 'vp', amount: last.to - last.from, current: last.from, resulting: last.to});
        }
      }
      return out;
    },
    targetHost(): TradeTargetStepHandle | undefined {
      return this.$refs.targetStep as TradeTargetStepHandle | undefined;
    },
    /** DESCEND into the target step — the cursor on the chosen card (a re-entry), else the first seat. */
    openTargetStep(): void {
      if (openTradeTargetFocus(this.targetStepModel, this.targetCapture) === undefined) {
        return;
      }
      this.sub = 'targets';
    },
    /** B — one level back; the choice made before stands. */
    closeTargetStep(): void {
      const drop = (): void => {
        if (this.sub === 'targets') {
          this.sub = undefined;
        }
        this.scrollFocusedIntoView();
      };
      const host = this.targetHost();
      if (host !== undefined) {
        host.close(drop);
      } else {
        drop();
      }
    },
    /** The step's answer: the capture rides the trade's ONE POST (`{type: 'card', cards: [name]}`). */
    targetPicked(card: string): void {
      this.targetCapture = card;
      this.closeTargetStep();
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
      // THE REWARD SLOT: whatever the category flies starts when the impulse SITS on the printed icon (the
      // handoff — cause before result), and the read begins only when both the card's own beat and the
      // reward have finished. An empty slot (a placement ahead) is a resolved promise.
      let reward: Promise<unknown> = Promise.resolve();
      this.sceneMotion = runActionCommitMotion({
        cardWrapEl: cardEl ?? undefined,
        ctaEl: undefined,
        actionNode: node,
        // Where the impulse lands follows from the reward (the printed parameter, the printed resource) — never a literal.
        kind: plan.answer,
        firstResource: plan.firstResource,
        onHandoff: () => {
          reward = this.flyReward(cardEl ?? undefined, plan);
        },
        onSettled: () => {
          this.sceneMotion = undefined;
          void reward.then(() => this.readScene());
        },
      });
    },
    /**
     * REWARD — a reward that landed ON THE RAIL leaves the card as a token: born on the PRINTED icon of the
     * effect row (measured now, on the standing face — the action-commit anchors, never a coordinate), flown to
     * its row, the counter ticking on the touchdown and the table's answer one beat later (`railReward.ts`
     * owns the holds and their order, so the chain survives this stage). Nothing was held for this scene (a
     * placement ahead, reduced motion, a promise the applied view did not keep) → nothing to fly.
     */
    flyReward(cardEl: HTMLElement | undefined, plan: FleetDockScenePlan): Promise<unknown> {
      if (!this.scene.railHeld) {
        return Promise.resolve();
      }
      setFleetDockScenePhase('reward');
      const node = fleetDockEffectNode(getCard(this.card)?.metadata.renderData);
      // The flights are the ARMED plan's (re-aimed at the card the paying response named) — one origin per token.
      const flown = armedFleetDockScene(this.card)?.plan ?? plan;
      const origins = cardEl === undefined ? [] : resolveGainIconOrigins(resolveActionCommitAnchors(cardEl, node), flown.specs);
      return flyRailReward(fleetDockRewardKey(this.card), (_spec, index) => origins[index]);
    },
    readScene(): void {
      if (!this.scene.holding) {
        return;
      }
      setFleetDockScenePhase('read');
      this.sceneWait(DOCK_READ_MS, () => {
        // A reward that is AHEAD needs the screen: the card departs first, as a beat of its own. A reward
        // delivered on the rail leaves nothing to make room for — the card goes WITH the workspace.
        if (this.presentPlan.category === 'rail' || this.presentPlan.category === 'card') {
          this.concludeScene();
        } else {
          this.leaveScene();
        }
      });
    },
    /** THE CARD'S DEPARTURE IS A BEAT, not a crossfade: it leaves on its own, the fleet mark with it. */
    leaveScene(): void {
      if (!this.scene.holding) {
        return;
      }
      setFleetDockScenePhase('leave');
      this.cardLeaving = true;
      this.sceneWait(DOCK_LEAVE_MS, () => this.concludeScene());
    },
    /**
     * A WAIT BETWEEN TWO BEATS OF THE SCENE — on the ANIMATION clock, never the wall clock. The beat before it
     * is the impulse's GSAP timeline and the beat after it a transition the compositor paces by PAINTED frames;
     * a wall-clock timer keeps running through a starved frame (a 4K frame is hundreds of ms) and through a
     * hidden tab, and hands the scene on before the beat it was waiting for has been drawn. GSAP's clock slows
     * with the frames it is given, so the read is a read of something painted. Reduced motion waits nothing.
     */
    sceneWait(ms: number, then: () => void): void {
      this.sceneCall?.kill();
      const call = gsap.delayedCall(consoleReducedMotionActive() ? 0 : motionMs(ms) / 1000, () => {
        this.sceneCall = undefined;
        then();
      });
      this.sceneCall = {kill: () => call.kill()};
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
    this.sceneCall?.kill();
    this.sceneCall = undefined;
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
    fleetDockUi.answered = false;
  },
});
</script>
