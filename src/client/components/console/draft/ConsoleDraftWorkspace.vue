<template>
  <section class="con-draftws con-ws" data-motion-surface="draftws" ref="rootEl"
           :class="{'con-draftws--waiting': zone === 'wait'}" :style="showcaseStyle"
           :data-draft-composition="composition">
    <!-- The identity EMBLEM is load-bearing here, not decoration: the flow
         connector's origin diamond rises out of the ROOT GLYPH's slot
         (--con-wsflow-axis), and without an emblem that axis falls under
         the title's first letter — the trace drew straight through «Д». -->
    <ConsoleWsHead :root="rootKey" emblem="cards" class="con-draftws__head"
                   :subject="crumb.subject" :stage="crumb.stage" :committed="crumb.committed">
      <template #flow>
        <ConsoleJourneyRail :phases="journeyPhases"
                            :presentation="flowPresentation"
                            :compact-context="compactContext"
                            :committing="draftWorkspaceState.completion === 'flights'"
                            terminal-label="Ready" />
      </template>
      <template #trailing>
        <!-- The selection's own READOUT — one reserved slot in the header's
             stable chrome: where the packet goes. (The PURCHASE's wallet
             closes the reading row under the packet — T10 · CE.) -->
        <div v-if="passReadout !== undefined" class="con-draftws__pass">
          <span class="con-draftws__pass-label">{{ $t('Passing to') }}</span>
          <span class="con-draftws__pass-dot" :class="'player_bg_color_' + passReadout.color" aria-hidden="true"></span>
          <span class="con-draftws__pass-name">{{ passReadout.name }}</span>
          <span class="con-draftws__pass-arrow" aria-hidden="true">{{ giveSide === 'right' ? '⟶' : '⟵' }}</span>
        </div>
      </template>
    </ConsoleWsHead>

    <div class="con-draftws__body" data-motion-panel ref="body">
      <!-- Invisible flight anchors at the side edges — the physical origin a
           PASSED packet's deal launches from (round 1 deals off the HUD deck). -->
      <span class="con-draftws__lane con-draftws__lane--left" ref="laneLeft" aria-hidden="true"></span>
      <span class="con-draftws__lane con-draftws__lane--right" ref="laneRight" aria-hidden="true"></span>

      <div class="con-draftws__stagewrap" :class="{'con-draftws__stagewrap--shelved': stageShelved}" ref="stageWrap">
        <!-- ── PICK: the packet, cards as the hero content ─────────────── -->
        <!-- Stage layers crossfade in place (absolute twins of one zone) —
             a v-show cut between stages is a blink, never acceptable. -->
        <transition name="con-draftws-stage">
        <div v-show="zone === 'pick'" class="con-draftws__stage con-draftws__stage--pick">
          <div class="con-draftws__cards">
            <!-- The row is OURS alone (never `.con-cards__strip`): the shared
                 carousel class arrives with `flex:1`, top alignment, its own
                 gap and `overflow-x:auto` — a scroll container a wrapping fit
                 can never win against, declared BELOW this block. -->
            <div class="con-draftws__row"
                 :class="{'con-draftws__row--passing': passingActive}"
                 :style="packetRowStyle" ref="packetRow">
              <div v-for="(entry, i) in packetEntries" :key="entry.key"
                   class="con-cards__slot con-draftws__slot"
                   :data-zoom-slot="entry.name"
                   :class="{
                     'con-cards__slot--focused': focusIdx === i && !beatActive && !passingActive,
                     'con-cards__slot--picked': isPicked(entry.name) && !pickBeat,
                     'con-cards__slot--dim': multiKeep && pickLimitReached && !isPicked(entry.name),
                     'con-deal-hold': deal.isHeld(entry.key),
                     'con-draftws__slot--passing': passingNames.includes(entry.name),
                   }"
                   :style="passingSlotStyle(entry.name, i)">
                <!-- The PASS exit turns the card over PHYSICALLY: face and
                     back are the two sides of one 3D body (preserve-3d +
                     the slot's perspective), the flip rides the same exit
                     window — never a one-frame face→back swap. The slot's
                     own keyframes keep translate/scale/opacity (opacity may
                     not live on a preserve-3d element). -->
                <div class="con-draftws__slot-flip">
                  <div class="con-draftws__slot-face">
                    <Card :card="entry.card" :key="entry.name" lightweight />
                  </div>
                  <span class="con-draftws__slot-back" aria-hidden="true"><span class="con-card-back"></span></span>
                </div>
                <span v-if="isPicked(entry.name) && !pickBeat" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              </div>
            </div>
          </div>
        </div>
        </transition>

        <!-- ── WAIT: the pass lane (a calm state, never a spinner) ─────── -->
        <transition name="con-draftws-stage">
        <div v-show="zone === 'wait'" class="con-draftws__stage con-draftws__stage--wait">
          <div class="con-draftws__await">
            <div class="con-draftws__await-sent">
              <span class="con-draftws__await-mark" aria-hidden="true">✓</span>
              <span class="con-draftws__await-title">{{ $t('Pick locked in') }}</span>
              <span v-if="giveReadout !== ''" class="con-draftws__await-sub">{{ giveReadout }}</span>
            </div>
            <div class="con-draftws__await-lane" :class="'con-draftws__await-lane--' + receiveSide">
              <span class="con-draftws__await-track" aria-hidden="true">
                <i class="con-draftws__await-node"></i>
                <i class="con-draftws__await-node"></i>
                <i class="con-draftws__await-node"></i>
              </span>
              <span v-if="takeReadout !== ''" class="con-draftws__await-from">{{ takeReadout }}</span>
            </div>
          </div>
        </div>
        </transition>

        <!-- ── BUY / PAY: the purchase chapter ─────────────────────────── -->
        <transition name="con-draftws-stage">
        <div v-show="zone === 'buy' || zone === 'pay'" class="con-draftws__stage con-draftws__stage--buy">
          <!-- (The purchase economics live in the HEADER's readout slot — the
               cards own the whole stage height.) -->
          <div class="con-draftws__cards">
            <div class="con-draftws__row" :style="buyRowStyle" ref="buyRow"
                 :class="{'con-draftws__row--departing': buyDeparting}">
              <!-- PAST THE COMMIT THE SELECTION CHROME IS STATE, NOT CSS:
                   the focused/picked classes are STRIPPED the moment the
                   completion beat starts. The old approach (keep the class,
                   suppress its paint via `__row--departing`) lost the
                   cascade to the TV profile's couch-ring re-statement
                   (html.con-profile-tv .con-cards__slot--focused out-
                   specifies it) — a bare cyan ring stood over the emptied
                   stage for the whole exit. A class that is not there
                   cannot be re-lit by any profile ladder. -->
              <div v-for="(entry, i) in buyEntries" :key="entry.key"
                   class="con-cards__slot con-draftws__slot"
                   :data-zoom-slot="entry.name"
                   :data-draft-buy-slot="entry.name"
                   :class="{
                     'con-cards__slot--focused': zone === 'buy' && focusIdx === i && !beatActive && !buyDeparting,
                     'con-cards__slot--picked': isPicked(entry.name) && !buyDeparting,
                     'con-cards__slot--dim': pickLimitReached && !isPicked(entry.name) && !buyDeparting,
                     'con-deal-hold': deal.isHeld(entry.key),
                   }">
                <Card :card="entry.card" :key="entry.name" lightweight />
                <span v-if="isPicked(entry.name) && !buyDeparting" class="con-cards__pickband con-draftws__bought" data-draft-bought aria-hidden="true">✓ {{ $t('Bought') }}</span>
              </div>
            </div>
          </div>
          <!-- The embedded PAYMENT step (Helion heat / steel edge — the common
               M€-only case auto-resolves server-side): the shell teleports the
               ONE ConsoleTaskHost instance here, `embedded` (no second modal).
               It BREATHES in over the card row through the same stage
               crossfade — every other stage change here is one; this was the
               file's one raw v-show cut. -->
          <transition name="con-draftws-stage">
            <div v-show="zone === 'pay'" class="con-draftws__paystep" data-draft-pay-slot></div>
          </transition>
        </div>
        </transition>

        <!-- ── INSPECT (LT): the drafted cards, spacious and read-only ─── -->
        <transition name="con-draftws-stage">
        <div v-show="zone === 'inspect'" class="con-draftws__stage con-draftws__stage--inspect">
          <div class="con-draftws__cards">
            <!-- The cards arrive PHYSICALLY from the shelf (clone-proxy
                 flights, `runShelfSpread`); a slot is held empty until its
                 own card lands on it — one physical set, never two copies. -->
            <div class="con-draftws__row" :style="inspectRowStyle" ref="inspectRow">
              <div v-for="(entry, i) in collectedEntries" :key="entry.name + '#' + i"
                   class="con-cards__slot con-draftws__slot"
                   :data-zoom-slot="entry.name"
                   :data-inspect-slot="entry.name"
                   :class="{
                     'con-cards__slot--focused': zone === 'inspect' && focusIdx === i && !inspectFlightActive,
                     'con-deal-hold': inspectSlotHeld(entry.name),
                   }">
                <Card :card="entry.card" :key="entry.name" lightweight />
              </div>
            </div>
          </div>
        </div>
        </transition>

        <!-- ── DONE: the terminal beat ─────────────────────────────────── -->
        <transition name="con-draftws-stage">
        <div v-show="zone === 'done'" class="con-draftws__stage con-draftws__stage--done">
          <div class="con-draftws__doneplate">
            <span class="con-draftws__done-mark" aria-hidden="true"><i>✓</i></span>
            <span class="con-draftws__done-title">{{ $t('Draft complete') }}</span>
            <span class="con-draftws__done-amount">
              <template v-if="completionBought > 0">
                <span>{{ boughtReadout }}</span>
                <span class="con-draftws__done-spent">−{{ completionSpent }}<i class="resource_icon resource_icon--megacredits con-draftws__fin-mc" aria-hidden="true"></i></span>
              </template>
              <template v-else>
                <span>{{ $t('No cards were bought') }}</span>
              </template>
            </span>
            <span v-if="completionBought > 0" class="con-draftws__done-sub">{{ doneReadout }}</span>
          </div>
        </div>
        </transition>
      </div>

      <!-- ── THE READING ROW (T10 · CE): the focused card's name + only what
           its face cannot print — the requirement's verdict in the hand's
           language (amber «пока не выполнено», red when the server PROVED
           «уже не выполнить» — informational, the pick/buy stays available);
           never the cost / tags / VP the face already shows above it. ONE
           line in a reserved zone: the stage above never
           reflows. IN FLOW under the stage and ABOVE the shelf overlay — it
           explains the card the player is looking at, so the collection may
           never cover it. Held through the commit's completion: a line naming
           the focused card floated alone over the emptied stage while the
           unbought cards tumbled out. ─────────── -->
      <div class="con-draftws__statusbar" :class="{'con-draftws__statusbar--held': beatActive || buyDeparting}" ref="statusbar">
        <ConsoleDraftReading :reading="statusReading" :wallet="walletModel" :idle="zone === 'wait' ? 'Waiting for the other players' : ''" />
      </div>

      <!-- ── THE SHELF («ОТОБРАНО») — the permanent collection zone. Slots
           carry `data-tray-slot`: the pick heroes land here (the shared
           draft-tray brain) and the research rise lifts off from here. ──── -->
      <!-- Present through the SELECTION chapter — and through the RISE, whose
           physical SOURCE it is (its slots are the measured launch rects);
           its fade-out IS the handoff's closing beat. An absolute overlay:
           leaving never reflows the stage above.
           THE RACK IS A CONSTANT: the draft takes a KNOWN number of cards, so
           its seats are laid out from the first frame — at 0/4 the player sees
           how far the draft runs, and the zone never materializes or resizes
           under the stage. Only `--pending` (the total not yet stated by the
           server) has no rack to draw and falls back to the bare caption. -->
      <transition name="con-draftws-shelf">
      <div class="con-draftws__shelf" v-show="shelfVisible"
           :class="{
             'con-draftws__shelf--muted': inspecting,
             'con-draftws__shelf--empty': collectedEntries.length === 0,
             'con-draftws__shelf--pending': !rackKnown,
             'con-draftws__shelf--pulse': shelfPulsing,
           }">
        <div class="con-draftws__shelf-head">
          <span class="con-draftws__shelf-label">{{ $t(setComplete ? 'Draft set complete' : 'Drafted') }}</span>
          <!-- LANDED cards only: the frozen scene set includes the still-
               inbound auto-passed card, and «4/4» over three visible cards
               was a small lie for the whole arrival flight. -->
          <span class="con-draftws__shelf-count">{{ shelfLandedCount }}<template v-if="pickTotal > 0"> / {{ pickTotal }}</template></span>
          <span v-if="canInspectCollected && !inspecting" class="con-draftws__shelf-hint">
            <GamepadGlyph control="triggerL" /><span>{{ $t('Inspect') }}</span>
          </span>
        </div>
        <div class="con-draftws__shelf-row">
          <!-- A seat whose card is still INBOUND (the auto-passed arrival)
               paints as a prepared SEAT, not as an invisible box: the rack
               keeps stating how far the draft runs while the neighbour's
               card is on its way. The plain hold (a pick's own flight, the
               peel's lift-off) stays a bare empty slot as before. -->
          <div v-for="(entry, idx) in collectedEntries" :key="entry.name + '-' + idx"
               class="con-draftws__shelf-slot"
               :style="{zIndex: idx + 1}"
               :data-tray-slot="entry.name"
               :class="{
                 'con-deal-hold': shelfHeld(entry.name) && !shelfAwaitingArrival(entry.name),
                 'con-draftws__shelf-slot--awaiting': shelfAwaitingArrival(entry.name),
                 'con-draftws__shelf-slot--landed': shelfJustLanded[entry.name] === true,
               }">
            <Card :card="entry.card" :key="entry.name" lightweight />
          </div>
          <!-- Prepared empty seats up to the known total: the shelf states how
               far the draft runs before a single card has landed — including
               at zero, which is exactly when that statement is worth most. -->
          <span v-for="n in emptySeats" :key="'seat-' + n" class="con-draftws__shelf-seat" aria-hidden="true"
                :data-shelf-seat="collectedEntries.length + n"><b class="con-draftws__shelf-seatnum">{{ collectedEntries.length + n }}</b></span>
        </div>
      </div>
      </transition>
    </div>

    <!-- The deal cinematic stage (packet arrivals + the research rise). -->
    <ConsoleCardDealLayer v-if="deal.state.active" ref="dealLayer"
                          :cards="deal.state.cards" :models="dealModels" :nonce="deal.state.nonce" />
  </section>
