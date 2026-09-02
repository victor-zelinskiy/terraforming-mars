<template>
  <!--
    THE DRAFT WORKSPACE («ДРАФТ») — the between-generations draft and the
    research buy as ONE console workspace flow.

    A PHASE-anchored root (consoleWorkspaceStack 'draft'): the shell stands it
    up when the draft phase begins and it lives until the buy's completion
    beats settle — the player never returns to the planet between micro-steps.
    The HUD, the player rail and the hand dock stay exactly where they are
    (the band geometry: `.con-ws` + `.con-ws-band()`), so entering the draft
    reads as the CENTRE of an already-running game turning into a workspace,
    never as a modal arriving.

    Zones are LAYERS of one stage (v-show — state survives), one visible at a
    time: PICK (the packet), WAIT (the pass lane), BUY (the purchase row +
    financial strip), PAY (the embedded payment step), INSPECT (the drafted
    cards, LT) and DONE (the terminal beat). The bottom SHELF («ОТОБРАНО») is
    permanent: every pick physically lands in it (the shared draft-tray brain +
    `runDraftPickToTray`), and at the buy transition it is the physical SOURCE
    the purchase row rises from (the research-rise scene, unchanged).

    Server truth only: stages derive from `consoleDraftFlow` (phase + the
    `draftPrompt` marker + `buyMode`); submissions are the byte-identical
    `cardsResponse` the legacy UI sends. No rule is re-implemented here.
  -->
  <section class="con-draftws con-ws" data-motion-surface="draftws" ref="rootEl">
    <!-- The identity EMBLEM is load-bearing here, not decoration: the flow
         connector's origin diamond rises out of the ROOT GLYPH's slot
         (--con-wsflow-axis), and without an emblem that axis falls under
         the title's first letter — the trace drew straight through «Д». -->
    <ConsoleWsHead root="Draft" emblem="cards" class="con-draftws__head"
                   :subject="crumb.subject" :stage="crumb.stage" :committed="crumb.committed">
      <template #flow>
        <ConsoleJourneyRail :phases="journeyPhases"
                            :presentation="flowPresentation"
                            :compact-context="compactContext"
                            :committing="draftWorkspaceState.completion === 'flights'"
                            terminal-label="Ready" />
      </template>
      <template #trailing>
        <!-- The chapter's own READOUT — one reserved slot in the header's
             stable chrome, so neither of the two costs the cards a single
             pixel of stage height: the SELECTION states where the packet
             goes; the PURCHASE states what it costs. -->
        <div v-if="passReadout !== undefined" class="con-draftws__pass">
          <span class="con-draftws__pass-label">{{ $t('Passing to') }}</span>
          <span class="con-draftws__pass-dot" :class="'player_bg_color_' + passReadout.color" aria-hidden="true"></span>
          <span class="con-draftws__pass-name">{{ passReadout.name }}</span>
          <span class="con-draftws__pass-arrow" aria-hidden="true">{{ giveSide === 'right' ? '⟶' : '⟵' }}</span>
        </div>
        <div v-else-if="zone === 'buy' || zone === 'pay'"
             class="con-draftws__finstrip" :class="{'con-draftws__finstrip--over': !buyAffordable}">
          <span class="con-draftws__fin-main">
            <span class="con-draftws__fin-label">{{ $t('Purchase') }}</span>
            <span class="con-draftws__fin-total" :key="buyTotal">−{{ buyTotal }}</span>
            <i class="resource_icon resource_icon--megacredits con-draftws__fin-mc" aria-hidden="true"></i>
            <span class="con-draftws__fin-detail">{{ picks.length }} × {{ buyCostPerCard }}</span>
          </span>
          <span class="con-draftws__fin-wallet">
            <span class="con-draftws__fin-cell">
              <span class="con-draftws__fin-caption">{{ $t('You have') }}</span>
              <span class="con-draftws__fin-num">{{ megacreditsOnHand }}</span>
              <i class="resource_icon resource_icon--megacredits con-draftws__fin-mc" aria-hidden="true"></i>
            </span>
            <span class="con-draftws__fin-sep" aria-hidden="true">→</span>
            <span class="con-draftws__fin-cell">
              <span class="con-draftws__fin-caption">{{ $t('After purchase') }}</span>
              <span class="con-draftws__fin-num" :class="{'con-draftws__fin-num--over': !buyAffordable}">{{ megacreditsAfterPurchase }}</span>
              <i class="resource_icon resource_icon--megacredits con-draftws__fin-mc" aria-hidden="true"></i>
            </span>
          </span>
        </div>
      </template>
    </ConsoleWsHead>

    <div class="con-draftws__body" data-motion-panel>
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
              <div v-for="(entry, i) in buyEntries" :key="entry.key"
                   class="con-cards__slot con-draftws__slot"
                   :data-zoom-slot="entry.name"
                   :data-draft-buy-slot="entry.name"
                   :class="{
                     'con-cards__slot--focused': zone === 'buy' && focusIdx === i && !beatActive,
                     'con-cards__slot--picked': isPicked(entry.name),
                     'con-cards__slot--dim': pickLimitReached && !isPicked(entry.name),
                     'con-deal-hold': deal.isHeld(entry.key),
                   }">
                <Card :card="entry.card" :key="entry.name" lightweight />
                <span v-if="isPicked(entry.name)" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
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

      <!-- ── STATUS RAIL: the focused card's availability block (the shared
           ConsoleCardAvailabilityPanel, compact density): the card's name +
           a loud TV-readable status on the first row, the requirement-vs-now
           comparison in the reading voice on the second. Amber = «пока не
           выполнено» (evaluative), red = the server PROVED «уже не
           выполнить» — informational either way, never blocking language
           (the pick/buy stays fully available). IN FLOW, directly under the
           stage and ABOVE the shelf overlay: it explains the card the player
           is looking at, so it may never be covered by the collection, nor
           float over the cards. ─────────── -->
      <div class="con-draftws__statusbar" :class="{'con-draftws__statusbar--held': beatActive}">
        <!-- ONE block in BOTH states. A met requirement set is the DEFAULT and
             says nothing beyond the card's name (a status that fires on every
             card is noise, and the positive state has no reader) — but the
             NAME is the same element, at the same size, whether or not a
             verdict stands beside it. The second, hand-rolled span this
             replaced inherited the document's px size and read tiny on a TV
             next to the block's own 1.18rem name. The key re-announces the
             name on every focus move. -->
        <ConsoleCardAvailabilityPanel v-if="statusEntry !== undefined"
                                      :key="statusEntry.name"
                                      variant="compact"
                                      :view="statusAvailability"
                                      :cardTitle="$t(statusEntry.name)"/>
        <span v-else-if="zone === 'wait'" class="con-draftws__status-idle">{{ $t('Waiting for the other players') }}</span>
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
          <span class="con-draftws__shelf-count">{{ collectedEntries.length }}<template v-if="pickTotal > 0"> / {{ pickTotal }}</template></span>
          <span v-if="canInspectCollected && !inspecting" class="con-draftws__shelf-hint">
            <GamepadGlyph control="triggerL" /><span>{{ $t('Inspect') }}</span>
          </span>
        </div>
        <div class="con-draftws__shelf-row">
          <div v-for="(entry, idx) in collectedEntries" :key="entry.name + '-' + idx"
               class="con-draftws__shelf-slot"
               :style="{zIndex: idx + 1}"
               :data-tray-slot="entry.name"
               :class="{'con-deal-hold': shelfHeld(entry.name), 'con-draftws__shelf-slot--landed': shelfJustLanded[entry.name] === true}">
            <Card :card="entry.card" :key="entry.name" lightweight />
          </div>
          <!-- Prepared empty seats up to the known total: the shelf states how
               far the draft runs before a single card has landed — including
               at zero, which is exactly when that statement is worth most. -->
          <span v-for="n in emptySeats" :key="'seat-' + n" class="con-draftws__shelf-seat" aria-hidden="true"></span>
        </div>
      </div>
      </transition>
    </div>

    <!-- The deal cinematic stage (packet arrivals + the research rise). -->
    <ConsoleCardDealLayer v-if="deal.state.active" ref="dealLayer"
                          :cards="deal.state.cards" :models="dealModels" :nonce="deal.state.nonce" />
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import {gsap} from 'gsap';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleJourneyRail from '@/client/components/console/foundation/ConsoleJourneyRail.vue';
import ConsoleCardDealLayer from '@/client/components/console/cardDeal/ConsoleCardDealLayer.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {cardsResponse} from '@/client/console/taskResponses';
import {megacreditsAvailable} from '@/client/console/paymentPlan';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {createCardDealSequence, RiseLaunchExtras} from '@/client/console/cardDeal/cardDealSequence';
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
  draftPicksKey, rememberDraftPicks, recallDraftPicks,
  DraftStage, DraftJourneyInput,
} from '@/client/console/draft/consoleDraftFlow';
import {draftCommands, setConsoleDraftCommands, resetConsoleDraftUi, DraftCommandState} from '@/client/console/draft/consoleDraftUi';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {availabilityContextFor, buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import {Phase} from '@/common/Phase';

type CardEntry = {name: CardName, key: string, card: CardModel};

/** One workspace zone — what the staging area is showing right now. */
type DraftZone = 'pick' | 'wait' | 'buy' | 'pay' | 'inspect' | 'done';

export default defineComponent({
  name: 'ConsoleDraftWorkspace',
  components: {Card, GamepadGlyph, ConsoleWsHead, ConsoleJourneyRail, ConsoleCardDealLayer, ConsoleCardAvailabilityPanel},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      draftTrayState,
      draftWorkspaceState,
      focusIdx: 0,
      /** Pick-stage picks (keep-2 rounds) and buy-stage picks — sequential
       *  stages share one list; it resets on every stage/packet change. */
      picks: [] as Array<CardName>,
      submitting: false,
      /** The buy set FROZEN at its first render: the surface outlives its own
       *  prompt (the submit ends `waitingFor` while the exit flights play). */
      buySnapshot: undefined as ReadonlyArray<CardEntry> | undefined,
      /** The pass exit: the leftover cards visibly leaving toward the neighbor. */
      passingNames: [] as Array<CardName>,
      passingActive: false,
      /** The deal sequence (packet arrivals + the research rise). */
      deal: createCardDealSequence(),
      dealLaunchTimer: undefined as number | undefined,
      doneTimer: undefined as number | undefined,
      passTimer: undefined as number | undefined,
      /** The pass-flip re-arm loop (WAAPI turn survives node renewal). */
      passFlipTimer: undefined as number | undefined,
      /** The packet standing when the workspace MOUNTED (a reload straight
       *  into a live draft): presented instantly, never re-dealt. */
      hydratedPacketKey: '',
      /** A packet arrived WHILE the LT sub-stage owned the screen — its
       *  presentation waits for the return (never torn into the inspect). */
      packetPendingPresent: false,
      /** The LT sub-stage's PHYSICAL spread/collect (clone-proxy flights):
       *  row slots held empty until their own card lands; input absorbed. */
      inspectFlightActive: false,
      inspectHeldNames: [] as Array<CardName>,
      /** Cards whose clone has physically LEFT the shelf (held from the exact
       *  frame the proxy stands over them — never a frame earlier). */
      shelfDeparted: [] as Array<CardName>,
      /** Seats already re-filled by the RETURN flight (per-card landings). */
      shelfReturned: [] as Array<CardName>,
      inspectFlightTimer: undefined as number | undefined,
      cloneLayer: undefined as HTMLElement | undefined,
      /** The collection has handed its cards to the purchase row (lift-off):
       *  the shelf dissolves and never returns for the rest of the flow. */
      shelfRetired: false,
      /** The purchase commit's receipt (the terminal plate's numbers). */
      completionBought: 0,
      completionSpent: 0,
      /** The unbought cards' exit has visually settled — the terminal plate
       *  may take the stage while the intake still flies to the dock. */
      discardsSettled: false,
      discardTimer: undefined as number | undefined,
      /** The zero-buy path's completion gate (no intake flight to ride). */
      completionFlightsTimer: undefined as number | undefined,
      /** The pick stage's FROZEN presentation while the pass exit reads —
       *  a fast answer must not swap the v-for under the leaving cards. */
      presentedPacketFrozen: undefined as ReadonlyArray<CardEntry> | undefined,
      /** Deferred packet-swap presentation (bounded by `passUntil`). */
      packetSwapTimer: undefined as number | undefined,
      /** Wall-clock deadline of the running pass exit's read. */
      passUntil: 0,
      /** Solved stage layouts (CSS custom-property maps). */
      packetRowStyle: {} as Record<string, string>,
      buyRowStyle: {} as Record<string, string>,
      inspectRowStyle: {} as Record<string, string>,
      /** Row shape (cards per row) for 2D d-pad navigation. */
      perRowByZone: {pick: 5, buy: 5, inspect: 5} as Record<string, number>,
      shelfPulsing: false,
      shelfPulseTimer: undefined as number | undefined,
      /** Per-seat one-shot settle accent (a landing accents ITSELF — the
       *  whole-row pulse is the set-complete beat only). */
      shelfJustLanded: {} as Record<string, boolean>,
      shelfLandTimers: {} as Record<string, number>,
    };
  },
  computed: {
    stage(): DraftStage {
      return draftStageOf(this.playerView);
    },
    inspecting(): boolean {
      return draftWorkspaceState.inspecting;
    },
    /** The one visible layer of the staging area. */
    zone(): DraftZone {
      if (this.inspecting) {
        return 'inspect';
      }
      if (this.paymentPending) {
        return 'pay';
      }
      if (draftWorkspaceState.completion !== 'none') {
        // The frozen buy row keeps the stage just long enough for the
        // unbought cards' exit to read; the terminal plate then takes over
        // WHILE the bought cards are still flying to the dock (the receipt
        // is synchronized with the delivery, never after it).
        return this.discardsSettled ? 'done' : 'buy';
      }
      switch (this.stage) {
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
        return this.passingActive ? 'pick' : 'wait';
      }
    },
    /**
     * The shelf presents through the SELECTION chapter, and through the rise
     * only until the cards LIFT OFF it — the moment they start growing into
     * the purchase row it dissolves, and it never comes back for the rest of
     * the flow (`shelfRetired`). Keeping it up past the lift-off is what put
     * a stale plate over the arriving cards.
     */
    shelfVisible(): boolean {
      if (this.shelfRetired) {
        return false;
      }
      return this.zone === 'pick' || this.zone === 'wait' || this.zone === 'inspect' ||
        riseSceneEngaged();
    },
    /** The stages step off the shelf's zone while it genuinely occupies it
     *  (the BUY deliberately keeps the full height — during the rise the
     *  shelf overlays the bottom edge, and the row is already final). */
    stageShelved(): boolean {
      return this.zone === 'pick' || this.zone === 'wait' || this.zone === 'inspect';
    },
    /** The post-buy SelectPayment (Helion heat / steel) — embedded, phase-scoped. */
    paymentPending(): boolean {
      return this.playerView.game.phase === Phase.RESEARCH &&
        this.playerView.waitingFor?.type === 'payment' &&
        draftWorkspaceState.completion !== 'none';
    },
    pickInput() {
      return draftPickInput(this.playerView);
    },
    buyInput() {
      return draftBuyInput(this.playerView);
    },
    packetKey(): string {
      return draftPacketKey(this.playerView);
    },
    /** What the PICK stage renders: the frozen presentation while the pass
     *  exit finishes its read (a fast answer used to swap the v-for and cut
     *  the leavers mid-slide), else the live server packet. */
    packetEntries(): ReadonlyArray<CardEntry> {
      return this.presentedPacketFrozen ?? this.livePacketEntries;
    },
    livePacketEntries(): ReadonlyArray<CardEntry> {
      const input = this.pickInput;
      if (input === undefined) {
        return [];
      }
      return input.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
    },
    /** Live models aligned with the deal's card list — the flying face must
     *  match the landed face (buy-zone deals resolve from the buy entries). */
    dealModels(): Array<CardModel | undefined> {
      const pool = [...this.packetEntries, ...this.buyEntries];
      return this.deal.state.cards.map((name) => pool.find((e) => e.name === name)?.card);
    },
    /** Buy candidates — live prompt first, else the frozen snapshot. */
    buyEntries(): ReadonlyArray<CardEntry> {
      if (this.buySnapshot !== undefined) {
        return this.buySnapshot;
      }
      const input = this.buyInput;
      if (input === undefined) {
        return [];
      }
      return input.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
    },
    /** The shelf: server drafted + optimistic in-flight + the frozen rise set. */
    collectedEntries(): ReadonlyArray<{name: CardName, card: CardModel | {name: CardName}}> {
      const server = this.playerView.draftedCards ?? [];
      const names = trayDisplayCards(server.map((c) => c.name));
      return names.map((name) => ({
        name,
        card: server.find((c) => c.name === name) ?? {name},
      }));
    },
    emptySeats(): number {
      return Math.max(0, this.pickTotal - this.collectedEntries.length);
    },
    /** The rack can only be DRAWN once its size is known — the server states
     *  it with the first draft marker, so this is false for at most the gap
     *  before the opening prompt lands (a reload into an empty wait state). */
    rackKnown(): boolean {
      return this.pickTotal > 0 || this.collectedEntries.length > 0;
    },
    pickTotal(): number {
      return draftWorkspaceState.total;
    },
    /** Picks locked in (the flow rail's progress) — optimistic in-flight
     *  additions count (the hero is already flying to the shelf). */
    pickedCount(): number {
      return draftCollectedNames(this.playerView, draftTrayState.pending).length;
    },
    multiKeep(): boolean {
      const input = this.pickInput;
      return input !== undefined && (input.min ?? 1) > 1;
    },
    pickLimitReached(): boolean {
      const max = this.zone === 'buy' ? this.buyMax : (this.pickInput?.max ?? 1);
      return this.picks.length >= max;
    },
    buyMax(): number {
      return this.buyInput?.max ?? this.buyEntries.length;
    },
    pickBeat(): boolean {
      return draftPickBeatActive();
    },
    beatActive(): boolean {
      return this.pickBeat || this.deal.state.active || this.passingActive;
    },
    // ── purchase economics (server-identical: ChooseCards charges
    //    selected.length × player.cardCost) ─────────────────────────────
    buyCostPerCard(): number {
      return this.playerView.thisPlayer.cardCost;
    },
    buyTotal(): number {
      return this.picks.length * this.buyCostPerCard;
    },
    megacreditsOnHand(): number {
      return megacreditsAvailable(this.playerView.thisPlayer);
    },
    megacreditsAfterPurchase(): number {
      return this.megacreditsOnHand - this.buyTotal;
    },
    buyAffordable(): boolean {
      return this.zone !== 'buy' || this.buyTotal <= this.megacreditsOnHand;
    },
    // ── the flow rail / crumb ─────────────────────────────────────────
    journeyInput(): DraftJourneyInput {
      return {
        total: this.pickTotal,
        picked: this.pickedCount,
        stage: this.stage,
        completion: draftWorkspaceState.completion,
      };
    },
    journeyPhases() {
      return draftJourneyPhases(this.journeyInput);
    },
    flowPresentation() {
      return draftFlowPresentation({completion: draftWorkspaceState.completion, inspecting: this.inspecting});
    },
    /** The purchase is committed and its cards are leaving/gone: the row's
     *  selection chrome (focus ring, pick band) must leave WITH the cards —
     *  a bare ring standing where a departed card was is the reported
     *  «след от выбранной карты». */
    buyDeparting(): boolean {
      return draftWorkspaceState.completion !== 'none';
    },
    compactContext() {
      return draftCompactContext(this.journeyInput);
    },
    crumb() {
      return draftCrumb({stage: this.stage, inspecting: this.inspecting, completion: draftWorkspaceState.completion});
    },
    // ── the pass readouts ─────────────────────────────────────────────
    giveSide(): 'left' | 'right' {
      // 'after' = the next seat: visually to the RIGHT (the top-strip order).
      return draftWorkspaceState.meta?.direction === 'before' ? 'left' : 'right';
    },
    receiveSide(): 'left' | 'right' {
      return this.giveSide === 'right' ? 'left' : 'right';
    },
    passReadout(): {name: string, color: string} | undefined {
      if (this.zone !== 'pick' && this.zone !== 'wait') {
        return undefined;
      }
      const to = draftNeighbor(this.playerView, draftWorkspaceState.meta?.givingTo);
      if (to === undefined) {
        return undefined;
      }
      // The ONE participant-name resolver — MarsBot reads «Бот», never raw.
      return {name: displayNameForColor(this.playerView.players, to.color), color: to.color};
    },
    giveReadout(): string {
      const to = draftWorkspaceState.meta?.givingTo;
      if (to === undefined || draftNeighbor(this.playerView, to) === undefined) {
        return '';
      }
      return translateTextWithParams('The rest of the packet went to ${0}', [displayNameForColor(this.playerView.players, to)]);
    },
    takeReadout(): string {
      const from = draftWorkspaceState.meta?.takingFrom;
      if (from === undefined || draftNeighbor(this.playerView, from) === undefined) {
        return '';
      }
      return translateTextWithParams('Next packet comes from ${0}', [displayNameForColor(this.playerView.players, from)]);
    },
    doneReadout(): string {
      return translateText('Purchased cards are in your hand');
    },
    boughtReadout(): string {
      return translateTextWithParams('Cards bought: ${0}', [String(this.completionBought)]);
    },
    setComplete(): boolean {
      return draftTrayState.setComplete;
    },
    canInspectCollected(): boolean {
      return this.collectedEntries.length > 0 &&
        (this.zone === 'pick' || this.zone === 'wait');
    },
    // ── the status rail ───────────────────────────────────────────────
    statusEntry(): CardEntry | undefined {
      const list = this.zone === 'buy' ? this.buyEntries :
        this.zone === 'pick' ? this.packetEntries :
          this.zone === 'inspect' ? this.collectedAsEntries : [];
      return list[this.focusIdx] ?? list[0];
    },
    collectedAsEntries(): ReadonlyArray<CardEntry> {
      return this.collectedEntries
        .filter((e): e is {name: CardName, card: CardModel} => (e.card as CardModel).name !== undefined)
        .map((e, i) => ({name: e.name, key: e.name + '#' + i, card: e.card as CardModel}));
    },
    /** The focused card's availability view (draft voice: printed
     *  requirements only; `undefined` = nothing to say beyond the name).
     *  Built by the SHARED cardAvailability model — the fullscreen panel
     *  renders the same view, so the two can never disagree. */
    statusAvailability(): CardAvailabilityView | undefined {
      return buildCardAvailability({reasons: this.statusEntry?.card?.unplayableReasons}, 'draft');
    },
    /** The bar contract facts (published to `consoleDraftUi` by a watcher). */
    commandState(): DraftCommandState {
      const zone: DraftCommandState['zone'] = this.zone === 'pay' ? 'buy' : this.zone;
      return {
        beatActive: this.beatActive,
        zone,
        singlePick: !this.multiKeep && this.zone === 'pick',
        focusedPicked: this.statusEntry !== undefined && this.isPicked(this.statusEntry.name),
        canPickFocused: this.zone === 'buy' ?
          (!this.pickLimitReached && this.buyAffordableWithOneMore) :
          (!this.multiKeep || !this.pickLimitReached),
        setValid: this.zone === 'buy' ? this.buyAffordable : this.picks.length === (this.pickInput?.min ?? 1),
        hasCards: (this.zone === 'buy' ? this.buyEntries : this.packetEntries).length > 0 ||
          (this.zone === 'inspect' && this.collectedEntries.length > 0),
        hasCollected: this.collectedEntries.length > 0,
        buyingNothing: this.zone === 'buy' && this.picks.length === 0,
      };
    },
    buyAffordableWithOneMore(): boolean {
      return (this.picks.length + 1) * this.buyCostPerCard <= this.megacreditsOnHand;
    },
    /** WHICH SET the current marks belong to — the memory's key, so a new
     *  packet / a new generation's buy never inherits a stale selection. */
    picksKey(): string {
      const buying = this.zone === 'buy' || this.zone === 'pay' || draftWorkspaceState.completion !== 'none';
      const entries = buying ? this.buyEntries : this.packetEntries;
      return draftPicksKey(buying ? 'buy' : 'pick', this.playerView.game.generation, entries.map((e) => e.name));
    },
  },
  watch: {
    /** A fresh packet: reset the pick state + arm its arrival (pre-flush,
     *  so the real cards render hidden from their very first frame).
     *
     *  While the LT sub-stage owns the screen the presentation is DEFERRED —
     *  a deal launched into a hidden stage measures degenerate rects, and its
     *  live beat would swallow the B that leaves the inspect. The packet
     *  arrives ON THE RETURN instead (the natural choreography: come back →
     *  the passed packet enters). */
    packetKey: {
      immediate: false,
      handler(next: string, prev: string) {
        if (next === '' || next === prev) {
          return;
        }
        // THE PASS EXIT FINISHES ITS READ FIRST. The v-for swap unmounts the
        // still-animating leavers, and a fast answer (a bot, a local server)
        // used to cut them mid-slide on the very frame — the exit essentially
        // never completed. The swap's PRESENTATION defers until the leavers
        // are ~faded (bounded by `passUntil`); the server state is already
        // here, only the paint order changes.
        if (this.packetSwapTimer !== undefined) {
          window.clearTimeout(this.packetSwapTimer);
          this.packetSwapTimer = undefined;
        }
        const wait = this.passUntil - Date.now();
        const present = () => {
          this.packetSwapTimer = undefined;
          this.presentedPacketFrozen = undefined; // the swap paints NOW
          this.resetPickState();
          if (this.inspecting) {
            this.packetPendingPresent = true;
            return;
          }
          this.preparePacketArrival();
        };
        if (wait > 16) {
          this.packetSwapTimer = window.setTimeout(present, Math.min(wait, 1900));
          return;
        }
        present();
      },
    },
    /** Every server response re-arms submission (the root identity changes). */
    playerView() {
      this.submitting = false;
    },
    /** Entering the buy: freeze the set + arm the rise launch. */
    zone(next: DraftZone, prev: DraftZone) {
      if (next === prev) {
        return;
      }
      if (prev === 'pick' && next !== 'pick') {
        // The stage-level crossfade owns this handover — a frozen packet
        // must never outlive the stage it was frozen for.
        this.presentedPacketFrozen = undefined;
      }
      if (next === 'buy' && this.buySnapshot === undefined && this.buyInput !== undefined) {
        this.buySnapshot = this.buyInput.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
        this.picks = [];
        this.focusIdx = 0;
        this.prepareBuyArrival();
      }
      if (next === 'done') {
        this.armDoneBeat();
      }
      if (next === 'inspect' || prev === 'inspect') {
        this.focusIdx = 0;
      }
      void this.$nextTick(() => this.fitStage());
    },
    /** The deal finished (or was skipped) while the rise scene was engaged —
     *  finalize the handoff (the shelf hands its frozen pile to the purchase
     *  row and empties), then re-fit on the settled layout. */
    'deal.state.active'(active: boolean) {
      if (!active) {
        if (riseSceneEngaged()) {
          finishRiseScene();
        }
        void this.$nextTick(() => this.fitStage());
      }
    },
    'draftTrayState.pulseNonce'() {
      if (this.shelfPulseTimer !== undefined) {
        window.clearTimeout(this.shelfPulseTimer);
      }
      this.shelfPulsing = false;
      void this.$nextTick(() => {
        this.shelfPulsing = true;
        this.shelfPulseTimer = window.setTimeout(() => {
          this.shelfPulsing = false;
          this.shelfPulseTimer = undefined;
        }, consoleMotionMs(280));
      });
    },
    /** A touchdown settles ITS OWN seat (never the whole row). */
    'draftTrayState.lastLand'(land: {n: number, name: string}) {
      const name = land.name;
      if (name === '') {
        return;
      }
      if (this.shelfLandTimers[name] !== undefined) {
        window.clearTimeout(this.shelfLandTimers[name]);
      }
      delete this.shelfJustLanded[name];
      void this.$nextTick(() => {
        this.shelfJustLanded[name] = true;
        this.shelfLandTimers[name] = window.setTimeout(() => {
          delete this.shelfJustLanded[name];
          delete this.shelfLandTimers[name];
        }, consoleMotionMs(300));
      });
    },
    /** The marks OUTLIVE this component: «свернуть» parks the stack, which
     *  unmounts the surface. Mirrored into module state on every change. */
    picks: {
      deep: true,
      handler(picks: ReadonlyArray<CardName>) {
        rememberDraftPicks(this.picksKey, picks);
      },
    },
    /** Keep the command bar mirror current. */
    commandState: {
      immediate: true,
      deep: true,
      handler(state: DraftCommandState) {
        setConsoleDraftCommands(draftCommands(state));
      },
    },
  },
  created() {
    // ARM BEFORE THE FIRST RENDER. The workspace mounts WITH its first prompt
    // (the frame enters on the phase flip), so a `mounted()` arm is one frame
    // too late — the raw cards flash for that frame before the deal's hold
    // lands. `deal.prepare` is DOM-free; the launch measures later.
    // READ THE MEMORY FIRST — `resetPickState()` below writes an empty
    // selection through the same key, so recalling afterwards would read
    // back the erasure it had just performed.
    const remembered = recallDraftPicks(this.picksKey);
    this.hydratedPacketKey = this.packetKey;
    if (this.packetKey !== '') {
      this.resetPickState();
      this.preparePacketArrival();
    } else if (this.stage === 'buy') {
      // Reload straight into the buy: freeze + present instantly.
      this.buySnapshot = this.buyInput?.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
      finishRiseScene();
    }
    // RESTORED FROM THE PARK (or re-mounted for any other reason): the marks
    // the player made are theirs, and «свернуть» promised to keep the
    // decision live. Recall is keyed by the SET, so nothing is inherited
    // across a new packet or a new generation's buy.
    if (remembered.length > 0) {
      this.picks = remembered;
    }
  },
  mounted() {
    // THE SHELF IS THE TRAY now: every pick-beat / rise flight resolves its
    // landing slot through this registration (the same brain, a new surface).
    registerTraySlotResolver((name) => this.resolveShelfSlot(name));
    useResizeObserver(this.$refs.stageWrap as HTMLElement, () => this.fitStage());
    void this.$nextTick(() => this.fitStage());
  },
  beforeUnmount() {
    registerTraySlotResolver(undefined);
    resetConsoleDraftUi();
    if (this.dealLaunchTimer !== undefined) {
      window.clearTimeout(this.dealLaunchTimer);
    }
    if (this.doneTimer !== undefined) {
      window.clearTimeout(this.doneTimer);
    }
    if (this.passTimer !== undefined) {
      window.clearTimeout(this.passTimer);
    }
    if (this.passFlipTimer !== undefined) {
      window.clearInterval(this.passFlipTimer);
    }
    if (this.shelfPulseTimer !== undefined) {
      window.clearTimeout(this.shelfPulseTimer);
    }
    for (const key of Object.keys(this.shelfLandTimers)) {
      window.clearTimeout(this.shelfLandTimers[key]);
    }
    if (this.inspectFlightTimer !== undefined) {
      window.clearTimeout(this.inspectFlightTimer);
    }
    if (this.discardTimer !== undefined) {
      window.clearTimeout(this.discardTimer);
    }
    if (this.completionFlightsTimer !== undefined) {
      window.clearTimeout(this.completionFlightsTimer);
    }
    if (this.packetSwapTimer !== undefined) {
      window.clearTimeout(this.packetSwapTimer);
    }
    this.disposeClones();
    this.deal.dispose();
    // An engaged rise scene can't outlive its frame — hand the shelf off
    // (the watcher may not flush during teardown).
    if (riseSceneEngaged()) {
      finishRiseScene();
    }
  },
  methods: {
    // ── input (routed by the shell while the workspace owns the pad) ────
    handleIntent(intent: GamepadIntent): void {
      // Any input mid-beat skips the cinematic and is consumed.
      if (draftPickBeatActive()) {
        skipDraftPickBeat();
        return;
      }
      if (this.deal.state.active) {
        this.deal.skip();
        return;
      }
      if (this.passingActive || this.inspectFlightActive) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onAction(action);
      }
    },
    onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
      const list = this.zone === 'buy' ? this.buyEntries :
        this.zone === 'pick' ? this.packetEntries :
          this.zone === 'inspect' ? this.collectedAsEntries : [];
      if (list.length === 0) {
        return;
      }
      const perRow = this.perRowByZone[this.zone === 'inspect' ? 'inspect' : (this.zone === 'buy' ? 'buy' : 'pick')] || list.length;
      let next = this.focusIdx;
      if (dir === 'left') {
        next = this.focusIdx - 1;
      } else if (dir === 'right') {
        next = this.focusIdx + 1;
      } else if (dir === 'up') {
        next = this.focusIdx - perRow;
      } else if (dir === 'down') {
        next = this.focusIdx + perRow;
      }
      if (next >= 0 && next < list.length) {
        this.focusIdx = next;
      }
    },
    onAction(action: ConsoleAction): void {
      switch (action) {
      case 'primary':
        this.onPrimary();
        return;
      case 'inspect':
        this.zoomFocused();
        return;
      case 'prevTab': // LT — the drafted-cards sub-stage
        if (this.zone === 'inspect') {
          this.leaveInspect();
        } else if (this.canInspectCollected) {
          this.enterInspect();
        }
        return;
      case 'nextTab': // RT — commit the set (keep-2 pick / the buy)
        if (this.zone === 'buy') {
          this.confirmPurchase();
        } else if (this.zone === 'pick' && this.multiKeep) {
          this.commitPickSet();
        }
        return;
      case 'back':
        this.onBack();
        return;
      default:
        return;
      }
    },
    onPrimary(): void {
      if (this.zone === 'pick') {
        const entry = this.packetEntries[this.focusIdx];
        if (entry === undefined) {
          return;
        }
        if (!this.multiKeep) {
          this.commitSinglePick(entry.name);
          return;
        }
        this.togglePick(entry.name, this.pickInput?.max ?? 1);
        return;
      }
      if (this.zone === 'buy') {
        const entry = this.buyEntries[this.focusIdx];
        if (entry === undefined) {
          return;
        }
        if (!this.isPicked(entry.name) && !this.buyAffordableWithOneMore) {
          return; // the financial strip already explains the shortfall
        }
        this.togglePick(entry.name, this.buyMax);
        return;
      }
    },
    onBack(): void {
      if (this.zone === 'inspect') {
        this.leaveInspect();
        return;
      }
      // Minimize — the shell's workspace-collapse path (the deferred chip).
      this.$emit('defer');
    },
    // ── picking ─────────────────────────────────────────────────────────
    isPicked(name: CardName): boolean {
      return this.picks.includes(name);
    },
    togglePick(name: CardName, max: number): void {
      const at = this.picks.indexOf(name);
      if (at !== -1) {
        this.picks.splice(at, 1);
        return;
      }
      if (this.picks.length < max) {
        this.picks.push(name);
      }
    },
    /** The single-keep pick: ONE press commits — hero to the shelf, the rest
     *  passes on toward the neighbor, submit fires at onLift. */
    commitSinglePick(name: CardName): void {
      if (this.submitting || this.pickBeat) {
        return;
      }
      this.picks = [name];
      this.launchPickBeat([name]);
    },
    /** The keep-2 commit (RT): both heroes fly, the rest passes on. */
    commitPickSet(): void {
      if (this.submitting || this.pickBeat) {
        return;
      }
      const need = this.pickInput?.min ?? 1;
      if (this.picks.length !== need) {
        return;
      }
      this.launchPickBeat([...this.picks]);
    },
    launchPickBeat(names: ReadonlyArray<CardName>): void {
      // FREEZE the packet's presentation for the whole exit read: the answer
      // lands mid-slide and the v-for swap used to cut the leavers on the
      // frame. The frozen list is released by the deferred swap presentation
      // (the packetKey watcher) or by the zone leaving `pick`.
      this.presentedPacketFrozen = this.livePacketEntries;
      const picks = names
        .map((name) => ({
          name,
          el: this.slotCardEl(name),
          // The live model rides the proxy: the flying face must BE the
          // landed face (cost chip / title-safe width / lightweight tier).
          card: this.packetEntries.find((e) => e.name === name)?.card,
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
      this.beginPassExit(this.packetEntries.filter((e) => !names.includes(e.name)).map((e) => e.name));
      runDraftPickBeat({
        picks,
        commit: () => this.submitCards(names),
      });
    },
    submitCards(names: ReadonlyArray<CardName>): void {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      this.$emit('submit', cardsResponse([...names]));
    },
    // ── the pass exit (leftovers leave toward the neighbor) ─────────────
    beginPassExit(names: ReadonlyArray<CardName>): void {
      if (names.length === 0 || consoleReducedMotionActive()) {
        return;
      }
      this.passingNames = [...names];
      this.passingActive = true;
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
      const dir = this.giveSide === 'right' ? 1 : -1;
      const passT0 = performance.now();
      const totalMs = consoleMotionMs(260 + 70 * Math.max(0, names.length - 1) + 820) + 120;
      let rearms = 0;
      if (this.passFlipTimer !== undefined) {
        window.clearInterval(this.passFlipTimer);
      }
      const tick = () => {
        const root = this.$el as HTMLElement | undefined;
        if (root === undefined || typeof root.querySelectorAll !== 'function') {
          return;
        }
        const elapsed = performance.now() - passT0;
        if (elapsed > totalMs) {
          window.clearInterval(this.passFlipTimer);
          this.passFlipTimer = undefined;
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
          // turn at the phase it would be in, never from zero.
          anim.currentTime = elapsed;
        });
      };
      this.passFlipTimer = window.setInterval(tick, 50) as unknown as number;
      void this.$nextTick(tick);
      // The read the packet swap defers to: the sequencing base, the last
      // leaver's stagger and ~85% of the 820ms flight (the cards are
      // essentially faded by then — cutting later buys nothing).
      this.passUntil = Date.now() + consoleMotionMs(260 + 70 * Math.max(0, names.length - 1) + 820 * 0.85);
      if (this.passTimer !== undefined) {
        window.clearTimeout(this.passTimer);
      }
      // Base delay + scaled stagger + the 820ms flight (see passingSlotStyle).
      this.passTimer = window.setTimeout(() => {
        this.passingActive = false;
        this.passTimer = undefined;
      }, consoleMotionMs(260 + 70 * Math.max(0, names.length - 1) + 940));
    },
    passingSlotStyle(name: CardName, index: number): Record<string, string> {
      const order = this.passingNames.indexOf(name);
      if (order < 0) {
        return {};
      }
      void index;
      const dir = this.giveSide === 'right' ? 1 : -1;
      // THE EXIT'S DESTINATION IS THE LANE — the physical anchor the NEXT
      // packet deals in from. A fixed 150px evaporated the cards in
      // mid-stage (partly clipped by the stage edge at full opacity); the
      // measured distance closes the same loop the arrival opens.
      const lane = (dir > 0 ? this.$refs.laneRight : this.$refs.laneLeft) as HTMLElement | undefined;
      const stage = this.$refs.stageWrap as HTMLElement | undefined;
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
    },
    // ── packet arrival (the deal cinematic) ─────────────────────────────
    resetPickState(): void {
      this.picks = [];
      this.focusIdx = 0;
      this.passingNames = [];
      this.passingActive = false;
      this.buySnapshot = undefined;
    },
    preparePacketArrival(): void {
      if (this.dealLaunchTimer !== undefined) {
        window.clearTimeout(this.dealLaunchTimer);
        this.dealLaunchTimer = undefined;
      }
      const entries = this.packetEntries;
      if (entries.length === 0) {
        return;
      }
      const names = entries.map((e) => e.name);
      const keys = entries.map((e) => e.key);
      const dealKey = `draft|${this.playerView.id}|${this.packetKey}`;
      // A reload straight into this packet: it is already on the table —
      // present instantly, consume the once-per-set memory.
      if (this.packetKey === this.hydratedPacketKey && !draftWorkspaceState.sawDraftStart) {
        this.deal.dispose();
        shouldRunDealOnce(dealKey);
        return;
      }
      if (this.deal.prepare(dealKey, names, keys)) {
        this.dealLaunchTimer = window.setTimeout(() => {
          this.dealLaunchTimer = undefined;
          void whenPickBeatDone().then(() => requestAnimationFrame(() => this.launchPacketDeal()));
        }, motionMs(300));
      }
    },
    launchPacketDeal(): void {
      if (!this.deal.state.active) {
        return;
      }
      const strip = this.$refs.packetRow as HTMLElement | undefined;
      const layer = this.$refs.dealLayer as InstanceType<typeof ConsoleCardDealLayer> | undefined;
      if (strip === undefined || strip === null || layer === undefined) {
        this.deal.dispose();
        return;
      }
      this.fitStage();
      const slotCards = Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot > :is(.card-container, .pcard)'));
      // ROUND 1 deals off the real HUD deck; a PASSED packet enters from the
      // side the neighbor sits on — the lane anchor is its physical origin.
      const firstPacket = this.playerView.draftedCards.length === 0 && draftTrayState.pending.length === 0;
      const lane = this.receiveSide === 'left' ? this.$refs.laneLeft : this.$refs.laneRight;
      this.deal.launch({
        slotCards,
        proxies: layer.proxyEls(),
        deck: layer.deckEl(),
        originEl: firstPacket ?
          document.querySelector<HTMLElement>('.con-deckstack__pile') :
          (lane as HTMLElement | undefined) ?? null,
      });
    },
    // ── the buy chapter ─────────────────────────────────────────────────
    prepareBuyArrival(): void {
      if (this.dealLaunchTimer !== undefined) {
        window.clearTimeout(this.dealLaunchTimer);
        this.dealLaunchTimer = undefined;
      }
      const entries = this.buyEntries;
      if (entries.length === 0) {
        return;
      }
      const names = entries.map((e) => e.name);
      const keys = entries.map((e) => e.key);
      const dealKey = `draft-buy|${this.playerView.id}|${this.playerView.game.generation}`;
      if (this.deal.prepare(dealKey, names, keys)) {
        this.dealLaunchTimer = window.setTimeout(() => {
          this.dealLaunchTimer = undefined;
          void whenPickBeatDone().then(() => requestAnimationFrame(() => this.launchBuyDeal()));
        }, motionMs(300));
      } else if (riseSceneEngaged()) {
        // Already presented once (defer/restore) — never replay the scene.
        finishRiseScene();
      }
    },
    launchBuyDeal(): void {
      if (!this.deal.state.active) {
        return;
      }
      const strip = this.$refs.buyRow as HTMLElement | undefined;
      const layer = this.$refs.dealLayer as InstanceType<typeof ConsoleCardDealLayer> | undefined;
      if (strip === undefined || strip === null || layer === undefined) {
        this.deal.dispose();
        if (riseSceneEngaged()) {
          finishRiseScene();
        }
        return;
      }
      this.fitStage();
      const slotCards = Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot > :is(.card-container, .pcard)'));
      this.deal.launch({
        slotCards,
        proxies: layer.proxyEls(),
        deck: layer.deckEl(),
        rise: this.riseExtras(),
        originEl: document.querySelector<HTMLElement>('.con-deckstack__pile'),
      });
    },
    /** The research rise: the shelf is the physical source of the purchase
     *  row (the auto-passed last card first ARRIVES from the deck, flipping). */
    riseExtras(): RiseLaunchExtras | undefined {
      if (!riseSceneEngaged()) {
        return undefined;
      }
      const cards = this.deal.state.cards;
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
      return {
        sources,
        arrivals,
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
          this.shelfRetired = true;
        },
        onFrameReveal: riseFrameReveal,
      };
    },
    /** RT on the buy: the purchase commit — bought cards physically leave for
     *  the hand dock, the rest tumbles to the discard, submit fires as the
     *  flights begin (never delayed behind the cinematic). */
    confirmPurchase(): void {
      if (this.submitting || !this.buyAffordable || this.beatActive) {
        return;
      }
      const bought = [...this.picks];
      const rest = this.buyEntries.filter((e) => !bought.includes(e.name));
      // The receipt the terminal plate reads («Куплено карт: N · −N M€»).
      this.completionBought = bought.length;
      this.completionSpent = bought.length * this.buyCostPerCard;
      this.discardsSettled = false;
      beginDraftCompletion();
      // The unbought cards drift out (the discard side), visibly secondary;
      // once their exit has READ, the terminal plate takes the stage — in
      // parallel with the bought cards' flight to the dock, never after it.
      applyDiscardExit(
        rest.map((e) => this.slotCardEl(e.name)).filter((el): el is HTMLElement => el !== null),
        {delayMs: 160},
      );
      if (this.discardTimer !== undefined) {
        window.clearTimeout(this.discardTimer);
      }
      this.discardTimer = window.setTimeout(() => {
        this.discardTimer = undefined;
        this.discardsSettled = true;
      }, consoleMotionMs(rest.length > 0 ? 880 : 200));
      if (bought.length === 0) {
        this.submitCards([]);
        // No intake flight to ride on this path — the gate is the discard
        // exit's read window. Stored + cleared on unmount, so a torn-down
        // frame can never receive the completion flip.
        if (this.completionFlightsTimer !== undefined) {
          window.clearTimeout(this.completionFlightsTimer);
        }
        this.completionFlightsTimer = window.setTimeout(() => {
          this.completionFlightsTimer = undefined;
          markDraftCompletionFlightsDone();
        }, consoleMotionMs(720));
        return;
      }
      const entries = bought
        .map((name) => ({name, el: this.slotCardEl(name) ?? undefined}))
        .filter((e) => e.el !== undefined);
      void runHandIntake(entries, {
        mode: 'stack',
        commit: () => this.submitCards(bought),
      }).then(() => markDraftCompletionFlightsDone());
    },
    /**
     * The terminal beat: a readable window AFTER the delivery — the frame may
     * release only once the bought cards have actually landed in the dock
     * (`completion === 'done'`); a beat that ends mid-flight would return the
     * board under cards still in the air.
     */
    armDoneBeat(): void {
      if (this.doneTimer !== undefined) {
        window.clearTimeout(this.doneTimer);
      }
      const started = Date.now();
      const tick = () => {
        this.doneTimer = undefined;
        if (draftWorkspaceState.completion === 'done' || Date.now() - started > 9000) {
          finishDraftCompletion();
          return;
        }
        this.doneTimer = window.setTimeout(tick, consoleMotionMs(400));
      };
      this.doneTimer = window.setTimeout(tick, consoleMotionMs(2100));
    },
    // ── the LT sub-stage («ОТОБРАННЫЕ › ОСМОТР») ───────────────────────
    /**
     * ENTER: the collected cards PHYSICALLY spread out of the shelf onto the
     * big row — clone proxies fly slot→slot (the shelf's seats empty as each
     * card departs; a row slot materializes only under its own landing).
     * LEAVE reverses the same gesture, and only after the LAST card has
     * settled back onto the shelf does the packet stage return (with a
     * deferred packet's arrival, if one came in during the inspect).
     */
    enterInspect(): void {
      if (this.collectedEntries.length === 0 || this.inspectFlightActive) {
        return;
      }
      const names = this.collectedEntries.map((e) => e.name);
      const from = this.measureRects(names, (n) => this.shelfCardEl(n));
      draftWorkspaceState.inspecting = true;
      if (consoleReducedMotionActive() || from === undefined) {
        this.shelfDeparted = [...names];
        void this.$nextTick(() => this.fitStage());
        return;
      }
      // The row mounts with EVERY slot held; each card's touchdown releases
      // its own slot. The SHELF keeps painting its cards until the exact
      // frame their clones stand over them (`shelfDeparted`, set at spawn).
      this.inspectHeldNames = [...names];
      this.beginInspectFlight();
      void this.$nextTick(() => {
        this.fitStage();
        void this.$nextTick(() => requestAnimationFrame(() => {
          const to = this.measureRects(names, (n) => this.inspectCardEl(n));
          if (to === undefined) {
            this.shelfDeparted = [...names];
            this.finishInspectFlight();
            return;
          }
          this.shelfDeparted = [...names];
          this.flyClones(names, from, to, {
            onLand: (name) => {
              const at = this.inspectHeldNames.indexOf(name);
              if (at !== -1) {
                this.inspectHeldNames.splice(at, 1);
              }
            },
            onDone: () => this.finishInspectFlight(),
          });
        }));
      });
    },
    leaveInspect(): void {
      if (this.inspectFlightActive) {
        return;
      }
      const names = this.collectedEntries.map((e) => e.name);
      const from = this.measureRects(names, (n) => this.inspectCardEl(n));
      if (consoleReducedMotionActive() || from === undefined || names.length === 0) {
        this.settleLeaveInspect();
        return;
      }
      const to = this.measureRects(names, (n) => this.shelfCardEl(n));
      if (to === undefined) {
        this.settleLeaveInspect();
        return;
      }
      // The big row empties card by card; the shelf's seats fill back one by
      // one — the packet returns only AFTER the collection is home.
      this.inspectHeldNames = [...names];
      this.shelfReturned = [];
      this.beginInspectFlight();
      this.flyClones(names, from, to, {
        onLand: (name) => {
          this.shelfReturned = [...this.shelfReturned, name];
        },
        onDone: () => {
          this.finishInspectFlight();
          this.settleLeaveInspect();
        },
      });
    },
    settleLeaveInspect(): void {
      this.inspectHeldNames = [];
      this.shelfDeparted = [];
      this.shelfReturned = [];
      // A packet that arrived during the inspect presents NOW: the holds are
      // armed SYNCHRONOUSLY, in the same tick the stage becomes visible — the
      // cards never flash raw before their arrival plays.
      if (this.packetPendingPresent) {
        this.packetPendingPresent = false;
        this.preparePacketArrival();
      }
      draftWorkspaceState.inspecting = false;
      // Focus returns to the stage the player left — the packet (or the wait).
      this.focusIdx = Math.min(this.focusIdx, Math.max(0, this.packetEntries.length - 1));
    },
    beginInspectFlight(): void {
      this.inspectFlightActive = true;
      if (this.inspectFlightTimer !== undefined) {
        window.clearTimeout(this.inspectFlightTimer);
      }
      // Bounded: a stranded flight may absorb input for at most this long.
      this.inspectFlightTimer = window.setTimeout(() => this.finishInspectFlight(), consoleMotionMs(2600));
    },
    finishInspectFlight(): void {
      if (this.inspectFlightTimer !== undefined) {
        window.clearTimeout(this.inspectFlightTimer);
        this.inspectFlightTimer = undefined;
      }
      this.inspectFlightActive = false;
      this.inspectHeldNames = [];
      this.disposeClones();
    },
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
    inspectSlotHeld(name: CardName): boolean {
      return this.zone !== 'inspect' || this.inspectHeldNames.includes(name);
    },
    /** While its card is OUT on the big row a shelf seat holds empty (one
     *  physical set, never two copies): held from the frame its clone SPAWNS
     *  (`shelfDeparted`), revealed by its OWN return landing. */
    shelfHeld(name: CardName): boolean {
      if (this.shelfDeparted.includes(name) && !this.shelfReturned.includes(name)) {
        return true;
      }
      return isTraySlotHeld(name);
    },
    // ── fullscreen inspect (X) ──────────────────────────────────────────
    zoomFocused(): void {
      const list = this.zone === 'buy' ? this.buyEntries :
        this.zone === 'pick' ? this.packetEntries :
          this.zone === 'inspect' ? this.collectedAsEntries : [];
      if (list.length === 0) {
        return;
      }
      const cards = list.map((e) => e.card);
      const rowRef = this.zone === 'buy' ? 'buyRow' : this.zone === 'inspect' ? 'inspectRow' : 'packetRow';
      const origin = slotZoomOrigin(
        () => this.$refs[rowRef] as HTMLElement | undefined,
        (i) => cards[i]?.name ?? '',
        (i) => {
          this.focusIdx = i;
        },
      );
      // The availability voice comes from the ONE policy (cardAvailability):
      // pick and buy are their own intents, the collected shelf is the
      // viewer's own mid-draft review — all evaluate FOR LATER.
      const availability = availabilityContextFor(
        this.zone === 'buy' ? 'research-buy' : this.zone === 'inspect' ? 'drafted-review' : 'draft-pick');
      if (this.zone === 'pick' && !this.multiKeep) {
        // The pick: A in the viewer COMMITS the card (the action bridge).
        openConsoleCardZoom(cards, this.focusIdx, undefined, {
          labelFor: () => 'Take',
          reasonsFor: () => [],
          execute: (name) => this.commitSinglePick(name as CardName),
        }, {origin, availability});
        return;
      }
      if (this.zone === 'pick' || this.zone === 'buy') {
        const max = this.zone === 'buy' ? this.buyMax : (this.pickInput?.max ?? 1);
        openConsoleCardZoom(cards, this.focusIdx, {
          isSelected: (name) => this.isPicked(name as CardName),
          toggle: (name) => this.togglePick(name as CardName, max),
        }, undefined, {origin, availability});
        return;
      }
      // INSPECT: read-only — no bridge, nothing here may mutate anything.
      openConsoleCardZoom(cards, this.focusIdx, undefined, undefined, {origin, availability});
    },
    // ── geometry ────────────────────────────────────────────────────────
    /** ONE fit for the active zone's row: the shared workspace stage solver
     *  (size + focus-safe gap + row shape together; resets its own outputs
     *  before measuring — the engine may never read its own output). */
    fitStage(): void {
      const zone = this.zone;
      const rowRef = zone === 'buy' || zone === 'pay' ? 'buyRow' : zone === 'inspect' ? 'inspectRow' : 'packetRow';
      const row = this.$refs[rowRef] as HTMLElement | undefined;
      const wrap = this.$refs.stageWrap as HTMLElement | undefined;
      if (row === undefined || row === null || wrap === undefined || wrap === null) {
        return;
      }
      const list = zone === 'buy' || zone === 'pay' ? this.buyEntries :
        zone === 'inspect' ? this.collectedAsEntries : this.packetEntries;
      if (list.length === 0) {
        return;
      }
      const current = zone === 'buy' || zone === 'pay' ? this.buyRowStyle :
        zone === 'inspect' ? this.inspectRowStyle : this.packetRowStyle;
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
        if (zone === 'buy' || zone === 'pay') {
          this.buyRowStyle = style;
        } else if (zone === 'inspect') {
          this.inspectRowStyle = style;
        } else {
          this.packetRowStyle = style;
        }
      };
      void this.$nextTick(() => {
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
        const chrome = this.stageChromeHeight();
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
          availH: Math.max(120, stageEl.clientHeight - chrome - rowPadY),
          slotW, slotH,
          n: list.length,
          ui: conUiScale(),
          padXPx: 0,
        });
        apply(wsStageLayoutStyle(layout));
        const zoneKey = zone === 'inspect' ? 'inspect' : (zone === 'buy' || zone === 'pay' ? 'buy' : 'pick');
        this.perRowByZone[zoneKey] = layout.perRow;
      });
    },
    /** Measured non-row chrome INSIDE the stage (the financial strip). */
    stageChromeHeight(): number {
      if (this.zone !== 'buy' && this.zone !== 'pay') {
        return 0;
      }
      const fin = (this.$el as HTMLElement).querySelector<HTMLElement>('.con-draftws__finstrip');
      return fin === null ? 0 : fin.offsetHeight + 12 * conUiScale();
    },
    // ── the clone-proxy flights (the LT spread/collect) ─────────────────
    /** Rects for every name, or undefined when ANY is unmeasurable — a
     *  half-measured convoy teleports half its cards, so it never flies. */
    measureRects(names: ReadonlyArray<CardName>, elOf: (n: CardName) => HTMLElement | null): Map<CardName, DOMRect> | undefined {
      const out = new Map<CardName, DOMRect>();
      for (const name of names) {
        const el = elOf(name);
        const r = el?.getBoundingClientRect();
        if (r === undefined || r.width < 8 || r.height < 8) {
          return undefined;
        }
        out.set(name, r);
      }
      return out;
    },
    /**
     * Fly pixel-true CLONES of the real card nodes rect→rect (the deployment
     * summary's clone trick: effective zoom = rect / offsetWidth, so the copy
     * is the same printed face at the same size). Transform-only; every card
     * lands on its own cadence; the batch owns and disposes ITS proxies.
     */
    flyClones(
      names: ReadonlyArray<CardName>,
      from: Map<CardName, DOMRect>,
      to: Map<CardName, DOMRect>,
      hooks: {onLand: (name: CardName) => void, onDone: () => void},
    ): void {
      // The flight stage is mounted by the BODY, never inside the workspace:
      // `position: fixed` resolves against ANY ancestor that establishes a
      // containing block (a transform / an entrance animation / a `zoom`),
      // and the workspace has all three at various moments.
      const layer = document.createElement('div');
      layer.className = 'con-draftws-flights';
      layer.style.cssText = 'position:fixed;inset:0;z-index:11640;pointer-events:none;overflow:clip;';
      document.body.appendChild(layer);
      this.cloneLayer = layer;
      let landed = 0;
      const total = names.length;
      const finishOne = (name: CardName) => {
        hooks.onLand(name);
        landed++;
        if (landed >= total) {
          // Handoff: reveal happened per-card; the layer leaves next frame.
          requestAnimationFrame(() => hooks.onDone());
        }
      };
      names.forEach((name, i) => {
        const src = this.shelfCardEl(name) ?? this.inspectCardEl(name);
        const f = from.get(name);
        const t = to.get(name);
        if (src === null || f === undefined || t === undefined) {
          finishOne(name);
          return;
        }
        const clone = src.cloneNode(true) as HTMLElement;
        // The source sits under an ancestor `zoom`; the clone reproduces the
        // RENDERED size via its own zoom = rect / natural (iteration-6 trick).
        //
        // ⚠️ `zoom` SCALES THE COORDINATE SYSTEM of the element it is on, and
        // that includes a `position: fixed` element's own left/top. Setting
        // `left: 0` and then translating by `rect / z` looked right on paper
        // and shipped the "cards fly in from the top-left" bug: the layer's
        // own transform/containing block was fine, but any rounding in `z`
        // multiplied the offset. So the clone is PLACED with left/top IN ITS
        // OWN ZOOMED SPACE and never translated for placement — the tween
        // moves it by a DELTA from that seat, which no zoom factor can skew.
        const natural = src.offsetWidth || 1;
        const z = f.width / natural;
        clone.style.cssText = `position:fixed;left:${(f.left / z).toFixed(2)}px;top:${(f.top / z).toFixed(2)}px;` +
          `margin:0;zoom:${z.toFixed(4)};transform-origin:top left;will-change:transform;`;
        // De-identify: a clone must never be found by slot/zoom resolvers.
        clone.removeAttribute('data-zoom-slot');
        for (const el of Array.from(clone.querySelectorAll('[data-zoom-slot], [data-tray-slot], [data-inspect-slot], [data-hand-dock-card]'))) {
          el.removeAttribute('data-zoom-slot');
          el.removeAttribute('data-tray-slot');
          el.removeAttribute('data-inspect-slot');
          el.removeAttribute('data-hand-dock-card');
        }
        layer.appendChild(clone);
        // Movement is a DELTA in the clone's own zoomed space (see above):
        // it starts exactly on its source seat, at scale 1, and travels to
        // the destination's seat — same physical card, one gesture.
        const scale = t.width / f.width;
        gsap.set(clone, {x: 0, y: 0, scale: 1});
        // Through the motion scale like every flight (this was the one
        // hand-triggered gesture `?motion=` did not touch), and the stagger
        // spaced to the LANDING-cadence floor — 65ms apart the touchdowns
        // shared a blink and the spread read as one flash.
        const dur = consoleMotionMs(460) / 1000;
        const at = i * (consoleMotionMs(96) / 1000);
        const tl = gsap.timeline({delay: at});
        tl.to(clone, {x: (t.left - f.left) / z, duration: dur, ease: 'power2.inOut'}, 0);
        tl.to(clone, {y: (t.top - f.top) / z, duration: dur, ease: 'power3.out'}, 0);
        tl.to(clone, {scale, duration: dur, ease: 'power2.inOut'}, 0);
        // Touchdown: the real slot materializes UNDER the clone; the clone
        // leaves on the next frame (never a crossfade of identical twins).
        const settle = () => {
          finishOne(name);
          requestAnimationFrame(() => clone.remove());
        };
        tl.eventCallback('onComplete', settle);
        tl.eventCallback('onInterrupt', settle);
      });
      if (total === 0) {
        hooks.onDone();
      }
    },
    disposeClones(): void {
      this.cloneLayer?.remove();
      this.cloneLayer = undefined;
    },
    shelfCardEl(name: CardName): HTMLElement | null {
      const slot = this.resolveShelfSlot(name);
      return slot === null ? null : (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot);
    },
    inspectCardEl(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | null;
      if (root === null) {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      const slot = root.querySelector<HTMLElement>(`[data-inspect-slot="${esc}"]`);
      return slot === null ? null : (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot);
    },
    // ── plumbing ────────────────────────────────────────────────────────
    slotCardEl(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | null;
      if (root === null) {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      const slot = root.querySelector<HTMLElement>(`.con-draftws__stage [data-zoom-slot="${esc}"]`);
      return slot === null ? null : (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot);
    },
    resolveShelfSlot(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | null;
      if (root === null) {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`.con-draftws__shelf [data-tray-slot="${esc}"]`);
    },
  },
});
</script>
