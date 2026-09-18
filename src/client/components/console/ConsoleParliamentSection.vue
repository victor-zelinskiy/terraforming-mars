<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux): ONE flow,
       one GAME SCREEN. Three instruments under one fixed head line (the
       GOVERNMENT · the VOTING AREA · the six PARTIES), the read-only AGENDA
       track, the DELEGATES ZONE at fixed coordinates in every mode; the VOTE
       MODE is a phase descent of this frame, a PARTY ACTION nests the action
       workspace (`parliament ⊃ card-actions`). THIS ROOT owns the stage
       machine (the shared flow record), the browse layer's grammar, the
       submit funnel and the crumb; every tier is its own component reading
       the same record. Nothing here re-derives a rule: availability is the
       PRESENCE of the server's option (its structural marker), the numbers
       are the server's projections, a submit is the byte-identical response.
       Anatomy and history: docs/TURMOIL_REDUX_PARLIAMENT_V6.md. -->
  <section class="con-parl con-ws"
           :class="{
             'con-parl--handed-over': sceneHandedOver,
             'con-parl--stage': stageUp,
             'con-parl--vote': voteUp,
             'con-parl--vote-leaving': flow.voteLeaving,
             'con-parl--flying': flightsAirborne,
             ['con-parl--zone-' + flow.zone]: true,
             ['con-parl--recap-' + recapHighlight]: flow.stage === 'recap' && recapHighlight !== '',
           }"
           ref="rootEl"
           role="region"
           :aria-label="$t('Parliament')"
           :data-zone="flow.zone"
           :data-stage="flow.stage">
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
    <div class="con-parl__field">
    <div class="con-parl__body">
      <!-- ══ TOP TIER: the GOVERNMENT · the VOTING AREA ══ -->
      <div class="con-parl__top">
        <ConsoleParliamentGovernment :view="view" :model="model" :players="playerView.players" :viewerColor="viewerColor"
                                     :agendaVm="agendaVm" :recapHighlight="recapHighlight" />
        <ConsoleParliamentVotingArea :view="view" :model="model" :viewerColor="viewerColor" :viewerParticipates="viewerParticipates"
                                     :benchWarn="benchWarn" :seatCandidates="seatCandidates" :recapHighlight="recapHighlight" />
      </div>

      <!-- ══ MIDDLE TIER — the PARTIES (browse) or a STAGE (the seat pick, the
           results) — ONE zone, one rect. ══ -->
      <div class="con-parl__mid" data-parl-mid data-parl-recede>
        <div class="con-parl__parties-tier" ref="partiesTierEl" :class="{'con-parl__parties-tier--parked': stageUp}" v-show="!stageUp || stageLeaving">
          <ConsoleParliamentParties :view="view" :partyStates="partyStates" :partyActionStates="partyActionStates" :viewerColor="viewerColor"
                                    :awaitingInput="awaitingInput" :recapHighlight="recapHighlight" :recapParties="recapItem?.parties ?? []" />
        </div>

        <!-- ── THE STAGE ZONE — the chairman SEAT pick and the RESULTS scene
             unfold in place of the parties tier. ── -->
        <transition :css="false" @enter="onStageEnter" @leave="onStageLeave" @enter-cancelled="onStageEnterCancelled" @leave-cancelled="onStageLeaveCancelled">
          <div v-if="stageUp" class="con-parl__stage" :class="'con-parl__stage--' + flow.stage" :data-parl-stage="flow.stage">
            <ConsoleParliamentSeatPick v-if="stageKind === 'seat' && focusedSlot !== undefined" ref="seatPick"
                                       :view="view" :slot="focusedSlot" :viewerColor="viewerColor" :seatCandidates="seatCandidates"
                                       @submit="submitSeat($event)" @inspect="$emit('inspect', $event)" />
            <ConsoleParliamentRecap v-else-if="flow.stage === 'recap'" ref="recap"
                                    :view="view" :model="model" :playerView="playerView" :viewerColor="viewerColor"
                                    @beat="onRecapBeat($event)" @close="closeStage()" />
            <!-- SUBMITTING (the seat) — the executing beat: sent, nothing to undo. -->
            <template v-else-if="flow.stage === 'submitting'">
              <div class="con-parl__stage-head">
                <div><b class="con-parl__stage-title">{{ $t('Recording your decision…') }}</b></div>
              </div>
            </template>
            <div class="con-parl__embed" data-embed-slot="parliament"></div>
          </div>
        </transition>
      </div>

      <ConsoleParliamentAgenda ref="agenda" :view="view" :model="model" :agendaVm="agendaVm" :viewerParticipates="viewerParticipates"
                               :recapHighlight="recapHighlight" :recapStep="recapItem?.step" :handedOver="sceneHandedOver" />
    </div>

    <ConsoleParliamentVoteMode ref="voteMode"
                               :view="view" :model="model" :playerView="playerView" :viewerColor="viewerColor" :viewerParticipates="viewerParticipates"
                               :awaitingInput="awaitingInput" :bridge="bridge" :voteTile="voteTile" :winningSlot="winningSlot"
                               :benchSource="benchSource" :benchWarn="benchWarn" :canActNow="canActNow" :canVoteNow="canVoteNow"
                               @notice="$emit('notice', $event)" @inspect="$emit('inspect', $event)"
                               @send="send($event.response, $event.from)" @flow-complete="$emit('flow-complete', $event)" />

    <ConsoleParliamentEnact :view="view" :model="model" :viewerColor="viewerColor" :prompt="enactPrompt" />
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
import {externalDrawTakeOf} from '@/client/console/externalDraw/consoleExternalDraw';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleParliamentSeats from '@/client/components/console/parliament/ConsoleParliamentSeats.vue';
import ConsoleParliamentGovernment from '@/client/components/console/parliament/ConsoleParliamentGovernment.vue';
import ConsoleParliamentVotingArea from '@/client/components/console/parliament/ConsoleParliamentVotingArea.vue';
import ConsoleParliamentParties from '@/client/components/console/parliament/ConsoleParliamentParties.vue';
import ConsoleParliamentAgenda from '@/client/components/console/parliament/ConsoleParliamentAgenda.vue';
import ConsoleParliamentVoteMode from '@/client/components/console/parliament/ConsoleParliamentVoteMode.vue';
import ConsoleParliamentSeatPick from '@/client/components/console/parliament/ConsoleParliamentSeatPick.vue';
import ConsoleParliamentRecap, {RecapItem} from '@/client/components/console/parliament/ConsoleParliamentRecap.vue';
import ConsoleParliamentEnact from '@/client/components/console/parliament/ConsoleParliamentEnact.vue';
import ConsoleParliamentFlights from '@/client/components/console/parliament/ConsoleParliamentFlights.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {isMandatoryGateHeld} from '@/client/console/consoleMandatoryGate';
import {
  agendaViewOf, AgendaVm, buildParliamentView, emptyParliamentView, ParliamentPartyVm, ParliamentPromptBridge, ParliamentSlotVm, ParliamentTileVm,
  ParliamentViewVm, parliamentPromptBridge, partyActionStateOf, PartyActionStateVm, partyStateOf, PartyStateVm, seatResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import {
  consoleParliamentUi, markParliamentRecapSeen, parliamentCrumbCommitted, parliamentCrumbStage, parliamentCrumbSubject, ParliamentStage,
  parliamentFlow, parliamentRecapSeen, parliamentStageKind, parliamentStageUp, parliamentVoteUp, pulseParliamentChair, resetParliamentFlow,
  setParliamentRootEl,
} from '@/client/console/parliament/consoleParliamentFlow';
import {resetParliamentHolds, seedRecapHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {flySeatDelegate, killParliamentFlights, parliamentFlightsAirborne} from '@/client/console/parliament/parliamentFlights';
import {fitParliamentCards} from '@/client/console/parliament/parliamentCardFit';
import {parliamentCommandsOf} from '@/client/console/parliament/parliamentCommands';
import {
  armPartyActionDescent, navigateParliamentZones, parliamentBrowseInspectRequest, partyActionRefusal,
} from '@/client/console/parliament/parliamentNavigation';
import {BenchSource, benchSourceOf, benchWarnOf} from '@/client/console/parliament/parliamentVoteView';
import {setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {translateText} from '@/client/directives/i18n';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {useResizeObserver} from '@vueuse/core';
import {playStageFold, playStageUnfold} from '@/client/console/parliament/parliamentStageMotion';
import {killParliamentVoteMotion, Rect} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {
  enactCarryRect, killParliamentEnactMotion, parkParliamentForEnact, playParliamentEnactEnter, playParliamentEnactFold,
} from '@/client/console/parliament/consoleParliamentEnactMotion';

/** How long a submit may stay unanswered before the stage gives the player back their hands. */
const SUBMIT_SAFETY_MS = 6000;

export default defineComponent({
  name: 'ConsoleParliamentSection',
  components: {
    ConsoleWsHead, ConsoleParliamentSeats, ConsoleParliamentGovernment, ConsoleParliamentVotingArea, ConsoleParliamentParties,
    ConsoleParliamentAgenda, ConsoleParliamentVoteMode, ConsoleParliamentSeatPick, ConsoleParliamentRecap, ConsoleParliamentEnact, ConsoleParliamentFlights,
  },
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
  },
  emits: ['close', 'submit', 'notice', 'inspect', 'open-action', 'flow-complete', 'collapse'],
  data() {
    return {
      /** The seat / recap stage is folding back — its DOM stays for the leave beat. */
      stageLeaving: false,
      submitTimer: undefined as number | undefined,
      /** The server's answer key at the submit — the answer is whatever changes it. */
      submittedKey: '',
      stopFitObs: undefined as (() => void) | undefined,
      /** The chairman-seat pick: the cube's rect on the card at the submit (the flight's source). */
      seatFrom: undefined as Rect | undefined,
      /** The results scene's current beat — the object it lights (handed up by the scene). */
      recapItem: undefined as RecapItem | undefined,
      /** The parties tier's rect at the press — the seat / recap stage unfolds from it. */
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
    /**
     * THE ENACTED RESOLUTION'S LIVE ASK for this seat — its payout's recipient
     * pick, by the server's own markers (a `resolution` source on a card pick
     * while the political phase pays its effects), never a title. An ANNOUNCED
     * prompt whose plate still waits for the player's A (the mandatory gate
     * holds it) keeps the stage down: a Parliament the player walked into on
     * their own shows its overview, never a payout stage whose picker is not
     * allowed to stand yet.
     */
    enactPrompt(): PlayerInputModel | undefined {
      const wf = this.playerView.waitingFor;
      if (wf === undefined || wf.type !== 'card' || this.model?.phase?.step !== 'effects' || isMandatoryGateHeld()) {
        return undefined;
      }
      return wf.choiceContext?.source?.kind === 'resolution' ? wf : undefined;
    },
    enactStanding(): boolean {
      return this.enactPrompt !== undefined;
    },
    /** The live ask is the mandatory TAKE of the cards the resolution drew (the server's `externalDrawPrompt` marker — never a title): the stage names itself «Получение». */
    enactDrawStanding(): boolean {
      return externalDrawTakeOf(this.enactPrompt) !== undefined;
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
    /** The results scene's focus — the object its current beat lights ('' outside the scene). */
    recapHighlight(): RecapItem['focus'] | '' {
      return parliamentFlow.stage === 'recap' ? (this.recapItem?.focus ?? '') : '';
    },
    crumbSubject(): string {
      return parliamentCrumbSubject();
    },
    crumbStage(): string {
      return parliamentCrumbStage(this.enactDrawStanding);
    },
    crumbCommitted(): boolean {
      return parliamentCrumbCommitted();
    },
    /** THE ONE COMMAND CONTRACT — published to the shell's bar. */
    commands(): Array<ConsoleCommand> {
      return parliamentCommandsOf({view: this.view, canVoteNow: this.canVoteNow, partyActionStates: this.partyActionStates});
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
    /** The ENACTMENT stage's zone — published on the same terms (the picker teleports into it only once it is in the DOM). */
    'flow.stage': {
      immediate: true,
      flush: 'post',
      handler(stage: ParliamentStage): void {
        consoleParliamentUi.enactStanding = stage === 'enact';
      },
    },
    /**
     * THE ENACTMENT: the enacted resolution asks this seat where its payout
     * goes — the stage unfolds around the shared picker; the answer (the
     * prompt moves on) ends the flow, which LEAVES (the winner's ocean is the
     * board's own scene, the rest of the phase the others' business).
     */
    'enactStanding': {
      immediate: true,
      handler(on: boolean): void {
        if (on && parliamentFlow.stage === 'browse') {
          this.openEnact();
        } else if (!on && parliamentFlow.stage === 'enact') {
          this.concludeEnact();
        }
      },
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
    /** The server answered: the stage it committed is over — a vote LANDS first, a paid vote PAYS first. */
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
    // browse layer. BEFORE the watchers: an `immediate` one (the enactment, a
    // standing chairman-seat pick) opens its stage at setup, exactly as it did
    // over the old `data()` — a reset in `created()` ran after them and wiped
    // the stage they had just opened.
    resetParliamentFlow();
    resetParliamentHolds();
  },
  mounted() {
    setParliamentRootEl(this.$refs.rootEl as HTMLElement | undefined);
    if (parliamentFlow.stage === 'enact') {
      parkParliamentForEnact(this.$refs.rootEl as HTMLElement | undefined);
    }
    fitParliamentCards();
    const field = (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-parl__field');
    if (field !== null && field !== undefined) {
      this.stopFitObs = useResizeObserver(field, () => fitParliamentCards()).stop;
    }
    this.maybeOpenRecap();
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.clearSubmitTimer();
    killParliamentFlights();
    killParliamentVoteMotion(this.$refs.rootEl as HTMLElement | undefined);
    killParliamentEnactMotion(this.$refs.rootEl as HTMLElement | undefined);
    consoleParliamentUi.commands = [];
    consoleParliamentUi.voteStanding = false;
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
    // ── input ──────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      const f = parliamentFlow;
      // The hosted picker owns the pad in the enactment stage (the shell routes to it first).
      if (f.stage === 'submitting' || f.stage === 'landed' || f.stage === 'paying' || f.stage === 'enact') {
        return;
      }
      if (f.stage === 'recap') {
        const action = consoleActionOf(intent);
        if (action === 'primary' || action === 'back') {
          (this.$refs.recap as InstanceType<typeof ConsoleParliamentRecap> | undefined)?.finish();
        }
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
    /** The stages' own verbs: B folds the vote / collapses the seat; everything else is the stage's. */
    handleStageIntent(intent: GamepadIntent): void {
      const f = parliamentFlow;
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
    // ── the seat / recap stage phrase ──────────────────────────────────
    openStage(stage: ParliamentStage): void {
      const tier = this.$refs.partiesTierEl as HTMLElement | undefined;
      const rect = tier?.getBoundingClientRect();
      this.stageFromRect = rect !== undefined && rect.width > 0 ? {left: rect.left, top: rect.top, width: rect.width, height: rect.height} : undefined;
      parliamentFlow.stage = stage;
      setWorkspaceFramePhase('parliament', 'configure');
    },
    /**
     * OPEN THE PAYOUT — the enacted resolution asks this seat where its share
     * goes. The card's government rect is read BEFORE the teleport moves it
     * (the FLIP's origin); at setup time (a reload, a restore) there is no DOM
     * yet and `mounted()` parks the overview instead — no entrance to play.
     */
    openEnact(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const cardFrom = enactCarryRect(root);
      parliamentFlow.zone = 'government';
      parliamentFlow.stage = 'enact';
      setWorkspaceFramePhase('parliament', 'committed');
      if (root === undefined) {
        return;
      }
      void this.$nextTick(() => {
        fitParliamentCards();
        playParliamentEnactEnter({root, cardFrom});
      });
    },
    /**
     * THE ANSWER IS IN. A finished payout LEAVES with its stage standing (one
     * motion with the workspace); only a flow that could not conclude — the
     * Parliament frame still known a tick later — folds back to the overview,
     * the card FLIPping home from the hero slot.
     */
    concludeEnact(): void {
      this.$emit('flow-complete', 'enact');
      void this.$nextTick(() => {
        if (parliamentFlow.stage !== 'enact' || this.enactStanding || !workspaceFrameKnown('parliament')) {
          return;
        }
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const cardFrom = enactCarryRect(root);
        this.closeStage();
        if (root === undefined) {
          return;
        }
        void this.$nextTick(() => {
          fitParliamentCards();
          playParliamentEnactFold({root, cardFrom});
        });
      });
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
    /** The results scene handed its beat up: the tiers light the object it names, the Agenda beat glides the marker. */
    onRecapBeat(item: RecapItem | undefined): void {
      this.recapItem = item;
      if (item?.move !== undefined) {
        void (this.$refs.agenda as InstanceType<typeof ConsoleParliamentAgenda> | undefined)?.playAgendaGlide(item.move);
      }
    },
    /**
     * THE RESULTS SCENE opens ONCE per generation on the overview: the holds
     * are seeded BEFORE the stage unfolds (its first frame already shows the
     * table as it stood), then the scene runs its beats on its own clock.
     */
    maybeOpenRecap(): void {
      const last = this.model?.lastPhase;
      if (last === undefined || last.generation !== this.playerView.game.generation - 1 || parliamentFlow.stage !== 'browse' || this.bridge.seat !== undefined) {
        return;
      }
      const key = `${this.playerView.id}:${last.generation}`;
      if (parliamentRecapSeen(key)) {
        return;
      }
      markParliamentRecapSeen(key);
      seedRecapHolds(this.model, this.view.slots, this.view.enacted?.instance);
      this.recapItem = undefined;
      this.openStage('recap');
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
        } else {
          this.closeStage();
        }
        return;
      }
      parliamentFlow.stageBeforeSubmit = from;
      this.submittedKey = this.answerKey;
      parliamentFlow.stage = 'submitting';
      setWorkspaceFramePhase('parliament', 'committed');
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
        setWorkspaceFramePhase('parliament', f.stage === 'browse' ? 'browse' : 'configure');
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
