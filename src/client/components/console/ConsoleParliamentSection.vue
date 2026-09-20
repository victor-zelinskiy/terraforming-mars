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
             'con-parl--stage': stageUp,
             'con-parl--vote': voteUp,
             'con-parl--vote-leaving': flow.voteLeaving,
             'con-parl--flying': flightsAirborne,
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

      <!-- ══ MIDDLE TIER — the OPPOSITION (browse) or a STAGE (the seat pick, the
           SITTING) — ONE zone, one rect; the sitting's reward stage may take
           the whole field for a hosted step (`--field`). The parties tier
           renders EVERY party (the ruling one is teleported into the
           government's ruler slot — one DOM instance per party). ══ -->
      <div class="con-parl__mid" data-parl-mid data-parl-recede ref="midEl">
        <div class="con-parl__parties-tier" ref="partiesTierEl" :class="{'con-parl__parties-tier--parked': stageUp && !motion.peek}" v-show="!stageUp || stageLeaving || motion.peek">
          <ConsoleParliamentParties :view="view" :partyStates="partyStates" :partyActionStates="partyActionStates" :viewerColor="viewerColor"
                                    :awaitingInput="awaitingInput" />
        </div>

        <!-- ── THE STAGE ZONE — the chairman SEAT pick and the SITTING unfold in
             place of the parties tier (one chassis). ── -->
        <transition :css="false" @enter="onStageEnter" @leave="onStageLeave" @enter-cancelled="onStageEnterCancelled" @leave-cancelled="onStageLeaveCancelled">
          <div v-if="stageUp" class="con-parl__stage" :class="['con-parl__stage--' + stageKind, {'con-parl__stage--field': flow.sittingField, 'con-parl__stage--peek': motion.peek}]" :data-parl-stage="stageKind" :data-sitting-motion="motion.stage || undefined" :data-sitting-beat="motion.beat || undefined">
            <ConsoleParliamentSeatPick v-if="stageKind === 'seat' && focusedSlot !== undefined" ref="seatPick"
                                       :view="view" :slot="focusedSlot" :viewerColor="viewerColor" :seatCandidates="seatCandidates"
                                       @submit="submitSeat($event)" @inspect="$emit('inspect', $event)" />
            <ConsoleParliamentSitting v-else-if="stageKind === 'sitting' && sitting !== undefined" ref="sitting"
                                      :position="sitting" :stage="sittingStage" :summary="model?.phase?.summary"
                                      :view="view" :model="model" :playerView="pv" :viewerColor="viewerColor"
                                      :field="flow.sittingField" :resultsHidden="resultsHidden" mode="live" />
            <div class="con-parl__embed" data-embed-slot="parliament"></div>
          </div>
        </transition>
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
  sittingStartPage, sittingWorkspacePhase, verdictStandsAt,
  parliamentSittingLive,
} from '@/client/console/parliament/consoleSittingFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
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
  setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameAnchor, workspaceFrameHasNested, workspaceFrameRenders,
} from '@/client/console/consoleWorkspaceStack';
import {translateText} from '@/client/directives/i18n';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {useResizeObserver} from '@vueuse/core';
import {playStageFold, playStageUnfold} from '@/client/console/parliament/parliamentStageMotion';
import {killParliamentVoteMotion, Rect} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {
  enactCarryRect, killParliamentEnactMotion, parkParliamentForEnact, playParliamentEnactEnter, playParliamentEnactFold,
} from '@/client/console/parliament/consoleParliamentEnactMotion';

/** How long a submit may stay unanswered before the stage gives the player back their hands (a net over a silent server — the tree's one wall-clock timer). */
const SUBMIT_SAFETY_MS = 6000;