</template>

<script setup lang="ts">
/*
 * THE DRAFT WORKSPACE («ДРАФТ») — the between-generations draft and the
 * research buy as ONE console workspace flow.
 *
 * A PHASE-anchored root (consoleWorkspaceStack 'draft'): the shell stands it
 * up when the draft phase begins and it lives until the buy's completion
 * beats settle — the player never returns to the planet between micro-steps.
 * The HUD, the player rail and the hand dock stay exactly where they are
 * (the band geometry: `.con-ws` + `.con-ws-band()`), so entering the draft
 * reads as the CENTRE of an already-running game turning into a workspace,
 * never as a modal arriving.
 *
 * Zones are LAYERS of one stage (v-show — state survives), one visible at a
 * time: PICK (the packet), WAIT (the pass lane), BUY (the purchase row +
 * financial strip), PAY (the embedded payment step), INSPECT (the drafted
 * cards, LT) and DONE (the terminal beat). The bottom SHELF («ОТОБРАНО») is
 * permanent: every pick physically lands in it (the shared draft-tray brain +
 * `runDraftPickToTray`), and at the buy transition it is the physical SOURCE
 * the purchase row rises from (the research-rise scene, unchanged).
 *
 * Server truth only: stages derive from `consoleDraftFlow` (phase + the
 * `draftPrompt` marker + `buyMode`); submissions are the byte-identical
 * `cardsResponse` the legacy UI sends. No rule is re-implemented here.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {useResizeObserver} from '@vueuse/core';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleJourneyRail from '@/client/components/console/foundation/ConsoleJourneyRail.vue';
import ConsoleCardDealLayer from '@/client/components/console/cardDeal/ConsoleCardDealLayer.vue';
import ConsoleDraftReading from '@/client/components/console/draft/ConsoleDraftReading.vue';
import {DraftReading, draftReadingOf, DraftWallet, draftWalletOf} from '@/client/console/draft/draftReadingModel';
import {DraftShowcaseComposition, planDraftShowcase} from '@/client/console/draft/draftShowcaseLayout';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {cardsResponse} from '@/client/console/taskResponses';
import {purchasePriceHint, purchasePriceSource} from '@/client/console/purchasePriceSource';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {CloneFlightHandle, flyCardClones, measureCardRects} from '@/client/console/cardFlight/cloneFlights';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {createCardDealSequence, RiseLaunchExtras} from '@/client/console/cardDeal/cardDealSequence';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {DealTargetRect} from '@/client/console/cardDeal/cardDealDirector';
import {shouldRunDealOnce} from '@/client/console/cardDeal/cardDealMemory';
import {
  draftTrayState, isTraySlotHeld, trayDisplayCards, registerTraySlotResolver,
  runDraftPickBeat, skipDraftPickBeat, draftPickBeatActive, riseSceneEngaged,
  finishRiseScene, beginRiseScene, riseArrivalLanded, riseSetComplete,
  riseLiftOff, riseFrameReveal, whenPickBeatDone, resolveTraySlot,
} from '@/client/console/cardDeal/consoleDraftTray';
import {applyDiscardExit} from '@/client/console/cardDeal/cardExitDirector';
import {runHandIntake} from '@/client/console/handDock/handDeliveryDirector';
import {
  draftWorkspaceState, draftStageOf, draftPickInput, draftBuyInput,
  draftPacketKey, draftJourneyPhases, draftFlowPresentation, draftCompactContext,
  draftCrumb, draftNeighbor, draftCollectedNames,
  beginDraftCompletion, markDraftCompletionFlightsDone, finishDraftCompletion,
  draftPicksKey, rememberDraftPicks, recallDraftPicks, draftPaymentPending, draftVariantOn,
  DraftStage, DraftJourneyInput,
} from '@/client/console/draft/consoleDraftFlow';
import {whenParliamentSurfaceGone} from '@/client/console/parliament/consoleParliamentFlow';
import {draftCommands, setConsoleDraftCommands, resetConsoleDraftUi, DraftCommandState} from '@/client/console/draft/consoleDraftUi';
import {
  buyAffordable as buyAffordableOf, buyCostPerCard as buyCostPerCardOf, buyTotal as buyTotalOf,
  megacreditsOnHand as megacreditsOnHandOf, DraftWorkspacePort, DraftZone,
} from '@/client/components/console/draft/consoleDraftWorkspaceLogic';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {availabilityContextFor} from '@/client/console/cardAvailability';
import {useFlowScope} from '@/client/console/session/useFlowScope';

type CardEntry = {name: CardName, key: string, card: CardModel};

/** T10 · CE — the packet showcase's composition (M1: the shelf a band of large faces under the packet). */
const DRAFT_SHOWCASE_COMPOSITION: DraftShowcaseComposition = 'stack';

defineOptions({name: 'ConsoleDraftWorkspace'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
});
const emit = defineEmits(['submit', 'defer']);
/** What the purchase's arithmetic (`consoleDraftWorkspaceLogic.ts`) reads of this workspace — accessors, read lazily. */
const port: DraftWorkspacePort = {
  get playerView() {
    return props.playerView;
  },
  get picks() {
    return picks.value;
  },
  get zone() {
    return zone.value;
  },
  get buyCostPerCard() {
    return buyCostPerCard.value;
  },
  get buyTotal() {
    return buyTotal.value;
  },
  get megacreditsOnHand() {
    return megacreditsOnHand.value;
  },
};

const flow = useFlowScope('draft-workspace');
const laneRight = useTemplateRef<HTMLElement>('laneRight');
const laneLeft = useTemplateRef<HTMLElement>('laneLeft');
const stageWrap = useTemplateRef<HTMLElement>('stageWrap');
const packetRow = useTemplateRef<HTMLElement>('packetRow');
const dealLayer = useTemplateRef<ExposedOf<typeof ConsoleCardDealLayer>>('dealLayer');
const buyRow = useTemplateRef<HTMLElement>('buyRow');
const body = useTemplateRef<HTMLElement>('body');
const statusbar = useTemplateRef<HTMLElement>('statusbar');
const inspectRow = useTemplateRef<HTMLElement>('inspectRow');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const focusIdx = ref(0);
/** Pick-stage picks (keep-2 rounds) and buy-stage picks — sequential
 *  stages share one list; it resets on every stage/packet change. */
const picks = ref<Array<CardName>>([]);
const submitting = ref(false);
/** The buy set FROZEN at its first render: the surface outlives its own
 *  prompt (the submit ends `waitingFor` while the exit flights play). */
