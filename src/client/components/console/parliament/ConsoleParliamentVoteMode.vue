<template>
  <!-- ══ THE VOTE MODE — the frame's PHASE DESCENT, as a layer over the body.
       Always mounted (it is the teleport target of the three slots — a target
       that exists before the slots do); visible while the mode stands. The
       head line above (crumb + delegates zone) does not move. ══ -->
  <div class="con-parl__vote"
       :class="{
         'con-parl__vote--up': voteUp || flow.voteLeaving,
         'con-parl__vote--committed': voteCommitted,
         'con-parl__vote--landed': flow.stage === 'landed',
         'con-parl__vote--paying': flow.stage === 'paying',
         'con-parl__vote--bill': billGeometry,
         'con-parl__vote--concluded': flow.concluded,
         'con-parl__vote--entering': flow.voteEntering,
       }"
       :style="{'--parl-accent': voteSlot !== undefined ? partyAccent(voteSlot.party) : undefined}"
       :aria-hidden="voteUp ? undefined : 'true'"
       :data-parl-vote-source-kind="voteSource"
       data-parl-vote>
    <!-- THE CARD ROW — the slots stand here while the mode is up (fewer
         than three stand centred at their usual size). -->
    <div class="con-parl__vrow" data-parl-vrow :style="{'--con-parl-slot-count': String(Math.max(1, view.slots.length))}"></div>

    <!-- THE INFO SURFACE — ONE NUMBER (`voteInfoModel.ts`): what the
         SELECTED card gives the viewer if enacted (left) and what THIS vote
         changes (right). Fixed geometry: the bodies crossfade in place when
         the selection moves; nothing above them ever reflows. Every sentence
         and every «if» lives in the fullscreen inspector (X), never here. -->
    <div class="con-parl__info" data-parl-vote-surface>
      <div class="con-parl__info-res">
        <transition name="con-parl-xfade">
          <!-- Always MOUNTED (the layer hides it): the press that opens the mode
               then moves the cards and lifts the surface — it builds nothing. -->
          <div v-if="voteInfo !== undefined" :key="voteInfo.instance" class="con-parl__info-body" data-parl-vote-body>
            <div class="con-parl__info-head" data-parl-vote-item>
              <img class="con-parl__info-emblem" :src="emblemUrl(voteInfo.party)" alt="" />
              <b class="con-parl__info-name">{{ $t(voteInfo.name) }}</b>
            </div>
            <!-- THE READING — the card's printed graphic as the formula, the
                 viewer's ONE number beside it (the estimate by the current
                 influence; what the win adds rides it as a suffix), and the
                 ruling party's answer to that number. A viewer without a
                 seat reads the graphic alone. -->
            <!-- THE READING and, beside it, THE PARTY the card brings to power:
                 its emblem, its printed formula and one line of moment («эффект
                 партии · всем при принятии») — a graphic, never a sentence
                 (registry example 4: the reading stood alone in a half-empty
                 plate; the words are the inspector's). -->
            <div class="con-parl__info-main">
              <div class="con-parl__info-own" :class="{'con-parl__info-own--yields': voteInfo.reading.yields.length > 0}" data-parl-vote-item data-parl-info="own">
                <span class="con-parl__info-kicker" data-parl-kicker="reading" data-parl-vote-late>{{ $t(voteInfo.reading.kicker) }}</span>
                <div class="con-parl__info-own-body">
                  <PremiumMechanicsPanel v-if="ownMechanics !== undefined" class="con-parl__info-mech" :mechanics="ownMechanics" />
                  <div v-if="voteInfo.reading.yields.length > 0" class="con-parl__info-readings" data-parl-vote-late>
                    <ConsoleInfluenceYield class="con-parl__info-yield"
                                           :yields="voteInfo.reading.yields"
                                           :suffixes="voteInfo.reading.suffixes"
                                           :formula="false"
                                           :captions="false"
                                           :oneNumber="true"
                                           :note="voteInfo.reading.note"
                                           size="compact"
                                           data-parl-vote-yield
                                           data-parl-vote-reading />
                    <ConsolePartyReaction v-for="r in voteInfo.reading.reactions" :key="r.reaction.id"
                                          class="con-parl__info-reaction"
                                          :reading="r"
                                          :withCaption="false"
                                          size="compact"
                                          data-parl-vote-reaction />
                  </div>
                </div>
              </div>
              <div class="con-parl__info-party" data-parl-vote-item data-parl-info="party-effect" :data-party="voteInfo.party">
                <ConsolePartyFormula class="con-parl__info-party-formula" :party="voteInfo.party" :emblem="true" size="compact" />
                <span class="con-parl__info-party-when" data-parl-vote-late>{{ $t(partyMoment) }}</span>
              </div>
            </div>
          </div>
        </transition>
      </div>
      <div class="con-parl__info-vote">
        <div class="con-parl__info-vote-main" v-show="flow.stage !== 'paying'">
          <transition name="con-parl-xfade">
            <div v-if="voteInfo !== undefined" :key="voteInfo.instance" class="con-parl__info-body con-parl__info-body--vote">
              <!-- YOUR VOTE — ONE block: the delegate at its place with its
                   source and price (only when there is one to send — a
                   missing delegate is the confirm's one reason, never said
                   twice), then this vote's consequences as current →
                   projected (a fact that does not change is ONE value): the
                   leader, the winning state, and the party effect only on
                   the edge this delegate crosses. The count is the ribbon
                   under the card; every note is the inspector's. -->
              <div class="con-parl__info-block con-parl__info-block--after" :class="{'con-parl__info-block--done': flow.stage === 'landed'}" data-parl-vote-item data-parl-vote-forecast>
                <div class="con-parl__info-src" :class="{'con-parl__info-src--none': voteInfo.vote.source === 'none'}" data-parl-vote-source>
                  <span class="con-parl__info-kicker con-parl__info-kicker--inline" data-parl-kicker="vote" data-parl-vote-late>{{ $t(voteInfo.vote.kicker) }}</span>
                  <template v-if="voteInfo.vote.source !== 'none'">
                    <span class="con-parl__socket con-parl__socket--small">
                      <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" :glow="false" />
                    </span>
                    <span class="con-parl__info-src-text" data-parl-vote-late>
                      <template v-if="voteInfo.vote.source === 'lobby'">{{ $t('from the lobby · free') }}</template>
                      <template v-else>
                        <span>{{ $t('from the reserve') }}</span>
                        <span class="con-parl__info-src-sep" aria-hidden="true">·</span>
                        <b class="con-parl__info-src-num">{{ voteInfo.vote.cost }}</b>
                        <i class="con-parl__info-src-mc resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                      </template>
                    </span>
                  </template>
                </div>
                <!-- The SHARED fact row (ConsoleVoteFactRow) — the same markup the fullscreen inspector's footer prints. -->
                <div class="con-parl__facts">
                  <ConsoleVoteFactRow v-for="fact in voteInfo.vote.facts" :key="fact.id" :fact="fact" :cubePx="cubePx(11)" data-parl-vote-late />
                </div>
              </div>
            </div>
          </transition>
        </div>
        <!-- A paid vote's PAYMENT stands here, inside the mode. -->
        <div class="con-parl__embed" data-embed-slot="parliament-vote"></div>
        <!-- THE CONFIRM — the verb and, beside it, the delegate's SOURCE and
             PRICE (the lobby's is free; the reserve's costs the server's own
             M€), read from the same vote option the submit answers. Blocked,
             the plate carries the ONE reason. -->
        <div class="con-parl__cta"
             :class="{
               'con-parl__cta--ready': canVoteNow && flow.stage === 'vote',
               'con-parl__cta--blocked': !canVoteNow && flow.stage === 'vote',
               'con-parl__cta--busy': flow.stage === 'submitting' || flow.stage === 'paying' || (flow.stage === 'landed' && voteInFlight),
               'con-parl__cta--done': flow.stage === 'landed' && !voteInFlight,
             }"
             data-parl-vote-item data-parl-cta @click="submitVote()">
          <GamepadGlyph v-if="flow.stage === 'vote' && canVoteNow" control="confirm" class="con-parl__cta-glyph" />
          <!-- The verb alone (R-14): the delegate's source and price are the «ВАШ ГОЛОС» row's, said once —
               the tail here doubled them and wrapped the plate onto two lines on the TV. The cost stays
               readable to probes on the plate's own attribute. -->
          <span class="con-parl__cta-label">{{ ctaText }}</span>
          <span v-if="flow.stage === 'vote' && canVoteNow && ctaCost.kind !== 'none'" class="con-parl__cta-cost con-parl__cta-cost--silent" data-parl-cta-cost :data-cost-kind="ctaCost.kind" :data-cost-amount="ctaCost.kind === 'free' ? 0 : ctaCost.amount" aria-hidden="true"></span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {SelectPaymentModel, VotePaymentMeta} from '@/common/models/PlayerInputModel';