export default defineComponent({
  name: 'ConsoleParliamentSection',
  components: {
    ConsoleWsHead, ConsoleParliamentSeats, ConsoleParliamentGovernment, ConsoleParliamentVotingArea, ConsoleParliamentParties,
    ConsoleParliamentAgenda, ConsoleParliamentVoteMode, ConsoleParliamentSeatPick, ConsoleParliamentSitting,
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
    /** A nested frame (the action workspace) took the scene — this screen yields and waits. */
    sceneHandedOver(): boolean {
      return workspaceFrameHasNested('parliament');
    },
    stageUp(): boolean {
      return parliamentStageUp();
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
     * The reward stage HOLDS THE FIELD while a hosted step (the pick, the take)
     * stands in its zone — but not before the reward that arrived WITH the ask
     * has played: the payout's wave first, then the take deals (one press,
     * several effects — the surfaces go in turn).
     */
    sittingField(): boolean {
      const p = this.sitting;
      return this.sittingUp && p !== undefined && this.sittingStage === 'reward' &&
        (p.rewardStep === 'choice' || p.rewardStep === 'intake') && !this.rewardPending;
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
    /** The results card is hidden until the renewal's beats are over (the director reveals it). */
    resultsHidden(): boolean {
      return this.sittingStage === 'results' && sittingMotion.stage === 'results' && !sittingMotion.resultsRevealed;
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
      const step = (p.rewardStep === 'choice' || p.rewardStep === 'intake') && !this.sittingField ? 'received' : p.rewardStep;
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
      if (p === undefined || this.sittingField) {
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
    crumbSubject(): string {
      return parliamentCrumbSubject();
    },
    crumbStage(): string {
      return parliamentCrumbStage(this.sittingTail);
    },
    crumbCommitted(): boolean {
      return parliamentCrumbCommitted();
    },
    /** THE ONE COMMAND CONTRACT — published to the shell's bar. */
    commands(): Array<ConsoleCommand> {
      return parliamentCommandsOf({
        view: this.view,
        canVoteNow: this.canVoteNow,
        partyActionStates: this.partyActionStates,
        sitting: {primary: this.sittingPrimary, inspect: this.sittingInspectable, back: this.sittingBack},
      });
    },
    /** X on the sitting inspects the enacted resolution — the object every stage is about. */
    sittingInspectable(): boolean {
      return this.model?.phase?.summary?.enacted !== undefined && !this.sittingField;
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
        // THE FIELD STANDS (post-flush — the zone is in the DOM now): the
        // hosted step's door. Published here, one tick after the pose, so the
        // shell's teleport never names a zone the pose has not opened yet.
        consoleParliamentUi.fieldStanding = on && parliamentFlow.stage === 'sitting';
        if (root === undefined) {
          return;
        }
        fitParliamentCards();
        if (on) {
          playParliamentEnactEnter({root, cardFrom});
        } else {
          playParliamentEnactFold({root, cardFrom});
        }
      });
    },
    sceneHandedOver(on: boolean): void {
      if (!on && parliamentFlow.stage === 'browse') {
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
    // The field already standing at mount is published from the mounted DOM
    // (the watcher above cannot fire for a value that never changed).
    consoleParliamentUi.fieldStanding = this.sittingField && parliamentFlow.stage === 'sitting';
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
      if (f.stage === 'submitting' || f.stage === 'landed' || f.stage === 'paying' || (f.stage === 'sitting' && this.sittingField)) {
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
      parliamentFlow.sittingPage = sittingStartPage(position, (stage) => sittingStagePlayed(key, stage));
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
      if (stage === 'enact') {
        return true;
      }
      if (stage === 'reward') {
        return sittingRewardSettled(position) && !this.rewardPending && !parliamentRewardState.receiptShowing;
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
          const key = this.sittingKey;
          const receipt = stage === 'reward' && parliamentRewardState.receiptShowing;
          if (!sittingStagePlayed(key, stage) || receipt || (stage === 'reward' && this.rewardPending)) {
            notePlayedSittingStage(key, stage);
            await playSittingStage(stage, this.sittingBeatList, ctx, {compact: false});
            if (receipt) {
              parliamentRewardState.receiptShowing = false;
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
    onStageEnter(el: Element, done: () => void): void {
      this.stageEntering = true;
      playStageUnfold(el as HTMLElement, this.stageFromRect, () => {
        this.stageEntering = false;
        done();
        if (parliamentFlow.stage === 'sitting') {
          this.queueWalk();
        }
      });
    },
    onStageLeave(el: Element, done: () => void): void {
      this.stageLeaving = true;
      playStageFold(el as HTMLElement, () => {
        this.stageLeaving = false;
        done();
      });
    },
    onStageEnterCancelled(el: Element): void {
      (el as HTMLElement).style.clipPath = '';
    },
    onStageLeaveCancelled(): void {
      this.stageLeaving = false;
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