const buySnapshot = ref<ReadonlyArray<CardEntry> | undefined>(undefined);
/** The pass exit: the leftover cards visibly leaving toward the neighbor. */
const passingNames = ref<Array<CardName>>([]);
const passingActive = ref(false);
/** The deal sequence (packet arrivals + the research rise). */
const deal = ref(createCardDealSequence());
let cancelDealLaunch = (() => {}) as () => void;
let cancelDoneBeat = (() => {}) as () => void;
let cancelPass = (() => {}) as () => void;
/** The pass-flip re-arm loop (WAAPI turn survives node renewal). */
let cancelPassFlip = (() => {}) as () => void;
/** The packet standing when the workspace MOUNTED (a reload straight
 *  into a live draft): presented instantly, never re-dealt. */
const hydratedPacketKey = ref('');
/** A packet arrived WHILE the LT sub-stage owned the screen — its
 *  presentation waits for the return (never torn into the inspect). */
const packetPendingPresent = ref(false);
/** The LT sub-stage's PHYSICAL spread/collect (clone-proxy flights):
 *  row slots held empty until their own card lands; input absorbed. */
const inspectFlightActive = ref(false);
const inspectHeldNames = ref<Array<CardName>>([]);
/** Cards whose clone has physically LEFT the shelf (held from the exact
 *  frame the proxy stands over them — never a frame earlier). */
const shelfDeparted = ref<Array<CardName>>([]);
/** Seats already re-filled by the RETURN flight (per-card landings). */
const shelfReturned = ref<Array<CardName>>([]);
let cancelInspectFlight = (() => {}) as () => void;
let cloneFlight: CloneFlightHandle | undefined;
/** The collection has handed its cards to the purchase row (lift-off):
 *  the shelf dissolves and never returns for the rest of the flow. */
const shelfRetired = ref(false);
/** The purchase commit's receipt (the terminal plate's numbers). */
const completionBought = ref(0);
const completionSpent = ref(0);
/** The unbought cards' exit has visually settled — the terminal plate
 *  may take the stage while the intake still flies to the dock. */
const discardsSettled = ref(false);
let cancelDiscardSettle = (() => {}) as () => void;
/** Guards the exit promise's settle against a torn-down frame. */
const discardWaitNonce = ref(0);
/** The zero-buy path's completion gate (no intake flight to ride). */
let cancelCompletionFlights = (() => {}) as () => void;
/** The pick stage's FROZEN presentation while the pass exit reads —
 *  a fast answer must not swap the v-for under the leaving cards. */
const presentedPacketFrozen = ref<ReadonlyArray<CardEntry> | undefined>(undefined);
/** Deferred packet-swap presentation (bounded by `passUntil`). */
let cancelPacketSwap = (() => {}) as () => void;
/** Wall-clock deadline of the running pass exit's read. */
const passUntil = ref(0);
/** Solved stage layouts (CSS custom-property maps). */
/** T10 · CE: the packet showcase's plan, published as custom properties on the root (`planShowcase`). */
const showcaseStyle = ref<Record<string, string>>({});
const packetRowStyle = ref<Record<string, string>>({});
const buyRowStyle = ref<Record<string, string>>({});
const inspectRowStyle = ref<Record<string, string>>({});
/** Row shape (cards per row) for 2D d-pad navigation. */
const perRowByZone = ref<Record<string, number>>({pick: 5, buy: 5, inspect: 5});
const shelfPulsing = ref(false);
let cancelShelfPulse = (() => {}) as () => void;
/** Per-seat one-shot settle accent (a landing accents ITSELF — the
 *  whole-row pulse is the set-complete beat only). */
const shelfJustLanded = ref<Record<string, boolean>>({});
const shelfLandCancels: Record<string, () => void> = {};

const stage = computed((): DraftStage => {
  return draftStageOf(props.playerView);
});
/** The game drafts between generations — the picks chapter exists; else the buy is the whole flow (TR61). */
const drafting = computed((): boolean => {
  return draftVariantOn(props.playerView);
});
/** The crumb's ROOT: «ДРАФТ» for a drafting table, «ИССЛЕДОВАНИЕ» for the buy alone — one workspace, one name per game. */
const rootKey = computed((): string => {
  return drafting.value ? 'Draft' : 'Research';
});
const inspecting = computed((): boolean => {
  return draftWorkspaceState.inspecting;
});
/** The one visible layer of the staging area. */
const zone = computed((): DraftZone => {
  if (inspecting.value) {
    return 'inspect';
  }
  if (paymentPending.value) {
    return 'pay';
  }
  if (draftWorkspaceState.completion !== 'none') {
    // The frozen buy row keeps the stage just long enough for the
    // unbought cards' exit to read; the terminal plate then takes over
    // WHILE the bought cards are still flying to the dock (the receipt
    // is synchronized with the delivery, never after it).
    return discardsSettled.value ? 'done' : 'buy';
  }
  switch (stage.value) {
  case 'pick': return 'pick';
  case 'buy': return 'buy';
  case 'wait':
  case 'idle':
    // THE PASS EXIT PLAYS ON THE PICK STAGE. The server's answer
    // routinely lands mid-slide (~300ms after the commit), and flipping
    // the zone at that instant sent the whole exit — the slide AND the
    // physical turn — into a `display: none` stage: every declarative
    // animation froze unpainted, and what the player actually saw was a
    // stage crossfade swallowing the packet in one frame (the reported
    // «карты сменились обложкой одним кадром»). The zone holds until
    // the exit has physically left; the wait stage then crossfades in.
    return passingActive.value ? 'pick' : 'wait';
  }
});
/**
 * The shelf presents through the SELECTION chapter, and through the rise
 * only until the cards LIFT OFF it — the moment they start growing into
 * the purchase row it dissolves, and it never comes back for the rest of
 * the flow (`shelfRetired`). Keeping it up past the lift-off is what put
 * a stale plate over the arriving cards.
 */
const shelfVisible = computed((): boolean => {
  if (shelfRetired.value) {
    return false;
  }
  return zone.value === 'pick' || zone.value === 'wait' || zone.value === 'inspect' ||
    riseSceneEngaged();
});
/** The stages step off the shelf's zone while it genuinely occupies it
 *  (the BUY deliberately keeps the full height — during the rise the
 *  shelf overlays the bottom edge, and the row is already final). */
const stageShelved = computed((): boolean => {
  return zone.value === 'pick' || zone.value === 'wait' || zone.value === 'inspect';
});
/** The post-buy SelectPayment (Helion heat / Luna titanium) — embedded.
 *  The pure derivation is deliberately FREE of the `completion` latch: a
 *  reload mid-payment arrives with `completion === 'none'` and must still
 *  land in the pay stage (see draftPaymentPending's contract). */
const paymentPending = computed((): boolean => {
  return draftPaymentPending(props.playerView);
});
const pickInput = computed(() => {
  return draftPickInput(props.playerView);
});
const buyInput = computed(() => {
  return draftBuyInput(props.playerView);
});
const packetKey = computed((): string => {
  return draftPacketKey(props.playerView);
});
/** What the PICK stage renders: the frozen presentation while the pass
 *  exit finishes its read (a fast answer used to swap the v-for and cut
 *  the leavers mid-slide), else the live server packet. */
const packetEntries = computed((): ReadonlyArray<CardEntry> => {
  return presentedPacketFrozen.value ?? livePacketEntries.value;
});
const livePacketEntries = computed((): ReadonlyArray<CardEntry> => {
  const input = pickInput.value;
  if (input === undefined) {
    return [];
  }
  return input.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
});
/** Live models aligned with the deal's card list — the flying face must
 *  match the landed face (buy-zone deals resolve from the buy entries). */
const dealModels = computed((): Array<CardModel | undefined> => {
  const pool = [...packetEntries.value, ...buyEntries.value];
  return deal.value.state.cards.map((name) => pool.find((e) => e.name === name)?.card);
});
/** Buy candidates — live prompt first, else the frozen snapshot. */
const buyEntries = computed((): ReadonlyArray<CardEntry> => {
  if (buySnapshot.value !== undefined) {
    return buySnapshot.value;
  }
  const input = buyInput.value;
  if (input === undefined) {
    return [];
  }
  return input.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
});
/** The shelf: server drafted + optimistic in-flight + the frozen rise set. */
const collectedEntries = computed((): ReadonlyArray<{name: CardName, card: CardModel | {name: CardName}}> => {
  const server = props.playerView.draftedCards ?? [];
  const names = trayDisplayCards(server.map((c) => c.name));
  return names.map((name) => ({
    name,
    card: server.find((c) => c.name === name) ?? {name},
  }));
});
const emptySeats = computed((): number => {
  return Math.max(0, pickTotal.value - collectedEntries.value.length);
});
/** Cards physically ON the shelf — the honest count while the auto-
 *  passed arrival is still inbound (the frozen scene set already lists
 *  it, but the player must never read «4/4» over three cards). */
const shelfLandedCount = computed((): number => {
  const awaiting = collectedEntries.value
    .filter((e) => shelfAwaitingArrival(e.name)).length;
  return collectedEntries.value.length - awaiting;
});
/** The rack can only be DRAWN once its size is known — the server states
 *  it with the first draft marker, so this is false for at most the gap
 *  before the opening prompt lands (a reload into an empty wait state). */
const rackKnown = computed((): boolean => {
  return pickTotal.value > 0 || collectedEntries.value.length > 0;
});
/** The packet showcase's composition (the owner's batch, decision 4 — M1: the shelf a band under the packet). */
const composition = DRAFT_SHOWCASE_COMPOSITION;
const pickTotal = computed((): number => {
  return draftWorkspaceState.total;
});
/** Picks locked in (the flow rail's progress) — optimistic in-flight
 *  additions count (the hero is already flying to the shelf). */
const pickedCount = computed((): number => {
  return draftCollectedNames(props.playerView, draftTrayState.pending).length;
});
const multiKeep = computed((): boolean => {
  const input = pickInput.value;
  return input !== undefined && (input.min ?? 1) > 1;
});
const pickLimitReached = computed((): boolean => {
  const max = zone.value === 'buy' ? buyMax.value : (pickInput.value?.max ?? 1);
  return picks.value.length >= max;
});
const buyMax = computed((): number => {
  return buyInput.value?.max ?? buyEntries.value.length;
});
const pickBeat = computed((): boolean => {
  return draftPickBeatActive();
});
const beatActive = computed((): boolean => {
  return pickBeat.value || deal.value.state.active || passingActive.value;
});
// ── purchase economics (server-identical: ChooseCards charges
//    selected.length × player.cardCost) — the bodies are the functions of
//    `consoleDraftWorkspaceLogic.ts`, which their spec runs against a stub ──
const buyCostPerCard = computed(() => buyCostPerCardOf(port));
const buyTotal = computed(() => buyTotalOf(port));
const megacreditsOnHand = computed(() => megacreditsOnHandOf(port));
const buyAffordable = computed(() => buyAffordableOf(port));
// ── the flow rail / crumb ─────────────────────────────────────────
const journeyInput = computed((): DraftJourneyInput => {
  return {
    total: pickTotal.value,
    picked: pickedCount.value,
    stage: stage.value,
    completion: draftWorkspaceState.completion,
    paying: paymentPending.value,
    draft: drafting.value,
  };
});
const journeyPhases = computed(() => {
  return draftJourneyPhases(journeyInput.value);
});
const flowPresentation = computed(() => {
  return draftFlowPresentation({completion: draftWorkspaceState.completion, inspecting: inspecting.value, paying: paymentPending.value});
});
/** The purchase is committed and its cards are leaving/gone: the row's
 *  selection chrome (focus ring, pick band) must leave WITH the cards —
 *  a bare ring standing where a departed card was is the reported
 *  «след от выбранной карты». */
