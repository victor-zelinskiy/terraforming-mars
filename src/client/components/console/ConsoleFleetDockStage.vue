<template>
  <!--
    THE FLEET-DOCK STAGE — a trade whose fleet goes to a CARD (Turmoil Redux
    TR06 Water Hauling and its sisters). ONE MORE DIRECTION OF THE TRADE (the
    owner, 2026-10-25): it stands on the colony trade stage's own materials and
    in its own grammar — the same surface, the same three columns, the same
    words — so walking from a colony to a dock changes the SUBJECT, never the
    screen. It never titles itself: the crumb above reads «КОЛОНИИ › ПЕРЕВОЗКА
    ВОДЫ › ТОРГОВЛЯ».

      HERO     the card itself where the colony stage stands its planet — the
               full premium face (the ▲ of its printed effect is where the
               fleet lands), a laconic line of what the dock does (the card's
               own curated short) and the honest verdict under it. Its size is
               SOLVED BEFORE the stage mounts (the room the section measured at
               the press): the tile's face FLIPs into a box that is already its
               final size, never into one that re-fits a frame later.
      MAIN     «СПОСОБ ОПЛАТЫ» — the SAME rows and the SAME model as the colony
               stage (`ConsoleTradePayRows` / `tradePayModel`), the M€ payment,
               the Delta Works mix and the reward's «КУДА» row.
      RESULT   «ИТОГ ТОРГОВЛИ» — the colony stage's summary rail: «ВАШ ИТОГ»
               (only the server's chips, as the rail's own rows), what the
               TABLE answers («⚡ сработает» — the R3 «Эффекты» door), the trade
               fleet leaving the supply, the payment, and the next step's note.

    The verbs are the colony trade's: A selects (a path, the payment, the
    target), X trades, L3 lifts the card into the viewer, R3 the effects.

    A reward that LANDS ON A CARD (TR27 Aurora Station) names its card before
    the press («КУДА» — `ConsoleTradeTargetValue`) and, with several holders,
    descends into the trade's TARGET STEP (`ConsoleTradeTargetStep` — the
    colony stage's own host). Past the commit the receiving card stands on the
    stage (`ConsoleTradeReceivingCards`), or the tokens land on the hero itself.
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
       data-forecast-host
       :data-fleet-dock-stage="card"
       :data-fleet-dock-category="presentPlan.category"
       :data-fleet-dock-degraded="rewardDegraded"
       :data-fleet-dock-scene="scene.phase">
    <div class="con-colfocus__surface con-fleetdock__surface" data-unfold-surface>
      <span class="con-colfocus__edge" data-unfold-edge aria-hidden="true"></span>

      <!-- ═══ HERO — the card as the physical object ═══ -->
      <section class="con-colfocus__hero con-fleetdock__hero">
        <!-- The CARRIED object: the dock tile's face grows into this one (the descend hooks FLIP
             `data-colony-focus-planet` — the stage's carried identity, whatever the subject is). The carried box
             is UNZOOMED (a FLIP's translate inside a CSS `zoom` would be scaled by it); the face inside takes the
             zoom. `data-played-key`: a reward that lands on the dock ITSELF (TR27 with one holder) aims at this
             face's own counter. `data-zoom-slot`: L3 lifts THIS card into the viewer. -->
        <div class="con-fleetdock__card" ref="cardEl" data-colony-focus-planet data-fleet-dock-hero
             :data-played-key="card" :data-zoom-slot="card">
          <div class="con-fleetdock__face" :style="{'--con-fleetdock-zoom': String(heroZoom)}">
            <ConsoleCardFaceLite :name="card" :card="heroModel" />
          </div>
        </div>
        <div v-if="shortRule !== ''" class="con-colfocus__idmeta" data-unfold-late>
          <div class="con-colfocus__desc" data-fleet-dock-desc>{{ shortRule }}</div>
        </div>
        <!-- THE HONEST VERDICT under the identity it judges — a pre-commit judgement, gone at the press. A refused
             dock names ONE reason (`[data-fleet-dock-verdict]`); the rows stay readable, they accept no press.
             Past the press its BOX stays, unpainted (`--reserved`): the hero column is centred, so a verdict that left
             the layout dropped the card by half its height — under the flight landing on its ▲ and the tokens born
             on its printed icons (85 px at 4K). The place a thing lands on does not move under it. -->
        <div class="con-colfocus__verdict"
             :class="[presentAvailable ? 'con-colfocus__verdict--ok' :
               (blockTone === 'warning' ? 'con-colfocus__verdict--notnow' : 'con-colfocus__verdict--no'),
                      {'con-colfocus__verdict--reserved': held !== undefined}]"
             :data-fleet-dock-verdict="presentAvailable ? undefined : ''"
             data-unfold-late>
          <template v-if="presentAvailable">
            <span class="con-coltile__status-dot" aria-hidden="true"></span>
            <span>{{ $t('Trade available') }}</span>
          </template>
          <template v-else>
            <span aria-hidden="true">{{ blockTone === 'warning' ? '⏳' : '✕' }}</span>
            <span>{{ blockReason !== '' ? $t(blockReason) : $t('Trade unavailable') }}</span>
          </template>
        </div>
      </section>

      <!-- ═══ MAIN — the trade's configuration ═══ -->
      <div class="con-colfocus__main con-fleetdock__main" ref="mainEl">
        <section class="con-colfocus__config con-fleetdock__config" data-unfold-item>
          <!-- ── THE «ЭФФЕКТЫ» LAYER (R3) — a LEVEL of this stage, the composers' own (PL-060): the configuration
               PARKS in place, the explorer unfolds out of the «⚡ сработает» door on the result rail, B / R3 fold it
               back with the chosen path intact; the crumb gains «· ЭФФЕКТЫ». ── -->
          <ConsoleForecastLayer ref="forecastLayer"
                                host="dock"
                                :forecast="forecast"
                                :cards="thisPlayer?.tableau ?? []"
                                :color="thisPlayer?.color ?? ''"
                                :players="players"
                                :statsByColor="forecastStatsByColor" />
          <!-- SUB: the M€ lanes — the SHARED payment panel, expanded. -->
          <template v-if="sub === 'lanes' && paymentView !== undefined">
            <ConsolePaymentPanel :view="paymentView"
                                 mode="expanded"
                                 hint-mode="none"
                                 :focus-unit="payFocusUnit"
                                 :flash-nonce="payFlashNonce" />
          </template>
          <!-- SUB: the Delta Works composition — the same panel, the bumpers dial, X trades. -->
          <template v-else-if="sub === 'mix' && energyMixInfo !== undefined">
            <ConsolePaymentPanel :view="tradeMixView"
                                 mode="compact"
                                 hint-mode="none"
                                 title-key="Payment mix"
                                 :source-card="energyMixInfo.card"
                                 :flash-nonce="mixFlashNonce" />
          </template>
          <ConsoleScrollArea v-else class="con-colfocus__configscroll con-fleetdock__scroll" ref="scroll" data-forecast-browse>
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
            <template v-if="(paymentStep !== undefined && held === undefined) || targetRow !== undefined">
              <div class="con-colfocus__sec-title con-colfocus__sec-title--steps">{{ $t('Your choices') }}</div>
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
            </template>
          </ConsoleScrollArea>
        </section>
      </div>

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
      <section v-if="outcomeZone" v-embed-zone class="con-colfocus__outcome con-fleetdock__outcome"
               data-outcome-zone data-embed-slot="colonies-focus-reveal"></section>

      <!-- ═══ RESULT — «ИТОГ ТОРГОВЛИ», from the SERVER only ═══ -->
      <section class="con-colfocus__result con-fleetdock__result" data-unfold-item data-fleet-dock-result>
        <div class="con-colfocus__sec-title" data-unfold-late>{{ $t('Trade outcome') }}</div>
        <div class="con-colfocus__rsec con-colfocus__rsec--lead con-fleetdock__gains">
          <div class="con-colfocus__rsec-label" data-unfold-late>{{ $t(presentAvailable ? 'Your total' : 'On the current level') }}</div>
          <div v-for="(row, i) in gainRows" :key="'g' + i"
               class="con-colfocus__rrow con-colfocus__rrow--gain con-colfocus__rrow--big"
               :data-fleet-dock-gain="row.icon">
            <span class="con-colfocus__rvalue">
              <b>{{ row.amount < 0 ? '−' + (-row.amount) : '+' + row.amount }}</b>
              <span class="con-colfocus__rglyph con-colfocus__rglyph--lg" :class="{'con-colfocus__rglyph--prod': row.production}">
                <i v-if="row.iconClass !== ''" :class="row.iconClass" aria-hidden="true"></i>
                <span v-else class="con-colfocus__rlabel">{{ $t(row.label) }}</span>
              </span>
            </span>
            <em v-if="row.reading !== ''" data-unfold-late>{{ row.reading }}</em>
          </div>
          <div v-if="gainRows.length === 0" class="con-colfocus__muted" data-unfold-late>{{ $t('No reward at this level') }}</div>
          <!-- WHAT THE TABLE ANSWERS to the reward (the ruling Greens' M€ on a TR step) — the composers' own
               «⚡ сработает» group, and the DOOR of the R3 «Эффекты» layer (PL-060): read BEFORE the press. -->
          <div class="con-fleetdock__chips">
            <ConsoleForecastDoor :reaction="presentReaction" :canOpen="forecastCanOpen" :pulse="forecastPulse" @open="openForecastLayer()" />
          </div>
        </div>
        <!-- THE FLEET — the unit is NAMED (PL-008): the ship, «2 → 1», «Торговый флот». -->
        <div class="con-colfocus__rsec con-fleetdock__fleet" data-unfold-late data-fleet-dock-fleet>
          <div class="con-colfocus__rsec-label">{{ $t('Trade fleet') }}</div>
          <div class="con-colfocus__rrow con-colfocus__rrow--cost">
            <ColonyFleetIcon v-if="viewerColor !== undefined" class="con-fleetdock__fleeticon" :color="viewerColor" />
            <b>−1</b>
            <em>{{ fleetRow.current }} → {{ fleetRow.resulting }}</em>
          </div>
        </div>
        <div v-if="payRowsOut.length > 0" class="con-colfocus__rsec con-colfocus__rsec--pay con-fleetdock__pay" data-unfold-late data-fleet-dock-pay>
          <div class="con-colfocus__rsec-label">{{ $t('Payment') }}</div>
          <div v-for="(row, k) in payRowsOut" :key="'c' + k" class="con-colfocus__rrow con-colfocus__rrow--cost">
            <i v-if="row.iconClass !== ''" :class="row.iconClass" aria-hidden="true"></i>
            <b>−{{ row.amount }}</b>
            <em v-if="row.reading !== ''">{{ row.reading }}</em>
          </div>
        </div>
        <div v-for="note in followUpNotes" :key="note" class="con-fleetdock__note con-colfocus__rsec" data-unfold-late data-fleet-dock-note>{{ $t(note) }}</div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import {vEmbedZone} from '@/client/console/embedZoneRegistry';
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
  fleetDockCardTarget, FleetDockCardTarget, fleetDockEffectDescription, fleetDockEffectNode, fleetDockScenePlan, FleetDockScenePlan, printedRewardUnits, tradeKnownRailMoves,
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
import {forecastLayerAvailable, reactionChipsOf, VariantReaction} from '@/client/console/effectForecastModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {closeEffectForecastLayer, effectForecastOpen} from '@/client/console/consoleEffectForecast';
import {
  foldForecastHost, forecastHostIntent, forecastOwnerColors, forecastStatsByColor, openForecastHost, pulseForecastDoor,
} from '@/client/console/consoleForecastHost';
import {VersionedView} from '@/client/console/gameStateVersion';
import ConsoleForecastDoor from '@/client/components/console/ConsoleForecastDoor.vue';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {
  runActionCommitMotion, resolveActionCommitAnchors, resolveGainIconOrigins, ActionCommitMotionHandle,
} from '@/client/console/consoleActionCommitMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsoleTradePayRows from '@/client/components/console/ConsoleTradePayRows.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleTradeTargetStep from '@/client/components/console/ConsoleTradeTargetStep.vue';
import {effectRuleText, effectRules} from '@/client/components/effects/effectDescription';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
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
/**
 * THE HERO CARD'S WIDTH, per profile (rem — the colony stage's hero column holds it with its air: 12rem / 16.5rem).
 * The size is SOLVED, never re-fitted after the mount: the descend FLIPs the tile's face into this box in the very
 * task the stage is inserted, so a box that re-sized a frame later was the «карта причала скачет» of the owner's walk.
 */
const HERO_CARD_W_REM: Readonly<Record<string, number>> = {tv: 15.2, handheld: 8.6};
const HERO_CARD_W_REM_DEFAULT = 11;
/** What the hero column holds under the card (the laconic line, the verdict, the gaps, the surface's padding), rem. */
const HERO_RESERVE_REM = 8.4;
/** A rem in screen px on the live profile (1rem = 20 logical px). */
function remPx(): number {
  return 20 * conUiScale();
}

/** A row of the summary rail («ИТОГ ТОРГОВЛИ») — the colony stage's own row reading. */
type RailRow = {icon: string, iconClass: string, label: string, amount: number, production: boolean, reading: string};
/** A row of the rail's «ОПЛАТА». */
type PayOutRow = {iconClass: string, amount: number, reading: string};
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
  directives: {embedZone: vEmbedZone},
  components: {
    ColonyFleetIcon, ConsoleScrollArea, ConsolePaymentPanel, ConsoleTradePayRows, ConsoleCardFaceLite,
    ConsoleTradeTargetStep, ConsoleTradeTargetValue, ConsoleTradeReceivingCards, ConsoleForecastDoor, ConsoleForecastLayer,
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
    /** The viewer's versioned view — the reacting seats' effect stats the layer's «За партию» block asks for. */
    statsView: {type: Object as PropType<VersionedView | undefined>, default: undefined},
    /**
     * The height of the room the stage stands in, measured by the section AT THE PRESS (px; 0 = unknown) — what
     * caps the hero card on a short host BEFORE the first frame (the stage then follows its own box).
     */
    roomHeight: {type: Number, default: 0},
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
      /** The one-shot COMMIT flare on the «⚡ сработает» group. */
      forecastPulse: false,
      railReward: railRewardState,
      /** The room's height — the press-time measurement until the stage's own box answers (a resize of the host). */
      roomH: this.roomHeight,
      layout: consoleLayoutState,
      /** The payment rows pinned at the commit boundary (the answer takes the options away under the receipt). */
      heldPay: undefined as ReadonlyArray<PayOutRow> | undefined,
      cardLeaving: false,
      scene: fleetDockSceneState,
      fleet: tradeFleetState,
      /**
       * The scene's pending wait between two beats — on the ANIMATION clock (see `sceneWait`). A plain handle,
       * never the tween itself: component data is a reactive proxy, and a proxied GSAP tween is not the object
       * its own timeline holds.
       */
      sceneCall: undefined as {kill: () => void} | undefined,
      /** The «сработает» group's commit flare (a plain handle — never the tween itself in reactive data). */
      pulseCall: undefined as {kill: () => void} | undefined,
      sceneMotion: undefined as ActionCommitMotionHandle | undefined,
      stopRoomObs: undefined as (() => void) | undefined,
    };
  },
  computed: {
    /**
     * THE HERO'S ZOOM — the profile's card width, capped by the room's height (the hero column holds the card,
     * the laconic line and the verdict). Pure arithmetic over known numbers, so the face mounts at its final size.
     */
    heroZoom(): number {
      const rem = remPx();
      const width = (HERO_CARD_W_REM[this.layout.profile] ?? HERO_CARD_W_REM_DEFAULT) * rem;
      const capH = this.roomH > 0 ? this.roomH - HERO_RESERVE_REM * rem : Infinity;
      const w = Math.min(width, capH * CARD_W / CARD_H);
      return Math.max(0.3, Math.floor((w / CARD_W) * 1000) / 1000);
    },
    /** What the dock does, in one calm line — the card's own curated short (`effect-short`), never a truncation. */
    shortRule(): string {
      const renderData = getCard(this.card)?.metadata.renderData;
      const rules = effectRules({
        cardName: this.card, effectIndex: 0, effectNode: fleetDockEffectNode(renderData),
        description: fleetDockEffectDescription(renderData), text: undefined,
      }, 1);
      return rules === undefined ? '' : effectRuleText(rules.summary);
    },
    /** «ВАШ ИТОГ» — the server's reward chips as the colony rail's rows (the fleet has its own section). */
    gainRows(): ReadonlyArray<RailRow> {
      return this.resultChips.filter((chip) => chip.icon !== TRADE_FLEET_ICON).map((chip): RailRow => {
        const cls = iconClassFor(chip.icon);
        const reading = chip.current !== undefined && chip.resulting !== undefined ?
          `${chip.current} → ${chip.resulting}` :
          (chip.note !== undefined && chip.note !== 'production' ? translateText(chip.note) : '');
        return {
          icon: chip.icon,
          iconClass: cls === '' ? '' : cls + ' con-task__opt-res',
          label: chip.icon === 'vp' ? 'VP' : chip.icon,
          amount: chip.direction === 'cost' ? -chip.amount : chip.amount,
          production: chip.note === 'production',
          reading,
        };
      });
    },
    /** The trade fleet leaving the supply — the result's own chip (pinned with it past the commit). */
    fleetRow(): {current: number, resulting: number} {
      const chip = this.resultChips.find((c) => c.icon === TRADE_FLEET_ICON);
      return {current: chip?.current ?? this.freeFleets, resulting: chip?.resulting ?? Math.max(0, this.freeFleets - 1)};
    },
    /**
     * «ОПЛАТА» — what the chosen path takes off the rail: the Delta Works composition, the M€ path's own payment,
     * or the path's fee as the server priced it (`current → resulting`). Pinned at the commit. A card door's bare
     * pick pays nothing here (its fee was the card's).
     */
    payRowsOut(): ReadonlyArray<PayOutRow> {
      if (this.heldPay !== undefined) {
        return this.heldPay;
      }
      if (this.pickMode || !this.available) {
        return [];
      }
      const icon = (unit: string): string => {
        const cls = iconClassFor(unit);
        return cls === '' ? '' : cls + ' con-task__opt-res';
      };
      const mix = this.payRowMix;
      if (mix !== undefined) {
        return [{unit: 'energy', amount: mix.energy}, {unit: 'steel', amount: mix.steel}]
          .filter((r) => r.amount > 0)
          .map((r) => ({iconClass: icon(r.unit), amount: r.amount, reading: ''}));
      }
      const view = this.paymentView;
      if (view !== undefined) {
        return view.rows.filter((row) => row.used > 0).map((row) => ({
          iconClass: icon(row.unit), amount: row.used, reading: `${row.available} → ${Math.max(0, row.available - row.used)}`,
        }));
      }
      const meta = this.options[this.payIdx]?.metadata;
      const resource = meta?.resource;
      if (meta?.icon === undefined || resource === undefined) {
        return [];
      }
      return [{iconClass: icon(meta.icon), amount: Math.max(0, resource.current - resource.resulting), reading: `${resource.current} → ${resource.resulting}`}];
    },
    /** X — the trade's commit (the colony stage's verb): «Торговать», or the gateway to the Delta Works mix. */
    confirmVerb(): {label: string, enabled: boolean} {
      if (this.sub === 'lanes' || this.sub === 'targets') {
        return {label: 'Confirm trade', enabled: false};
      }
      if (this.sub === 'mix') {
        return {label: 'Confirm trade', enabled: this.canConfirm};
      }
      return {label: this.tradeMixAdjustable ? 'Continue to payment' : 'Confirm trade', enabled: this.canConfirm};
    },
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
        ask: textOf(step.pick.title) || translateText('Choose the receiving card'),
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
    /**
     * What A does on the cursor's row — the colony trade's grammar: A SELECTS (another path, the payment, the
     * reward's card), it never trades; X does (`confirmVerb`). The bar reads the label the stage publishes.
     */
    primary(): {label: string, enabled: boolean, commits: boolean} {
      if (this.sub === 'lanes') {
        return {label: 'Done', enabled: this.paymentView?.status.ok === true, commits: false};
      }
      if (this.sub === 'mix') {
        return {label: 'Select', enabled: false, commits: false};
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
      return {label: 'Select', enabled: focused?.zone === 'pay' && focused.index !== this.payIdx && this.lockedPayIdx < 0, commits: false};
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
        // The unit is NAMED (PL-008): the fleet glyph alone read as one more resource of the reward.
        note: 'Trade fleet',
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
     * WHAT THE TABLE ANSWERS to the reward — the server's own forecast facts (`FleetDockPreviewModel.forecast.facts`)
     * as the «⚡ сработает» chips every composer draws. Nothing is derived here: no fact, no group.
     */
    presentReaction(): VariantReaction {
      return this.heldReaction ?? reactionChipsOf(this.forecast?.facts ?? []);
    },
    // ── THE EFFECT FORECAST (rides inside the dock preview) — the R3 «Эффекты» layer, the composers' own ──
    forecast(): EffectForecast | undefined {
      return this.preview?.forecast;
    },
    forecastAvailable(): boolean {
      return forecastLayerAvailable(this.forecast);
    },
    /** R3 is the SETUP level's verb — silent in a sub-step (the lanes, the mix, the target step) and past the commit. */
    forecastCanOpen(): boolean {
      return this.forecastAvailable && this.sub === undefined && this.held === undefined;
    },
    fxOpen(): boolean {
      return effectForecastOpen('dock');
    },
    forecastStatsByColor(): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> {
      return forecastStatsByColor(this.forecastOwnerColors);
    },
    /** The seats whose CARDS react (a party's or a resolution's fact has no seat to ask stats of). */
    forecastOwnerColors(): ReadonlyArray<string> {
      return forecastOwnerColors(this.forecast, this.players);
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
    confirmVerb: {
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
    /** The «Эффекты» layer lives ONLY on the setup level — a sub-step and the commit boundary fold it instantly. */
    forecastCanOpen(can: boolean): void {
      this.syncUiMirror();
      if (!can) {
        foldForecastHost('dock');
      }
    },
    fxOpen(): void {
      this.syncUiMirror();
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
      fleetDockUi.confirmLabel = this.confirmVerb.label;
      fleetDockUi.confirmEnabled = this.confirmVerb.enabled && this.held === undefined;
      fleetDockUi.answered = this.held !== undefined;
      fleetDockUi.forecastAvailable = this.forecastCanOpen;
      fleetDockUi.forecastOpen = this.fxOpen;
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
      // THE «ЭФФЕКТЫ» LAYER owns the pad while it is open; R3 at the setup level opens it. Both resolved BEFORE
      // the semantic map (no default R3) — the composers' own order.
      if (this.fxOpen) {
        this.onForecastIntent(intent);
        return;
      }
      if (intent.kind === 'press' && intent.button === 'stickR') {
        this.openForecastLayer();
        return;
      }
      // L3 — the card itself, lifted into the viewer out of the hero (X is the trade's verb here, as on a colony).
      if (intent.kind === 'press' && intent.button === 'stickL') {
        if (this.sub === undefined) {
          this.$emit('inspect');
        }
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
    /** R3 / a click on the «⚡ сработает» door — the WORKSPACE DESCEND into the layer (`openForecastHost`: the door's
     *  rect armed SYNCHRONOUSLY, the reacting seats' stats asked, the flare on the animation clock). */
    openForecastLayer(): void {
      if (!this.forecastCanOpen || this.fxOpen) {
        return;
      }
      this.pulseCall = pulseForecastDoor((on) => {
        this.forecastPulse = on;
      }, this.pulseCall);
      openForecastHost('dock', this.$refs.rootEl as HTMLElement | undefined, this.forecastOwnerColors, this.statsView);
    },
    closeForecastLayer(): void {
      if (this.fxOpen) {
        closeEffectForecastLayer('dock');
      }
    },
    /** Input while the layer is open: B folds one level (the explorer's dossier first), R3 closes the whole layer. */
    onForecastIntent(intent: GamepadIntent): void {
      forecastHostIntent('dock', intent, this.$refs.forecastLayer as InstanceType<typeof ConsoleForecastLayer> | undefined);
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
        // X = «Подтвердить торговлю» — the colony trade's commit verb (the card is L3's).
        this.onConfirm();
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
     * X — THE TRADE (the colony stage's commit verb): with several valid Delta Works mixes it is first the
     * gateway to the composition, where X trades. Dead while a sub-step that is not the mix owns the pad.
     */
    onConfirm(): void {
      if (this.sub === 'lanes' || this.sub === 'targets' || !this.canConfirm) {
        return;
      }
      if (this.sub === undefined && this.tradeMixAdjustable) {
        this.sub = 'mix';
        return;
      }
      this.emitConfirm();
    },
    /**
     * A — ONE verb whose meaning follows the cursor, and a choice is a press:
     * on another payment path it SELECTS it (the cursor alone selects nothing),
     * on the payment row it opens the M€ payment, on the «КУДА» row the target
     * step. It never trades — X does.
     */
    onPrimary(): void {
      if (this.sub === 'lanes') {
        if (this.paymentView?.status.ok === true) {
          this.sub = undefined;
        }
        return;
      }
      if (this.sub === 'mix') {
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
      }
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
      const pay = this.payRowsOut;
      this.heldTarget = target;
      this.heldCounts = counts;
      this.held = {entry: entry === undefined ? undefined : (mix !== undefined ? {...entry, mix} : entry)};
      this.heldChips = chips;
      this.heldPlan = plan;
      this.heldReaction = this.presentReaction;
      this.heldPay = pay;
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
      this.heldPay = undefined;
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
          out.push({direction: 'gain', icon: effect.icon, amount: effect.amount, note: 'Choose the receiving card'});
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
    // The ROOM follows the stage's own box from here on (a host that resizes) — the first answer is the
    // press-time measurement's, so nothing re-fits under the entrance.
    const root = this.$refs.rootEl as HTMLElement | undefined;
    if (root !== undefined && root !== null) {
      this.stopRoomObs = useResizeObserver(root, () => {
        const h = root.clientHeight;
        if (h > 0 && Math.abs(h - this.roomH) >= 1) {
          this.roomH = h;
        }
      }).stop;
    }
    this.focusIdx = Math.max(0, this.focusables.findIndex((f) => f.zone === 'pay' && f.index === this.payIdx));
    this.syncUiMirror();
  },
  beforeUnmount() {
    this.stopRoomObs?.();
    this.sceneMotion?.kill();
    this.sceneCall?.kill();
    this.sceneCall = undefined;
    this.pulseCall?.kill();
    this.pulseCall = undefined;
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
    fleetDockUi.confirmEnabled = false;
    fleetDockUi.answered = false;
    fleetDockUi.forecastAvailable = false;
    fleetDockUi.forecastOpen = false;
    closeEffectForecastLayer('dock');
  },
});
</script>
