<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux): ONE flow,
       one GAME SCREEN. Three instruments under one fixed head line (the
       GOVERNMENT · the VOTING AREA · the six PARTIES), the read-only AGENDA
       track, the DELEGATES ZONE at fixed coordinates in every mode; the VOTE
       MODE is a phase descent of this frame, a PARTY ACTION nests the action
       workspace (`parliament ⊃ card-actions`), and the SITTING — the political
       phase's own flow («ЗАСЕДАНИЕ») — stands on the middle tier's stage
       chassis, its stage the SERVER's step. THIS ROOT owns the stage machine
       (the shared flow record), the browse layer's grammar, the submit funnel
       and the crumb; every tier is its own component reading the same record.
       Nothing here re-derives a rule: availability is the PRESENCE of the
       server's option (its structural marker), the numbers are the server's
       projections, a submit is the byte-identical response.
       Anatomy and history: docs/TURMOIL_REDUX_PARLIAMENT_V6.md; the sitting:
       docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md. -->
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
           :data-sitting-stage="sittingUp ? sittingStage : undefined">
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
        <ConsoleParliamentGovernment :view="view" :model="model" :players="playerView.players" :viewerColor="viewerColor"
                                     :agendaVm="agendaVm" :sittingStage="sittingUp ? sittingStage : ''" />
        <ConsoleParliamentVotingArea :view="view" :model="model" :viewerColor="viewerColor" :viewerParticipates="viewerParticipates"
                                     :benchWarn="benchWarn" :seatCandidates="seatCandidates" :sittingStage="sittingUp ? sittingStage : ''" />
      </div>

      <!-- ══ MIDDLE TIER — the PARTIES (browse) or a STAGE (the seat pick, the
           SITTING) — ONE zone, one rect; the sitting's reward stage may take
           the whole field for a hosted step (`--field`). ══ -->
      <div class="con-parl__mid" data-parl-mid data-parl-recede ref="midEl">
        <div class="con-parl__parties-tier" ref="partiesTierEl" :class="{'con-parl__parties-tier--parked': stageUp}" v-show="!stageUp || stageLeaving">
          <ConsoleParliamentParties :view="view" :partyStates="partyStates" :partyActionStates="partyActionStates" :viewerColor="viewerColor"
                                    :awaitingInput="awaitingInput" :sittingParties="sittingParties" />
        </div>

        <!-- ── THE STAGE ZONE — the chairman SEAT pick and the SITTING unfold in
             place of the parties tier (one chassis). ── -->
        <transition :css="false" @enter="onStageEnter" @leave="onStageLeave" @enter-cancelled="onStageEnterCancelled" @leave-cancelled="onStageLeaveCancelled">
          <div v-if="stageUp" class="con-parl__stage" :class="['con-parl__stage--' + stageKind, {'con-parl__stage--field': flow.sittingField}]" :data-parl-stage="stageKind">
            <ConsoleParliamentSeatPick v-if="stageKind === 'seat' && focusedSlot !== undefined" ref="seatPick"
                                       :view="view" :slot="focusedSlot" :viewerColor="viewerColor" :seatCandidates="seatCandidates"
                                       @submit="submitSeat($event)" @inspect="$emit('inspect', $event)" />
            <ConsoleParliamentSitting v-else-if="stageKind === 'sitting' && sitting !== undefined" ref="sitting"
                                      :position="sitting" :stage="sittingStage" :summary="model?.phase?.summary"
                                      :view="view" :model="model" :playerView="playerView" :viewerColor="viewerColor"
                                      :field="flow.sittingField" mode="live" />
            <div class="con-parl__embed" data-embed-slot="parliament"></div>
          </div>
        </transition>
      </div>

      <ConsoleParliamentAgenda ref="agenda" :view="view" :model="model" :agendaVm="agendaVm" :viewerParticipates="viewerParticipates"
                               :sittingStep="sittingStep" :handedOver="sceneHandedOver" />
    </div>

    <ConsoleParliamentVoteMode ref="voteMode"
                               :view="view" :model="model" :playerView="playerView" :viewerColor="viewerColor" :viewerParticipates="viewerParticipates"
                               :awaitingInput="awaitingInput" :bridge="bridge" :voteTile="voteTile" :winningSlot="winningSlot"
                               :benchSource="benchSource" :benchWarn="benchWarn" :canActNow="canActNow" :canVoteNow="canVoteNow"
                               @notice="$emit('notice', $event)" @inspect="$emit('inspect', $event)"
                               @send="send($event.response, $event.from)" @flow-complete="$emit('flow-complete', $event)" />
    </div>

    <ConsoleParliamentFlights />
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
import ConsoleParliamentFlights from '@/client/components/console/parliament/ConsoleParliamentFlights.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {backLabelForVerb, backVerbFor} from '@/client/console/consoleWorkspaceFlow';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {
  agendaViewOf, AgendaVm, buildParliamentView, emptyParliamentView, ParliamentPartyVm, ParliamentPromptBridge, ParliamentSlotVm, ParliamentTileVm,
  ParliamentViewVm, parliamentPromptBridge, partyActionStateOf, PartyActionStateVm, partyStateOf, PartyStateVm, seatResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import {
  consoleParliamentUi, parliamentCrumbCommitted, parliamentCrumbStage, parliamentCrumbSubject, ParliamentStage,
  parliamentFlow, parliamentSittingUp, parliamentStageKind, parliamentStageUp, parliamentVoteUp, pulseParliamentChair, resetParliamentFlow,
  setParliamentRootEl,
} from '@/client/console/parliament/consoleParliamentFlow';
import {
  sittingAtLastPage, sittingPositionOf, SittingPosition, sittingPrimaryKey, sittingRewardComing, SittingStage, sittingStageAt, sittingStageKey,
  sittingStartPage, sittingWorkspacePhase,
} from '@/client/console/parliament/consoleSittingFlow';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {flySeatDelegate, killParliamentFlights, parliamentFlightsAirborne} from '@/client/console/parliament/parliamentFlights';
import {fitParliamentCards} from '@/client/console/parliament/parliamentCardFit';
import {parliamentCommandsOf} from '@/client/console/parliament/parliamentCommands';
import {ParliamentInspectRequest} from '@/client/console/parliament/parliamentInspect';
import {
  armPartyActionDescent, navigateParliamentZones, parliamentBrowseInspectRequest, partyActionRefusal,
} from '@/client/console/parliament/parliamentNavigation';
import {BenchSource, benchSourceOf, benchWarnOf} from '@/client/console/parliament/parliamentVoteView';
import {setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested} from '@/client/console/consoleWorkspaceStack';
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
    ConsoleParliamentAgenda, ConsoleParliamentVoteMode, ConsoleParliamentSeatPick, ConsoleParliamentSitting, ConsoleParliamentFlights,
  },
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
  },
  emits: ['close', 'submit', 'notice', 'inspect', 'open-action', 'flow-complete', 'collapse'],
  data() {
    return {
      /** The seat / sitting stage is folding back — its DOM stays for the leave beat. */
      stageLeaving: false,
      submitTimer: undefined as number | undefined,
      /** The server's answer key at the submit — the answer is whatever changes it. */
      submittedKey: '',
      stopFitObs: undefined as (() => void) | undefined,
      /** The chairman-seat pick: the cube's rect on the card at the submit (the flight's source). */
      seatFrom: undefined as Rect | undefined,
      /** The parties tier's rect at the press — the seat / sitting stage unfolds from it. */
      stageFromRect: undefined as Rect | undefined,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    flightsAirborne(): boolean {
      return parliamentFlightsAirborne();
    },
    model(): ParliamentModel | undefined {
      return this.playerView.game.parliament;
    },
    viewerColor(): Color | undefined {
      return this.playerView.thisPlayer?.color;
    },
    viewerParticipates(): boolean {
      return this.view.viewer?.participates === true;
    },
    view(): ParliamentViewVm {
      const model = this.model;
      return model === undefined ? emptyParliamentView() : buildParliamentView(model, this.viewerColor, this.playerView.players);
    },
    bridge(): ParliamentPromptBridge {
      return parliamentPromptBridge(this.playerView.waitingFor);
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
    // ── the SITTING (the political phase's own flow) ───────────────────
    /**
     * WHERE THE SITTING STANDS — the server's step, the viewer's own gate
     * prompt, the seats still awaited, the seat's own ask (a pick / a take /
     * a tile) or the wait for another's; undefined outside a live political
     * phase the viewer takes part in. Every stage below derives from it.
     */
    sitting(): SittingPosition | undefined {
      return sittingPositionOf(this.model, this.playerView.waitingFor, this.viewerColor);
    },
    /** The sitting's server step — its change resets the local page cursor. */
    sittingStepKey(): string {
      const p = this.sitting;
      return p === undefined ? '' : `${p.generation}:${p.step}`;
    },
    /** The stage on screen: the position's pages under the local cursor. */
    sittingStage(): SittingStage {
      const p = this.sitting;
      return p === undefined ? 'verdict' : sittingStageAt(p, parliamentFlow.sittingPage);
    },
    /** The reward stage HOLDS THE FIELD while a hosted step (the pick, the take) stands in its zone. */
    sittingField(): boolean {
      const p = this.sitting;
      return this.sittingUp && p !== undefined && this.sittingStage === 'reward' && (p.rewardStep === 'choice' || p.rewardStep === 'intake');
    },
    /** The crumb's tail for the sitting's stage (`sittingStageKey`). */
    sittingTail(): string {
      const p = this.sitting;
      return p === undefined ? '' : sittingStageKey(this.sittingStage, p.rewardStep);
    },
    /** The parties the sitting's stage lights: the enactment lights the ruling party, the renewal the parties whose support grew. */
    sittingParties(): Array<ReduxParty> {
      const summary = this.model?.phase?.summary;
      if (!this.sittingUp || summary === undefined) {
        return [];
      }
      switch (this.sittingStage) {
      case 'enact': return [summary.enacted.party];
      case 'renewal': return summary.support.filter((s) => s.gained > 0).map((s) => s.party);
      default: return [];
      }
    },
    /** The Agenda step the enactment page lights — the winner's new position. */
    sittingStep(): number | undefined {
      const summary = this.model?.phase?.summary;
      return this.sittingUp && this.sittingStage === 'enact' ? summary?.agenda?.to : undefined;
    },
    /** IS SOMETHING COMING FOR THIS SEAT — the assembly's A verb («К награде») reads it. */
    sittingRewardComing(): boolean {
      const id = this.model?.phase?.summary?.enacted.resolution;
      return sittingRewardComing(this.model, this.viewerColor, id === undefined ? undefined : getResolution(id));
    },
    /** The sitting's A verb (undefined = A does nothing here). */
    sittingPrimary(): string | undefined {
      const p = this.sitting;
      if (p === undefined || this.sittingField) {
        return undefined;
      }
      return sittingPrimaryKey(p, parliamentFlow.sittingPage, {rewardComing: this.sittingRewardComing});
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
      return this.view.parties[parliamentFlow.partyIndex];
    },
    voteTile(): ParliamentTileVm | undefined {
      return this.view.tiles.find((t) => t.id === 'vote');
    },
    /** The bench's marked source: the place the next delegate leaves, or none when there is nothing to send. */
    benchSource(): BenchSource {
      return benchSourceOf(this.view, parliamentFlow.voteSnapshot);
    },
    benchWarn(): boolean {
      return benchWarnOf(this.benchSource, this.voteTile, this.playerView.thisPlayer?.megacredits ?? 0);
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
      return `${this.playerView.game.gameAge}|${promptIdentityKey(this.playerView.waitingFor)}`;
    },
  },
  watch: {
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
            parliamentFlow.sittingPage = sittingStartPage(position);
            this.openStage('sitting');
          }
          if (parliamentFlow.stage === 'sitting') {
            setWorkspaceFramePhase('parliament', sittingWorkspacePhase(this.sittingStage, false));
          }
        } else if (parliamentFlow.stage === 'sitting') {
          this.closeStage();
          this.$emit('flow-complete', 'sitting');
        }
      },
    },
    /** A new server step starts its walk on its first page (a gate this seat already answered: on its wait pose); the phase follows the page. */
    'sittingStepKey'(): void {
      const position = this.sitting;
      parliamentFlow.sittingPage = position === undefined ? 0 : sittingStartPage(position);
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
      if (root === undefined) {
        return;
      }
      void this.$nextTick(() => {
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
    /** The server answered: the stage it committed is over — a vote LANDS first, a paid vote PAYS first, a gate answer stays on its stage. */
    answerKey(key: string): void {
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
          // re-derives (the wait pose, the effects, the renewal) and the
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
    // the stage they had just opened.
    resetParliamentFlow();
    resetParliamentHolds();
  },
  mounted() {
    setParliamentRootEl(this.$refs.rootEl as HTMLElement | undefined);
    // A sitting already holding the field at mount (a reload, a restore) has
    // no entrance to play — the overview is parked at once.
    parliamentFlow.sittingField = this.sittingField;
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
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.clearSubmitTimer();
    killParliamentFlights();
    killParliamentVoteMotion(this.$refs.rootEl as HTMLElement | undefined);
    killParliamentEnactMotion(this.$refs.rootEl as HTMLElement | undefined);
    consoleParliamentUi.commands = [];
    consoleParliamentUi.voteStanding = false;
    consoleParliamentUi.stageStanding = false;
    setWorkspaceFrameSubject('parliament', '');
    setWorkspaceFrameStage('parliament', '');
  },
  unmounted() {
    setParliamentRootEl(undefined);
    resetParliamentFlow();
    resetParliamentHolds();
  },
  methods: {
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
      case 'parties': {
        const party = this.focusedParty;
        const state = this.partyActionStates[parliamentFlow.partyIndex];
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
     * THE SITTING'S GRAMMAR: A turns the page, and on a step's last page
     * ANSWERS THE GATE (never before, never automatically); X inspects the
     * enacted resolution; B obeys the workspace phase — «свернуть» past the
     * commit (the whole stack parks, the board-home card restores this very
     * stage), nothing on the terminal closing page.
     */
    handleSittingIntent(intent: GamepadIntent): void {
      const position = this.sitting;
      if (position === undefined) {
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        if (this.sittingPrimary === undefined) {
          return;
        }
        if (!sittingAtLastPage(position, parliamentFlow.sittingPage)) {
          parliamentFlow.sittingPage += 1;
          return;
        }
        if (position.gateStanding) {
          this.send({type: 'option'}, 'sitting');
        }
        return;
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
      parliamentFlow.stage = 'browse';
      setWorkspaceFramePhase('parliament', 'browse');
    },
    onStageEnter(el: Element, done: () => void): void {
      playStageUnfold(el as HTMLElement, this.stageFromRect, done);
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