const buyDeparting = computed((): boolean => {
  return draftWorkspaceState.completion !== 'none';
});
const compactContext = computed(() => {
  return draftCompactContext(journeyInput.value);
});
const crumb = computed(() => {
  return draftCrumb({stage: stage.value, inspecting: inspecting.value, completion: draftWorkspaceState.completion, paying: paymentPending.value});
});
// ── the pass readouts ─────────────────────────────────────────────
const giveSide = computed((): 'left' | 'right' => {
  // 'after' = the next seat: visually to the RIGHT (the top-strip order).
  return draftWorkspaceState.meta?.direction === 'before' ? 'left' : 'right';
});
const receiveSide = computed((): 'left' | 'right' => {
  return giveSide.value === 'right' ? 'left' : 'right';
});
const passReadout = computed((): {name: string, color: string} | undefined => {
  if (zone.value !== 'pick' && zone.value !== 'wait') {
    return undefined;
  }
  const to = draftNeighbor(props.playerView, draftWorkspaceState.meta?.givingTo);
  if (to === undefined) {
    return undefined;
  }
  // The ONE participant-name resolver — MarsBot reads «Бот», never raw.
  return {name: displayNameForColor(props.playerView.players, to.color), color: to.color};
});
const giveReadout = computed((): string => {
  const to = draftWorkspaceState.meta?.givingTo;
  if (to === undefined || draftNeighbor(props.playerView, to) === undefined) {
    return '';
  }
  return translateTextWithParams('The rest of the packet went to ${0}', [displayNameForColor(props.playerView.players, to)]);
});
const takeReadout = computed((): string => {
  const from = draftWorkspaceState.meta?.takingFrom;
  if (from === undefined || draftNeighbor(props.playerView, from) === undefined) {
    return '';
  }
  return translateTextWithParams('Next packet comes from ${0}', [displayNameForColor(props.playerView.players, from)]);
});
const doneReadout = computed((): string => {
  return translateText('Purchased cards are in your hand');
});
const boughtReadout = computed((): string => {
  return translateTextWithParams('Cards bought: ${0}', [String(completionBought.value)]);
});
const setComplete = computed((): boolean => {
  return draftTrayState.setComplete;
});
const canInspectCollected = computed((): boolean => {
  return collectedEntries.value.length > 0 &&
    (zone.value === 'pick' || zone.value === 'wait');
});
// ── the status rail ───────────────────────────────────────────────
const statusEntry = computed((): CardEntry | undefined => {
  const list = zone.value === 'buy' ? buyEntries.value :
    zone.value === 'pick' ? packetEntries.value :
      zone.value === 'inspect' ? collectedAsEntries.value : [];
  return list[focusIdx.value] ?? list[0];
});
/** The reading row's model (T10 · CE) — `undefined` when no card is under the cursor (the wait). */
const statusReading = computed((): DraftReading | undefined => {
  const entry = statusEntry.value;
  return entry === undefined ? undefined : draftReadingOf(entry.card);
});
/** The purchase's WALLET (T10 · CE, decision 8): the reading row's plate on the buy — the server's price per card. */
const walletModel = computed((): DraftWallet | undefined => {
  return zone.value === 'buy' || zone.value === 'pay' ? draftWalletOf(picks.value.length, buyCostPerCard.value, megacreditsOnHand.value,
    purchasePriceHint(purchasePriceSource(props.playerView.thisPlayer))) : undefined;
});
const collectedAsEntries = computed((): ReadonlyArray<CardEntry> => {
  return collectedEntries.value
    .filter((e): e is {name: CardName, card: CardModel} => (e.card as CardModel).name !== undefined)
    .map((e, i) => ({name: e.name, key: e.name + '#' + i, card: e.card as CardModel}));
});
/** The bar contract facts (published to `consoleDraftUi` by a watcher). */
const commandState = computed((): DraftCommandState => {
  // Past the commit the bar is EMPTY (the 'done' contract): the frozen
  // buy row still paints while the exit reads, but «A Выбрать / RT
  // Пропустить» over departing cards promised verbs that no longer
  // exist (input is consumed for the whole completion window). The PAY
  // stage is empty for the same reason whatever the completion latch says
  // (a reload lands there with completion === 'none'): the embedded
  // payment panel owns the pad and publishes its own verbs.
  const zoneNow: DraftCommandState['zone'] =
    draftWorkspaceState.completion !== 'none' || zone.value === 'pay' ?
      'done' : zone.value;
  return {
    beatActive: beatActive.value,
    zone: zoneNow,
    singlePick: !multiKeep.value && zone.value === 'pick',
    focusedPicked: statusEntry.value !== undefined && isPicked(statusEntry.value.name),
    canPickFocused: zone.value === 'buy' ?
      (!pickLimitReached.value && buyAffordableWithOneMore.value) :
      (!multiKeep.value || !pickLimitReached.value),
    setValid: zone.value === 'buy' ? buyAffordable.value : picks.value.length === (pickInput.value?.min ?? 1),
    hasCards: (zone.value === 'buy' ? buyEntries.value : packetEntries.value).length > 0 ||
      (zone.value === 'inspect' && collectedEntries.value.length > 0),
    hasCollected: collectedEntries.value.length > 0,
    buyingNothing: zone.value === 'buy' && picks.value.length === 0,
    buyCount: zone.value === 'buy' ? picks.value.length : 0,
  };
});
const buyAffordableWithOneMore = computed((): boolean => {
  return (picks.value.length + 1) * buyCostPerCard.value <= megacreditsOnHand.value;
});
/** WHICH SET the current marks belong to — the memory's key, so a new
 *  packet / a new generation's buy never inherits a stale selection. */
const picksKey = computed((): string => {
  const buying = zone.value === 'buy' || zone.value === 'pay' || draftWorkspaceState.completion !== 'none';
  const entries = buying ? buyEntries.value : packetEntries.value;
  return draftPicksKey(buying ? 'buy' : 'pick', props.playerView.game.generation, entries.map((e) => e.name));
});

// ── input (routed by the shell while the workspace owns the pad) ────
function handleIntent(intent: GamepadIntent): void {
  // Any input mid-beat skips the cinematic and is consumed.
  if (draftPickBeatActive()) {
    skipDraftPickBeat();
    return;
  }
  if (deal.value.state.active) {
    deal.value.skip();
    return;
  }
  if (passingActive.value || inspectFlightActive.value) {
    return;
  }
  // Past the commit boundary the workspace is a receipt playing out —
  // nothing here accepts input (a repeat RT could re-submit into a
  // prompt that has already moved on; A would mutate a frozen set).
  // The window is short and the frame releases itself.
  if (draftWorkspaceState.completion !== 'none') {
    return;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  const action = consoleActionOf(intent);
  if (action !== undefined) {
    onAction(action);
  }
}
function onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
  const list = zone.value === 'buy' ? buyEntries.value :
    zone.value === 'pick' ? packetEntries.value :
      zone.value === 'inspect' ? collectedAsEntries.value : [];
  if (list.length === 0) {
    return;
  }
  const perRow = perRowByZone.value[zone.value === 'inspect' ? 'inspect' : (zone.value === 'buy' ? 'buy' : 'pick')] || list.length;
  let next = focusIdx.value;
  if (dir === 'left') {
    next = focusIdx.value - 1;
  } else if (dir === 'right') {
    next = focusIdx.value + 1;
  } else if (dir === 'up') {
    next = focusIdx.value - perRow;
  } else if (dir === 'down') {
    next = focusIdx.value + perRow;
  }
  if (next >= 0 && next < list.length) {
    focusIdx.value = next;
  }
}
function onAction(action: ConsoleAction): void {
  switch (action) {
  case 'primary':
    onPrimary();
    return;
  case 'inspect':
    zoomFocused();
    return;
  case 'prevTab': // LT — the drafted-cards sub-stage
    if (zone.value === 'inspect') {
      leaveInspect();
    } else if (canInspectCollected.value) {
      enterInspect();
    }
    return;
  case 'nextTab': // RT — commit the set (keep-2 pick / the buy)
    if (zone.value === 'buy') {
      confirmPurchase();
    } else if (zone.value === 'pick' && multiKeep.value) {
      commitPickSet();
    }
    return;
  case 'back':
    onBack();
    return;
  default:
    return;
  }
}
function onPrimary(): void {
  if (zone.value === 'pick') {
    const entry = packetEntries.value[focusIdx.value];
    if (entry === undefined) {
      return;
    }
    if (!multiKeep.value) {
      commitSinglePick(entry.name);
      return;
    }
    togglePick(entry.name, pickInput.value?.max ?? 1);
    return;
  }
  if (zone.value === 'buy') {
    const entry = buyEntries.value[focusIdx.value];
    if (entry === undefined) {
      return;
    }
    if (!isPicked(entry.name) && !buyAffordableWithOneMore.value) {
      return; // the financial strip already explains the shortfall
    }
    togglePick(entry.name, buyMax.value);
    return;
  }
}
function onBack(): void {
  if (zone.value === 'inspect') {
    leaveInspect();
    return;
  }
  // Minimize — the shell's workspace-collapse path (the deferred chip).
  emit('defer');
}
// ── picking ─────────────────────────────────────────────────────────
function isPicked(name: CardName): boolean {
  return picks.value.includes(name);
}
function togglePick(name: CardName, max: number): void {
  const at = picks.value.indexOf(name);
  if (at !== -1) {
    picks.value.splice(at, 1);
    return;
  }
  if (picks.value.length < max) {
    picks.value.push(name);
  }
}
/** The single-keep pick: ONE press commits — hero to the shelf, the rest
 *  passes on toward the neighbor, submit fires at onLift. */
