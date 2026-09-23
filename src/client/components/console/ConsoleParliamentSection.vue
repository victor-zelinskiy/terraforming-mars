<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux): ONE flow,
       one GAME SCREEN. Three instruments under one fixed head line (the
       GOVERNMENT with the RULING PARTY's tile · the VOTING AREA · the five
       OPPOSITION parties), the read-only AGENDA track, the DELEGATES ZONE at
       fixed coordinates in every mode; the VOTE MODE is a phase descent of
       this frame, a PARTY ACTION nests the action workspace
       (`parliament ⊃ card-actions`), and the SITTING — the political phase's
       own flow («ЗАСЕДАНИЕ») — stands on the middle tier's stage chassis, its
       stage the SERVER's step and its pages a WALK the director turns
       (v2: docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md). THIS ROOT owns the
       stage machine (the shared flow record), the browse layer's grammar, the
       submit funnel and the crumb; every tier is its own component reading
       the same record. Nothing here re-derives a rule: availability is the
       PRESENCE of the server's option (its structural marker), the numbers
       are the server's projections, a submit is the byte-identical response.
       Anatomy and history: docs/TURMOIL_REDUX_PARLIAMENT_V6.md; the sitting:
       docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md, the v2 rework above. -->
  <section class="con-parl con-ws"
           :class="{
             'con-parl--handed-over': sceneHandedOver,
             'con-parl--stage': stagePanelUp,
             'con-parl--vote': voteUp,
             'con-parl--vote-leaving': flow.voteLeaving,
             'con-parl--flying': flightsAirborne,
             'con-parl--swapping': motion.swapping,
             'con-parl--sitting': sittingUp,
             'con-parl--sitting-field': flow.sittingField,
             ['con-parl--zone-' + flow.zone]: true,
           }"
           ref="rootEl"
           role="region"
           :aria-label="$t('Parliament')"
           :data-zone="flow.zone"
           :data-stage="flow.stage"
           :data-sitting-stage="sittingUp ? sittingStage : undefined"
           :data-sitting-walking="walking ? '' : undefined"
           :data-sitting-page="sittingUp ? String(flow.sittingPage) : undefined"
           :data-sitting-motion="motion.stage || undefined"
           :data-sitting-beat="motion.beat || undefined"
           :data-renewal-degraded="motion.renewalDegraded.length > 0 ? motion.renewalDegraded.join(' · ') : undefined"
           :data-quest-beat="questBeat || undefined"
           :data-parl-reading-up="stagePanelUp ? '' : undefined"
           :data-parl-unfolding="stageEntering ? '' : undefined"
           :data-parl-leaving="leaving ? '' : undefined"
           data-motion-panel>
    <ConsoleWsHead class="con-parl__head"
                   root="Parliament"
                   emblem="parliament"
                   wheelAnchor="parliament"
                   :subject="crumbSubject"
                   :subjectRaw="false"
                   :stage="crumbStage"
                   :committed="crumbCommitted">
      <template #trailing>
        <ConsoleParliamentSeats :view="view" :viewerColor="viewerColor" :benchSource="benchSource" :benchWarn="benchWarn" />
      </template>
    </ConsoleWsHead>

    <!-- THE FIELD — the overview's body and, over it, the vote mode's layer. -->
    <div class="con-parl__field" ref="fieldEl">
    <div class="con-parl__body">
      <!-- ══ TOP TIER: the GOVERNMENT · the VOTING AREA ══ -->
      <div class="con-parl__top">
        <ConsoleParliamentGovernment :view="view" :model="model" :players="pv.players" :viewerColor="viewerColor"
                                     :agendaVm="agendaVm" :sittingStage="sittingUp ? sittingStage : ''" />
        <ConsoleParliamentVotingArea :view="view" :model="model" :viewerColor="viewerColor" :viewerParticipates="viewerParticipates"
                                     :benchWarn="benchWarn" :seatCandidates="seatCandidates" :sittingStage="sittingUp ? sittingStage : ''" />
      </div>

      <!-- ══ MIDDLE ZONE — ЛЕНТА и ТЕЛО («Заседание v5»), and that is its only anatomy in every mode.
           The BAND is a strip of FIXED height that exists always: it names WHY what is on the table is
           happening and never repeats what an object says itself; only its content crossfades.
           The BODY under it is the row of parties by default — the verdict, the Agenda, the support, the
           enactment and the whole physical part of the results MOVE objects the player must watch, so
           nothing may stand over them. It changes exactly twice in a sitting: for an EMBEDDED STEP the
           player works in (a pick, a take — they need the площадь) and for the RESULTS panel. The chairman
           SEAT pick is a body of its own too (a decision, nothing flying). ══ -->
      <div class="con-parl__mid" data-parl-mid data-parl-recede ref="midEl">
        <ConsoleParliamentBand :view="view" :model="model" :playerView="pv" :viewerColor="viewerColor"
                               :position="sitting" :sittingUp="sittingUp" :stage="sittingStage" />

        <div class="con-parl__bodyzone" data-parl-body>
        <div class="con-parl__parties-tier" ref="partiesTierEl"
             :class="{'con-parl__parties-tier--parked': rowParked}"
             :data-parl-row-shown="rowParked ? undefined : ''"
             :aria-hidden="rowParked ? 'true' : undefined">
          <ConsoleParliamentParties :view="view" :partyStates="partyStates" :partyActionStates="partyActionStates" :viewerColor="viewerColor"
                                    :awaitingInput="awaitingInput" />
        </div>

        <!-- ── THE READING PANEL — the chairman SEAT pick and the sitting's READING stages unfold in place
             of the parties row (one chassis, one rect).
             IT IS SHOWN, NOT MOUNTED, PER STAGE (`v-show`): three `<Teleport>`s point INTO this panel (the
             enacted card onto its hero slot, the hosted step into `[data-embed-slot="parliament-stage"]`, and
             a step's own children), and a teleport re-resolves its target only when the `to` string CHANGES.
             Unmounting the panel between the table and the reading therefore left Vue patching into detached
             nodes — «Cannot read properties of null (reading 'insertBefore')», after which the whole section
             stopped re-rendering and the walk froze at the enactment with the take standing in a zombie panel.
             `v-show` fires the same enter/leave hooks, so the phrase is unchanged; the panel is `position:
             absolute`, so hidden it costs the layout nothing. ── -->
        <transition :css="false" @enter="onStageEnter" @leave="onStageLeave" @enter-cancelled="onStageEnterCancelled" @leave-cancelled="onStageLeaveCancelled">
          <div v-if="stageKind === 'seat' || stageKind === 'sitting'" v-show="stagePanelUp" class="con-parl__stage" :class="['con-parl__stage--' + stageKind, {'con-parl__stage--field': flow.sittingField}]" :data-parl-stage="stageKind" data-parl-reading>
            <ConsoleParliamentSeatPick v-if="stageKind === 'seat' && focusedSlot !== undefined" ref="seatPick"
                                       :view="view" :slot="focusedSlot" :viewerColor="viewerColor" :seatCandidates="seatCandidates"
                                       @submit="submitSeat($event)" @inspect="$emit('inspect', $event)" />
            <ConsoleParliamentSitting v-else-if="stageKind === 'sitting' && sitting !== undefined" ref="sitting"
                                      :position="sitting" :stage="sittingStage" :summary="model?.phase?.summary"
                                      :view="view" :model="model" :playerView="pv" :viewerColor="viewerColor"
                                      :field="flow.sittingField" :stepOpen="sittingStepOpen" :ledger="sittingLedger"
                                      :resultsHidden="resultsHidden" mode="live" />
            <div class="con-parl__embed" data-embed-slot="parliament"></div>
          </div>
        </transition>
        </div>
      </div>

      <ConsoleParliamentAgenda ref="agenda" :view="view" :model="model" :agendaVm="agendaVm" :viewerParticipates="viewerParticipates"
                               :sittingStep="sittingStep" :handedOver="sceneHandedOver" />
    </div>

    <ConsoleParliamentVoteMode ref="voteMode"
                               :view="view" :model="model" :playerView="pv" :viewerColor="viewerColor" :viewerParticipates="viewerParticipates"
                               :awaitingInput="awaitingInput" :bridge="bridge" :voteTile="voteTile" :winningSlot="winningSlot"
                               :benchSource="benchSource" :benchWarn="benchWarn" :canActNow="canActNow" :canVoteNow="canVoteNow"
                               @notice="$emit('notice', $event)" @inspect="$emit('inspect', $event)"
                               @send="send($event.response, $event.from)" @flow-complete="$emit('flow-complete', $event)" />
    </div>
  </section>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleParliamentSeats from '@/client/components/console/parliament/ConsoleParliamentSeats.vue';
import ConsoleParliamentGovernment from '@/client/components/console/parliament/ConsoleParliamentGovernment.vue';
import ConsoleParliamentVotingArea from '@/client/components/console/parliament/ConsoleParliamentVotingArea.vue';
import ConsoleParliamentBand from '@/client/components/console/parliament/ConsoleParliamentBand.vue';
import ConsoleParliamentParties from '@/client/components/console/parliament/ConsoleParliamentParties.vue';
import ConsoleParliamentAgenda from '@/client/components/console/parliament/ConsoleParliamentAgenda.vue';
import ConsoleParliamentVoteMode from '@/client/components/console/parliament/ConsoleParliamentVoteMode.vue';
import ConsoleParliamentSeatPick from '@/client/components/console/parliament/ConsoleParliamentSeatPick.vue';
import ConsoleParliamentSitting from '@/client/components/console/parliament/ConsoleParliamentSitting.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {backLabelForVerb, backVerbFor} from '@/client/console/consoleWorkspaceFlow';
import {
  AgendaMove, agendaViewOf, AgendaVm, buildParliamentView, emptyParliamentView, ParliamentPartyVm, ParliamentPromptBridge, ParliamentSlotVm, ParliamentTileVm,
  ParliamentViewVm, parliamentPromptBridge, partyActionStateOf, PartyActionStateVm, partyStateOf, PartyStateVm, seatResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import {
  consoleParliamentUi, notePlayedSittingStage, parliamentCrumbCommitted, parliamentCrumbStage, parliamentCrumbSubject, ParliamentStage,
  parliamentFlow, parliamentSittingUp, parliamentStageKind, parliamentStageUp, parliamentVoteUp, pulseParliamentChair, resetParliamentFlow,
  setParliamentRootEl, sittingSessionKnown, sittingStagePlayed,
} from '@/client/console/parliament/consoleParliamentFlow';
import {
  parliamentRewardPending, parliamentRewardState, releaseParliamentRewards, takeTileReceipt,
} from '@/client/console/parliament/parliamentRewardBeat';
import {
  sittingPageAuto, sittingPositionOf, SittingPosition, sittingPrimaryKey, sittingRewardSettled, SittingStage, sittingStageAt, sittingStageKey,
  sittingBodyOf, SittingBody, sittingStartPage, sittingWorkspacePhase, verdictStandsAt,
  parliamentSittingLive, SITTING_HOSTED_STEPS, sittingFieldOf,
} from '@/client/console/parliament/consoleSittingFlow';
import {colonyLedgerOf, ColonyLedgerReading} from '@/client/console/parliament/colonyLedgerModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {
  armChairmanQuestFlow, chairmanQuestFlow, chairmanQuestGateOf, chairmanQuestStageKey, releaseChairmanQuestHolds, resetChairmanQuestFlow,
} from '@/client/console/parliament/consoleChairmanQuest';
import {
  chairmanQuestBeatActive, finishChairmanQuestBeats, killChairmanQuestBeats, noteChairmanQuestAnswer, startChairmanQuestBeats,
} from '@/client/console/parliament/chairmanQuestDirector';
import {SittingBeat, sittingBeats} from '@/client/console/parliament/sittingBeats';
import {
  finishSittingMotion, killSittingMotion, playSittingStage, resetSittingDirector, sittingMotion, sittingMotionActive, SittingDirectorContext,
} from '@/client/console/parliament/sittingDirector';
import {probeTick} from '@/client/console/probeTick';
import {flySeatDelegate, killParliamentFlights, parliamentFlightsAirborne} from '@/client/console/parliament/parliamentFlights';
import {fitParliamentCards, freezeParliamentFit} from '@/client/console/parliament/parliamentCardFit';
import {parliamentCommandsOf} from '@/client/console/parliament/parliamentCommands';
import {ParliamentInspectRequest} from '@/client/console/parliament/parliamentInspect';
import {
  armPartyActionDescent, navigateParliamentZones, parliamentBrowseInspectRequest, parliamentEnactedInspectRequest, partyActionRefusal,
} from '@/client/console/parliament/parliamentNavigation';
import {BenchSource, benchSourceOf, benchWarnOf} from '@/client/console/parliament/parliamentVoteView';
import {
  setWorkspaceFramePhase, setWorkspaceFrameSlot, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameAnchor,
  workspaceFrameHasNested, workspaceFrameRenders, workspaceHostYieldsScene,
} from '@/client/console/consoleWorkspaceStack';
import {translateText} from '@/client/directives/i18n';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {useResizeObserver} from '@vueuse/core';
import {playBodyFold, playBodyUnfold, pulseCarrier, settleRow} from '@/client/console/parliament/parliamentStageMotion';
import {killParliamentVoteMotion, Rect} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {
  enactCarryRect, killParliamentEnactMotion, parkParliamentForEnact, playParliamentEnactEnter, playParliamentEnactFold,
} from '@/client/console/parliament/consoleParliamentEnactMotion';

/** How long a submit may stay unanswered before the stage gives the player back their hands (a net over a silent server — the tree's one wall-clock timer). */
const SUBMIT_SAFETY_MS = 6000;

/**
 * THE SITTING'S STAGE ZONE — the one selector every hosted step of the sitting is teleported into (the shell
 * names it for the picker / the take; the Parliament FRAME publishes it as its slot for a step that is a
 * workspace frame of its own — the hand in its discard mode).
 */
const STAGE_ZONE_SELECTOR = '.con-parl [data-embed-slot="parliament-stage"]';

export default defineComponent({
  name: 'ConsoleParliamentSection',
  components: {
    ConsoleWsHead, ConsoleParliamentSeats, ConsoleParliamentGovernment, ConsoleParliamentVotingArea, ConsoleParliamentBand,
    ConsoleParliamentParties, ConsoleParliamentAgenda, ConsoleParliamentVoteMode, ConsoleParliamentSeatPick, ConsoleParliamentSitting,
  },
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** The shell plays this section's LEAVE (v3 В1): the surface is latched on the last coherent view until the unmount. */
    leaving: {type: Boolean, default: false},
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
  },
  emits: ['close', 'submit', 'notice', 'inspect', 'open-action', 'flow-complete', 'collapse', 'to-board'],
  data() {
    return {
      /** The seat / sitting stage is folding back — its DOM stays for the leave beat. */
      stageLeaving: false,
      /**
       * THE LEAVE LATCH (v3 В1): the last COHERENT player view, frozen when the surface starts leaving —
       * the phase's end (the sitting's data gone in the same response that closes the frame), the flow's
       * conclusion, B's «свернуть», the yield to the board. Every computed reads `pv` (this or the live
       * prop), so no tier re-computes on its way out: the surface leaves WHOLE, as one motion.
       */
      frozenView: undefined as PlayerViewModel | undefined,
      submitTimer: undefined as number | undefined,
      /** The server's answer key at the submit — the answer is whatever changes it. */
      submittedKey: '',
      stopFitObs: undefined as (() => void) | undefined,
      /** The chairman-seat pick: the cube's rect on the card at the submit (the flight's source). */
      seatFrom: undefined as Rect | undefined,
      /** The parties tier's rect at the press — the seat / sitting stage unfolds from it. */
      stageFromRect: undefined as Rect | undefined,
      /** The stage is unfolding — a walk queued meanwhile starts on the unfold's end. */
      stageEntering: false,
      /**
       * The reward stage is TAKING THE FIELD (the overview recedes, the enacted card FLIPs onto its hero
       * slot): a wave that would leave the ledger's rows waits for the card to land — the cause before the
       * effect. Cleared by the entrance's own end, which re-queues the walk.
       */
      fieldSettling: false,
      /**
       * THE LEDGER CAME BACK after a hosted step (Colonial Affairs): its rows now read what the step paid, and
       * that reading is OWED a beat before the walk may leave the page — a ledger that flashes «получено» for one
       * frame and turns into the renewal has not been read. Cleared by the read beat the walk plays for it.
       */
      ledgerReadOwed: false,
      /** The step door as last PUBLISHED (post-flush) — what a pre-flush watcher may still read as «a step was open». */
      stepOpenMirror: false,
      /** THE WALK is running (the director turning the sitting's pages) — a step that arrives meanwhile is picked up by its loop. */
      walking: false,
      /** A walk is queued for the next probe tick (idempotent). */
      walkQueued: false,
      /** Something asked for a walk WHILE one ran — re-run once it ends. */
      walkOwed: false,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    flightsAirborne(): boolean {
      return parliamentFlightsAirborne();
    },
    /** THE VIEW THIS SURFACE READS: the leave latch while leaving, the live prop otherwise (v3 В1). */
    pv(): PlayerViewModel {
      return this.frozenView ?? this.playerView;
    },
    model(): ParliamentModel | undefined {
      return this.pv.game.parliament;
    },
    viewerColor(): Color | undefined {
      return this.pv.thisPlayer?.color;
    },
    viewerParticipates(): boolean {
      return this.view.viewer?.participates === true;
    },
    view(): ParliamentViewVm {
      const model = this.model;
      return model === undefined ? emptyParliamentView() : buildParliamentView(model, this.viewerColor, this.pv.players);
    },
    bridge(): ParliamentPromptBridge {
      return parliamentPromptBridge(this.pv.waitingFor);
    },
    /**
     * A nested frame (the action workspace) took the SCENE — this screen yields and waits. A frame this
     * one hosts as an EMBEDDED step (the hand in its discard mode, inside the sitting's zone — the
     * registry's `frameSteps`) is not a hand-over: the screen stays, the step stands inside it.
     */
    sceneHandedOver(): boolean {
      return workspaceHostYieldsScene('parliament');
    },
    stageUp(): boolean {
      return parliamentStageUp();
    },
    /**
     * ТЕЛО СРЕДНЕЙ ЗОНЫ (v5): the row of parties by default, an embedded STEP while the seat works, the
     * RESULTS panel at the end. Derived once (`sittingBodyOf`) — never decided per case.
     */
    sittingBody(): SittingBody {
      return sittingBodyOf(this.sittingStage, this.sittingField);
    },
    /**
     * THE ROW'S RESTING POSE. Parked means SHUT — invisible and untouchable — and it is applied only when
     * the drawer is not moving: during the swap the tiles are the director's, and a tier faded by CSS on
     * top of them would swallow the motion whole.
     */
    rowParked(): boolean {
      return this.stagePanelUp && !this.stageLeaving && !this.stageEntering;
    },
    /** The body has left the row: a step or the results panel stands in its place. */
    sittingReading(): boolean {
      return this.sittingUp && this.sittingBody !== 'parties';
    },
    /** The body is NOT the row: the chairman seat pick (a decision), or the sitting in a step / the results. */
    stagePanelUp(): boolean {
      const kind = parliamentStageKind();
      return kind === 'seat' || (kind === 'sitting' && this.sittingReading);
    },
    voteUp(): boolean {
      return parliamentVoteUp();
    },
    stageKind(): ParliamentStage {
      return parliamentStageKind();
    },
    sittingUp(): boolean {
      return parliamentSittingUp();
    },
    /** The director's live state (the peek, the playing stage). */
    motion() {
      return sittingMotion;
    },
    /** THE SITTING'S BEATS — pure over the phase's summary (`sittingBeats.ts`). */
    sittingBeatList(): Array<SittingBeat> {
      const summary = this.model?.phase?.summary;
      return summary === undefined ? [] : sittingBeats(summary, this.viewerColor, 'live');
    },
    // ── the SITTING (the political phase's own flow) ───────────────────
    /**
     * WHERE THE SITTING STANDS — the server's step, the viewer's own gate
     * prompt, the seats still awaited, the seat's own ask (a pick / a take /
     * a tile) or the wait for another's; undefined outside a live political
     * phase the viewer takes part in. Every stage below derives from it.
     */
    sitting(): SittingPosition | undefined {
      return sittingPositionOf(this.model, this.pv.waitingFor, this.viewerColor);
    },
    /** The sitting's server step — its change re-seats the walk. */
    sittingStepKey(): string {
      const p = this.sitting;
      return p === undefined ? '' : `${p.generation}:${p.step}`;
    },
    /** The stage on screen: the position's pages under the local cursor. */
    sittingStage(): SittingStage {
      const p = this.sitting;
      return p === undefined ? 'verdict' : sittingStageAt(p, parliamentFlow.sittingPage);
    },
    /**
     * THE COLONY LEDGER the enacted resolution pays this seat (Colonial Affairs) — undefined for every
     * other resolution and for a seat outside the parliament. Read LIVE: the rows' states follow the
     * viewer's own records as they arrive (`colonyLedgerOf`, the one reading every surface shares).
     */
    sittingLedger(): ColonyLedgerReading | undefined {
      const id = this.model?.phase?.summary?.enacted.resolution;
      const resolution = id === undefined ? undefined : getResolution(id);
      return colonyLedgerOf(resolution, this.model, this.viewerColor, {enacted: true, live: true});
    },
    /**
     * THE FIELD AND THE STEP'S DOOR (`sittingFieldOf`): the reward stage HOLDS THE FIELD while a hosted
     * step (the pick, the take, the discard) stands in its zone — but not before the reward that arrived
     * WITH the ask has played: the payout's wave first, then the take deals (one press, several effects —
     * the surfaces go in turn) — and for the whole reward page when the resolution reads a LEDGER, whose
     * rows are the wave's own sources.
     */
    sittingFieldState(): {pose: boolean, stepOpen: boolean} {
      const p = this.sitting;
      if (!this.sittingUp || p === undefined) {
        return {pose: false, stepOpen: false};
      }
      return sittingFieldOf(this.sittingStage, p.rewardStep, this.rewardPending, this.sittingLedger !== undefined, this.stepFrameNested);
    },
    /**
     * A hosted step that is a workspace FRAME still stands INSIDE the Parliament (the colonies of the winner's
     * free colony — Colony Contest — after its pick was answered: the build's cube in flight, the tile's own
     * bonus asking). The stack is the one witness (`workspaceFrameHasNested`), and it is reactive: the field
     * and the door stay open for as long as the frame stands, and the walk holds the reward page (`mayLeave`).
     */
    stepFrameNested(): boolean {
      return workspaceFrameHasNested('parliament');
    },
    /** The stage's FIELD pose stands (the overview receded, the card on the hero slot, the zone open). */
    sittingField(): boolean {
      return this.sittingFieldState.pose;
    },
    /** A hosted step may teleport INTO the zone right now (the ledger, if any, yields to it). */
    sittingStepOpen(): boolean {
      return this.sittingFieldState.stepOpen;
    },
    /** A reward wave is owed or in the air for this seat (the ledger's reactive fact). */
    rewardPending(): boolean {
      void parliamentRewardState.owed.length;
      void parliamentRewardState.flying.length;
      return parliamentRewardPending();
    },
    /** The records the ledger still owes — the watcher below queues the walk on the rising edge. */
    rewardsOwed(): number {
      return parliamentRewardState.owed.length;
    },
    /**
     * The results card's ROWS are hidden until the director's cascade reveals them — the panel itself stands
     * from the page turn (the body swapped to it), and its rows come in by the results beat. The physical part
     * of the sitting is the RENEWAL page's, so nothing flies under this panel any more. A RELOAD onto a
     * finished sitting marks every stage played with nothing playing, so the card simply stands.
     */
    resultsHidden(): boolean {
      return this.sittingStage === 'results' && !sittingMotion.resultsRevealed;
    },
    /**
     * The crumb's tail for the sitting's stage (`sittingStageKey`). The tail
     * names the hosted step only once its field has opened: while the wave
     * that arrived with the ask still plays, the page IS the reward — one
     * animation of the tail, forward, when the take deals.
     */
    sittingTail(): string {
      const p = this.sitting;
      if (p === undefined) {
        return '';
      }
      const step = SITTING_HOSTED_STEPS.has(p.rewardStep) && !this.sittingStepOpen ? 'received' : p.rewardStep;
      return sittingStageKey(this.sittingStage, step);
    },
    /** The sitting's identity for the session's memory of played stages (`generation:seq`). */
    sittingKey(): string {
      const phase = this.model?.phase;
      return phase === undefined ? '' : `${phase.generation}:${phase.summary?.seq ?? phase.generation}`;
    },
    /** The Agenda step the enactment lights — the winner's new position, once the marker has reached it. */
    sittingStep(): number | undefined {
      const summary = this.model?.phase?.summary;
      return this.sittingUp && this.sittingStage !== 'verdict' && parliamentHolds.agendaAwaits === undefined ? summary?.agenda?.to : undefined;
    },
    /** The sitting's A verb (undefined = A does nothing here). */
    sittingPrimary(): string | undefined {
      const p = this.sitting;
      if (p === undefined || this.sittingStepOpen) {
        return undefined;
      }
      const key = sittingPrimaryKey(p, parliamentFlow.sittingPage);
      // The door to the board opens only once the wave that arrived with the tile has landed (the surfaces go in turn).
      if (key === 'Onto the board' && (this.rewardPending || this.walking)) {
        return undefined;
      }
      return key;
    },
    /** The sitting's B verb label — from the workspace phase, so B can never say one thing and do another. */
    sittingBack(): string | undefined {
      return backLabelForVerb(backVerbFor(sittingWorkspacePhase(this.sittingStage, false)));
    },
    winningSlot(): ParliamentSlotVm | undefined {
      return this.view.slots.find((s) => s.isWinning);
    },
    focusedSlot(): ParliamentSlotVm | undefined {
      return this.view.slots[parliamentFlow.slotIndex];
    },
    focusedParty(): ParliamentPartyVm | undefined {
      return parliamentFlow.zone === 'ruler' ?
        this.view.parties.find((p) => p.party === this.view.rulingParty) :
        this.view.parties[parliamentFlow.partyIndex];
    },
    voteTile(): ParliamentTileVm | undefined {
      return this.view.tiles.find((t) => t.id === 'vote');
    },
    /** The bench's marked source: the place the next delegate leaves, or none when there is nothing to send. */
    benchSource(): BenchSource {
      return benchSourceOf(this.view, parliamentFlow.voteSnapshot);
    },
    benchWarn(): boolean {
      return benchWarnOf(this.benchSource, this.voteTile, this.pv.thisPlayer?.megacredits ?? 0);
    },
    /** The execution gate — the viewer's own action window (never a reason of its own). */
    canActNow(): boolean {
      return this.myTurn && this.awaitingInput;
    },
    canVoteNow(): boolean {
      return this.bridge.vote !== undefined && this.canActNow;
    },
    partyStates(): Array<PartyStateVm> {
      const enactedEmpty = this.view.enacted === undefined;
      return this.view.parties.map((p) => partyStateOf(p, enactedEmpty));
    },
    partyActionStates(): Array<PartyActionStateVm> {
      return this.view.parties.map((p) => partyActionStateOf(p, this.canActNow));
    },
    agendaVm(): AgendaVm {
      return agendaViewOf(this.view);
    },
    seatCandidates(): Array<number> {
      const parties = (this.bridge.seat as {parties?: Array<PartyName>} | undefined)?.parties ?? [];
      return this.view.slots.map((slot, i) => ({slot, i})).filter(({slot}) => parties.includes(slot.party)).map(({i}) => i);
    },
    /**
     * THE CHAIRMAN-QUEST GATE stands for this seat — the server's own marker,
     * never a title. While it stands NOTHING of the quest is applied: the
     * marker is on its old step, the office untouched, the rating unchanged.
     */
    questGate(): {generation: number} | undefined {
      return chairmanQuestGateOf(this.pv.waitingFor);
    },
    /** The chairmanship flow's crumb tail — one word per stage («ЗАДАНИЕ» → «ПОВЕСТКА»). */
    questTail(): string {
      return chairmanQuestStageKey(chairmanQuestFlow.stage);
    },
    /** The chairmanship flow's own beat, published on the root — read by the e2e probe, never by the product. */
    questBeat(): string {
      return chairmanQuestFlow.live ? chairmanQuestFlow.beat : '';
    },
    /** The flow is holding at its seat beat with the server's own pick standing — the picker takes the stage. */
    questSeatStep(): boolean {
      return chairmanQuestFlow.live && chairmanQuestFlow.beat === 'seat' && this.bridge.seat !== undefined;
    },
    /** Its A verb: nothing while a beat is in flight (A «дожать» is unadvertised), «Закрыть» once everything has landed. */
    questCommands(): {done: boolean} | undefined {
      return chairmanQuestFlow.live ? {done: chairmanQuestFlow.beat === 'done'} : undefined;
    },
    crumbSubject(): string {
      return parliamentCrumbSubject(chairmanQuestFlow.live);
    },
    crumbStage(): string {
      return parliamentCrumbStage(this.sittingTail, this.questTail);
    },
    crumbCommitted(): boolean {
      return parliamentCrumbCommitted(chairmanQuestFlow.live);
    },
    /** THE ONE COMMAND CONTRACT — published to the shell's bar. */
    commands(): Array<ConsoleCommand> {
      return parliamentCommandsOf({
        view: this.view,
        canVoteNow: this.canVoteNow,
        partyActionStates: this.partyActionStates,
        sitting: {primary: this.sittingPrimary, inspect: this.sittingInspectable, back: this.sittingBack},
        quest: this.questCommands,
      });
    },
    /** X on the sitting inspects the enacted resolution — the object every stage is about. */
    sittingInspectable(): boolean {
      return this.model?.phase?.summary?.enacted !== undefined && !this.sittingStepOpen;
    },
    /**
     * THE SERVER'S ANSWER KEY. A submit is answered by a state change (the
     * game age moves) OR by a new prompt with the state untouched — a paid
     * vote's bill is raised before anything is paid, so the age alone would
     * miss it. The identity is structural (`promptIdentityKey`), never a raw title.
     */
    answerKey(): string {
      return `${this.pv.game.gameAge}|${promptIdentityKey(this.pv.waitingFor)}`;
    },
  },
  watch: {
    /**
     * THE PHASE'S END IS THE SURFACE'S END (v3 В1): the response that carries the sitting's data away is
     * the one that closes the frame (the shell's `parliamentSittingFrameLive` watcher) — the surface must
     * never render THAT view. Pre-flush, before this very render: latch the view the sitting stood with.
     * Declared first: the `leaving` watcher below keeps whatever this one froze.
     */
    'playerView'(now: PlayerViewModel, was: PlayerViewModel | undefined): void {
      if (this.frozenView === undefined && was !== undefined && parliamentSittingLive(was) && !parliamentSittingLive(now) && this.rootIsClosing()) {
        this.frozenView = was;
      }
    },
    /**
     * СТОЛ → ЧТЕНИЕ (v4 §1): the panel unfolds FROM THE ROW'S OWN RECT, so that rect is read at the
     * handoff and not at `openStage` — the sitting's panel goes up stages later (the reward, the results
     * card), by which time the row has been re-fitted at least once (the tile token, a profile change).
     * A `pre`-flush watcher runs BEFORE this render, so the row is still standing when it is measured.
     */
    'stagePanelUp'(up: boolean): void {
      if (!up) {
        return;
      }
      const tier = this.$refs.partiesTierEl as HTMLElement | undefined;
      const rect = tier?.getBoundingClientRect();
      if (rect !== undefined && rect.width > 0) {
        this.stageFromRect = {left: rect.left, top: rect.top, width: rect.width, height: rect.height};
      }
    },
    /** The shell plays the leave: freeze on the live view (a flow's conclusion, «свернуть», the yield); a cancelled leave lets go. */
    'leaving'(on: boolean): void {
      if (on) {
        this.frozenView ??= this.playerView;
      } else {
        this.frozenView = undefined;
      }
    },
    'commands': {
      immediate: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        consoleParliamentUi.commands = [...cmds];
      },
    },
    'crumbSubject': {
      immediate: true,
      handler(subject: string): void {
        setWorkspaceFrameSubject('parliament', subject);
      },
    },
    'crumbStage': {
      immediate: true,
      handler(stage: string): void {
        setWorkspaceFrameStage('parliament', stage);
      },
    },
    /** The vote mode's PAYMENT zone — published once the mode's DOM stands (post-flush: a teleport into a zone not yet rendered drops its content). */
    'voteUp': {
      immediate: true,
      flush: 'post',
      handler(on: boolean): void {
        consoleParliamentUi.voteStanding = on;
      },
    },
    /** The SITTING's stage zone — published on the same terms (the picker / the take teleport into it only once it is in the DOM). */
    'sittingUp': {
      immediate: true,
      flush: 'post',
      handler(on: boolean): void {
        consoleParliamentUi.stageStanding = on;
      },
    },
    /**
     * A REWARD ARRIVED while the sitting stands (the ledger seeded its hold in
     * the transport's own commit block): the walk plays its wave on the reward
     * page. The door is the STANDING of the sitting (its stage, or its gate
     * answer in flight — `parliamentSittingUp`), never the section's transient
     * flow stage: the viewer's own answer comes back while the stage is still
     * `submitting`, the other seat's through the poll while it is `sitting`,
     * and both must reach the same walk.
     */
    'rewardsOwed'(n: number, was: number): void {
      if (n > 0 && n > was && parliamentSittingUp()) {
        this.queueWalk();
      }
    },
    /**
     * THE SITTING OPENS WITH THE PHASE and closes with it. The position's
     * rising edge unfolds the stage from the parties tier (from the browse
     * layer only — a vote in flight finishes its own phrase first, then the
     * answer-key watcher lands here); the falling edge (the phase is over) is
     * the flow's ending: the shell's ONE guarded conclusion decides whether
     * the workspace leaves. Never a title, never a client memory — the
     * server's phase record is the only witness.
     */
    'sitting': {
      immediate: true,
      handler(position: SittingPosition | undefined): void {
        if (position !== undefined) {
          if (parliamentFlow.stage === 'browse') {
            parliamentFlow.zone = 'government';
            this.planOpening(position);
            this.openStage('sitting');
          }
          if (parliamentFlow.stage === 'sitting') {
            setWorkspaceFramePhase('parliament', sittingWorkspacePhase(this.sittingStage, false));
          }
        } else if (parliamentFlow.stage === 'sitting') {
          this.endSitting();
        }
      },
    },
    /** A new server step re-seats the walk: from its first unplayed page (a gate this seat already answered: its wait pose). */
    'sittingStepKey'(_now: string, was: string): void {
      if (was === '' || !parliamentSittingUp()) {
        return;
      }
      if (this.walking) {
        // The walk's own loop re-reads the position after every beat; a step that arrives mid-beat is picked up there.
        this.walkOwed = true;
        return;
      }
      this.enterServerStep();
    },
    'sittingStage'(stage: SittingStage): void {
      if (parliamentFlow.stage === 'sitting') {
        setWorkspaceFramePhase('parliament', sittingWorkspacePhase(stage, false));
      }
    },
    /**
     * THE REWARD STAGE TAKES THE FIELD for a hosted step — the overview recedes
     * and the enacted card FLIPs onto the stage's hero slot (its government
     * rect is read BEFORE the teleport moves it); when the step is answered
     * the card FLIPs home and the overview breathes back. The flow record
     * mirrors it synchronously for the tiers (the carry) and the stylesheet
     * (the pose); the motion follows on the next tick, after the layout.
     */
    'sittingField'(on: boolean): void {
      parliamentFlow.sittingField = on;
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const cardFrom = enactCarryRect(root);
      this.publishMidOffsets();
      void this.$nextTick(() => {
        if (root === undefined) {
          return;
        }
        fitParliamentCards();
        if (on) {
          // A wave that leaves the ledger waits for the card to LAND on its hero slot (the cause before the effect).
          this.fieldSettling = true;
          playParliamentEnactEnter({root, cardFrom, onDone: () => {
            this.fieldSettling = false;
            if (parliamentFlow.stage === 'sitting') {
              this.queueWalk();
            }
          }});
        } else {
          this.fieldSettling = false;
          playParliamentEnactFold({root, cardFrom});
        }
      });
    },
    /**
     * THE STEP'S DOOR (Colonial Affairs, block C): a hosted step may teleport into the zone — published
     * POST-FLUSH (the zone node is in the DOM) as `fieldStanding` for the shell's teleports (the picker, the
     * take) and as the Parliament FRAME's slot for a step that is a workspace FRAME (the hand in its
     * discard mode). For every step but the ledger's the door flips WITH the pose; with a ledger body the
     * field stands from the page's start and the door opens only once the wave has landed.
     */
    'sittingStepOpen': {
      flush: 'post',
      handler(on: boolean, was: boolean): void {
        this.publishStepDoor(on);
        this.stepOpenMirror = on;
        // The step left and the LEDGER returns under it: its updated rows are read for a beat before the walk goes on.
        if (!on && was && this.sittingStage === 'reward' && this.sittingLedger !== undefined) {
          this.ledgerReadOwed = true;
          this.queueWalk();
        }
      },
    },
    /**
     * THE HOSTED FRAME LEFT (Colony Contest): the shell popped the colonies once the build chain finished. The
     * position moved on long ago (the response after the build), so nothing else re-queues the walk — the
     * stage's door closes with the frame (`sittingStepOpen` falls), the hero card folds home, and the walk
     * goes on from the reward page: «получено», the renewal, the results. The sitting is never concluded here.
     */
    stepFrameNested(on: boolean, was: boolean): void {
      if (!on && was && parliamentFlow.stage === 'sitting') {
        this.queueWalk();
      }
    },
    sceneHandedOver(on: boolean): void {
      if (!on && parliamentFlow.stage === 'browse') {
        // (the falling edge of a SCENE hand-over — the browse layer republishes its own crumb)
        setWorkspaceFrameSubject('parliament', this.crumbSubject);
        setWorkspaceFrameStage('parliament', this.crumbStage);
        setWorkspaceFramePhase('parliament', 'browse');
        void this.$nextTick(() => fitParliamentCards());
      }
    },
    'view'(): void {
      void this.$nextTick(() => fitParliamentCards());
    },
    /**
     * The server answered: the stage it committed is over — a vote LANDS first, a paid vote PAYS first, a gate answer stays on its stage.
     * POST-flush on purpose: the answer is read by the vote-mode CHILD off its `playerView` PROP, and a parent's pre-flush
     * watcher runs one patch BEFORE that prop is updated — the child then read the OLD prompt, saw no bill, closed the vote
     * and reported the flow complete, and the shell concluded the workspace out from under the payment (the stranded
     * «Выберите, как оплатить …» over the board). The Э0 split moved `paymentStands` from this component into the child;
     * this is the seam it crossed.
     */
    'answerKey': {
      flush: 'post',
      handler(key: string): void {
        this.onAnswerKey(key);
      },
    },
    /**
     * THE CHAIRMAN-QUEST GATE takes the stage the moment it stands. The
     * player has ALREADY pressed A — on the mandatory announce plate, which is
     * what mounted this section — so the flow opens, starts its reading beat
     * and sends the answer under it: the reading is the minimum beat a fast
     * server never cuts, and everything past it waits for the response.
     */
    'questGate': {
      immediate: true,
      handler(gate: {generation: number} | undefined): void {
        if (gate !== undefined && parliamentFlow.stage === 'browse' && !chairmanQuestFlow.live) {
          this.openQuestFlow();
        }
      },
    },
    /**
     * THE CHAIRMANSHIP FLOW HOLDS FOR THE DELEGATE PICK (the corner case: every
     * delegate of this seat stands on a resolution). The DIRECTOR decides that
     * — not the prompt's arrival — so the picker opens on its own beat, and the
     * crumb keeps «ПРЕДСЕДАТЕЛЬСТВО» with only the tail advancing.
     */
    'questSeatStep'(open: boolean): void {
      if (!open || parliamentStageKind() !== 'quest') {
        return;
      }
      const seat = this.bridge.seat;
      const parties = seat === undefined ? [] : (seat as {parties: Array<PartyName>}).parties;
      const idx = this.view.slots.findIndex((slot) => parties.includes(slot.party));
      parliamentFlow.slotIndex = idx >= 0 ? idx : 0;
      parliamentFlow.zone = 'voting';
      this.openStage('seat');
    },
    /** A stand-alone chairman-seat pick is MANDATORY: it takes the stage as soon as it stands. */
    'bridge.seat': {
      immediate: true,
      handler(seat: PlayerInputModel | undefined): void {
        if (seat !== undefined && parliamentFlow.stage === 'browse') {
          const parties = (seat as {parties: Array<PartyName>}).parties;
          const idx = this.view.slots.findIndex((slot) => parties.includes(slot.party));
          parliamentFlow.slotIndex = idx >= 0 ? idx : 0;
          parliamentFlow.zone = 'voting';
          this.openStage('seat');
        }
      },
    },
  },
  beforeCreate() {
    // The flow record is the section's own: a fresh Parliament starts on its
    // browse layer. BEFORE the watchers: an `immediate` one (the sitting, a
    // standing chairman-seat pick) opens its stage at setup, exactly as it did
    // over the old `data()` — a reset in `created()` ran after them and wiped
    // the stage they had just opened. The DISPLAY HOLDS are NOT reset here
    // (v2): they outlive the section — a collapsed or yielded sitting resumes
    // its walk over the table as it stood.
    resetParliamentFlow();
  },
  mounted() {
    setParliamentRootEl(this.$refs.rootEl as HTMLElement | undefined);
    // A sitting already holding the field at mount (a reload, a restore) has
    // no entrance to play — the overview is parked at once.
    parliamentFlow.sittingField = this.sittingField;
    // A step's door already open at mount is published from the mounted DOM
    // (the watcher above cannot fire for a value that never changed).
    this.publishStepDoor(this.sittingStepOpen);
    this.stepOpenMirror = this.sittingStepOpen;
    this.publishMidOffsets();
    if (this.sittingField) {
      parkParliamentForEnact(this.$refs.rootEl as HTMLElement | undefined);
    }
    fitParliamentCards();
    const field = this.$refs.fieldEl as HTMLElement | undefined;
    if (field !== undefined) {
      this.stopFitObs = useResizeObserver(field, () => {
        this.publishMidOffsets();
        fitParliamentCards();
      }).stop;
    }
    // A SITTING STANDING AT MOUNT (the usual door — the plate's A mounts the
    // section with the stage already in its first render): the stage's
    // `<transition>` never plays an enter for an element present at the
    // initial render, so the walk starts here, on the mounted DOM.
    if (parliamentFlow.stage === 'sitting' && !this.stageEntering) {
      this.queueWalk();
    }
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.clearSubmitTimer();
    resetSittingDirector();
    // «ПРЕДСЕДАТЕЛЬСТВО» ends with its section: a beat has nowhere to play and
    // a hold nobody would consume would freeze the track for the rest of the
    // game (its counters tick with this block instead — honestly late).
    if (chairmanQuestFlow.live) {
      killChairmanQuestBeats();
      releaseChairmanQuestHolds('unmount');
      resetChairmanQuestFlow();
    }
    // The phase is over (the section unmounts after its latched leave — v3 В1): the sitting's display
    // holds end here, never in the apply block that carried the phase away (the surface still needed
    // them for its leave). A park / a yield keeps them: the walk resumes over them.
    if (!parliamentSittingLive(this.playerView)) {
      resetParliamentHolds();
    }
    // A reward whose wave has not left with the sitting leaving (a park, the
    // board taking the screen, the phase's end) is announced by its counter
    // now — never held for a stage that is gone. The DISPLAY holds stay: the
    // walk resumes over them when the section comes back.
    releaseParliamentRewards('unmount');
    killParliamentFlights();
    killParliamentVoteMotion(this.$refs.rootEl as HTMLElement | undefined);
    killParliamentEnactMotion(this.$refs.rootEl as HTMLElement | undefined);
    freezeParliamentFit(false);
    consoleParliamentUi.commands = [];
    consoleParliamentUi.voteStanding = false;
    consoleParliamentUi.stageStanding = false;
    consoleParliamentUi.fieldStanding = false;
    // The zone's host retracts its frame slot unconditionally (the embed contract): a nested frame
    // pointed at a destroyed node would mount outside the document.
    setWorkspaceFrameSlot('parliament', '');
    setWorkspaceFrameSubject('parliament', '');
    setWorkspaceFrameStage('parliament', '');
  },
  unmounted() {
    setParliamentRootEl(undefined);
    resetParliamentFlow();
  },
  methods: {
    /** The answer's stage handling (see the `answerKey` watcher). */
    onAnswerKey(key: string): void {
      const f = parliamentFlow;
      if (f.stage === 'paying') {
        this.voteMode()?.answerWhilePaying();
        return;
      }
      if (f.stage === 'submitting' && key !== this.submittedKey) {
        this.clearSubmitTimer();
        if (f.stageBeforeSubmit === 'vote') {
          this.voteMode()?.answerAfterSubmit();
          return;
        }
        if (f.stageBeforeSubmit === 'quest') {
          // THE GATE IS ANSWERED — the flow STAYS: its beats play the office
          // and the Agenda step the answer produced. The holds were seeded in
          // the response's own commit block; the director consumes them.
          f.stage = 'quest';
          setWorkspaceFramePhase('parliament', 'committed');
          noteChairmanQuestAnswer();
          return;
        }
        if (f.stageBeforeSubmit === 'sitting') {
          // THE GATE IS ANSWERED — the sitting stays on its stage: the position
          // re-derives (the wait pose, the chain's beats, the results) and the
          // `sitting` watcher ends the flow only when the phase itself is over.
          f.stage = this.sitting === undefined ? 'browse' : 'sitting';
          setWorkspaceFramePhase('parliament', f.stage === 'sitting' ? sittingWorkspacePhase(this.sittingStage, false) : 'browse');
          if (f.stage === 'browse') {
            this.$emit('flow-complete', 'sitting');
          }
          return;
        }
        // The chairman's delegate leaves the card for the seat.
        const wasSeat = f.stageBeforeSubmit === 'seat';
        if (wasSeat && chairmanQuestFlow.live) {
          // …and inside the chairmanship flow it goes back to it: the office
          // beat plays the cube onto the chair, then the Agenda step.
          f.stage = 'quest';
          setWorkspaceFramePhase('parliament', 'committed');
          this.seatFrom = undefined;
          noteChairmanQuestAnswer();
          return;
        }
        f.stage = 'browse';
        setWorkspaceFramePhase('parliament', 'browse');
        if (wasSeat) {
          void this.$nextTick(() => {
            const from = this.seatFrom;
            this.seatFrom = undefined;
            flySeatDelegate(this.$refs.rootEl as HTMLElement | undefined, this.viewerColor, from, () => pulseParliamentChair());
          });
        }
        this.$emit('flow-complete', f.stageBeforeSubmit);
      }
    },
    voteMode(): InstanceType<typeof ConsoleParliamentVoteMode> | undefined {
      return this.$refs.voteMode as InstanceType<typeof ConsoleParliamentVoteMode> | undefined;
    },
    /**
     * THE STEP'S DOOR, published (see the `sittingStepOpen` watcher): the shell's teleports read
     * `fieldStanding`; a step that is a workspace FRAME (the hand) reads the Parliament frame's slot.
     * Both retract together — a door left open names a zone the pose has already closed.
     */
    publishStepDoor(on: boolean): void {
      const open = on && parliamentFlow.stage === 'sitting';
      consoleParliamentUi.fieldStanding = open;
      setWorkspaceFrameSlot('parliament', open ? STAGE_ZONE_SELECTOR : '');
    },
    /**
     * THE MIDDLE TIER'S OFFSETS inside the field, as px tokens on the field —
     * what the stage's FIELD pose grows by (`.con-parl__stage--field`, one
     * element, two poses). Measured, never assumed: the top tier's height is
     * the grid's own answer.
     */
    publishMidOffsets(): void {
      const field = this.$refs.fieldEl as HTMLElement | undefined;
      const mid = this.$refs.midEl as HTMLElement | undefined;
      if (field === undefined || mid === undefined) {
        return;
      }
      const top = mid.offsetTop;
      const bottom = Math.max(0, field.clientHeight - (top + mid.offsetHeight));
      field.style.setProperty('--con-parl-mid-top', `${top}px`);
      field.style.setProperty('--con-parl-mid-bottom', `${bottom}px`);
    },
    // ── input ──────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      const f = parliamentFlow;
      // A beat in flight absorbs input by phase; a hosted step owns the pad
      // while it stands in the sitting's zone (the shell routes to it first).
      if (f.stage === 'submitting' || f.stage === 'landed' || f.stage === 'paying' || (f.stage === 'sitting' && this.sittingStepOpen)) {
        return;
      }
      if (f.stage === 'browse') {
        this.handleBrowseIntent(intent);
        return;
      }
      this.handleStageIntent(intent);
    },
    handleBrowseIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        navigateParliamentZones(intent.dir, this.view);
        return;
      }
      // R3 — the ENACTED resolution (v3 В5): it left the focus ring (nothing about it is a decision) and
      // kept its own verb, read from wherever the player stands in the browse layer.
      if (intent.kind === 'press' && intent.button === 'stickR') {
        const enacted = parliamentEnactedInspectRequest(this.view, this.$refs.rootEl as HTMLElement | undefined);
        if (enacted !== undefined) {
          this.$emit('inspect', enacted);
        }
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        this.primary();
        return;
      case 'inspect': {
        const request = parliamentBrowseInspectRequest(this.view, this.$refs.rootEl as HTMLElement | undefined);
        if (request !== undefined) {
          this.$emit('inspect', request);
        }
        return;
      }
      case 'back':
        this.$emit('close');
        return;
      default:
        return;
      }
    },
    primary(): void {
      switch (parliamentFlow.zone) {
      case 'voting':
        this.voteMode()?.openVote();
        return;
      case 'parties':
      case 'ruler': {
        // The ruling party's tile in the government is a party tile like the five below it: the same door.
        const party = this.focusedParty;
        const index = party === undefined ? -1 : this.view.parties.findIndex((p) => p.party === party.party);
        const state = index === -1 ? undefined : this.partyActionStates[index];
        if (party?.actionId === undefined || state === undefined || state.kind === 'none') {
          this.$emit('notice', translateText('This party has no action'));
          return;
        }
        this.openAction(party.party, party.actionId, state);
        return;
      }
      case 'government':
        this.$emit('notice', translateText(this.view.enacted === undefined ?
          'No resolution is enacted yet — the Greens rule by the starting rule' :
          'The enacted resolution has no action of its own'));
        return;
      default:
        return;
      }
    },
    /** The stages' own verbs: B folds the vote / collapses the seat and the sitting; everything else is the stage's. */
    handleStageIntent(intent: GamepadIntent): void {
      const f = parliamentFlow;
      if (f.stage === 'sitting') {
        this.handleSittingIntent(intent);
        return;
      }
      if (f.stage === 'quest') {
        this.handleQuestIntent(intent);
        return;
      }
      if (consoleActionOf(intent) === 'back') {
        if (f.stage === 'seat') {
          this.$emit('collapse');
          return;
        }
        if (f.stage === 'vote') {
          this.voteMode()?.closeVote();
          return;
        }
        this.closeStage();
        return;
      }
      switch (f.stage) {
      case 'vote':
        this.voteMode()?.handleIntent(intent);
        return;
      case 'seat':
        (this.$refs.seatPick as InstanceType<typeof ConsoleParliamentSeatPick> | undefined)?.handleIntent(intent);
        return;
      default:
        return;
      }
    },
    /**
     * THE SITTING'S GRAMMAR (v2): A on the VERDICT answers gate 1 — the whole
     * chain follows with no press; A on the reward's PLACEMENT step is the ONE
     * door to the board («К полю»); A on the RESULTS answers gate 2; A during a
     * beat = «дожать» (never a skipped stage); X inspects the enacted
     * resolution; B obeys the workspace phase — «свернуть» past the commit
     * (the whole stack parks, the board-home card restores this very page),
     * nothing on the terminal results page.
     */
    handleSittingIntent(intent: GamepadIntent): void {
      const position = this.sitting;
      if (position === undefined) {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary': {
        if (sittingMotionActive()) {
          finishSittingMotion();
          return;
        }
        const stage = this.sittingStage;
        if (stage === 'verdict' && position.gateStanding) {
          this.send({type: 'option'}, 'sitting');
          return;
        }
        if (stage === 'reward' && position.rewardStep === 'placement' && this.sittingPrimary !== undefined) {
          this.$emit('to-board');
          return;
        }
        if (stage === 'results' && position.gateStanding) {
          this.send({type: 'option'}, 'sitting');
        }
        return;
      }
      case 'inspect':
        this.inspectSitting();
        return;
      case 'back':
        if (backVerbFor(sittingWorkspacePhase(this.sittingStage, false)) === 'collapse') {
          this.$emit('collapse');
        }
        return;
      default:
        return;
      }
    },
    /**
     * «ПРЕДСЕДАТЕЛЬСТВО»: A «дожать» while a beat is in flight, A «Закрыть»
     * once everything has landed. B says nothing for the whole flow — it is
     * past the commit and there is no reversible level to go back to; a beat
     * in flight absorbs input by construction (the phase is `executing`).
     */
    handleQuestIntent(intent: GamepadIntent): void {
      if (consoleActionOf(intent) !== 'primary') {
        return;
      }
      if (!chairmanQuestFlow.answered && !chairmanQuestFlow.sent && this.questGate !== undefined) {
        // A refused or silenced submit gave the stage back: the gate still
        // stands, so A means what it meant — send it again.
        chairmanQuestFlow.sent = true;
        this.send({type: 'option'}, 'quest');
        return;
      }
      if (chairmanQuestBeatActive()) {
        finishChairmanQuestBeats();
        return;
      }
      if (chairmanQuestFlow.beat === 'done') {
        this.endQuestFlow();
      }
    },
    /**
     * OPEN the chairmanship flow: arm it from the model as it stands BEFORE
     * the answer (the office, the delegate's own place), unfold the stage,
     * start the reading beat and send the gate's confirm under it.
     */
    openQuestFlow(): void {
      armChairmanQuestFlow(this.model, this.viewerColor);
      parliamentFlow.zone = 'government';
      this.openStage('quest');
      void this.$nextTick(() => probeTick(() => {
        const root = this.$refs.rootEl as HTMLElement | undefined;
        if (root === undefined || !chairmanQuestFlow.live) {
          return;
        }
        startChairmanQuestBeats({
          root,
          viewer: this.viewerColor,
          generation: this.pv.game.generation,
          playAgendaGlide: (move: AgendaMove, onLanded: () => void) => {
            const agenda = this.$refs.agenda as InstanceType<typeof ConsoleParliamentAgenda> | undefined;
            if (agenda === undefined) {
              onLanded();
              return;
            }
            void agenda.playAgendaGlide(move, {onLanded});
          },
          owesSeatPick: () => this.bridge.seat !== undefined,
          onStage: () => {
            setWorkspaceFrameStage('parliament', this.crumbStage);
          },
          onDone: () => undefined,
        });
      }));
      if (this.questGate !== undefined) {
        chairmanQuestFlow.sent = true;
        this.send({type: 'option'}, 'quest');
      }
    },
    /** The flow is over: the holds are gone with their beats, and the workspace concludes. */
    endQuestFlow(): void {
      killChairmanQuestBeats();
      releaseChairmanQuestHolds('quest-closed');
      resetChairmanQuestFlow();
      this.closeStage();
      this.$emit('flow-complete', 'quest');
    },
    /** X: the enacted resolution lifts out of the government's card (or the stage's hero, while carried). */
    inspectSitting(): void {
      const id = this.model?.phase?.summary?.enacted.resolution;
      if (id === undefined) {
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const request: ParliamentInspectRequest = {
        kind: 'resolution', ids: [id], index: 0,
        origin: () => root?.querySelector<HTMLElement>('.con-parl__gov-card .pcard') ?? root?.querySelector<HTMLElement>('.con-parl__gov-card') ?? null,
      };
      this.$emit('inspect', request);
    },
    /**
     * A PARTY ACTION from its plaque — the Parliament's door into the ONE
     * execution point (the action workspace, nested inside this screen). The
     * pressed plaque is the descent's origin; a closed door names its reason.
     */
    openAction(party: ReduxParty, id: PartyActionId, state: PartyActionStateVm): void {
      const refusal = partyActionRefusal(state, id === 'unity-trade' || this.bridge.actions[id] !== undefined, this.awaitingInput);
      if (refusal !== undefined) {
        this.$emit('notice', refusal);
        return;
      }
      armPartyActionDescent(this.$refs.rootEl as HTMLElement | undefined, party);
      this.$emit('open-action', party);
    },
    // ── the seat / sitting stage phrase ─────────────────────────────────
    openStage(stage: ParliamentStage): void {
      const tier = this.$refs.partiesTierEl as HTMLElement | undefined;
      const rect = tier?.getBoundingClientRect();
      this.stageFromRect = rect !== undefined && rect.width > 0 ? {left: rect.left, top: rect.top, width: rect.width, height: rect.height} : undefined;
      parliamentFlow.stage = stage;
      setWorkspaceFramePhase('parliament', stage === 'sitting' ? sittingWorkspacePhase(this.sittingStage, false) : 'configure');
    },
    closeStage(): void {
      killSittingMotion();
      this.walkOwed = false;
      parliamentFlow.stage = 'browse';
      setWorkspaceFramePhase('parliament', 'browse');
    },
    /**
     * THE PHASE IS OVER. A PHASE-anchored root leaves WITH its stage standing
     * (the shell's `closeWorkspaceRoot` on the falling edge — one motion of
     * the whole surface, never a stage folding to browse under a leaving
     * frame); a Parliament the player walked into on their own stays, so its
     * stage folds back to the browse layer.
     */
    /**
     * IS THIS ROOT ON ITS WAY OUT? (v3 В1) The phase's end closes a PHASE-anchored Parliament — and the
     * SHELL's own watcher gets there FIRST, in the same flush, so by the time this section is asked the
     * frame is already gone and its anchor with it. Both facts mean the same thing and both must count:
     * the frame no longer renders, or it still does and is the phase's. A Parliament the player walked
     * into on their own (an `always` anchor, still in the stack) is NOT closing — it folds back to browse
     * and goes on living on the live view.
     */
    rootIsClosing(): boolean {
      return !workspaceFrameRenders('parliament') || workspaceFrameAnchor('parliament')?.type === 'phase';
    },
    endSitting(): void {
      killSittingMotion();
      if (this.rootIsClosing()) {
        // The surface leaves WITH its stage: folding to browse under a leaving frame shows the player the
        // overview for the length of a dissolve — a screen they never asked for (v3 В1).
        this.walkOwed = false;
      } else {
        this.closeStage();
      }
      this.$emit('flow-complete', 'sitting');
    },
    /**
     * THE OPENING (the section mounts with the sitting standing, or the stage
     * unfolds over the browse layer): where the walk starts and what it plays.
     *  · at the VERDICT (gate 1) — the verdict page; its light plays once;
     *  · past the barrier with NO memory of this sitting (a reload inside the
     *    sequence): the step's last page in its final poses — nothing replays,
     *    the holds are dropped;
     *  · past the barrier with a memory (a collapsed sitting coming back, the
     *    frame back from the board): the first unplayed page, with the holds
     *    the transport seeded while the section was away — the walk goes on
     *    from there (the tile's RECEIPT is read first when one is owed).
     */
    planOpening(position: SittingPosition): void {
      const key = this.sittingKey;
      const played = (stage: SittingStage) => sittingStagePlayed(key, stage);
      if (verdictStandsAt(position.step)) {
        parliamentFlow.sittingPage = 0;
        return;
      }
      if (!sittingSessionKnown(key)) {
        for (const stage of position.pages) {
          notePlayedSittingStage(key, stage);
        }
        // …and the results card is simply STANDING for a sitting re-read at its final poses: nothing will play,
        // so nothing will reveal it, and `resultsHidden` (which keeps the panel off the table while the renewal
        // moves) must not hold it hidden for ever.
        sittingMotion.resultsRevealed = true;
        resetParliamentHolds();
        parliamentRewardState.receiptShowing = false;
        parliamentFlow.sittingPage = position.pages.length - 1;
        return;
      }
      const receipt = takeTileReceipt(key);
      parliamentFlow.sittingPage = sittingStartPage(position, played, receipt !== undefined);
      // The receipt is READ on the reward page; a walk that cannot start there (the gate already answered) owes no read.
      parliamentRewardState.receiptShowing = receipt !== undefined && position.pages[parliamentFlow.sittingPage] === 'reward';
    },
    /** A new server step: the walk re-seats on the step's first unplayed page and goes on. */
    enterServerStep(): void {
      const position = this.sitting;
      if (position === undefined) {
        return;
      }
      const key = this.sittingKey;
      // THE LEDGER'S READ IS OWED ACROSS A STEP CHANGE (Colonial Affairs): the last hosted step's answer carries the
      // server straight to the adjourn gate, and the walk would re-seat past the reward page — the page whose ledger
      // now reads what every step paid. A step that was open a flush ago (`stepOpenMirror` — the post-flush door
      // watcher has not run yet) and is open no more seats the walk on the reward page first, like a tile's receipt.
      const ledgerRead = this.sittingLedger !== undefined && this.stepOpenMirror && !this.sittingStepOpen;
      if (ledgerRead) {
        this.ledgerReadOwed = true;
      }
      // A hosted FRAME still standing in the zone (the colonies of the winner's free colony — the server moved
      // to the adjourn gate the moment the pick was answered, the cube is still flying) seats the walk on the
      // reward page too: the step is where the player is, and the page holds until the frame has left.
      parliamentFlow.sittingPage = sittingStartPage(position, (stage) => sittingStagePlayed(key, stage), ledgerRead || this.stepFrameNested);
      this.queueWalk();
    },
    // ── the director's walk ─────────────────────────────────────────────
    /** Run the walk once the DOM (and the stage's unfold) stands — idempotent. */
    queueWalk(): void {
      if (this.walkQueued) {
        return;
      }
      this.walkQueued = true;
      void this.$nextTick(() => probeTick(() => {
        this.walkQueued = false;
        void this.runWalk();
      }));
    },
    directorContext(): SittingDirectorContext | undefined {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const summary = this.model?.phase?.summary;
      if (root === undefined || summary === undefined) {
        return undefined;
      }
      return {
        root, view: this.view, model: this.model, summary, viewer: this.viewerColor,
        playAgendaGlide: (move: AgendaMove, onLanded?: () => void) => {
          const agenda = this.$refs.agenda as InstanceType<typeof ConsoleParliamentAgenda> | undefined;
          if (agenda === undefined) {
            onLanded?.();
            return;
          }
          void agenda.playAgendaGlide(move, {onLanded});
        },
      };
    },
    /** May the walk leave `stage` by itself? The enactment always; the reward once nothing of this seat's is open there. */
    mayLeave(stage: SittingStage, position: SittingPosition): boolean {
      if (stage === 'enact' || stage === 'renewal') {
        return true;
      }
      if (stage === 'reward') {
        // …and never while a hosted FRAME still stands in the zone (the colonies' build chain after the pick).
        return sittingRewardSettled(position) && !this.rewardPending && !parliamentRewardState.receiptShowing && !this.ledgerReadOwed &&
          !this.stepFrameNested;
      }
      return false;
    },
    /**
     * THE WALK — the director turns the sitting's pages: every page's beats
     * play ONCE per session (a page turned back and forth replays nothing),
     * the reward page replays for what arrived since (a wave owed, the tile's
     * receipt), and the walk advances by itself over the auto pages until a
     * STOP: the verdict, an ask of this seat, a wait on another, the results.
     * The position is re-read after every beat, so a step that arrived
     * mid-beat (a poll, the viewer's own answer) is picked up where it lands.
     */
    async runWalk(): Promise<void> {
      if (this.walking || this.stageEntering || !this.sittingUp) {
        return;
      }
      this.walking = true;
      try {
        for (let guard = 0; guard < 16; guard++) {
          const position = this.sitting;
          if (position === undefined || !this.sittingUp) {
            break;
          }
          const cursor = Math.max(0, Math.min(position.pages.length - 1, parliamentFlow.sittingPage));
          parliamentFlow.sittingPage = cursor;
          const stage = position.pages[cursor];
          const ctx = this.directorContext();
          if (ctx === undefined) {
            break;
          }
          // A BEAT IS PLAYED ONLY ON ITS OWN SURFACE (v4, kept): a beat whose objects live in the BODY may
          // not start while the body is still swapping, and a beat that measures inside a panel may not
          // start before that panel stands. One flush is what starts the swap (the page changed in this very
          // loop, with no patch in between), so the walk asks for it and then reads the leave; the swap's
          // completion re-queues the walk, and nothing is marked played, so nothing is skipped. Measured in
          // v4: without it the renewal's first beat played under a panel still fading over the very table it
          // was moving things on, and the reward's wave measured a hidden panel — its hold then sat to the
          // 12 s ceiling, `rewardPending` never cleared, and the walk never left the reward at all.
          await this.$nextTick();
          if (this.sittingBody === 'parties' && this.stageLeaving) {
            break;
          }
          // …and a beat whose objects live in a body still UNFOLDING (the ledger's rows, the card landing on
          // its hero slot) waits for the entrance to end — its end re-queues the walk (nothing is marked
          // played, so nothing is skipped). A wave measured mid-unfold leaves a row that is still moving.
          if (this.stageEntering || this.fieldSettling) {
            break;
          }
          const key = this.sittingKey;
          const receipt = stage === 'reward' && parliamentRewardState.receiptShowing;
          // The ledger's READ after a hosted step (Colonial Affairs): a beat of its own, like the tile's receipt.
          const ledgerRead = stage === 'reward' && this.ledgerReadOwed;
          if (!sittingStagePlayed(key, stage) || receipt || ledgerRead || (stage === 'reward' && this.rewardPending)) {
            notePlayedSittingStage(key, stage);
            await playSittingStage(stage, this.sittingBeatList, ctx, {compact: false});
            if (receipt) {
              parliamentRewardState.receiptShowing = false;
            }
            if (ledgerRead) {
              this.ledgerReadOwed = false;
            }
          }
          if (!this.sittingUp) {
            break;
          }
          const now = this.sitting;
          if (now === undefined) {
            break;
          }
          const idx = Math.min(cursor, now.pages.length - 1);
          if (now.pages[idx] !== stage) {
            // The step changed under the walk: re-seat on the first unplayed page of the new step.
            parliamentFlow.sittingPage = sittingStartPage(now, (st) => sittingStagePlayed(key, st));
            continue;
          }
          if (idx < now.pages.length - 1 && sittingPageAuto(stage) && this.mayLeave(stage, now)) {
            if (now.pages[idx + 1] === 'results') {
              // The results' rows wait for their own cascade: hidden from the frame the panel opens.
              sittingMotion.resultsRevealed = false;
            }
            parliamentFlow.sittingPage = idx + 1;
            continue;
          }
          break;
        }
      } finally {
        this.walking = false;
      }
      if (this.walkOwed) {
        this.walkOwed = false;
        this.queueWalk();
      }
    },
    /**
     * СМЕНА ТЕЛА (v5 §3): the row is pushed shut downward as one group while the new body unfolds from
     * under the band, and the carrier card gives its one impulse — the cause of the work that is opening.
     * The band itself does not take part: it stands still and changes only its text.
     */
    onStageEnter(el: Element, done: () => void): void {
      this.stageEntering = true;
      pulseCarrier(this.$refs.rootEl instanceof HTMLElement ?
        this.$refs.rootEl.querySelector<HTMLElement>('[data-parl-gov-carry] .con-parl__gov-card') ?? undefined : undefined);
      playBodyUnfold(el as HTMLElement, this.$refs.partiesTierEl as HTMLElement | undefined, this.stageFromRect, () => {
        this.stageEntering = false;
        done();
        if (parliamentFlow.stage === 'sitting') {
          this.queueWalk();
        }
      });
    },
    onStageLeave(el: Element, done: () => void): void {
      this.stageLeaving = true;
      playBodyFold(el as HTMLElement, this.$refs.partiesTierEl as HTMLElement | undefined, () => {
        this.stageLeaving = false;
        done();
        // The row is back: a beat whose objects live in it can play now.
        if (parliamentFlow.stage === 'sitting') {
          this.queueWalk();
        }
      });
    },
    onStageEnterCancelled(el: Element): void {
      (el as HTMLElement).style.clipPath = '';
      settleRow(this.$refs.partiesTierEl as HTMLElement | undefined, !this.stagePanelUp);
    },
    onStageLeaveCancelled(): void {
      this.stageLeaving = false;
      settleRow(this.$refs.partiesTierEl as HTMLElement | undefined, !this.stagePanelUp);
    },
    // ── submits (byte-identical to the live prompt) ─────────────────────
    /** The seat pick's A — `from` is the rect of the cube that leaves the card (the flight's source after the answer). */
    submitSeat(from: Rect | undefined): void {
      const slot = this.focusedSlot;
      if (slot === undefined) {
        return;
      }
      this.seatFrom = from;
      this.send(seatResponse(this.bridge, slot.party), 'seat');
    },
    send(response: InputResponse | undefined, from: ParliamentStage): void {
      if (response === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        if (from === 'vote') {
          parliamentFlow.voteSnapshot = undefined;
        } else if (from !== 'sitting') {
          this.closeStage();
        }
        return;
      }
      parliamentFlow.stageBeforeSubmit = from;
      this.submittedKey = this.answerKey;
      parliamentFlow.stage = 'submitting';
      setWorkspaceFramePhase('parliament', from === 'sitting' ? 'executing' : 'committed');
      this.$emit('submit', response);
      this.clearSubmitTimer();
      this.submitTimer = window.setTimeout(() => this.resetSubmitting(), SUBMIT_SAFETY_MS);
    },
    /** A REFUSED submit gives the stage back (the shell calls it on a transport error too). */
    resetSubmitting(): void {
      this.clearSubmitTimer();
      const f = parliamentFlow;
      if (f.stage === 'submitting') {
        f.stage = f.stageBeforeSubmit === 'seat' ? 'seat' : f.stageBeforeSubmit;
        f.voteSnapshot = undefined;
        this.seatFrom = undefined;
        if (f.stage !== 'landed' && f.stage !== 'paying') {
          freezeParliamentFit(false);
        }
        setWorkspaceFramePhase('parliament',
          f.stage === 'browse' ? 'browse' :
            f.stage === 'sitting' ? sittingWorkspacePhase(this.sittingStage, false) : 'configure');
      }
    },
    clearSubmitTimer(): void {
      if (this.submitTimer !== undefined) {
        window.clearTimeout(this.submitTimer);
        this.submitTimer = undefined;
      }
    },
  },
});
</script>
