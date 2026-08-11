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
    <ConsoleWsHead root="Draft" class="con-draftws__head"
                   :subject="crumb.subject" :stage="crumb.stage" :committed="crumb.committed">
      <template #flow>
        <ConsoleJourneyRail :phases="journeyPhases"
                            :presentation="flowPresentation"
                            :compact-context="compactContext"
                            :committing="draftWorkspaceState.completion === 'flights'"
                            terminal-label="Ready" />
      </template>
      <template #trailing>
        <!-- The pass direction, stated quietly: who receives this packet's
             rest. Part of the header's stable chrome — never re-animated by a
             stage change (the arrow flips only when the GENERATION does). -->
        <div v-if="passReadout !== undefined" class="con-draftws__pass">
          <span class="con-draftws__pass-label">{{ $t('Passing to') }}</span>
          <span class="con-draftws__pass-dot" :class="'player_bg_color_' + passReadout.color" aria-hidden="true"></span>
          <span class="con-draftws__pass-name">{{ passReadout.name }}</span>
          <span class="con-draftws__pass-arrow" aria-hidden="true">{{ giveSide === 'right' ? '⟶' : '⟵' }}</span>
        </div>
      </template>
    </ConsoleWsHead>

    <div class="con-draftws__body" data-motion-panel>
      <!-- Invisible flight anchors at the side edges — the physical origin a
           PASSED packet's deal launches from (round 1 deals off the HUD deck). -->
      <span class="con-draftws__lane con-draftws__lane--left" ref="laneLeft" aria-hidden="true"></span>
      <span class="con-draftws__lane con-draftws__lane--right" ref="laneRight" aria-hidden="true"></span>

      <div class="con-draftws__stagewrap" ref="stageWrap">
        <!-- ── PICK: the packet, cards as the hero content ─────────────── -->
        <div v-show="zone === 'pick'" class="con-draftws__stage con-draftws__stage--pick">
          <div class="con-cards con-draftws__cards">
            <div class="con-cards__strip con-draftws__row"
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
                <Card :card="entry.card" :key="entry.name" lightweight />
                <span v-if="isPicked(entry.name) && !pickBeat" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
                <!-- The face→back crossfade of the PASS exit (cheap, honest:
                     the packet leaves the table turned over). -->
                <span class="con-draftws__slot-back" aria-hidden="true"><span class="con-card-back"></span></span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── WAIT: the pass lane (a calm state, never a spinner) ─────── -->
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

        <!-- ── BUY / PAY: the purchase chapter ─────────────────────────── -->
        <div v-show="zone === 'buy' || zone === 'pay'" class="con-draftws__stage con-draftws__stage--buy">
          <!-- The financial strip: compact, instantly readable, ONE source of
               the purchase economics (server-identical math: cardCost × picks). -->
          <div class="con-draftws__finstrip" :class="{'con-draftws__finstrip--over': !buyAffordable}">
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
              </span>
              <span class="con-draftws__fin-sep" aria-hidden="true">→</span>
              <span class="con-draftws__fin-cell">
                <span class="con-draftws__fin-caption">{{ $t('After purchase') }}</span>
                <span class="con-draftws__fin-num" :class="{'con-draftws__fin-num--over': !buyAffordable}">{{ megacreditsAfterPurchase }}</span>
              </span>
            </span>
          </div>
          <div class="con-cards con-draftws__cards">
            <div class="con-cards__strip con-draftws__row" :style="buyRowStyle" ref="buyRow">
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
               ONE ConsoleTaskHost instance here, `embedded` (no second modal). -->
          <div v-show="zone === 'pay'" class="con-draftws__paystep" data-draft-pay-slot></div>
        </div>

        <!-- ── INSPECT (LT): the drafted cards, spacious and read-only ─── -->
        <div v-show="zone === 'inspect'" class="con-draftws__stage con-draftws__stage--inspect">
          <div class="con-cards con-draftws__cards">
            <div class="con-cards__strip con-draftws__row" :style="inspectRowStyle" ref="inspectRow">
              <div v-for="(entry, i) in collectedEntries" :key="entry.name + '#' + i"
                   class="con-cards__slot con-draftws__slot con-draftws__slot--rise"
                   :data-zoom-slot="entry.name"
                   :style="{animationDelay: (i * 70) + 'ms'}"
                   :class="{'con-cards__slot--focused': zone === 'inspect' && focusIdx === i}">
                <Card :card="entry.card" :key="entry.name" lightweight />
              </div>
            </div>
          </div>
        </div>

        <!-- ── DONE: the terminal beat ─────────────────────────────────── -->
        <div v-show="zone === 'done'" class="con-draftws__stage con-draftws__stage--done">
          <div class="con-draftws__doneplate">
            <span class="con-draftws__done-mark" aria-hidden="true"><i>✓</i></span>
            <span class="con-draftws__done-title">{{ $t('Research complete') }}</span>
            <span class="con-draftws__done-sub">{{ doneReadout }}</span>
          </div>
        </div>
      </div>

      <!-- ── STATUS RAIL: the focused card's verdict (name + the soft
           requirements heads-up — amber, never blocking language). ─────── -->
      <div class="con-draftws__statusbar" :class="{'con-draftws__statusbar--held': beatActive}">
        <template v-if="statusEntry !== undefined">
          <span class="con-draftws__status-name" :key="statusEntry.name">{{ $t(statusEntry.name) }}</span>
          <span v-if="statusHeadsUp !== undefined" class="con-draftws__status-warn">
            <span aria-hidden="true">◈</span>
            <span>{{ $t('Cannot be played yet') }}</span>
            <span class="con-draftws__status-why">{{ statusHeadsUpText }}</span>
          </span>
          <span v-else class="con-draftws__status-ok">
            <span aria-hidden="true">✓</span>
            <span>{{ $t('All requirements met') }}</span>
          </span>
        </template>
        <span v-else-if="zone === 'wait'" class="con-draftws__status-idle">{{ $t('Waiting for the other players') }}</span>
      </div>

      <!-- ── THE SHELF («ОТОБРАНО») — the permanent collection zone. Slots
           carry `data-tray-slot`: the pick heroes land here (the shared
           draft-tray brain) and the research rise lifts off from here. ──── -->
      <div class="con-draftws__shelf" v-show="zone !== 'done'"
           :class="{
             'con-draftws__shelf--muted': inspecting,
             'con-draftws__shelf--empty': collectedEntries.length === 0,
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
               :class="{'con-deal-hold': shelfHeld(entry.name)}">
            <Card :card="entry.card" :key="entry.name" lightweight />
          </div>
          <!-- Prepared empty seats up to the known total: the shelf states how
               far the draft runs before a single card has landed. -->
          <span v-for="n in emptySeats" :key="'seat-' + n" class="con-draftws__shelf-seat" aria-hidden="true"></span>
        </div>
      </div>
    </div>

    <!-- The deal cinematic stage (packet arrivals + the research rise). -->
    <ConsoleCardDealLayer v-if="deal.state.active" ref="dealLayer"
                          :cards="deal.state.cards" :nonce="deal.state.nonce" />
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {useResizeObserver} from '@vueuse/core';
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
import {unplayableReasonLine} from '@/client/components/handCards/unplayableReasonFormat';
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
  draftCrumb, draftNeighbor, requirementHeadsUp, draftCollectedNames,
  beginDraftCompletion, markDraftCompletionFlightsDone, finishDraftCompletion,
  DraftStage, DraftJourneyInput,
} from '@/client/console/draft/consoleDraftFlow';
import {draftCommands, setConsoleDraftCommands, resetConsoleDraftUi, DraftCommandState} from '@/client/console/draft/consoleDraftUi';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {Phase} from '@/common/Phase';