function commitSinglePick(name: CardName): void {
  if (submitting.value || pickBeat.value) {
    return;
  }
  picks.value = [name];
  launchPickBeat([name]);
}
/** The keep-2 commit (RT): both heroes fly, the rest passes on. */
function commitPickSet(): void {
  if (submitting.value || pickBeat.value) {
    return;
  }
  const need = pickInput.value?.min ?? 1;
  if (picks.value.length !== need) {
    return;
  }
  launchPickBeat([...picks.value]);
}
function launchPickBeat(names: ReadonlyArray<CardName>): void {
  // FREEZE the packet's presentation for the whole exit read: the answer
  // lands mid-slide and the v-for swap used to cut the leavers on the
  // frame. The frozen list is released by the deferred swap presentation
  // (the packetKey watcher) or by the zone leaving `pick`.
  presentedPacketFrozen.value = livePacketEntries.value;
  const picks = names
    .map((name) => ({
      name,
      el: slotCardEl(name),
      // The live model rides the proxy: the flying face must BE the
      // landed face (cost chip / title-safe width / lightweight tier).
      card: packetEntries.value.find((e) => e.name === name)?.card,
    }))
    .filter((p): p is {name: CardName, el: HTMLElement, card: CardModel | undefined} => {
      if (p.el === null) {
        // The flight rule: a missing source is a dev warn, never a
        // silent «just appear» on the shelf.
        console.warn('[draft-pick] source slot unresolved — the card will teleport', p.name);
        return false;
      }
      return true;
    });
  // The leftovers physically pass on toward the receiving neighbor —
  // AFTER the hero's take has had the eye (the base delay in
  // `passingSlotStyle`).
  beginPassExit(packetEntries.value.filter((e) => !names.includes(e.name)).map((e) => e.name));
  runDraftPickBeat({
    picks,
    commit: () => submitCards(names),
  });
}
function submitCards(names: ReadonlyArray<CardName>): void {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  emit('submit', cardsResponse([...names]));
}
// ── the pass exit (leftovers leave toward the neighbor) ─────────────
function beginPassExit(names: ReadonlyArray<CardName>): void {
  if (names.length === 0 || consoleReducedMotionActive()) {
    return;
  }
  passingNames.value = [...names];
  passingActive.value = true;
  // THE PHYSICAL TURN of the pass, delay-matched to each slot's own exit
  // (12%..68% of the same 820ms window). WAAPI + a RE-ARM loop,
  // deliberately: the same keyframes as a CSS animation — stylesheet AND
  // inline — reported `running` in the live tree while the transform
  // stayed `none` (something in the live patch cycle replaces/renews the
  // flip nodes mid-pass, resetting any declarative animation into its
  // delay phase forever; an injected reference slot beside them animated
  // fine). The loop re-applies the Animation to the CURRENT node in the
  // CORRECT phase (currentTime seeded from the pass's own clock), so a
  // node swap costs nothing — the dock magnet's discipline, applied to
  // a turn.
  const dir = giveSide.value === 'right' ? 1 : -1;
  const passT0 = performance.now();
  const totalMs = consoleMotionMs(260 + 70 * Math.max(0, names.length - 1) + 820) + 120;
  let rearms = 0;
  cancelPassFlip();
  const tick = () => {
    const root = rootEl.value ?? undefined;
    if (root === undefined || typeof root.querySelectorAll !== 'function') {
      return;
    }
    const elapsed = performance.now() - passT0;
    if (elapsed > totalMs) {
      cancelPassFlip();
      if (process.env.NODE_ENV !== 'production' && rearms > names.length) {
        console.log(`[pass-flip-rearm] flip nodes were renewed ${rearms - names.length}x mid-pass`);
      }
      return;
    }
    names.forEach((name, order) => {
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name;
      const flip = root.querySelector<HTMLElement>(
        `.con-draftws__stage--pick [data-zoom-slot="${esc}"] .con-draftws__slot-flip`) as
        (HTMLElement & {__passFlip?: boolean}) | null;
      if (flip === null || flip.__passFlip === true || typeof flip.animate !== 'function') {
        return;
      }
      flip.__passFlip = true;
      rearms++;
      const anim = flip.animate([
        {transform: 'rotateY(0deg)', offset: 0},
        {transform: 'rotateY(0deg)', offset: 0.12, easing: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)'},
        {transform: `rotateY(${dir * 180}deg)`, offset: 0.68},
        {transform: `rotateY(${dir * 180}deg)`, offset: 1},
      ], {
        duration: consoleMotionMs(820),
        delay: consoleMotionMs(260 + order * 70),
        fill: 'forwards',
      });
      // Seed the pass's own clock: a node renewed mid-pass joins the
      // turn at the phase it would be in, never from zero. Through the
      // START time, never `currentTime`: a currentTime written into a
      // fresh animation is a HOLD — the animation stays pending on it
      // until the compositor's ready, and on a starved 4K frame that
      // froze the turn (`running/122` for 200+ ms) while the slot's CSS
      // exit faded the card out: it left without turning (CI
      // 2026-11-10, `console-draft-workspace` § pass-flip, max 0°). A
      // start time on the document timeline resolves the pending play
      // at once — the turn and the exit run on one clock (law 7).
      const timelineNow = document.timeline?.currentTime;
      if (typeof timelineNow === 'number') {
        anim.startTime = timelineNow - elapsed;
      } else {
        anim.currentTime = elapsed;
      }
    });
  };
  // The re-arm loop: the next look is armed BEFORE this one runs, so the look that ends the loop takes it back.
  const beat = () => {
    cancelPassFlip = flow.after(50, 'the pass flip\'s next look', beat);
    tick();
  };
  cancelPassFlip = flow.after(50, 'the pass flip\'s next look', beat);
  void nextTick(tick);
  // The read the packet swap defers to: the sequencing base, the last
  // leaver's stagger and ~85% of the 820ms flight (the cards are
  // essentially faded by then — cutting later buys nothing).
  passUntil.value = Date.now() + consoleMotionMs(260 + 70 * Math.max(0, names.length - 1) + 820 * 0.85);
  cancelPass();
  // Base delay + scaled stagger + the 820ms flight (see passingSlotStyle).
  cancelPass = flow.after(consoleMotionMs(260 + 70 * Math.max(0, names.length - 1) + 940), 'the pass exit reads', () => {
    passingActive.value = false;
  });
}
function passingSlotStyle(name: CardName, index: number): Record<string, string> {
  const order = passingNames.value.indexOf(name);
  if (order < 0) {
    return {};
  }
  void index;
  const dir = giveSide.value === 'right' ? 1 : -1;
  // THE EXIT'S DESTINATION IS THE LANE — the physical anchor the NEXT
  // packet deals in from. A fixed 150px evaporated the cards in
  // mid-stage (partly clipped by the stage edge at full opacity); the
  // measured distance closes the same loop the arrival opens.
  const lane = (dir > 0 ? laneRight.value : laneLeft.value) ?? undefined;
  const stage = stageWrap.value ?? undefined;
  let travel = 150 * conUiScale();
  const laneRect = lane?.getBoundingClientRect?.();
  const stageRect = stage?.getBoundingClientRect?.();
  if (laneRect !== undefined && stageRect !== undefined && laneRect.width >= 0) {
    // From the stage centre band toward the lane's own x — a bounded,
    // direction-true travel whatever the packet's width.
    travel = Math.max(120 * conUiScale(),
      Math.abs(laneRect.left + laneRect.width / 2 - (stageRect.left + stageRect.width / 2)) * 0.32);
  }
  return {
    '--con-draftws-pass-x': `${dir * Math.round(travel)}px`,
    '--con-draftws-pass-dir': `${dir}`,
    // THE HERO READS FIRST. The pick's take + the first beat of its carry
    // own the eye (~260ms base), THEN the leftovers start toward the
    // lane — one thing at a time (the same `delayMs` sequencing the buy
    // path documents). The stagger is by LEAVER order (never the packet
    // index — the exit's phase must not depend on which card was picked)
    // and rides the motion scale like every other duration.
    'animationDelay': `${consoleMotionMs(260 + order * 70)}ms`,
  };
}
// ── packet arrival (the deal cinematic) ─────────────────────────────
function resetPickState(): void {
  picks.value = [];
  focusIdx.value = 0;
  passingNames.value = [];
  passingActive.value = false;
  buySnapshot.value = undefined;
}
function preparePacketArrival(): void {
  cancelDealLaunch();
  const entries = packetEntries.value;
  if (entries.length === 0) {
    return;
  }
  const names = entries.map((e) => e.name);
  const keys = entries.map((e) => e.key);
  const dealKey = `draft|${props.playerView.id}|${packetKey.value}`;
  // A reload straight into this packet: it is already on the table —
  // present instantly, consume the once-per-set memory.
  if (packetKey.value === hydratedPacketKey.value && !draftWorkspaceState.sawDraftStart) {
    deal.value.dispose();
    shouldRunDealOnce(dealKey);
    return;
  }
  if (deal.value.prepare(dealKey, names, keys)) {
    cancelDealLaunch = flow.after(motionMs(300), 'the packet\'s deal launches', () => {
      // The first packet comes off the HUD deck over a CLEAR screen: a Parliament that handed the screen over
      // («К драфту» — P89 · EA) finishes its leave first; the slots hold the cards hidden until then.
      void whenPickBeatDone().then(() => whenParliamentSurfaceGone()).then(() => flow.afterFrame('the packet\'s deal launches on a frame', () => launchPacketDeal()));
    });
  }
}
function launchPacketDeal(): void {
  if (!deal.value.state.active) {
    return;
  }
  const strip = packetRow.value ?? undefined;
  const layer = dealLayer.value ?? undefined;
  if (strip === undefined || strip === null || layer === undefined) {
    deal.value.dispose();
    return;
  }
  fitStage();
  // Per-slot DESCENDANT resolve: the pick row's card lives inside the
  // physical flip wrapper (__slot-flip > __slot-face), so the old
  // direct-child query returned ZERO cards — deal.launch bailed on the
  // count mismatch and the whole packet materialized in one frame (the
  // reported «карты просто появляются»; the cinematic had been silently
  // dead since the flip wrapper landed).
  const slotCards = rowSlotCards(strip);
  // ROUND 1 deals off the real HUD deck; a PASSED packet enters from the
  // side the neighbor sits on — the lane anchor is its physical origin.
  const firstPacket = props.playerView.draftedCards.length === 0 && draftTrayState.pending.length === 0;
  const lane = receiveSide.value === 'left' ? laneLeft.value : laneRight.value;
  if (firstPacket) {
    // The cards come off the REAL pile: no synthetic stack sprite over
    // the HUD (the pile is its own deck visual), and the proxies leave
    // at the pile's honest on-screen scale — «взять карту с той колоды
    // и поднести к себе», not a full-size card popping out of a corner.
    const pile = document.querySelector<HTMLElement>('.con-deckstack__pile');
    const pileRect = pile?.getBoundingClientRect();
    deal.value.launch({
      slotCards,
      proxies: layer.proxyEls(),
      deck: null,
      originEl: pile,
      originScale: pileRect !== undefined && pileRect.width > 4 ? pileRect.width / CARD_NATURAL_W : undefined,
    });
    return;
  }
  // The lane is a dimensionless anchor span — hand its POINT over
  // explicitly (the sequence's originEl rect guard rightly rejects a
  // 2px element, and the fallback dealt the neighbour's packet from
  // the synthetic bottom-centre dealer while the wait stage had just
  // named the side it comes from).
  const laneRect = lane?.getBoundingClientRect?.();
  deal.value.launch({
    slotCards,
    proxies: layer.proxyEls(),
    deck: layer.deckEl(),
    originPoint: laneRect !== undefined ?
      {x: laneRect.left + laneRect.width / 2, y: laneRect.top + laneRect.height / 2} : undefined,
  });
}
/** The row's real card elements, one per slot, wrapper-agnostic (the
 *  pick row nests its card inside the flip body; the buy row does not). */