import {PARLIAMENT_VOTE_COST, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import ConsoleVoteFactRow from '@/client/components/console/parliament/ConsoleVoteFactRow.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ParliamentBeat, scheduleParliamentBeat} from '@/client/console/parliament/parliamentBeat';
import {descendWorkspaceFrame, foldWorkspaceFrame, setWorkspaceFramePhase, workspaceFrameHasNested} from '@/client/console/consoleWorkspaceStack';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {offTurnReason} from '@/client/console/offTurnReason';
import {probeTick} from '@/client/console/probeTick';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {parliamentFlow, parliamentRootEl, parliamentVoteInFlight, parliamentVoteUp} from '@/client/console/parliament/consoleParliamentFlow';
import {fitParliamentCards} from '@/client/console/parliament/parliamentCardFit';
import {
  dropFlight, dropFlightsWithPrefix, flightEl, nextFlightId, pushCubeFlight, registerFlightHandle, VOTE_FLIGHT_MS,
} from '@/client/console/parliament/parliamentFlights';
import {
  killParliamentVoteMotion, measureVoteRects, parkParliamentBody, playParliamentVoteEnter, playParliamentVoteLeave, playParliamentVoteRefit, Rect,
  restoreParliamentBody, runDelegateCubeFlight,
} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {
  ParliamentPromptBridge, parliamentPlayerName, ParliamentSlotVm, ParliamentTileVm, ParliamentViewVm, resolutionTitleOf, voteForecastOf,
  VoteForecastVm, voteResponse, voteVerbOf, VoteVerbVm,
} from '@/client/console/parliament/consoleParliamentModel';
import {PARTY_MOMENT, voteFactsOf, VoteFactsVm, voteInfoOf, VoteInfoVm} from '@/client/console/parliament/voteInfoModel';
import {BenchSource, voteSourceOf, winningShownOf} from '@/client/console/parliament/parliamentVoteView';
import {ParliamentInspectRequest, slotFaceOf} from '@/client/console/parliament/parliamentInspect';

/** The delegate's landing beat (the cube settles, the counters tick). */
const VOTE_LANDING_MS = 700;
/** THE CONCLUSION — the landed scene lets go as one picture (a class fade) before the workspace leaves. */
const VOTE_CONCLUDE_MS = 220;

/** The confirm's price line: the lobby's delegate is free, the reserve's costs the server's own M€. */
type CtaCost = {kind: 'free' | 'cost' | 'none', amount: number};

/**
 * THE VOTE MODE — the Parliament frame's phase descent: the three slots are
 * teleported into this layer's row and FLIP there from their overview rects,
 * the info surface reads the SELECTED card in one number, the confirm sends
 * the delegate, and the answer LANDS: the cube leaves its real place on the
 * bench and settles on the card's ribbon before the flow leaves. The stage
 * machine it moves is the section's shared flow record; the submit itself
 * (the safety timer, the answer key) is the section's — this component
 * emits `send` and is told when the answer is in.
 */
export default defineComponent({
  name: 'ConsoleParliamentVoteMode',
  components: {ConsoleInfluenceYield, ConsolePartyFormula, ConsolePartyReaction, ConsoleVoteFactRow, PlayerCube, GamepadGlyph, PremiumMechanicsPanel},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    viewerParticipates: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
    bridge: {type: Object as PropType<ParliamentPromptBridge>, required: true},
    voteTile: {type: Object as PropType<ParliamentTileVm | undefined>, default: undefined},
    winningSlot: {type: Object as PropType<ParliamentSlotVm | undefined>, default: undefined},
    benchSource: {type: String as PropType<BenchSource>, required: true},
    benchWarn: {type: Boolean, default: false},
    /** The execution gate — the viewer's own action window (never a reason of its own). */
    canActNow: {type: Boolean, default: false},
    canVoteNow: {type: Boolean, default: false},
  },
  emits: ['notice', 'inspect', 'send', 'flow-complete'],
  data() {
    return {
      partyMoment: PARTY_MOMENT,
      landingBeat: undefined as ParliamentBeat | undefined,
      concludeBeat: undefined as ParliamentBeat | undefined,
      landingHold: undefined as AnimationHold | undefined,
      flightHold: undefined as AnimationHold | undefined,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    /** The card the vote mode is on — the cursor's slot. */
    voteSlot(): ParliamentSlotVm | undefined {
      return this.view.slots[parliamentFlow.slotIndex];
    },
    voteUp(): boolean {
      return parliamentVoteUp();
    },
    voteCommitted(): boolean {
      return this.voteUp && parliamentFlow.stage !== 'vote';
    },
    voteSource(): BenchSource {
      return voteSourceOf(this.view, parliamentFlow.voteSnapshot, this.voteTile);
    },
    voteInFlight(): boolean {
      return parliamentVoteInFlight();
    },
    /** A nested frame (the action workspace) took the scene — this screen yields and waits. */
    sceneHandedOver(): boolean {
      return workspaceFrameHasNested('parliament');
    },
    voteForecast(): VoteForecastVm | undefined {
      const slot = this.voteSlot;
      return slot === undefined ? undefined : voteForecastOf(slot, this.viewerColor, this.model?.viewer?.vote);
    },
    /** The SELECTED card's reading — the info surface (`voteInfoModel` decides; this renders). */
    voteInfo(): VoteInfoVm | undefined {
      const slot = this.voteSlot;
      if (slot === undefined) {
        return undefined;
      }
      return voteInfoOf({
        slot,
        resolution: slot.resolution ?? getResolution(slot.resolutionId),
        model: this.model,
        viewer: this.viewerColor,
        tableau: this.playerView.thisPlayer.tableau,
        name: resolutionTitleOf(this.view, slot.resolutionId),
        winning: winningShownOf(slot),
        source: this.benchSource,
        cost: this.ctaCost.amount,
        facts: this.voteFacts,
        numbers: this.voteNumbers,
      });
    },
    /** The selected card's printed graphic — the reading's formula, beside the number. */
    ownMechanics(): MechanicsVM | undefined {
      const slot = this.voteSlot;
      const resolution = slot === undefined ? undefined : (slot.resolution ?? getResolution(slot.resolutionId));
      const own = resolution === undefined ? undefined : buildMechanics(resolution.renderData);
      return own === undefined || own.textOnly ? undefined : own;
    },
    /**
     * THE VOTE'S NUMBERS: before the submit, the live model and its
     * projection; from the submit to the landing, the SNAPSHOT (the counters
     * tick when the cube lands, not when the packet does); after the landing,
     * the live model on both sides.
     */
    voteNumbers(): {votesBefore: number, votesAfter: number, mineBefore: number, mineAfter: number} {
      const slot = this.voteSlot;
      const snap = parliamentFlow.voteSnapshot;
      if (slot === undefined) {
        return {votesBefore: 0, votesAfter: 0, mineBefore: 0, mineAfter: 0};
      }
      if (parliamentFlow.stage === 'landed' && snap !== undefined) {
        return {votesBefore: snap.votes, votesAfter: slot.totalVotes, mineBefore: snap.mine, mineAfter: slot.viewerVotes};
      }
      if (snap !== undefined) {
        return {votesBefore: snap.votes, votesAfter: snap.votes + 1, mineBefore: snap.mine, mineAfter: snap.mine + 1};
      }
      const f = this.voteForecast;
      return {
        votesBefore: slot.totalVotes, votesAfter: f?.votesAfter ?? slot.totalVotes + 1,
        mineBefore: slot.viewerVotes, mineAfter: slot.viewerVotes + 1,
      };
    },
    /** THIS VOTE's consequences — every fact as current → projected (`voteFactsOf`; the panel prints two, the inspector all). */
    voteFacts(): VoteFactsVm {
      const slot = this.voteSlot;
      const snap = parliamentFlow.voteSnapshot;
      const landed = parliamentFlow.stage === 'landed';
      return voteFactsOf({
        slot,
        party: this.view.parties.find((p) => p.party === slot?.party),
        viewer: this.viewerColor,
        forecast: this.voteForecast,
        snapshot: snap === undefined ? undefined : {leader: snap.leader, winning: snap.winning},
        landed,
        mineBefore: this.voteNumbers.mineBefore,
        mineAfter: landed ? (slot?.viewerVotes ?? this.voteNumbers.mineAfter) : this.voteNumbers.mineAfter,
        nameOf: (color: Color) => this.nameOf(color),
      });
    },
    ctaText(): string {
      switch (parliamentFlow.stage) {
      case 'submitting': return translateText('Performing…');
      case 'paying': return translateText('Pay for the delegate');
      // «placed» only once the cube has landed — the answer's arrival is not the delegate's.
      case 'landed': return translateText(this.voteInFlight ? 'Performing…' : 'Delegate placed');
      default:
        return this.canVoteNow ? translateText('Send the delegate') : this.voteBlockedText;
      }
    },
    voteBlockedText(): string {
      const tile = this.voteTile;
      if (tile === undefined) {
        return translateText(this.viewerParticipates ? 'Not your turn — you can read the Parliament' : 'Not in this game');
      }
      if (!tile.available) {
        return this.reasonText(tile.reason);
      }
      return translateText(this.awaitingInput ? 'Finish your current action first' : 'Not your turn — you can read the Parliament');
    },
    /**
     * THE PRICE ON THE CONFIRM — from the SAME vote option the submit answers
     * (the server's source and cost; a standing bill's own cost outranks the
     * tile's): the lobby's delegate is free, the reserve's costs M€. Nothing
     * to send → no price line (the confirm carries the one reason).
     */
    ctaCost(): CtaCost {
      const source = this.benchSource;
      if (source === 'none') {
        return {kind: 'none', amount: 0};
      }
      if (source === 'lobby') {
        return {kind: 'free', amount: 0};
      }
      return {kind: 'cost', amount: this.votePayment?.cost ?? this.voteTile?.cost ?? PARLIAMENT_VOTE_COST};
    },
    /** A paid vote's BILL stands — the server's own marker, never a title (the vote mode hosts it). */
    votePayment(): VotePaymentMeta | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'payment' ? (wf as SelectPaymentModel).votePayment : undefined;
    },
    /**
     * THE BILL GEOMETRY — the vote column at the shared payment panel's width
     * and the band at its height, from the payment through the paid delegate's
     * landing (a re-fit under a flight would jump the scene it measures).
     */
    billGeometry(): boolean {
      return parliamentFlow.stage === 'paying' || (parliamentFlow.stage === 'landed' && parliamentFlow.voteSnapshot?.source === 'reserve');
    },
    paymentStands(): boolean {
      return this.votePayment !== undefined;
    },
  },
  watch: {
    /**
     * A paid vote's BILL stands on a fresh mount (a reload, a restore from
     * the board home): the vote mode re-forms around it — the cards carried,
     * the counters at their pre-vote values, the payment in the mode's own
     * zone — with no press to animate from. Keyed on the server's marker.
     */
    'votePayment': {
      immediate: true,
      handler(meta: VotePaymentMeta | undefined): void {
        if (meta === undefined || this.voteUp) {
          return;
        }
        const idx = this.view.slots.findIndex((s) => s.party === meta.party);
        if (idx === -1) {
          return;
        }
        const slot = this.view.slots[idx];
        const f = parliamentFlow;
        f.slotIndex = idx;
        f.zone = 'voting';
        f.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: this.winningSlot?.instance, source: 'reserve'};
        f.stageBeforeSubmit = 'vote';
        f.stage = 'paying';
        descendWorkspaceFrame('parliament', 'Voting', 'Payment');
        setWorkspaceFramePhase('parliament', 'committed');
        void this.$nextTick(() => {
          fitParliamentCards();
          parkParliamentBody(parliamentRootEl());
        });
      },
    },
    /**
     * The bill geometry changes under a STANDING mode: measure before the
     * layout moves (pre-flush), re-fit the cards after it, and FLIP every
     * carried object from where it stood — never a jump under the bill. A mode
     * that opens straight into the payment (a reload) has nothing to carry.
     */
    billGeometry(): void {
      const root = parliamentRootEl();
      const up = root?.querySelector<HTMLElement>('.con-parl__vote--up') ?? null;
      if (root === undefined || up === null || parliamentFlow.voteEntering || parliamentFlow.voteLeaving) {
        return;
      }
      const before = measureVoteRects(root, {mode: 'vote'});
      void this.$nextTick(() => {
        fitParliamentCards();
        playParliamentVoteRefit({root, before});
      });
    },
  },
  beforeUnmount() {
    this.clearLanding();
    this.clearConclude();
  },
  methods: {
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    nameOf(color: Color | 'neutral' | undefined): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    reasonText(reason: string | Message): string {
      return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
    },
    /**
     * A on the voting area: the frame DESCENDS into the vote mode (a phase,
     * not a frame — the overview is parked, its focus survives). The three
     * slots are measured where they stand, teleported into the vote row, and
     * the entrance FLIPs every carried object from the rect it just had.
     * The mode opens whether or not a vote is possible right now — comparing
     * the three proposals is its job too; the confirm carries the reason.
     */
    openVote(opts?: {fromViewer?: boolean, index?: number}): void {
      this.clearConclude();
      const root = parliamentRootEl();
      const f = parliamentFlow;
      if (this.view.slots.length === 0 || root === undefined) {
        this.$emit('notice', translateText('Not in this game'));
        return;
      }
      if (this.voteUp || f.voteLeaving) {
        return;
      }
      if (opts?.index !== undefined) {
        f.slotIndex = opts.index;
      }
      f.slotIndex = Math.max(0, Math.min(this.view.slots.length - 1, f.slotIndex));
      const selected = this.view.slots[f.slotIndex];
      const plate = root.querySelector<HTMLElement>('.con-parl__voting');
      const pr = plate?.getBoundingClientRect();
      const press = pr === undefined || pr.width < 2 ? undefined : {x: pr.left + pr.width / 2, y: pr.top + pr.height / 2};
      // Measure BEFORE the layout changes — the overview's rects are the FLIPs' departures.
      const before = measureVoteRects(root, {press, viewer: this.viewerColor, mode: 'browse'});
      killParliamentVoteMotion(root);
      f.voteSnapshot = undefined;
      f.sourceHold = undefined;
      f.sourceLeaving = undefined;
      f.zone = 'voting';
      f.stage = 'vote';
      f.voteEntering = true;
      descendWorkspaceFrame('parliament', 'Voting', '');
      void this.$nextTick(() => {
        // The slots are in the vote row now: fit them, then play from the old rects.
        fitParliamentCards();
        playParliamentVoteEnter({
          root,
          before,
          selected: selected.instance,
          fromViewer: opts?.fromViewer === true,
          instant: false,
          done: () => {
            f.voteEntering = false;
          },
        });
      });
    },
    /** B before the commit: the same phrase folded back — every object returns home, the focus is where it was. */
    closeVote(): void {
      if (!this.voteUp) {
        return;
      }
      const root = parliamentRootEl();
      const f = parliamentFlow;
      this.clearConclude();
      this.clearLanding();
      f.voteSnapshot = undefined;
      f.sourceHold = undefined;
      f.sourceLeaving = undefined;
      f.voteEntering = false;
      foldWorkspaceFrame();
      setWorkspaceFramePhase('parliament', 'browse');
      if (root === undefined || this.sceneHandedOver) {
        f.stage = 'browse';
        restoreParliamentBody(root);
        return;
      }
      // Measure the VOTE layout before the teleport home, then let the slots
      // go home and animate them from where they were.
      killParliamentVoteMotion(root);
      const before = measureVoteRects(root, {viewer: this.viewerColor, mode: 'vote'});
      f.voteLeaving = true;
      f.stage = 'browse';
      void this.$nextTick(() => {
        fitParliamentCards();
        playParliamentVoteLeave({
          root,
          viewer: this.viewerColor,
          before,
          done: () => {
            f.voteLeaving = false;
          },
        });
      });
    },
    /** The vote mode's own verbs: ◀ ▶ select, A sends, X inspects the selected card (B — the section's, folds back). */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        if (intent.dir === 'left') {
          this.selectVoteSlot(parliamentFlow.slotIndex - 1);
        } else if (intent.dir === 'right') {
          this.selectVoteSlot(parliamentFlow.slotIndex + 1);
        }
        return;
      }
      const action = consoleActionOf(intent);
      if (action === 'inspect') {
        this.inspect();
      } else if (action === 'primary') {
        // The press that opened the mode is never its confirm.
        if (parliamentFlow.voteEntering) {
          return;
        }
        this.submitVote();
      }
    },
    /**
     * THE INSPECTOR — X on the selected card. Inside the vote mode it opens
     * the viewer over ALL THREE cards (LB/RB browse them, the cursor follows)
     * and offers the A verb that sends the delegate to the card shown; a bill
     * standing or a delegate in flight binds the viewer to ONE card.
     */
    inspect(): void {
      const root = parliamentRootEl();
      const slots = this.view.slots;
      const selected = this.voteSlot;
      if (selected === undefined) {
        return;
      }
      if (parliamentFlow.stage !== 'vote') {
        // A bill standing or a delegate in flight belongs to ONE card: the
        // viewer reads that card alone, and nothing in it can move the
        // selection the transaction is bound to.
        const single: ParliamentInspectRequest = {kind: 'resolution', ids: [selected.resolutionId], index: 0, origin: () => slotFaceOf(root, selected.instance)};
        this.$emit('inspect', single);
        return;
      }
      // THE THREE PROPOSALS, in the order they stand in the row: LB/RB page
      // them inside the viewer and the mode's selection follows (B lands on
      // the last card looked at); A sends the delegate to the card on screen
      // through this mode's own submit.
      const request: ParliamentInspectRequest = {
        kind: 'resolution',
        ids: slots.map((slot) => slot.resolutionId),
        index: parliamentFlow.slotIndex,
        origin: (index) => {
          const slot = slots[index];
          return slot === undefined ? null : slotFaceOf(root, slot.instance);
        },
        onBrowse: (index) => this.selectVoteSlot(index),
        vote: {
          verbAt: (index) => this.voteVerbAt(index),
          execute: (index) => this.sendVoteFromInspector(index),
        },
      };
      this.$emit('inspect', request);
    },
    /** Select the vote mode's card (the d-pad inside the mode, the viewer's paging). */
    selectVoteSlot(index: number): void {
      // The crumb stays «Голосование»: the selection is named by the surface, never by the head line.
      parliamentFlow.slotIndex = Math.max(0, Math.min(this.view.slots.length - 1, index));
    },
    /**
     * «Send the delegate» for the card at `index`, as THIS mode reads it — the
     * same option, source, price and blocked text its own confirm uses.
     */
    voteVerbAt(index: number): VoteVerbVm | undefined {
      const slot = this.view.slots[index];
      if (slot === undefined || parliamentFlow.stage !== 'vote') {
        return undefined;
      }
      const tile = this.voteTile;
      return voteVerbOf({
        participates: this.viewerParticipates,
        tile,
        refusalText: tile === undefined || tile.available ? '' : this.reasonText(tile.reason),
        offered: this.bridge.vote !== undefined,
        canActNow: this.canActNow,
        offeredParties: this.bridge.vote?.model.parties,
        party: slot.party,
        turnText: translateText(offTurnReason(this.awaitingInput)),
        notOfferedText: translateText('This option is no longer offered'),
      });
    },
    /**
     * The inspector's A, after the viewer has flown back into the card's slot:
     * the card it showed becomes the mode's selection and the mode's own
     * submit runs — the same snapshot, the same answer handling, the same
     * delegate flight. A refusal speaks through the same notice.
     */
    sendVoteFromInspector(index: number): void {
      if (parliamentFlow.stage !== 'vote') {
        return;
      }
      this.selectVoteSlot(index);
      this.submitVote();
    },
    // ── the submit (byte-identical to the live prompt) ─────────────────
    submitVote(): void {
      const slot = this.voteSlot;
      if (slot === undefined || parliamentFlow.stage !== 'vote') {
        return;
      }
      if (!this.canVoteNow) {
        this.$emit('notice', this.voteBlockedText);
        return;
      }
      const source = this.benchSource === 'none' ? 'lobby' : this.benchSource;
      parliamentFlow.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: this.winningSlot?.instance, source};
      this.$emit('send', {response: voteResponse(this.bridge, slot.party), from: 'vote'});
    },
    /** The server answered while the BILL stood: the paid delegate lands — or the payment was refused / the prompt moved on. */
    answerWhilePaying(): void {
      if (this.landVote()) {
        return;
      }
      if (!this.paymentStands) {
        // The payment was refused / the prompt moved on without a delegate.
        this.closeVote();
        this.$emit('flow-complete', 'vote');
      }
    },
    /** The server answered the vote's submit: the delegate LANDS, or the bill is raised, or nothing was placed. */
    answerAfterSubmit(): void {
      if (this.landVote()) {
        return;
      }
      if (this.paymentStands) {
        parliamentFlow.stage = 'paying';
        setWorkspaceFramePhase('parliament', 'committed');
        return;
      }
      this.closeVote();
      this.$emit('flow-complete', 'vote');
    },
    /**
     * THE DELEGATE FLIGHT + LANDING. The vote's answer is in the model: the
     * viewer's newest delegate on the selected card is the one that just
     * arrived. Its cube LEAVES the place it came from (the bench's lobby socket
     * or the top of the reserve stack — real, measured places), flies to its
     * place on the card's ribbon and lands there; the counters tick on the
     * landing. Returns false when the model shows no new delegate (a refusal,
     * a paid vote still owing its payment) — the caller decides what that means.
     */
    landVote(): boolean {
      const slot = this.voteSlot;
      const me = this.viewerColor;
      const f = parliamentFlow;
      const snap = f.voteSnapshot;
      if (slot === undefined || me === undefined || snap === undefined || slot.viewerVotes <= snap.mine) {
        return false;
      }
      const mine = slot.votes.filter((vote) => vote.owner === me);
      if (mine.length === 0) {
        return false;
      }
      const seq = Math.max(...mine.map((vote) => vote.seq));
      f.stage = 'landed';
      setWorkspaceFramePhase('parliament', 'committed');
      this.landingHold = beginAnimationHold('parliament-vote-landing', {maxHoldMs: 4000});
      f.flightSeq = seq;
      // The bench keeps painting the source cube until the proxy stands over
      // it, and keeps its WORDS until the cube has visibly left.
      f.sourceHold = snap.source;
      f.sourceLeaving = snap.source;
      void this.$nextTick(() => {
        if (!this.flyDelegate(seq, me)) {
          f.sourceHold = undefined;
          f.sourceLeaving = undefined;
          f.flightSeq = undefined;
          this.beginLanding(seq);
        }
      });
      return true;
    },
    flyDelegate(seq: number, color: Color): boolean {
      const root = parliamentRootEl();
      const f = parliamentFlow;
      if (root === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
        return false;
      }
      // The REAL places on the delegates zone, measured where they stand right
      // now (the zone has moved with the mode; nothing here remembers the
      // overview's coordinates).
      const fromLobby = this.voteSource === 'lobby';
      const sourceCube = fromLobby ?
        root.querySelector<HTMLElement>(`[data-parl-seat-lobby="${color}"] .player-cube`) :
        root.querySelector<HTMLElement>(`[data-parl-seat-reserve="${color}"] .con-parl__stack-cube:last-child .player-cube`);
      const place = root.querySelector<HTMLElement>(`.con-parl__slot[data-instance] [data-seq="${seq}"]`);
      // The proxy lands on the CUBE's own box — the ribbon's place is a wider socket drawn around it.
      const target = place?.querySelector<HTMLElement>('.player-cube') ?? place;
      if (sourceCube === null || target === null || target === undefined) {
        return false;
      }
      const fr = sourceCube.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      if (fr.width < 2 || tr.width < 2) {
        return false;
      }
      const from: Rect = {left: fr.left, top: fr.top, width: fr.width, height: fr.height};
      const to: Rect = {left: tr.left, top: tr.top, width: tr.width, height: tr.height};
      const id = nextFlightId('vote');
      const size = Math.round(fr.width);
      pushCubeFlight({id, color, size});
      void this.$nextTick(() => {
        const proxy = flightEl(id);
        if (proxy === null || proxy === undefined) {
          dropFlight(id);
          f.sourceHold = undefined;
          f.sourceLeaving = undefined;
          f.flightSeq = undefined;
          this.beginLanding(seq);
          return;
        }
        const handle = runDelegateCubeFlight({
          proxy,
          from,
          to,
          durationMs: VOTE_FLIGHT_MS,
          onLifted: () => {
            // The proxy stands exactly over the source cube: the source may vanish now.
            f.sourceHold = undefined;
          },
          onDeparted: () => {
            // The cube has visibly left its place: the socket's note / the stack's count may say so now.
            f.sourceLeaving = undefined;
          },
          onLanded: () => {
            f.flightSeq = undefined;
            this.beginLanding(seq);
            probeTick(() => dropFlight(id));
          },
        });
        registerFlightHandle(id, handle);
        this.flightHold = beginAnimationHold('parliament-vote-flight', {maxHoldMs: 4000});
      });
      return true;
    },
    beginLanding(seq: number): void {
      parliamentFlow.landedSeq = seq;
      this.flightHold?.release();
      this.flightHold = undefined;
      this.landingBeat?.kill();
      // The landed READ — a beat on the motion clock (never a wall-clock timer).
      this.landingBeat = scheduleParliamentBeat(VOTE_LANDING_MS, () => this.finishLanding());
    },
    finishLanding(): void {
      this.landingBeat?.kill();
      this.landingBeat = undefined;
      if (parliamentFlow.stage !== 'landed') {
        this.clearLanding();
        return;
      }
      // The flow is over: the landed scene lets go as ONE picture — cards, zone
      // and band together (a leaving Teleport would drop the cards a frame
      // before the fading layer) — while its counters keep the landed reading
      // (`landedSeq` stands until the fade is out); then the shell's ONE
      // guarded conclusion decides whether the workspace leaves (a vote is a
      // full action — it does). A CLASS fade, not a tween: the unmount's
      // prop reset would have popped a tweened layer back to full.
      parliamentFlow.concluded = true;
      this.concludeBeat = scheduleParliamentBeat(VOTE_CONCLUDE_MS + 40, () => {
        this.concludeBeat = undefined;
        this.clearLanding();
        if (parliamentFlow.stage === 'landed') {
          this.$emit('flow-complete', 'vote');
        }
      });
    },
    clearConclude(): void {
      this.concludeBeat?.kill();
      this.concludeBeat = undefined;
      parliamentFlow.concluded = false;
    },
    clearLanding(): void {
      this.landingBeat?.kill();
      this.landingBeat = undefined;
      dropFlightsWithPrefix('vote');
      this.flightHold?.release();
      this.flightHold = undefined;
      this.landingHold?.release();
      this.landingHold = undefined;
      const f = parliamentFlow;
      f.landedSeq = undefined;
      f.flightSeq = undefined;
      f.sourceHold = undefined;
      f.sourceLeaving = undefined;
    },
  },
});
</script>
