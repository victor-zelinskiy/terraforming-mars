<template>
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
       :style="{'--fleetdock-hero-h': heroNeedPx + 'px'}"
       :data-fleet-dock-entering="entering ? '' : undefined"
       :data-fleet-dock-art="heroArtTier"
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
          <!-- THE ART TIER DOES NOT CHANGE IN FLIGHT (ledger EZ): the hero carries the thumb while the descend's FLIP
               flies it, and shows the full file only once the entry has SETTLED and that file is decoded — the face
               crossfades the two (`PremiumCardArt`), never a blink to black. -->
          <div class="con-fleetdock__face" :style="{'--con-fleetdock-zoom': String(heroZoom)}">
            <ConsoleCardFaceLite :name="card" :card="heroModel" :artTier="heroArtTier" />
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

<script setup lang="ts">
/*
 * THE FLEET-DOCK STAGE — a trade whose fleet goes to a CARD (Turmoil Redux
 * TR06 Water Hauling and its sisters). ONE MORE DIRECTION OF THE TRADE (the
 * owner, 2026-10-25): it stands on the colony trade stage's own materials and
 * in its own grammar — the same surface, the same three columns, the same
 * words — so walking from a colony to a dock changes the SUBJECT, never the
 * screen. It never titles itself: the crumb above reads «КОЛОНИИ › ПЕРЕВОЗКА
 * ВОДЫ › ТОРГОВЛЯ».
 *
 *   HERO     the card itself where the colony stage stands its planet — the
 *            full premium face (the ▲ of its printed effect is where the
 *            fleet lands), a laconic line of what the dock does (the card's
 *            own curated short) and the honest verdict under it. Its size is
 *            SOLVED BEFORE the stage mounts (the room the section measured at
 *            the press): the tile's face FLIPs into a box that is already its
 *            final size, never into one that re-fits a frame later.
 *   MAIN     «СПОСОБ ОПЛАТЫ» — the SAME rows and the SAME model as the colony
 *            stage (`ConsoleTradePayRows` / `tradePayModel`), the M€ payment,
 *            the Delta Works mix and the reward's «КУДА» row.
 *   RESULT   «ИТОГ ТОРГОВЛИ» — the colony stage's summary rail: «ВАШ ИТОГ»
 *            (only the server's chips, as the rail's own rows), what the
 *            TABLE answers («⚡ сработает» — the R3 «Эффекты» door), the trade
 *            fleet leaving the supply, the payment, and the next step's note.
 *
 * The verbs are the colony trade's: A selects (a path, the payment, the
 * target), X trades, L3 lifts the card into the viewer, R3 the effects.
 *
 * A reward that LANDS ON A CARD (TR27 Aurora Station) names its card before
 * the press («КУДА» — `ConsoleTradeTargetValue`) and, with several holders,
 * descends into the trade's TARGET STEP (`ConsoleTradeTargetStep` — the
 * colony stage's own host). Past the commit the receiving card stands on the
 * stage (`ConsoleTradeReceivingCards`), or the tokens land on the hero itself.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {motionAfter} from '@/client/console/session/sessionWaits';
import {useFlowScope} from '@/client/console/session/useFlowScope';
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
import {cardArtUrlAtTier, premiumCardArt} from '@/client/cards/cardArt';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {fleetDockUi, setColonyFocusStage} from '@/client/console/consoleColoniesModel';
import {paymentLanes, megacreditsAvailable, paymentFromCounts, initialCounts, dialLaneCount, buildPaymentView, buildEnergyMixView, clampEnergyMixSteel, editableRows, PaymentLane, PaymentView} from '@/client/console/paymentPlan';
import {afterConfirmNotes, tradeSteps, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {TradePayEntry, TradePayRow, tradePayDisabledEntries, tradePayEntries, visibleTradePayDisabled, visibleTradePayRows} from '@/client/console/colonyTrade/tradePayModel';
import {cardColonyTradeCard, lockedTradePaymentIndex, partyColonyTradeParty} from '@/client/console/colonyTrade/colonyTradeEntry';
import {fleetDockCardTarget, FleetDockCardTarget, fleetDockEffectDescription, fleetDockEffectNode, fleetDockScenePlan, FleetDockScenePlan, printedRewardUnits, tradeKnownRailMoves} from '@/client/console/colonyTrade/fleetDockModel';
import {ColonyTradePresentedTarget, buildColonyTradeTargetModel, openTradeTargetFocus, presentedTargetModel} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import {PlayedTargetModel} from '@/client/console/played/consolePlayedTargetModel';
import {cardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {armFleetDockScene, armedFleetDockScene, disarmFleetDockScene, fleetDockAnswerFlight, fleetDockRewardKey, fleetDockSceneState, setFleetDockScenePhase, setFleetDockStageCard, endFleetDockScene} from '@/client/console/colonyTrade/fleetDockScene';
import {flyRailReward, railRewardState} from '@/client/console/resourceTransfer/railReward';
import {forecastLayerAvailable, reactionChipsOf, VariantReaction} from '@/client/console/effectForecastModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {closeEffectForecastLayer, effectForecastOpen} from '@/client/console/consoleEffectForecast';
import {foldForecastHost, forecastHostIntent, forecastOwnerColors as forecastOwnerColorsOf, forecastStatsByColor as forecastStatsByColorOf, openForecastHost, pulseForecastDoor} from '@/client/console/consoleForecastHost';
import {VersionedView} from '@/client/console/gameStateVersion';
import ConsoleForecastDoor from '@/client/components/console/ConsoleForecastDoor.vue';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {runActionCommitMotion, resolveActionCommitAnchors, resolveGainIconOrigins, ActionCommitMotionHandle} from '@/client/console/consoleActionCommitMotion';
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
import type {FleetDockConfirmPayload} from '@/client/components/console/consoleFleetDockStageTypes';
import {vEmbedZone} from '@/client/directives/vDirectives';

export type {FleetDockConfirmPayload};
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
/** Decode one art file (true = the picture exists now); a no-op `false` where there is no image pipeline (JSDOM). */
function decodeCardArt(url: string): Promise<boolean> {
  if (typeof Image === 'undefined' || typeof navigator === 'undefined' || /jsdom/i.test(navigator.userAgent)) {
    return Promise.resolve(false);
  }
  const img = new Image();
  img.src = url;
  if (typeof img.decode === 'function') {
    return img.decode().then(() => true, () => false);
  }
  return new Promise((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
  });
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

defineOptions({name: 'ConsoleFleetDockStage'});
const props = defineProps({
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
  /**
   * THE ENTRY IS IN FLIGHT (the section's descend phrase has not settled — its `done`): the hero's zoom is FROZEN
   * at the press-time room and its art stays on the thumb tier, so the box the FLIP aims at never re-fits and the
   * picture never re-decodes under the flight (ledger EZ — «при входе внутрь причала его карта странно скачет»).
   */
  entering: {type: Boolean, default: false},
});
const emit = defineEmits(['confirm', 'cancel', 'inspect', 'flow-complete']);

const flow = useFlowScope('fleet-dock-stage');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const forecastLayer = useTemplateRef<InstanceType<typeof ConsoleForecastLayer>>('forecastLayer');
const targetStep = useTemplateRef<TradeTargetStepHandle>('targetStep');
const payRows = useTemplateRef<{focusedEl?: () => HTMLElement | undefined}>('payRows');
const scroll = useTemplateRef<{ensureVisible?: (el: Element | null | undefined) => void}>('scroll');
const cardEl = useTemplateRef<HTMLElement>('cardEl');
const payIdx = ref(0);
const focusIdx = ref(0);
const sub = ref<'lanes' | 'mix' | 'targets' | undefined>(undefined);
/** The card the player CHOSE for the reward ('' = none — a choice is a press, never seeded). */
const targetCapture = ref('');
/** Past the commit: the receiving card as chosen AT THE PRESS ('' when the dock pays no card). */
const heldTarget = ref('');
/** Past the commit: the viewer's card counters as they stood AT THE PRESS — the frozen «было» of a receiving card. */
const heldCounts = ref<Record<string, number>>({});
const landings = cardResourceLandings;
const outcome = workspaceOutcomeState;
const subIdx = ref(0);
const steelMixPreference = ref(0);
const mixFlashNonce = ref(0);
const payFlashNonce = ref(0);
const paymentCounts = ref<Partial<Record<SpendableResource, number>>>({});
/** The COMMIT BOUNDARY: the receipt the stage keeps showing past the answer. */
const held = ref<HeldView | undefined>(undefined);
/** The pinned result chips (the answer re-prices the reward under the scene). */
const heldChips = ref<ReadonlyArray<ActionEffect> | undefined>(undefined);
/** The pinned plan of the scene — the reward's category as the server's preview stated it AT THE PRESS. */
const heldPlan = ref<FleetDockScenePlan | undefined>(undefined);
/** The pinned answer of the table (the receipt keeps naming what the press was promised). */
const heldReaction = ref<VariantReaction | undefined>(undefined);
/** The one-shot COMMIT flare on the «⚡ сработает» group. */
const forecastPulse = ref(false);
const railReward = railRewardState;
/** The room's height — the press-time measurement until the stage's own box answers (a resize of the host). */
const roomH = ref(props.roomHeight);
const layout = consoleLayoutState;
/** The payment rows pinned at the commit boundary (the answer takes the options away under the receipt). */
const heldPay = ref<ReadonlyArray<PayOutRow> | undefined>(undefined);
const cardLeaving = ref(false);
const scene = fleetDockSceneState;
/**
 * The scene's pending wait between two beats — on the ANIMATION clock (see `sceneWait`). A plain handle in a
 * plain variable, never the tween itself and never a ref: nothing reactive reads it, a ref's value is a reactive
 * proxy, and a proxied GSAP tween is not the object its own timeline holds.
 */
let sceneCall: {kill: () => void} | undefined;
/** The «сработает» group's commit flare (a plain handle in a plain variable — never the tween itself, never a ref). */
let pulseCall: {kill: () => void} | undefined;
let sceneMotion: ActionCommitMotionHandle | undefined;
let stopRoomObs: (() => void) | undefined;
/** The full art file is decoded AND the entry has settled — the hero shows the full tier. */
const heroArtFull = ref(false);

/**
 * THE HERO'S ZOOM — the profile's card width, capped by the room's height (the hero column holds the card,
 * the laconic line and the verdict). Pure arithmetic over known numbers, so the face mounts at its final size.
 */
const heroZoom = computed((): number => {
  const rem = remPx();
  const width = (HERO_CARD_W_REM[layout.profile] ?? HERO_CARD_W_REM_DEFAULT) * rem;
  const capH = roomH.value > 0 ? roomH.value - HERO_RESERVE_REM * rem : Infinity;
  const w = Math.min(width, capH * CARD_W / CARD_H);
  return Math.max(0.3, Math.floor((w / CARD_W) * 1000) / 1000);
});
/**
 * THE HERO'S OWN ROOM (px) — the card at its solved zoom plus what the column holds under it. The surface's floor
 * (`--fleetdock-hero-h`): the server's preview arrives AFTER the entry and grows the result rail, and a surface
 * sized by its content then re-centred the hero under the eye. Known before the first frame, never measured.
 */
const heroNeedPx = computed((): number => {
  return Math.ceil(CARD_H * heroZoom.value + HERO_RESERVE_REM * remPx());
});
/** The tier the hero paints: the thumb through the entry's flight, the full file once settled and decoded. */
const heroArtTier = computed((): 'full' | 'thumb' => {
  return heroArtFull.value ? 'full' : 'thumb';
});
/** What the dock does, in one calm line — the card's own curated short (`effect-short`), never a truncation. */
const shortRule = computed((): string => {
  const renderData = getCard(props.card)?.metadata.renderData;
  const rules = effectRules({
    cardName: props.card, effectIndex: 0, effectNode: fleetDockEffectNode(renderData),
    description: fleetDockEffectDescription(renderData), text: undefined,
  }, 1);
  return rules === undefined ? '' : effectRuleText(rules.summary);
});
/** «ВАШ ИТОГ» — the server's reward chips as the colony rail's rows (the fleet has its own section). */
const gainRows = computed((): ReadonlyArray<RailRow> => {
  return resultChips.value.filter((chip) => chip.icon !== TRADE_FLEET_ICON).map((chip): RailRow => {
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
});
/** The trade fleet leaving the supply — the result's own chip (pinned with it past the commit). */
const fleetRow = computed((): {current: number, resulting: number} => {
  const chip = resultChips.value.find((c) => c.icon === TRADE_FLEET_ICON);
  return {current: chip?.current ?? props.freeFleets, resulting: chip?.resulting ?? Math.max(0, props.freeFleets - 1)};
});
/**
 * «ОПЛАТА» — what the chosen path takes off the rail: the Delta Works composition, the M€ path's own payment,
 * or the path's fee as the server priced it (`current → resulting`). Pinned at the commit. A card door's bare
 * pick pays nothing here (its fee was the card's).
 */
const payRowsOut = computed((): ReadonlyArray<PayOutRow> => {
  if (heldPay.value !== undefined) {
    return heldPay.value;
  }
  if (props.pickMode || !props.available) {
    return [];
  }
  const icon = (unit: string): string => {
    const cls = iconClassFor(unit);
    return cls === '' ? '' : cls + ' con-task__opt-res';
  };
  const mix = payRowMix.value;
  if (mix !== undefined) {
    return [{unit: 'energy', amount: mix.energy}, {unit: 'steel', amount: mix.steel}]
      .filter((r) => r.amount > 0)
      .map((r) => ({iconClass: icon(r.unit), amount: r.amount, reading: ''}));
  }
  const view = paymentView.value;
  if (view !== undefined) {
    return view.rows.filter((row) => row.used > 0).map((row) => ({
      iconClass: icon(row.unit), amount: row.used, reading: `${row.available} → ${Math.max(0, row.available - row.used)}`,
    }));
  }
  const meta = props.options[payIdx.value]?.metadata;
  const resource = meta?.resource;
  if (meta?.icon === undefined || resource === undefined) {
    return [];
  }
  return [{iconClass: icon(meta.icon), amount: Math.max(0, resource.current - resource.resulting), reading: `${resource.current} → ${resource.resulting}`}];
});
/** X — the trade's commit (the colony stage's verb): «Торговать», or the gateway to the Delta Works mix. */
const confirmVerb = computed((): {label: string, enabled: boolean} => {
  if (sub.value === 'lanes' || sub.value === 'targets') {
    return {label: 'Confirm trade', enabled: false};
  }
  if (sub.value === 'mix') {
    return {label: 'Confirm trade', enabled: canConfirm.value};
  }
  return {label: tradeMixAdjustable.value ? 'Continue to payment' : 'Confirm trade', enabled: canConfirm.value};
});
/** Past the commit the stage is a RECEIPT: the live props flip under it (the trade is spent). */
const presentAvailable = computed((): boolean => {
  return held.value !== undefined || props.available;
});
const payEntries = computed((): Array<TradePayEntry> => {
  return tradePayEntries(props.options, textOf, payIconClass);
});
const disabledEntries = computed((): ReturnType<typeof tradePayDisabledEntries> => {
  return tradePayDisabledEntries(props.disabledOptions, textOf, payIconClass);
});
const lockedPayIdx = computed((): number => {
  return lockedTradePaymentIndex(props.options, cardColonyTradeCard(), partyColonyTradeParty());
});
const visibleRows = computed((): Array<TradePayRow> => {
  return visibleTradePayRows(payEntries.value, lockedPayIdx.value, held.value !== undefined);
});
const visibleDisabled = computed((): ReadonlyArray<ReturnType<typeof tradePayDisabledEntries>[number]> => {
  return visibleTradePayDisabled(disabledEntries.value, lockedPayIdx.value, held.value !== undefined);
});
const isMcSelected = computed((): boolean => {
  return props.options[payIdx.value]?.metadata?.icon === 'megacredits';
});
const isEnergySelected = computed((): boolean => {
  return props.options[payIdx.value]?.metadata?.icon === 'energy';
});
const steps = computed((): Array<TradeStep> => {
  return held.value !== undefined || !props.available ? [] :
    tradeSteps(props.preview, isMcSelected.value, isEnergySelected.value);
});
const paymentStep = computed((): Extract<TradeStep, {kind: 'payment'}> | undefined => {
  const step = steps.value.find((s) => s.kind === 'payment');
  return step?.kind === 'payment' ? step : undefined;
});
/** The reward's card target as the server's preview states it (absent = the reward lands on no card). */
const cardTarget = computed((): FleetDockCardTarget | undefined => {
  return fleetDockCardTarget(props.preview?.followUps);
});
/** The target STEP — present only when the server will ASK (several holders; one holder is named, not asked). */
const cardTargetStep = computed((): Extract<TradeStep, {kind: 'cardTarget'}> | undefined => {
  const step = steps.value.find((s) => s.kind === 'cardTarget');
  return step?.kind === 'cardTarget' ? step : undefined;
});
const targetIcon = computed((): string => {
  const resource = cardTarget.value?.resource;
  return resource === undefined ? '' : cardResourceKey(resource);
});
/**
 * THE CARD THAT RECEIVES — past the commit, the card the paying response named (else the press-time choice);
 * before it, the player's own choice (a choice is a press: nothing is pre-selected), or the one holder the
 * server names when there is no choice to make.
 */
const chosenTarget = computed((): string | undefined => {
  if (held.value !== undefined) {
    const named = scene.card === props.card && scene.target !== '' ? scene.target : heldTarget.value;
    return named !== '' ? named : undefined;
  }
  if (cardTargetStep.value !== undefined) {
    return targetCapture.value !== '' ? targetCapture.value : undefined;
  }
  return cardTarget.value !== undefined && !cardTarget.value.lost ? cardTarget.value.auto : undefined;
});
/** The «КУДА» row — undefined when the reward lands on no card. */
const targetRow = computed((): TargetRow | undefined => {
  const target = cardTarget.value;
  if (target === undefined || target.lost) {
    return undefined;
  }
  const card = chosenTarget.value;
  const before = card === undefined ? 0 : countOf(card);
  return {
    card,
    impact: card === undefined ? '' : `${before} → ${before + target.amount}`,
    iconClass: targetIcon.value === '' ? '' : payIconClass(targetIcon.value),
    pickable: cardTargetStep.value !== undefined,
    missing: cardTargetStep.value !== undefined && card === undefined,
  };
});
/**
 * THE STEP'S MODEL — the colony stage's own translation of the trade step (`buildColonyTradeTargetModel`),
 * with the two things only this stage has: its hero is a card that is itself a candidate («ЭТА КАРТА»), and
 * each candidate reads what the floaters do to its points.
 */
const targetStepModel = computed((): PlayedTargetModel | undefined => {
  const step = cardTargetStep.value;
  if (step === undefined || props.viewerColor === undefined) {
    return undefined;
  }
  return buildColonyTradeTargetModel({
    step,
    ask: textOf(step.pick.title) || translateText('Choose the receiving card'),
    players: props.players,
    viewerColor: props.viewerColor,
    typeOf: (name) => getCard(name)?.type,
    resourceOf: (name) => getCard(name)?.resourceType,
    sourceCardName: props.card,
    victoryPoints: true,
  });
});
/** The units the reward lays on its card (the plan's own tokens, summed). */
const rewardUnits = computed((): number => {
  return presentPlan.value.specs.filter((spec) => spec.channel === 'card-resource').reduce((sum, spec) => sum + spec.amount, 0);
});
/** A follow-up embedded in the colonies' zone is ON SCREEN (a question re-asked live). */
const claimPresenting = computed((): boolean => {
  return outcome.host === 'colonies' && outcome.stage === 'presenting';
});
/**
 * THE RECEIVING CARD on the stage, past the commit — standing before the first token leaves the dock, frozen
 * at its press-time count. None when the dock receives on its own face, and none while a re-asked question
 * stands in the zone (the card it names is not decided yet).
 */
const presentedTargets = computed((): ReadonlyArray<ColonyTradePresentedTarget> => {
  const target = chosenTarget.value;
  if (held.value === undefined || presentPlan.value.category !== 'card' || target === undefined || target === props.card || claimPresenting.value) {
    return [];
  }
  return [{
    card: target as CardName,
    role: 'tradeReward',
    icon: presentPlan.value.firstResource ?? '',
    amount: rewardUnits.value,
    before: heldCounts.value[target] ?? 0,
  }];
});
/** The hero's face: FROZEN at its press-time count while its own counter is the one receiving (TR27 with one holder). */
const heroModel = computed((): CardModel | undefined => {
  if (held.value === undefined || presentPlan.value.category !== 'card' || chosenTarget.value !== props.card) {
    return props.model;
  }
  return presentedTargetModel(
    {card: props.card, role: 'tradeReward', icon: presentPlan.value.firstResource ?? '', amount: rewardUnits.value, before: heldCounts.value[props.card] ?? 0},
    props.model,
    landings.by[props.card] ?? 0);
});
const payLanes = computed((): ReadonlyArray<PaymentLane> => {
  const step = paymentStep.value;
  return step === undefined || props.thisPlayer === undefined ? [] : paymentLanes(step.model, props.thisPlayer);
});
const paymentView = computed((): PaymentView | undefined => {
  const step = paymentStep.value;
  if (step === undefined || props.thisPlayer === undefined) {
    return undefined;
  }
  return buildPaymentView({
    cost: step.model.amount,
    lanes: payLanes.value,
    counts: paymentCounts.value,
    mcAvailable: megacreditsAvailable(props.thisPlayer),
  });
});
const payFocusUnit = computed((): string | undefined => {
  const view = paymentView.value;
  return view === undefined || sub.value !== 'lanes' ? undefined : editableRows(view)[subIdx.value]?.unit;
});
const paymentSummary = computed((): string => {
  const view = paymentView.value;
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
});
const energyMixInfo = computed((): FleetDockPreviewModel['energyMix'] => {
  const mix = props.preview?.energyMix;
  return mix === undefined || !isEnergySelected.value || held.value !== undefined ? undefined : mix;
});
const energyMixLive = computed((): boolean => {
  return held.value === undefined && props.preview?.energyMix !== undefined;
});
const energyEntryIdx = computed((): number => {
  return props.options.findIndex((o) => o.metadata?.icon === 'energy');
});
const tradeSteelMix = computed((): number => {
  const mix = energyMixInfo.value;
  return mix === undefined ? 0 : clampEnergyMixSteel(steelMixPreference.value, mix);
});
const tradeMixAdjustable = computed((): boolean => {
  const mix = energyMixInfo.value;
  return mix !== undefined && mix.maxSteel > mix.minSteel;
});
const tradeMixView = computed((): PaymentView => {
  const mix = energyMixInfo.value;
  return buildEnergyMixView({
    cost: mix?.cost ?? 0,
    energyAvailable: mix?.energyAvailable ?? 0,
    steelAvailable: mix?.steelAvailable ?? 0,
    minSteel: mix?.minSteel ?? 0,
    maxSteel: mix?.maxSteel ?? 0,
    steelUsed: tradeSteelMix.value,
  });
});
const payRowMix = computed((): {energy: number, steel: number} | undefined => {
  const mix = energyMixInfo.value;
  return mix === undefined ? undefined : {energy: (mix.cost ?? 0) - tradeSteelMix.value, steel: tradeSteelMix.value};
});
/** The cursor's stops: the payment paths (never a locked fee) + the M€ payment row. */
const focusables = computed((): Array<Focusable> => {
  if (!presentAvailable.value || held.value !== undefined) {
    return [];
  }
  const out: Array<Focusable> = lockedPayIdx.value >= 0 ? [] : payEntries.value.map((_, index) => ({zone: 'pay' as const, index}));
  if (paymentStep.value !== undefined) {
    out.push({zone: 'payment', index: 0});
  }
  if (cardTargetStep.value !== undefined) {
    out.push({zone: 'target', index: 0});
  }
  return out;
});
const focused = computed((): Focusable | undefined => {
  return focusables.value[Math.min(focusIdx.value, Math.max(0, focusables.value.length - 1))];
});
const focusedZone = computed((): Zone | undefined => {
  return sub.value === undefined ? focused.value?.zone : undefined;
});
const focusedPayIndex = computed((): number => {
  return focusedZone.value === 'pay' ? (focused.value?.index ?? -1) : -1;
});
/** Every decision is in and the server offers the trade. */
const canConfirm = computed((): boolean => {
  if (held.value !== undefined || !props.available) {
    return false;
  }
  // A CHOICE IS A PRESS: with several holders the trade waits for the card to be named (a card door's bare
  // pick too — its fee was the card's, its reward is still this one).
  if (cardTargetStep.value !== undefined && targetCapture.value === '') {
    return false;
  }
  if (props.pickMode) {
    return true;
  }
  if (props.options[payIdx.value] === undefined) {
    return false;
  }
  return paymentView.value === undefined || paymentView.value.status.ok;
});
/**
 * What A does on the cursor's row — the colony trade's grammar: A SELECTS (another path, the payment, the
 * reward's card), it never trades; X does (`confirmVerb`). The bar reads the label the stage publishes.
 */
const primary = computed((): {label: string, enabled: boolean, commits: boolean} => {
  if (sub.value === 'lanes') {
    return {label: 'Done', enabled: paymentView.value?.status.ok === true, commits: false};
  }
  if (sub.value === 'mix') {
    return {label: 'Select', enabled: false, commits: false};
  }
  if (sub.value === 'targets') {
    return {label: 'Select', enabled: true, commits: false};
  }
  const focusedNow = focused.value;
  if (focusedNow?.zone === 'payment') {
    return {label: 'Select', enabled: payLanes.value.length > 0, commits: false};
  }
  if (focusedNow?.zone === 'target') {
    return {label: 'Select', enabled: targetStepModel.value !== undefined, commits: false};
  }
  return {label: 'Select', enabled: focusedNow?.zone === 'pay' && focusedNow.index !== payIdx.value && lockedPayIdx.value < 0, commits: false};
});
/** THE RESULT — the server's chips (pinned past the commit) + the fleet leaving the supply. */
const resultChips = computed((): ReadonlyArray<ActionEffect> => {
  if (heldChips.value !== undefined) {
    return heldChips.value;
  }
  const effects = cardEffects(props.preview?.effects ?? props.offerEffects);
  const fleet: ActionEffect = {
    direction: 'cost',
    icon: TRADE_FLEET_ICON,
    amount: 1,
    current: props.freeFleets,
    resulting: Math.max(0, props.freeFleets - 1),
    // The unit is NAMED (PL-008): the fleet glyph alone read as one more resource of the reward.
    note: 'Trade fleet',
  };
  return [...effects, fleet];
});
/**
 * What the reward raises AFTER the confirm («После подтверждения: тайл океана на поле») — the server's own
 * follow-ups through the ONE table of their lines (`colonyTradePlan.afterConfirmNotes`). A reward that
 * raises nothing (a plain gain) has no line, and the block above it stands exactly where it stood.
 */
const followUpNotes = computed((): Array<string> => {
  return afterConfirmNotes(props.preview?.followUps ?? []);
});
/** The scene this trade will play — its reward's category, read off the server's preview (never off the card). */
const scenePlan = computed((): FleetDockScenePlan => {
  const target = cardTarget.value;
  return fleetDockScenePlan(props.preview, target === undefined ? undefined : {
    target: chosenTarget.value as CardName | undefined,
    tokens: printedRewardUnits(fleetDockEffectNode(getCard(props.card)?.metadata.renderData), target.resource, target.amount),
  });
});
/** Past the commit the plan is the PINNED one: the answer re-prices the preview under the scene. */
const presentPlan = computed((): FleetDockScenePlan => {
  return heldPlan.value ?? scenePlan.value;
});
/**
 * WHAT THE TABLE ANSWERS to the reward — the server's own forecast facts (`FleetDockPreviewModel.forecast.facts`)
 * as the «⚡ сработает» chips every composer draws. Nothing is derived here: no fact, no group.
 */
const presentReaction = computed((): VariantReaction => {
  return heldReaction.value ?? reactionChipsOf(forecast.value?.facts ?? []);
});
// ── THE EFFECT FORECAST (rides inside the dock preview) — the R3 «Эффекты» layer, the composers' own ──
const forecast = computed((): EffectForecast | undefined => {
  return props.preview?.forecast;
});
const forecastAvailable = computed((): boolean => {
  return forecastLayerAvailable(forecast.value);
});
/** R3 is the SETUP level's verb — silent in a sub-step (the lanes, the mix, the target step) and past the commit. */
const forecastCanOpen = computed((): boolean => {
  return forecastAvailable.value && sub.value === undefined && held.value === undefined;
});
const fxOpen = computed((): boolean => {
  return effectForecastOpen('dock');
});
const forecastStatsByColor = computed((): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> => {
  return forecastStatsByColorOf(forecastOwnerColors.value);
});
/** The seats whose CARDS react (a party's or a resolution's fact has no seat to ask stats of). */
const forecastOwnerColors = computed((): ReadonlyArray<string> => {
  return forecastOwnerColorsOf(forecast.value, props.players);
});
/** A rail reward of THIS dock that was not shown as promised — named (`railReward.ts`), never silent. */
const rewardDegraded = computed((): string | undefined => {
  const degraded = railReward.degraded;
  return degraded !== undefined && degraded.key === fleetDockRewardKey(props.card) ? degraded.why : undefined;
});
/**
 * The scene may start: the hold stands — seeded in the very block that applied the view, i.e. the
 * fleet has LANDED and the real mark stands on the ▲. The proxy's crossfade onto that mark overlaps
 * the card's answer (one gesture, never a pause between the touchdown and the answer).
 */
const sceneDue = computed((): boolean => {
  return scene.holding && scene.card === props.card && scene.phase === 'seeded';
});

function syncUiMirror(): void {
  fleetDockUi.sub = sub.value ?? '';
  fleetDockUi.primaryLabel = primary.value.label;
  fleetDockUi.primaryEnabled = primary.value.enabled && held.value === undefined;
  fleetDockUi.primaryCommits = primary.value.commits;
  fleetDockUi.confirmLabel = confirmVerb.value.label;
  fleetDockUi.confirmEnabled = confirmVerb.value.enabled && held.value === undefined;
  fleetDockUi.answered = held.value !== undefined;
  fleetDockUi.forecastAvailable = forecastCanOpen.value;
  fleetDockUi.forecastOpen = fxOpen.value;
}
function seedPaymentDefault(): void {
  const step = paymentStep.value;
  if (step === undefined || props.thisPlayer === undefined) {
    paymentCounts.value = {};
    return;
  }
  const lanes = paymentLanes(step.model, props.thisPlayer);
  paymentCounts.value = initialCounts(step.model.amount, lanes, megacreditsAvailable(props.thisPlayer));
}
/** The shell routes every intent here while the stage stands. */
function handleIntent(intent: GamepadIntent): void {
  // A commit on the wire or a scene playing owns the moment — input is absorbed.
  if (held.value !== undefined) {
    return;
  }
  // THE «ЭФФЕКТЫ» LAYER owns the pad while it is open; R3 at the setup level opens it. Both resolved BEFORE
  // the semantic map (no default R3) — the composers' own order.
  if (fxOpen.value) {
    onForecastIntent(intent);
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickR') {
    openForecastLayer();
    return;
  }
  // L3 — the card itself, lifted into the viewer out of the hero (X is the trade's verb here, as on a colony).
  if (intent.kind === 'press' && intent.button === 'stickL') {
    if (sub.value === undefined) {
      emit('inspect');
    }
    return;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  const action = consoleActionOf(intent);
  if (action !== undefined) {
    onPress(action);
  }
}
/** R3 / a click on the «⚡ сработает» door — the WORKSPACE DESCEND into the layer (`openForecastHost`: the door's
 *  rect armed SYNCHRONOUSLY, the reacting seats' stats asked, the flare on the animation clock). */
function openForecastLayer(): void {
  if (!forecastCanOpen.value || fxOpen.value) {
    return;
  }
  pulseCall = pulseForecastDoor((on) => {
    forecastPulse.value = on;
  }, pulseCall);
  openForecastHost('dock', rootEl.value ?? undefined, forecastOwnerColors.value, props.statsView);
}
/** Input while the layer is open: B folds one level (the explorer's dossier first), R3 closes the whole layer. */
function onForecastIntent(intent: GamepadIntent): void {
  forecastHostIntent('dock', intent, forecastLayer.value ?? undefined);
}
function onNav(dir: NavDirection): void {
  if (sub.value === 'targets') {
    targetHost()?.nav(dir);
    return;
  }
  if (sub.value === 'lanes') {
    if (dir === 'up' || dir === 'down') {
      subIdx.value = Math.min(payLanes.value.length - 1, Math.max(0, subIdx.value + (dir === 'down' ? 1 : -1)));
    } else {
      adjustPayLane(subIdx.value, dir === 'right' ? 1 : -1);
    }
    return;
  }
  if (sub.value !== undefined) {
    return;
  }
  if (dir === 'up' || dir === 'down') {
    focusIdx.value = Math.min(focusables.value.length - 1, Math.max(0, focusIdx.value + (dir === 'down' ? 1 : -1)));
    scrollFocusedIntoView();
  }
}
function adjustPayLane(idx: number, step: number, toMax = false): void {
  const view = paymentView.value;
  const lane = payLanes.value[idx];
  if (view === undefined || lane === undefined) {
    return;
  }
  const before = paymentCounts.value[lane.unit] ?? 0;
  const next = dialLaneCount(view.cost, lane, payLanes.value, paymentCounts.value, toMax ? 'max' : step);
  if (next !== before) {
    paymentCounts.value = {...paymentCounts.value, [lane.unit]: next};
    payFlashNonce.value += 1;
  }
}
function adjustTradeMix(delta: number): void {
  const mix = energyMixInfo.value;
  if (sub.value !== 'mix' || mix === undefined || !tradeMixAdjustable.value) {
    return;
  }
  const next = clampEnergyMixSteel(tradeSteelMix.value + delta, mix);
  if (next !== tradeSteelMix.value) {
    steelMixPreference.value = next;
    mixFlashNonce.value += 1;
  }
}
function onPress(action: ConsoleAction): void {
  // THE TARGET STEP SPEAKS THE SHARED SELECTOR'S GRAMMAR — A chooses, X inspects the focused candidate, LB/RB
  // the owner axis, B one level back with the previous choice intact.
  if (sub.value === 'targets') {
    switch (action) {
    case 'primary': targetHost()?.confirm(); return;
    case 'inspect': targetHost()?.inspect(); return;
    case 'prevSection': targetHost()?.cycleOwner(-1); return;
    case 'nextSection': targetHost()?.cycleOwner(1); return;
    case 'back': closeTargetStep(); return;
    default: return;
    }
  }
  switch (action) {
  case 'primary':
    onPrimary();
    return;
  case 'inspect':
    // X = «Подтвердить торговлю» — the colony trade's commit verb (the card is L3's).
    onConfirm();
    return;
  case 'prevSection':
    adjustTradeMix(-1);
    return;
  case 'nextSection':
    adjustTradeMix(1);
    return;
  case 'nextTab':
    if (sub.value === 'lanes') {
      adjustPayLane(subIdx.value, 0, true);
    }
    return;
  case 'back':
    if (sub.value !== undefined) {
      sub.value = undefined;
      return;
    }
    emit('cancel');
    return;
  default:
    return;
  }
}
/**
 * X — THE TRADE (the colony stage's commit verb): with several valid Delta Works mixes it is first the
 * gateway to the composition, where X trades. Dead while a sub-step that is not the mix owns the pad.
 */
function onConfirm(): void {
  if (sub.value === 'lanes' || sub.value === 'targets' || !canConfirm.value) {
    return;
  }
  if (sub.value === undefined && tradeMixAdjustable.value) {
    sub.value = 'mix';
    return;
  }
  emitConfirm();
}
/**
 * A — ONE verb whose meaning follows the cursor, and a choice is a press:
 * on another payment path it SELECTS it (the cursor alone selects nothing),
 * on the payment row it opens the M€ payment, on the «КУДА» row the target
 * step. It never trades — X does.
 */
function onPrimary(): void {
  if (sub.value === 'lanes') {
    if (paymentView.value?.status.ok === true) {
      sub.value = undefined;
    }
    return;
  }
  if (sub.value === 'mix') {
    return;
  }
  const focusedNow = focused.value;
  if (focusedNow?.zone === 'payment') {
    if (payLanes.value.length > 0) {
      sub.value = 'lanes';
      subIdx.value = 0;
    }
    return;
  }
  if (focusedNow?.zone === 'target') {
    openTargetStep();
    return;
  }
  if (focusedNow?.zone === 'pay' && focusedNow.index !== payIdx.value && lockedPayIdx.value < 0) {
    payIdx.value = focusedNow.index;
  }
}
function emitConfirm(): void {
  const captures: Record<number, unknown> = {};
  steps.value.forEach((step, i) => {
    if (step.kind === 'payment') {
      const view = paymentView.value;
      if (view !== undefined && props.thisPlayer !== undefined) {
        captures[i] = paymentFromCounts(view.cost, payLanes.value, paymentCounts.value, megacreditsAvailable(props.thisPlayer));
      }
    } else if (step.kind === 'energyMix') {
      captures[i] = tradeSteelMix.value;
    } else if (step.kind === 'cardTarget' && targetCapture.value !== '') {
      captures[i] = targetCapture.value;
    }
  });
  const payload: FleetDockConfirmPayload = {
    paymentIndex: payIdx.value, steps: steps.value, captures,
    asksCard: cardTarget.value !== undefined && !cardTarget.value.lost,
  };
  emit('confirm', payload);
}
/**
 * THE COMMIT BOUNDARY (the shell calls it once ITS guards accepted the
 * confirm): pin what the stage shows — the chosen path as a receipt (a mix
 * keeps the composition it was paid with), the result chips as priced at
 * the press — because the answer spends the trade under the scene.
 */
function holdPresentation(): void {
  const entry = payEntries.value[payIdx.value];
  const mix = payRowMix.value;
  // The trade's OTHER moves on the rail, as priced at the press (the fee of the chosen path — a card that
  // answers the trade is the plan's reaction): the reward's diff check allows for exactly these. Read BEFORE the receipt pins the rows.
  const paid = paymentStep.value !== undefined && paymentView.value !== undefined && props.thisPlayer !== undefined ?
    paymentFromCounts(paymentView.value.cost, payLanes.value, paymentCounts.value, megacreditsAvailable(props.thisPlayer)) :
    undefined;
  // (A card door's bare pick has no path of its own: its fee was the card's, and is no rail row.)
  const known = tradeKnownRailMoves({
    option: props.pickMode ? undefined : props.options[payIdx.value], payment: paid, mix,
  });
  // The receiving card and every counter as they stand AT THE PRESS — read before `held` flips the readings.
  const target = chosenTarget.value ?? '';
  const counts: Record<string, number> = {};
  for (const model of props.thisPlayer?.tableau ?? []) {
    counts[model.name] = model.resources ?? 0;
  }
  const plan = scenePlan.value;
  const chips = resultChips.value;
  const pay = payRowsOut.value;
  heldTarget.value = target;
  heldCounts.value = counts;
  held.value = {entry: entry === undefined ? undefined : (mix !== undefined ? {...entry, mix} : entry)};
  heldChips.value = chips;
  heldPlan.value = plan;
  heldReaction.value = presentReaction.value;
  heldPay.value = pay;
  armFleetDockScene({card: props.card, plan: heldPlan.value, known});
  sub.value = undefined;
  syncUiMirror();
}
/** A refused submit gives the stage back as it was (the fleet returns to its pad). */
function releasePresentation(): void {
  held.value = undefined;
  heldTarget.value = '';
  heldCounts.value = {};
  heldChips.value = undefined;
  heldPlan.value = undefined;
  heldReaction.value = undefined;
  heldPay.value = undefined;
  disarmFleetDockScene(props.card);
  syncUiMirror();
}
/** A card's counter: frozen at the press past the commit; before it, the pick's own reading, else the viewer's tableau. */
function countOf(name: string): number {
  if (held.value !== undefined) {
    return heldCounts.value[name] ?? 0;
  }
  const fromPick = cardTargetStep.value?.pick.cards.find((c) => c.name === name);
  if (fromPick !== undefined) {
    return fromPick.resources ?? 0;
  }
  if (name === props.card) {
    return props.model?.resources ?? 0;
  }
  return props.thisPlayer?.tableau.find((c) => c.name === name)?.resources ?? 0;
}
/**
 * THE RESULT, card by card: the server's «+2 [floater] на карту» chip names WHERE it lands — the chosen card
 * with its own «n → n + 2» (re-aimed with the choice; «выберите карту», with no number, before one is made)
 * and, when the move shifts that card's points, its «ПО from → to» beside it (the server's per-unit reading).
 */
function cardEffects(effects: ReadonlyArray<ActionEffect>): ReadonlyArray<ActionEffect> {
  const target = cardTarget.value;
  if (target === undefined || target.lost) {
    return effects;
  }
  const out: Array<ActionEffect> = [];
  for (const effect of effects) {
    if (effect.direction !== 'gain' || effect.note !== 'to a card' || effect.icon !== targetIcon.value) {
      out.push(effect);
      continue;
    }
    const card = chosenTarget.value;
    if (card === undefined) {
      out.push({direction: 'gain', icon: effect.icon, amount: effect.amount, note: 'Choose the receiving card'});
      continue;
    }
    const before = countOf(card);
    // The card is named by the «КУДА» row right above (a chip note is lowercase type — never a proper name).
    out.push({direction: 'gain', icon: effect.icon, amount: effect.amount, current: before, resulting: before + effect.amount, note: 'to a card'});
    const steps = target.vpSteps?.[card as CardName];
    const last = steps?.[Math.max(0, Math.min(steps.length, target.amount) - 1)];
    if (last !== undefined && last.to !== last.from) {
      out.push({direction: 'gain', icon: 'vp', amount: last.to - last.from, current: last.from, resulting: last.to});
    }
  }
  return out;
}
function targetHost(): TradeTargetStepHandle | undefined {
  return targetStep.value ?? undefined;
}
/** DESCEND into the target step — the cursor on the chosen card (a re-entry), else the first seat. */
function openTargetStep(): void {
  if (openTradeTargetFocus(targetStepModel.value, targetCapture.value) === undefined) {
    return;
  }
  sub.value = 'targets';
}
/** B — one level back; the choice made before stands. */
function closeTargetStep(): void {
  const drop = (): void => {
    if (sub.value === 'targets') {
      sub.value = undefined;
    }
    scrollFocusedIntoView();
  };
  const host = targetHost();
  if (host !== undefined) {
    host.close(drop);
  } else {
    drop();
  }
}
/** The step's answer: the capture rides the trade's ONE POST (`{type: 'card', cards: [name]}`). */
function targetPicked(card: string): void {
  targetCapture.value = card;
  closeTargetStep();
}
function scrollFocusedIntoView(): void {
  void nextTick(() => {
    // The pay rows name their own cursored row; the «ВАШ ВЫБОР» step rows
    // (payment · reward target) stand BELOW them in the same scroll and
    // are found by their zone hook — a cursor on them scrolls too.
    const zone = focusedZone.value;
    const root = rootEl.value ?? undefined;
    const node = zone === 'payment' ? root?.querySelector<HTMLElement>('[data-fleet-dock-payment]') :
      zone === 'target' ? root?.querySelector<HTMLElement>('[data-fleet-dock-target]') :
        payRows.value?.focusedEl?.();
    scroll.value?.ensureVisible?.(node);
  });
}
// ── THE SCENE (`fleetDockScene.ts`) — ANSWER → REWARD → READ → LEAVE → CONCLUDE, the slot by category ──
function playScene(): void {
  const cardElNow = cardEl.value ?? undefined;
  const plan = presentPlan.value;
  setFleetDockScenePhase('answer');
  const node = fleetDockEffectNode(getCard(props.card)?.metadata.renderData);
  // THE REWARD SLOT: whatever the category flies starts when the impulse SITS on the printed icon (the
  // handoff — cause before result), and the read begins only when both the card's own beat and the
  // reward have finished. An empty slot (a placement ahead) is a resolved promise.
  let reward: Promise<unknown> = Promise.resolve();
  sceneMotion = runActionCommitMotion({
    cardWrapEl: cardElNow ?? undefined,
    ctaEl: undefined,
    actionNode: node,
    // Where the impulse lands follows from the reward (the printed parameter, the printed resource) — never a literal.
    kind: plan.answer,
    firstResource: plan.firstResource,
    onHandoff: () => {
      reward = flyReward(cardElNow ?? undefined, plan);
    },
    onSettled: () => {
      sceneMotion = undefined;
      void reward.then(() => readScene());
    },
  });
}
/**
 * REWARD — a reward that landed ON THE RAIL leaves the card as a token: born on the PRINTED icon of the
 * effect row (measured now, on the standing face — the action-commit anchors, never a coordinate), flown to
 * its row, the counter ticking on the touchdown and the table's answer one beat later (`railReward.ts`
 * owns the holds and their order, so the chain survives this stage). Nothing was held for this scene (a
 * placement ahead, reduced motion, a promise the applied view did not keep) → nothing to fly.
 */
function flyReward(cardEl: HTMLElement | undefined, plan: FleetDockScenePlan): Promise<unknown> {
  if (!scene.railHeld) {
    return Promise.resolve();
  }
  setFleetDockScenePhase('reward');
  const node = fleetDockEffectNode(getCard(props.card)?.metadata.renderData);
  // The flights are the ARMED plan's (re-aimed at the card the paying response named) — one origin per token.
  const flown = armedFleetDockScene(props.card)?.plan ?? plan;
  const origins = cardEl === undefined ? [] : resolveGainIconOrigins(resolveActionCommitAnchors(cardEl, node), flown.specs);
  return flyRailReward(fleetDockRewardKey(props.card), (_spec, index) => origins[index], fleetDockAnswerFlight(props.card));
}
function readScene(): void {
  if (!scene.holding) {
    return;
  }
  setFleetDockScenePhase('read');
  sceneWait(DOCK_READ_MS, () => {
    // A reward that is AHEAD needs the screen: the card departs first, as a beat of its own. A reward
    // delivered on the rail leaves nothing to make room for — the card goes WITH the workspace.
    if (presentPlan.value.category === 'rail' || presentPlan.value.category === 'card') {
      concludeScene();
    } else {
      leaveScene();
    }
  });
}
/** THE CARD'S DEPARTURE IS A BEAT, not a crossfade: it leaves on its own, the fleet mark with it. */
function leaveScene(): void {
  if (!scene.holding) {
    return;
  }
  setFleetDockScenePhase('leave');
  cardLeaving.value = true;
  sceneWait(DOCK_LEAVE_MS, () => concludeScene());
}
/**
 * A WAIT BETWEEN TWO BEATS OF THE SCENE — on the ANIMATION clock, never the wall clock. The beat before it
 * is the impulse's GSAP timeline and the beat after it a transition the compositor paces by PAINTED frames;
 * a wall-clock timer keeps running through a starved frame (a 4K frame is hundreds of ms) and through a
 * hidden tab, and hands the scene on before the beat it was waiting for has been drawn. GSAP's clock slows
 * with the frames it is given, so the read is a read of something painted. Reduced motion waits nothing.
 */
function sceneWait(ms: number, then: () => void): void {
  sceneCall?.kill();
  // PACING on the motion clock, owned by the stage: a stage that left ends its scene itself (`onBeforeUnmount`).
  const cancel = motionAfter(consoleReducedMotionActive() ? 0 : motionMs(ms), 'a beat of the fleet dock\'s scene', () => {
    sceneCall = undefined;
    then();
  }, flow);
  sceneCall = {kill: cancel};
}
/** …and only then the workspace leaves as one surface; the shell concludes it and the hold falls at the END of that leave. */
/** The room's height from the stage's own box — never while the entry is in flight (the hero's zoom is frozen). */
function measureRoom(): void {
  const root = rootEl.value ?? undefined;
  if (props.entering || root === undefined || root === null) {
    return;
  }
  const h = root.clientHeight;
  if (h > 0 && Math.abs(h - roomH.value) >= 1) {
    roomH.value = h;
  }
}
/**
 * The hero's FULL art: decoded first (fire-and-forget at the press — `preloadPremiumCardArt` — and awaited here),
 * shown only after — the face crossfades the thumb into it. A decode that fails keeps the thumb (never a hole).
 */
function upgradeHeroArt(): void {
  if (heroArtFull.value || props.entering) {
    return;
  }
  const card = props.card;
  void decodeCardArt(cardArtUrlAtTier(premiumCardArt(card).url, 'full')).then((ok) => {
    if (ok && !props.entering && props.card === card) {
      heroArtFull.value = true;
    }
  });
}
function concludeScene(): void {
  if (!scene.holding) {
    return;
  }
  emit('flow-complete', rootEl.value?.closest('.con-ws') ?? rootEl.value?.closest('.con-colonies'));
}

/** The entry has SETTLED: the room follows the stage's own box from now on, and the full art may take over. */
watch(() => props.entering, (now: boolean, was: boolean): void => {
  if (!now && was) {
    measureRoom();
    upgradeHeroArt();
  }
});
watch(() => primary.value, (): void => {
  syncUiMirror();
}, {deep: true});
watch(() => confirmVerb.value, (): void => {
  syncUiMirror();
}, {deep: true});
watch(() => sub.value, (): void => {
  syncUiMirror();
  // The step is one level DEEPER in the same flow — only the crumb's tail advances, and B walks it back.
  setColonyFocusStage(sub.value === 'targets' ? 'Reward target' : 'Trading');
});
/** The «Эффекты» layer lives ONLY on the setup level — a sub-step and the commit boundary fold it instantly. */
watch(() => forecastCanOpen.value, (can: boolean): void => {
  syncUiMirror();
  if (!can) {
    foldForecastHost('dock');
  }
});
watch(() => fxOpen.value, (): void => {
  syncUiMirror();
});
// A fresh preview re-judges the choice: a card no longer offered is dropped (the row asks again), a step that
// vanished folds the target step back.
watch(() => cardTargetStep.value, (step: Extract<TradeStep, {kind: 'cardTarget'}> | undefined): void => {
  if (held.value !== undefined) {
    return;
  }
  if (targetCapture.value !== '' && (step === undefined || !step.pick.cards.some((c) => c.name === targetCapture.value))) {
    targetCapture.value = '';
  }
  if (step === undefined && sub.value === 'targets') {
    sub.value = undefined;
  }
});
watch(() => isMcSelected.value, (): void => {
  seedPaymentDefault();
});
watch(() => props.preview, (): void => {
  seedPaymentDefault();
});
watch(() => lockedPayIdx.value, (): void => {
  if (lockedPayIdx.value >= 0) {
    payIdx.value = lockedPayIdx.value;
  }
}, {immediate: true});
watch(() => tradeMixAdjustable.value, (adjustable: boolean): void => {
  if (!adjustable && sub.value === 'mix') {
    sub.value = undefined;
  }
});
watch(() => sceneDue.value, (due: boolean): void => {
  if (due) {
    playScene();
  }
});
// A REFUSED submit: the fleet came home (the transport's abort battery) and
// no scene was seeded — the stage is given back as it was, the choice intact.
watch(() => tradeFleetState.active, (active: boolean, was: boolean): void => {
  if (!active && was && held.value !== undefined && scene.phase === 'idle') {
    releasePresentation();
  }
});

onMounted(() => {
  setFleetDockStageCard(props.card);
  setColonyFocusStage('Trading');
  seedPaymentDefault();
  // The ROOM follows the stage's own box from here on (a host that resizes) — but only once the entry has
  // LANDED: the first answer is the press-time measurement's, and the observer's first call (the stage's own box
  // mid-unfold) must not re-solve the hero the FLIP is flying into.
  const root = rootEl.value ?? undefined;
  if (root !== undefined && root !== null) {
    stopRoomObs = useResizeObserver(root, () => measureRoom()).stop;
  }
  // A door with no entry phrase in flight (a restore, a reload) shows the full art as soon as it is decoded.
  upgradeHeroArt();
  focusIdx.value = Math.max(0, focusables.value.findIndex((f) => f.zone === 'pay' && f.index === payIdx.value));
  syncUiMirror();
});
onBeforeUnmount(() => {
  stopRoomObs?.();
  sceneMotion?.kill();
  // (The scene's beat — `sceneCall` — is `flow`'s: taken back with it.)
  pulseCall?.kill();
  pulseCall = undefined;
  setFleetDockStageCard('');
  // A scene the stage did not finish (the world moved, a collapse) ends here:
  // the placement is server state and comes up on its own. A CONCLUDING scene
  // is released by its root's detachment, which this unmount is part of.
  if (scene.holding && scene.card === props.card && scene.phase !== 'conclude') {
    endFleetDockScene('stage-unmounted');
  } else if (!scene.holding) {
    // A stage that left before its answer came: the plan it armed is void.
    disarmFleetDockScene(props.card);
  }
  fleetDockUi.sub = '';
  fleetDockUi.primaryEnabled = false;
  fleetDockUi.primaryCommits = false;
  fleetDockUi.confirmEnabled = false;
  fleetDockUi.answered = false;
  fleetDockUi.forecastAvailable = false;
  fleetDockUi.forecastOpen = false;
  closeEffectForecastLayer('dock');
});
defineExpose({handleIntent, holdPresentation, releasePresentation});
</script>