function rowSlotCards(strip: HTMLElement): Array<HTMLElement> {
  return Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot'))
    .map((slot) => slot.querySelector<HTMLElement>(':is(.card-container, .pcard)'))
    .filter((el): el is HTMLElement => el !== null);
}
// ── the buy chapter ─────────────────────────────────────────────────
function prepareBuyArrival(): void {
  cancelDealLaunch();
  const entries = buyEntries.value;
  if (entries.length === 0) {
    return;
  }
  const names = entries.map((e) => e.name);
  const keys = entries.map((e) => e.key);
  const dealKey = `draft-buy|${props.playerView.id}|${props.playerView.game.generation}`;
  if (deal.value.prepare(dealKey, names, keys)) {
    cancelDealLaunch = flow.after(motionMs(300), 'the buy row\'s deal launches', () => {
      void whenPickBeatDone().then(() => whenParliamentSurfaceGone()).then(() => flow.afterFrame('the buy row\'s deal launches on a frame', () => launchBuyDeal()));
    });
  } else if (riseSceneEngaged()) {
    // Already presented once (defer/restore) — never replay the scene.
    finishRiseScene();
  }
}
function launchBuyDeal(): void {
  if (!deal.value.state.active) {
    return;
  }
  const strip = buyRow.value ?? undefined;
  const layer = dealLayer.value ?? undefined;
  if (strip === undefined || strip === null || layer === undefined) {
    deal.value.dispose();
    if (riseSceneEngaged()) {
      finishRiseScene();
    }
    return;
  }
  fitStage();
  const slotCards = rowSlotCards(strip);
  deal.value.launch({
    slotCards,
    proxies: layer.proxyEls(),
    deck: layer.deckEl(),
    rise: riseExtras(),
    originEl: document.querySelector<HTMLElement>('.con-deckstack__pile'),
  });
}
/** The research rise: the shelf is the physical source of the purchase
 *  row (the auto-passed last card first ARRIVES from the deck, flipping). */
function riseExtras(): RiseLaunchExtras | undefined {
  if (!riseSceneEngaged()) {
    return undefined;
  }
  const cards = deal.value.state.cards;
  const sources: Array<DealTargetRect> = [];
  const arrivals: Array<number> = [];
  for (let i = 0; i < cards.length; i++) {
    const name = cards[i];
    const slot = resolveTraySlot(name);
    const card = slot !== null ? (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot) : null;
    const r = card !== null ? card.getBoundingClientRect() : undefined;
    if (r === undefined || r.width < 10 || r.height < 10) {
      finishRiseScene(); // no believable shelf — the deck deal carries it
      return undefined;
    }
    sources.push({left: r.left, top: r.top, width: r.width, height: r.height});
    if (draftTrayState.sceneArrivals.includes(name)) {
      arrivals.push(i);
    }
  }
  beginRiseScene();
  // The auto-passed card enters from the RECEIVE lane — the same
  // physical origin every passed packet deals in from. The old deck
  // origin told the wrong story (a deck popping in over the HUD for a
  // card the NEIGHBOUR handed over).
  const lane = (receiveSide.value === 'left' ? laneLeft.value : laneRight.value) ?? undefined;
  const laneRect = lane?.getBoundingClientRect?.();
  return {
    sources,
    arrivals,
    arrivalOrigin: laneRect !== undefined ?
      {x: laneRect.left + laneRect.width / 2, y: laneRect.top + laneRect.height / 2} : undefined,
    onArrivalLanded: (i) => {
      const name = cards[i];
      if (name !== undefined) {
        riseArrivalLanded(name);
      }
    },
    onSetComplete: riseSetComplete,
    onLiftOff: () => {
      // THE HANDOFF: the cards are off the shelf and growing into the
      // purchase row — the collection dissolves WITH that motion (and
      // stays gone; a shelf that flickers back reads as a second object).
      riseLiftOff();
      shelfRetired.value = true;
    },
    onFrameReveal: riseFrameReveal,
  };
}
/** RT on the buy: the purchase commit — bought cards physically leave for
 *  the hand dock, the rest tumbles to the discard, submit fires as the
 *  flights begin (never delayed behind the cinematic). */
function confirmPurchase(): void {
  if (submitting.value || !buyAffordable.value || beatActive.value) {
    return;
  }
  const bought = [...picks.value];
  const rest = buyEntries.value.filter((e) => !bought.includes(e.name));
  // The receipt the terminal plate reads («Куплено карт: N · −N M€»).
  completionBought.value = bought.length;
  completionSpent.value = bought.length * buyCostPerCard.value;
  discardsSettled.value = false;
  beginDraftCompletion();
  // The unbought cards drift out (the discard side), visibly secondary;
  // the terminal plate takes the stage the moment their exit has
  // ACTUALLY ENDED — the settle rides applyDiscardExit's own joined
  // animationend, never a parallel wall-clock guess (the old 880ms
  // timer left ~350ms of bare stage between the last fade and the
  // plate). The nonce guards a torn-down / re-entered frame.
  const settleToken = ++discardWaitNonce.value;
  const exit = applyDiscardExit(
    rest.map((e) => slotCardEl(e.name)).filter((el): el is HTMLElement => el !== null),
    {delayMs: 160},
  );
  cancelDiscardSettle();
  if (rest.length > 0) {
    void exit.then(() => {
      if (discardWaitNonce.value === settleToken && draftWorkspaceState.completion !== 'none') {
        discardsSettled.value = true;
      }
    });
  } else {
    // Everything was bought — a short beat while the intake proxies
    // stand over their sources, then the receipt.
    cancelDiscardSettle = flow.after(consoleMotionMs(200), 'the intake proxies stand over their sources', () => {
      discardsSettled.value = true;
    });
  }
  if (bought.length === 0) {
    submitCards([]);
    // No intake flight to ride on this path — the gate is the discard
    // exit's read window. Stored + cleared on unmount, so a torn-down
    // frame can never receive the completion flip.
    cancelCompletionFlights();
    cancelCompletionFlights = flow.after(consoleMotionMs(720), 'the zero-buy discard exit reads', () => {
      markDraftCompletionFlightsDone();
    });
    return;
  }
  const entries = bought
    .map((name) => ({name, el: slotCardEl(name) ?? undefined}))
    .filter((e) => e.el !== undefined);
  void runHandIntake(entries, {
    mode: 'stack',
    commit: () => submitCards(bought),
  }).then(() => markDraftCompletionFlightsDone());
}
/**
 * The terminal beat: a readable window AFTER the delivery — the frame may
 * release only once the bought cards have actually landed in the dock
 * (`completion === 'done'`); a beat that ends mid-flight would return the
 * board under cards still in the air.
 */
function armDoneBeat(): void {
  cancelDoneBeat();
  const started = Date.now();
  const tick = () => {
    // NEVER finish while the post-buy payment stands: the completion latch
    // is what keeps the frame's whole pay stage alive, and finishing it
    // mid-payment tore the embedded panel out into a standalone band over
    // a workspace posing as «ожидание». The payment is a stage of this
    // flow — the terminal beat reads AFTER it (the 9 s ceiling included:
    // a player thinking about their heat is not a stall).
    if (!paymentPending.value &&
        (draftWorkspaceState.completion === 'done' || Date.now() - started > 9000)) {
      finishDraftCompletion();
      return;
    }
    cancelDoneBeat = flow.after(consoleMotionMs(400), 'the terminal beat\'s next look', tick);
  };
  cancelDoneBeat = flow.after(consoleMotionMs(2100), 'the terminal beat reads', tick);
}
// ── the LT sub-stage («ОТОБРАННЫЕ › ОСМОТР») ───────────────────────
/**
 * ENTER: the collected cards PHYSICALLY spread out of the shelf onto the
 * big row — clone proxies fly slot→slot (the shelf's seats empty as each
 * card departs; a row slot materializes only under its own landing).
 * LEAVE reverses the same gesture, and only after the LAST card has
 * settled back onto the shelf does the packet stage return (with a
 * deferred packet's arrival, if one came in during the inspect).
 */