type CardEntry = {name: CardName, key: string, card: CardModel};

/** One workspace zone — what the staging area is showing right now. */
type DraftZone = 'pick' | 'wait' | 'buy' | 'pay' | 'inspect' | 'done';

export default defineComponent({
  name: 'ConsoleDraftWorkspace',
  components: {Card, GamepadGlyph, ConsoleWsHead, ConsoleJourneyRail, ConsoleCardDealLayer},
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
      /** The packet standing when the workspace MOUNTED (a reload straight
       *  into a live draft): presented instantly, never re-dealt. */
      hydratedPacketKey: '',
      /** A packet arrived WHILE the LT sub-stage owned the screen — its
       *  presentation waits for the return (never torn into the inspect). */
      packetPendingPresent: false,
      /** Solved stage layouts (CSS custom-property maps). */
      packetRowStyle: {} as Record<string, string>,
      buyRowStyle: {} as Record<string, string>,
      inspectRowStyle: {} as Record<string, string>,
      /** Row shape (cards per row) for 2D d-pad navigation. */
      perRowByZone: {pick: 5, buy: 5, inspect: 5} as Record<string, number>,
      shelfPulsing: false,
      shelfPulseTimer: undefined as number | undefined,
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
      if (draftWorkspaceState.completion === 'done') {
        return 'done';
      }
      if (draftWorkspaceState.completion === 'flights') {
        // The purchase exit beats play over the frozen buy row.
        return 'buy';
      }
      switch (this.stage) {
      case 'pick': return 'pick';
      case 'buy': return 'buy';
      case 'wait':
      case 'idle': return 'wait';
      }
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
    packetEntries(): ReadonlyArray<CardEntry> {
      const input = this.pickInput;
      if (input === undefined) {
        return [];
      }
      return input.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
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
      return {name: to.name, color: to.color};
    },
    giveReadout(): string {
      const to = draftNeighbor(this.playerView, draftWorkspaceState.meta?.givingTo);
      return to === undefined ? '' : translateTextWithParams('The rest of the packet went to ${0}', [to.name]);
    },
    takeReadout(): string {
      const from = draftNeighbor(this.playerView, draftWorkspaceState.meta?.takingFrom);
      return from === undefined ? '' : translateTextWithParams('Next packet comes from ${0}', [from.name]);
    },
    doneReadout(): string {
      return translateText('Purchased cards are in your hand');
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
    statusHeadsUp(): UnplayableReason | undefined {
      return requirementHeadsUp(this.statusEntry?.card);
    },
    statusHeadsUpText(): string {
      const r = this.statusHeadsUp;
      return r === undefined ? '' : unplayableReasonLine(r);
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
        this.resetPickState();
        if (this.inspecting) {
          this.packetPendingPresent = true;
          return;
        }
        this.preparePacketArrival();
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
    /** Keep the command bar mirror current. */
    commandState: {
      immediate: true,
      deep: true,
      handler(state: DraftCommandState) {
        setConsoleDraftCommands(draftCommands(state));
      },
    },
  },
  mounted() {
    // THE SHELF IS THE TRAY now: every pick-beat / rise flight resolves its
    // landing slot through this registration (the same brain, a new surface).
    registerTraySlotResolver((name) => this.resolveShelfSlot(name));
    // A reload straight into a live draft: the standing packet presents
    // instantly (no entrance replay); later packets animate normally.
    this.hydratedPacketKey = this.packetKey;
    if (this.packetKey !== '') {
      this.resetPickState();
      this.preparePacketArrival();
    } else if (this.stage === 'buy') {
      // Reload straight into the buy: freeze + present instantly.
      this.buySnapshot = this.buyInput?.cards.map((card, i) => ({name: card.name, key: card.name + '#' + i, card}));
      finishRiseScene();
    }
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
    if (this.shelfPulseTimer !== undefined) {
      window.clearTimeout(this.shelfPulseTimer);
    }
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
      if (this.passingActive) {
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
      const picks = names
        .map((name) => ({name, el: this.slotCardEl(name)}))
        .filter((p): p is {name: CardName, el: HTMLElement} => p.el !== null);
      // The leftovers physically pass on toward the receiving neighbor.
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
      if (this.passTimer !== undefined) {
        window.clearTimeout(this.passTimer);
      }
      this.passTimer = window.setTimeout(() => {
        this.passingActive = false;
        this.passTimer = undefined;
      }, consoleMotionMs(760));
    },
    passingSlotStyle(name: CardName, index: number): Record<string, string> {
      if (!this.passingNames.includes(name)) {
        return {};
      }
      const dir = this.giveSide === 'right' ? 1 : -1;
      return {
        '--con-draftws-pass-x': `${dir * 120 * conUiScale()}px`,
        'animationDelay': `${index * 55}ms`,
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
        onLiftOff: riseLiftOff,
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
      beginDraftCompletion();
      // The unbought cards drift out (the discard side), visibly secondary.
      applyDiscardExit(
        rest.map((e) => this.slotCardEl(e.name)).filter((el): el is HTMLElement => el !== null),
        {delayMs: 160},
      );
      if (bought.length === 0) {
        this.submitCards([]);
        window.setTimeout(() => markDraftCompletionFlightsDone(), consoleMotionMs(720));
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
    armDoneBeat(): void {
      if (this.doneTimer !== undefined) {
        window.clearTimeout(this.doneTimer);
      }
      this.doneTimer = window.setTimeout(() => {
        this.doneTimer = undefined;
        finishDraftCompletion();
      }, consoleMotionMs(1500));
    },
    // ── the LT sub-stage («ОТОБРАННЫЕ › ОСМОТР») ───────────────────────
    enterInspect(): void {
      if (this.collectedEntries.length === 0) {
        return;
      }
      draftWorkspaceState.inspecting = true;
    },
    leaveInspect(): void {
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
    /** While inspecting, the shelf's cards are OUT on the big row: their shelf
     *  slots hold empty (one physical set, never two copies). */
    shelfHeld(name: CardName): boolean {
      return this.inspecting || isTraySlotHeld(name);
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
      if (this.zone === 'pick' && !this.multiKeep) {
        // The pick: A in the viewer COMMITS the card (the action bridge).
        openConsoleCardZoom(cards, this.focusIdx, undefined, {
          labelFor: () => 'Take',
          reasonsFor: () => [],
          execute: (name) => this.commitSinglePick(name as CardName),
        }, {origin});
        return;
      }
      if (this.zone === 'pick' || this.zone === 'buy') {
        const max = this.zone === 'buy' ? this.buyMax : (this.pickInput?.max ?? 1);
        openConsoleCardZoom(cards, this.focusIdx, {
          isSelected: (name) => this.isPicked(name as CardName),
          toggle: (name) => this.togglePick(name as CardName, max),
        }, undefined, {origin});
        return;
      }
      // INSPECT: read-only — no bridge, nothing here may mutate anything.
      openConsoleCardZoom(cards, this.focusIdx, undefined, undefined, {origin});
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
      const apply = (style: Record<string, string>) => {
        if (zone === 'buy' || zone === 'pay') {
          this.buyRowStyle = style;
        } else if (zone === 'inspect') {
          this.inspectRowStyle = style;
        } else {
          this.packetRowStyle = style;
        }
      };
      // Reset the outputs before measuring (the fit-engine rule).
      apply({});
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
        const wrapBox = wrap.getBoundingClientRect();
        const chrome = this.stageChromeHeight();
        const layout = wsStageLayout({
          // The ZONE's width, never the row's own: a shrink-to-fit row
          // reports its content width — the fit engine reading its output.
          availW: wrap.clientWidth,
          availH: Math.max(120, wrapBox.height - chrome),
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