function enterInspect(): void {
  if (collectedEntries.value.length === 0 || inspectFlightActive.value) {
    return;
  }
  const names = collectedEntries.value.map((e) => e.name);
  const from = measureRects(names, (n) => shelfCardEl(n));
  draftWorkspaceState.inspecting = true;
  if (consoleReducedMotionActive() || from === undefined) {
    shelfDeparted.value = [...names];
    void nextTick(() => fitStage());
    return;
  }
  // The row mounts with EVERY slot held; each card's touchdown releases
  // its own slot. The SHELF keeps painting its cards until the exact
  // frame their clones stand over them (`shelfDeparted`, set at spawn).
  inspectHeldNames.value = [...names];
  beginInspectFlight();
  void nextTick(() => {
    fitStage();
    void nextTick(() => flow.afterFrame('the inspect row is laid out', () => {
      const to = measureRects(names, (n) => inspectCardEl(n));
      if (to === undefined) {
        shelfDeparted.value = [...names];
        finishInspectFlight();
        return;
      }
      shelfDeparted.value = [...names];
      flyClones(names, from, to, {
        onLand: (name) => {
          const at = inspectHeldNames.value.indexOf(name);
          if (at !== -1) {
            inspectHeldNames.value.splice(at, 1);
          }
        },
        onDone: () => finishInspectFlight(),
      });
    }));
  });
}
function leaveInspect(): void {
  if (inspectFlightActive.value) {
    return;
  }
  const names = collectedEntries.value.map((e) => e.name);
  const from = measureRects(names, (n) => inspectCardEl(n));
  if (consoleReducedMotionActive() || from === undefined || names.length === 0) {
    settleLeaveInspect();
    return;
  }
  const to = measureRects(names, (n) => shelfCardEl(n));
  if (to === undefined) {
    settleLeaveInspect();
    return;
  }
  // The big row empties card by card; the shelf's seats fill back one by
  // one — the packet returns only AFTER the collection is home.
  inspectHeldNames.value = [...names];
  shelfReturned.value = [];
  beginInspectFlight();
  flyClones(names, from, to, {
    onLand: (name) => {
      shelfReturned.value = [...shelfReturned.value, name];
    },
    onDone: () => {
      finishInspectFlight();
      settleLeaveInspect();
    },
  });
}
function settleLeaveInspect(): void {
  inspectHeldNames.value = [];
  shelfDeparted.value = [];
  shelfReturned.value = [];
  // A packet that arrived during the inspect presents NOW: the holds are
  // armed SYNCHRONOUSLY, in the same tick the stage becomes visible — the
  // cards never flash raw before their arrival plays.
  if (packetPendingPresent.value) {
    packetPendingPresent.value = false;
    preparePacketArrival();
  }
  draftWorkspaceState.inspecting = false;
  // Focus returns to the stage the player left — the packet (or the wait).
  focusIdx.value = Math.min(focusIdx.value, Math.max(0, packetEntries.value.length - 1));
}
function beginInspectFlight(): void {
  inspectFlightActive.value = true;
  cancelInspectFlight();
  // Bounded: a stranded flight may absorb input for at most this long.
  cancelInspectFlight = flow.after(consoleMotionMs(2600), 'the inspect flight\'s bound', () => finishInspectFlight());
}
function finishInspectFlight(): void {
  cancelInspectFlight();
  inspectFlightActive.value = false;
  inspectHeldNames.value = [];
  disposeClones();
}
/**
 * The inspect row's REAL card is empty while its clone is in the air —
 * and for as long as this stage is not the zone at all.
 *
 * The second half is what killed the flash: a `v-show` stage keeps
 * PAINTING through its ~180 ms leave transition, and the collect ended
 * by releasing every hold (`finishInspectFlight`) one tick BEFORE
 * `inspecting` went false. For those frames the full-size cards were
 * back on a stage the player had just watched them leave — they had
 * physically gone home to the shelf and then blinked back, full size.
 * Deriving the hold from the ZONE (rather than clearing it on a timer)
 * makes that window unexpressible.
 */
function inspectSlotHeld(name: CardName): boolean {
  return zone.value !== 'inspect' || inspectHeldNames.value.includes(name);
}
/** While its card is OUT on the big row a shelf seat holds empty (one
 *  physical set, never two copies): held from the frame its clone SPAWNS
 *  (`shelfDeparted`), revealed by its OWN return landing. */
function shelfHeld(name: CardName): boolean {
  if (shelfDeparted.value.includes(name) && !shelfReturned.value.includes(name)) {
    return true;
  }
  return isTraySlotHeld(name);
}
/** The seat is waiting for the neighbour's auto-passed card (the rise's
 *  arrival leg) — it paints as a prepared SEAT while the card is in the
 *  air. Bounded by `setComplete`: past the set beat the same card's
 *  hold belongs to the peel's lift-off and must read as a bare slot. */
function shelfAwaitingArrival(name: CardName): boolean {
  return draftTrayState.sceneArrivals.includes(name) &&
    !draftTrayState.setComplete && isTraySlotHeld(name);
}
// ── fullscreen inspect (X) ──────────────────────────────────────────
function zoomFocused(): void {
  const list = zone.value === 'buy' ? buyEntries.value :
    zone.value === 'pick' ? packetEntries.value :
      zone.value === 'inspect' ? collectedAsEntries.value : [];
  if (list.length === 0) {
    return;
  }
  const cards = list.map((e) => e.card);
  const rowRef = zone.value === 'buy' ? 'buyRow' : zone.value === 'inspect' ? 'inspectRow' : 'packetRow';
  const origin = slotZoomOrigin(
    () => stageRow(rowRef),
    (i) => cards[i]?.name ?? '',
    (i) => {
      focusIdx.value = i;
    },
  );
  // The availability voice comes from the ONE policy (cardAvailability):
  // pick and buy are their own intents, the collected shelf is the
  // viewer's own mid-draft review — all evaluate FOR LATER.
  const availability = availabilityContextFor(
    zone.value === 'buy' ? 'research-buy' : zone.value === 'inspect' ? 'drafted-review' : 'draft-pick');
  if (zone.value === 'pick' && !multiKeep.value) {
    // The pick: A in the viewer COMMITS the card (the action bridge).
    openConsoleCardZoom(cards, focusIdx.value, undefined, {
      labelFor: () => 'Take',
      reasonsFor: () => [],
      execute: (name) => commitSinglePick(name as CardName),
    }, {origin, availability});
    return;
  }
  if (zone.value === 'pick' || zone.value === 'buy') {
    const max = zone.value === 'buy' ? buyMax.value : (pickInput.value?.max ?? 1);
    openConsoleCardZoom(cards, focusIdx.value, {
      isSelected: (name) => isPicked(name as CardName),
      toggle: (name) => togglePick(name as CardName, max),
    }, undefined, {origin, availability});
    return;
  }
  // INSPECT: read-only — no bridge, nothing here may mutate anything.
  openConsoleCardZoom(cards, focusIdx.value, undefined, undefined, {origin, availability});
}
// ── geometry ────────────────────────────────────────────────────────
/** ONE fit for the active zone's row: the shared workspace stage solver
 *  (size + focus-safe gap + row shape together; resets its own outputs
 *  before measuring — the engine may never read its own output). */
/**
 * THE PACKET SHOWCASE (T10 · CE): share the MEASURED body between the packet, the shelf and the reading row
 * (`planDraftShowcase`) and publish the plan as custom properties — the stage's inset, the shelf's seats, the
 * wait's forward scale. Runs synchronously before the row's fit measures the stage box the plan leaves.
 */
function planShowcase(): void {
  const bodyNow = body.value ?? undefined;
  const bar = statusbar.value ?? undefined;
  if (bodyNow === undefined || bodyNow === null || bodyNow.clientHeight < 40) {
    return;
  }
  const zoneNow = zone.value;
  const rowRef = zoneNow === 'buy' || zoneNow === 'pay' ? 'buyRow' : zoneNow === 'inspect' ? 'inspectRow' : 'packetRow';
  const row = stageRow(rowRef);
  const probe = row?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null;
  const rowStyle = row === undefined || row === null ? undefined : getComputedStyle(row);
  const list = zoneNow === 'buy' || zoneNow === 'pay' ? buyEntries.value : zoneNow === 'inspect' ? collectedAsEntries.value : packetEntries.value;
  const plan = planDraftShowcase({
    bodyW: bodyNow.clientWidth,
    bodyH: bodyNow.clientHeight,
    readingH: bar?.offsetHeight ?? 0,
    stage: zoneNow === 'pay' ? 'buy' : zoneNow,
    cards: list.length,
    seats: rackKnown.value ? Math.max(pickTotal.value, collectedEntries.value.length) : 0,
    slotW: probe !== null && probe.offsetWidth > 10 ? probe.offsetWidth : 320,
    slotH: probe !== null && probe.offsetHeight > 10 ? probe.offsetHeight : 460,
    rowPadX: rowStyle === undefined ? 0 : (parseFloat(rowStyle.paddingLeft) || 0) + (parseFloat(rowStyle.paddingRight) || 0),
    rowPadY: rowStyle === undefined ? 0 : (parseFloat(rowStyle.paddingTop) || 0) + (parseFloat(rowStyle.paddingBottom) || 0),
    ui: conUiScale(),
    grown: consoleLayoutState.profile !== 'handheld',
    composition: composition,
  });
  if (plan.seatH === 0) {
    return; // no shelf in this stage — the last plan stays (the shelf leaves by its own fade)
  }
  const stageH = bodyNow.clientHeight - (bar?.offsetHeight ?? 0);
  const next: Record<string, string> = {
    '--con-draftws-seat-w': `${plan.seatW}px`,
    '--con-draftws-seat-h': `${plan.seatH}px`,
    '--con-draftws-seat-zoom': plan.seatZoom.toFixed(4),
    '--con-draftws-shelf-block': `${Math.ceil(plan.shelfBlock)}px`,
    '--con-draftws-wait-scale': plan.waitScale.toFixed(4),
    '--con-draftws-wait-lift': `${Math.round(Math.max(0, (stageH - plan.shelfBlock * plan.waitScale) / 2))}px`,
  };
  const cur = showcaseStyle.value;
  if (Object.keys(next).some((k) => cur[k] !== next[k])) {
    showcaseStyle.value = next;
  }
}
function fitStage(): void {
  planShowcase();
  const zoneNow = zone.value;
  const rowRef = zoneNow === 'buy' || zoneNow === 'pay' ? 'buyRow' : zoneNow === 'inspect' ? 'inspectRow' : 'packetRow';
  const row = stageRow(rowRef);
  const wrap = stageWrap.value ?? undefined;
  if (row === undefined || row === null || wrap === undefined || wrap === null) {
    return;
  }
  const list = zoneNow === 'buy' || zoneNow === 'pay' ? buyEntries.value :
    zoneNow === 'inspect' ? collectedAsEntries.value : packetEntries.value;
  if (list.length === 0) {
    return;
  }
  const current = zoneNow === 'buy' || zoneNow === 'pay' ? buyRowStyle.value :
    zoneNow === 'inspect' ? inspectRowStyle.value : packetRowStyle.value;
  const apply = (style: Record<string, string>) => {
    // A re-solve that lands on the SAME values must not touch the row:
    // the deal-end watcher re-fits a LIVE row, and even a no-op
    // re-assignment (let alone the old blank-first reset) re-laid the
    // whole line for a frame — the reported «дрожание ряда» on the last
    // card's landing. This fit's inputs are zoom-independent (slot probe
    // offsetWidth is pre-zoom, the budget is the STAGE's box), so the
    // blank-first reset bought nothing here.
    const same = Object.keys(style).length === Object.keys(current).length &&
      Object.entries(style).every(([k, v]) => current[k] === v);
    if (same) {
      return;
    }
    if (zoneNow === 'buy' || zoneNow === 'pay') {
      buyRowStyle.value = style;
    } else if (zoneNow === 'inspect') {
      inspectRowStyle.value = style;
    } else {
      packetRowStyle.value = style;
    }
  };
  void nextTick(() => {
    const slot = row.querySelector<HTMLElement>('.con-cards__slot');
    if (slot === null) {
      return;
    }
    const probe = slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot;
    const slotW = probe.offsetWidth;
    const slotH = probe.offsetHeight;
    if (slotW < 10 || slotH < 10) {
      return;
    }
    // THE STAGE's box, not the wrap's: the shelved zones inset their
    // stages off the shelf overlay, so the stage box IS the honest room.
    const stageEl = row.closest<HTMLElement>('.con-draftws__stage') ?? wrap;
    // The row's own paddings (focus/lift headroom on all four sides) are
    // part of the budget — MEASURED off the element, never re-stated as
    // constants that drift from the stylesheet.
    const rowStyle = getComputedStyle(row);
    const rowPadY = (parseFloat(rowStyle.paddingTop) || 0) + (parseFloat(rowStyle.paddingBottom) || 0);
    const rowPadX = (parseFloat(rowStyle.paddingLeft) || 0) + (parseFloat(rowStyle.paddingRight) || 0);
    const layout = wsStageLayout({
      // The ZONE's width, never the row's own: a shrink-to-fit row
      // reports its content width — the fit engine reading its output.
      availW: Math.max(160, stageEl.clientWidth - rowPadX),
      availH: Math.max(120, stageEl.clientHeight - rowPadY),
      slotW, slotH,
      n: list.length,
      ui: conUiScale(),
      padXPx: 0,
    });
    apply(wsStageLayoutStyle(layout));
    const zoneKey = zoneNow === 'inspect' ? 'inspect' : (zoneNow === 'buy' || zoneNow === 'pay' ? 'buy' : 'pick');
    perRowByZone.value[zoneKey] = layout.perRow;
  });
}
// ── the clone-proxy flights (the LT spread/collect) ─────────────────
// The engine lives in the SHARED `cardFlight/cloneFlights.ts` (the
// carryover picker is its second client) — this surface contributes only
// its source-node resolution and its layer class.
function measureRects(names: ReadonlyArray<CardName>, elOf: (n: CardName) => HTMLElement | null): Map<CardName, DOMRect> | undefined {
  return measureCardRects(names, elOf);
}
function flyClones(
  names: ReadonlyArray<CardName>,
  from: Map<CardName, DOMRect>,
  to: Map<CardName, DOMRect>,
  hooks: {onLand: (name: CardName) => void, onDone: () => void},
): void {
  cloneFlight = flyCardClones({
    names, from, to,
    layerClass: 'con-draftws-flights',
    sourceEl: (name) => shelfCardEl(name) ?? inspectCardEl(name),
    onLand: hooks.onLand,
    onDone: hooks.onDone,
  });
}
function disposeClones(): void {
  cloneFlight?.dispose();
  cloneFlight = undefined;
}
function shelfCardEl(name: CardName): HTMLElement | null {
  const slot = resolveShelfSlot(name);
  return slot === null ? null : (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot);
}
function inspectCardEl(name: CardName): HTMLElement | null {
  const root = rootEl.value;
  if (root === null) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  const slot = root.querySelector<HTMLElement>(`[data-inspect-slot="${esc}"]`);
  return slot === null ? null : (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot);
}
// ── plumbing ────────────────────────────────────────────────────────
/** A stage's card row, by the name of its template ref (the three rows are three refs — one keyed read each). */
function stageRow(rowRef: 'buyRow' | 'inspectRow' | 'packetRow'): HTMLElement | undefined {
  switch (rowRef) {
  case 'buyRow': return buyRow.value ?? undefined;
  case 'inspectRow': return inspectRow.value ?? undefined;
  case 'packetRow': return packetRow.value ?? undefined;
  }
}
function slotCardEl(name: CardName): HTMLElement | null {
  const root = rootEl.value;
  if (root === null) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  const slot = root.querySelector<HTMLElement>(`.con-draftws__stage [data-zoom-slot="${esc}"]`);
  return slot === null ? null : (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot);
}
function resolveShelfSlot(name: CardName): HTMLElement | null {
  const root = rootEl.value;
  if (root === null) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  return root.querySelector<HTMLElement>(`.con-draftws__shelf [data-tray-slot="${esc}"]`);
}

/** A fresh packet: reset the pick state + arm its arrival (pre-flush,
 *  so the real cards render hidden from their very first frame).
 *
 *  While the LT sub-stage owns the screen the presentation is DEFERRED —
 *  a deal launched into a hidden stage measures degenerate rects, and its
 *  live beat would swallow the B that leaves the inspect. The packet
 *  arrives ON THE RETURN instead (the natural choreography: come back →
 *  the passed packet enters). */
watch(() => packetKey.value, (next: string, prev: string) => {
  if (next === '' || next === prev) {
    return;
  }
  // THE PASS EXIT FINISHES ITS READ FIRST. The v-for swap unmounts the
  // still-animating leavers, and a fast answer (a bot, a local server)
  // used to cut them mid-slide on the very frame — the exit essentially
  // never completed. The swap's PRESENTATION defers until the leavers
  // are ~faded (bounded by `passUntil`); the server state is already
  // here, only the paint order changes.
  cancelPacketSwap();
  const wait = passUntil.value - Date.now();
  const present = () => {
    presentedPacketFrozen.value = undefined; // the swap paints NOW
    resetPickState();
    if (inspecting.value) {
      packetPendingPresent.value = true;
      return;
    }
    preparePacketArrival();
  };
  if (wait > 16) {
    cancelPacketSwap = flow.after(Math.min(wait, 1900), 'the pass exit finishes its read', present);
    return;
  }
  present();
}, {immediate: false});
/** Every server response re-arms submission (the root identity changes). */
watch(() => props.playerView, () => {
  submitting.value = false;
});
/** Entering the buy: freeze the set + arm the rise launch. */
watch(() => zone.value, (next: DraftZone, prev: DraftZone) => {
  if (next === prev) {
    return;
  }
  if (prev === 'pick' && next !== 'pick') {
    // The stage-level crossfade owns this handover — a frozen packet
    // must never outlive the stage it was frozen for.
    presentedPacketFrozen.value = undefined;
  }
  if (next === 'buy' && buySnapshot.value === undefined && buyInput.value !== undefined) {
    buySnapshot.value = buyInput.value.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
    picks.value = [];
    focusIdx.value = 0;
    prepareBuyArrival();
  }
  if (next === 'done') {
    armDoneBeat();
  }
  // Leaving the terminal beat (the post-buy PAYMENT arrived mid-read, or
  // the LT inspect) DISARMS it: a done-timer left ticking would finish the
  // completion UNDER the payment stage — `paymentPending`'s own guard in
  // the tick is the belt, this is the braces, and the beat re-arms with
  // its full read window when the zone returns to 'done'.
  if (prev === 'done') {
    cancelDoneBeat();
  }
  if (next === 'inspect' || prev === 'inspect') {
    focusIdx.value = 0;
  }
  void nextTick(() => fitStage());
});
/** The deal finished (or was skipped) while the rise scene was engaged —
 *  finalize the handoff (the shelf hands its frozen pile to the purchase
 *  row and empties), then re-fit on the settled layout. */
watch(() => deal.value.state.active, (active: boolean) => {
  if (!active) {
    if (riseSceneEngaged()) {
      finishRiseScene();
    }
    void nextTick(() => fitStage());
  }
});
watch(() => draftTrayState.pulseNonce, () => {
  cancelShelfPulse();
  shelfPulsing.value = false;
  void nextTick(() => {
    shelfPulsing.value = true;
    // Covers the set-complete ring warm (con-draftws-setglow, ~640ms) —
    // dropping the class mid-animation cuts the glow's release.
    cancelShelfPulse = flow.after(consoleMotionMs(680), 'the shelf\'s set-complete pulse reads', () => {
      shelfPulsing.value = false;
    });
  });
});
/** A touchdown settles ITS OWN seat (never the whole row). */
watch(() => draftTrayState.lastLand, (land: {n: number, name: string}) => {
  const name = land.name;
  if (name === '') {
    return;
  }
  shelfLandCancels[name]?.();
  delete shelfJustLanded.value[name];
  void nextTick(() => {
    shelfJustLanded.value[name] = true;
    shelfLandCancels[name] = flow.after(consoleMotionMs(300), 'a shelf seat\'s landing accent reads', () => {
      delete shelfJustLanded.value[name];
      delete shelfLandCancels[name];
    });
  });
});
/** The marks OUTLIVE this component: «свернуть» parks the stack, which
 *  unmounts the surface. Mirrored into module state on every change. */
watch(() => picks.value, (picks: ReadonlyArray<CardName>) => {
  rememberDraftPicks(picksKey.value, picks);
}, {deep: true});
/** Keep the command bar mirror current. */
watch(() => commandState.value, (state: DraftCommandState) => {
  setConsoleDraftCommands(draftCommands(state));
}, {immediate: true, deep: true});

// ARM BEFORE THE FIRST RENDER. The workspace mounts WITH its first prompt
// (the frame enters on the phase flip), so an `onMounted` arm is one frame
// too late — the raw cards flash for that frame before the deal's hold
// lands. `deal.prepare` is DOM-free; the launch measures later.
// READ THE MEMORY FIRST — `resetPickState()` below writes an empty
// selection through the same key, so recalling afterwards would read
// back the erasure it had just performed.
const remembered = recallDraftPicks(picksKey.value);
hydratedPacketKey.value = packetKey.value;
if (packetKey.value !== '') {
  resetPickState();
  preparePacketArrival();
} else if (stage.value === 'buy') {
  buySnapshot.value = buyInput.value?.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
  if (draftWorkspaceState.sawResearchStart && !drafting.value) {
    // THE BUY WITHOUT A DRAFT (TR61): the workspace stands up straight into the buy — the generation scene's
    // conclusion, or the player's A on the announce — and the four cards were just dealt: they come off the HUD
    // deck into the row (the deck deal; no shelf to rise from).
    prepareBuyArrival();
  } else {
    // Reload straight into the buy: freeze + present instantly.
    finishRiseScene();
  }
}
// RESTORED FROM THE PARK (or re-mounted for any other reason): the marks
// the player made are theirs, and «свернуть» promised to keep the
// decision live. Recall is keyed by the SET, so nothing is inherited
// across a new packet or a new generation's buy.
if (remembered.length > 0) {
  picks.value = remembered;
}

onMounted(() => {
  // THE SHELF IS THE TRAY now: every pick-beat / rise flight resolves its
  // landing slot through this registration (the same brain, a new surface).
  registerTraySlotResolver((name) => resolveShelfSlot(name));
  useResizeObserver(stageWrap.value, () => fitStage());
  void nextTick(() => fitStage());
});
onBeforeUnmount(() => {
  registerTraySlotResolver(undefined);
  resetConsoleDraftUi();
  // The workspace's timers are waits of its own scope (`flow`) — taken back when the component is unmounted.
  discardWaitNonce.value++; // a late exit promise may not touch a dead frame
  disposeClones();
  deal.value.dispose();
  // An engaged rise scene can't outlive its frame — hand the shelf off
  // (the watcher may not flush during teardown).
  if (riseSceneEngaged()) {
    finishRiseScene();
  }
});
defineExpose({handleIntent});
</script>
