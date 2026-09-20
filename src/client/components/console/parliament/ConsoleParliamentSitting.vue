<template>
  <!-- ══ THE SITTING (Turmoil Redux) — «ПАРЛАМЕНТ › ЗАСЕДАНИЕ»: the political
       phase's ONE flow, five STAGES as POSES of this one always-mounted
       surface (verdict · enactment · reward · renewal · closing). A stage
       change swaps a modifier, never a subtree — the Э4 director animates
       between the poses; here they are static and honest. Every object on
       every panel is the SERVER's own record (the phase summary, the recorded
       outcomes, the awaited seats), never a recomputation.

       HOST-AGNOSTIC (the embed contract): the surface titles NOTHING of its
       own — its stage name goes UP to the host's crumb («ЗАСЕДАНИЕ › ВЕРДИКТ»),
       its verbs live on the ONE command bar (the host publishes them), and its
       reward zone `[data-embed-slot="parliament-stage"]` is where the shell
       teleports the enacted resolution's own asks (the payout pick, the take).
       `mode: 'review'` reads a finished phase's summary the same way (the
       protocol's re-inspection, later); today only `live` is used. ══ -->
  <div class="con-sit"
       :class="{'con-sit--field': field, 'con-sit--embedded': embedded}"
       :data-sit-stage="stage"
       :data-sit-step="position.rewardStep"
       :data-sit-mode="mode"
       data-parl-sitting>

    <!-- ── VERDICT: who won the vote, with how many delegates, and for whom. ── -->
    <section class="con-sit__panel con-sit__panel--verdict" :class="{'con-sit__panel--on': stage === 'verdict'}" data-sit-panel="verdict">
      <!-- The RESOLUTION's state is the kicker (glossary: a resolution «принимается»); the winning PLAYER is a row below (P-18: the kicker repeated the row's label). -->
      <span class="con-sit__kicker">{{ $t('Winning') }}</span>
      <template v-if="summary !== undefined">
        <div class="con-sit__head">
          <b class="con-sit__title">{{ $t(resolutionTitle(summary.winner.resolution)) }}</b>
          <span class="con-sit__party"><img class="con-sit__emblem" :src="emblemUrl(summary.winner.party)" alt="" />{{ $t(partyNameKey(summary.winner.party)) }}</span>
        </div>
        <div class="con-sit__rows">
          <div class="con-sit__row" data-sit-row="delegates">
            <span class="con-parl__chip-dim">{{ $t('Delegates') }}</span>
            <b>{{ summary.winner.votes }}</b>
          </div>
          <div class="con-sit__row" data-sit-row="winner">
            <span class="con-parl__chip-dim">{{ $t('Winning player') }}</span>
            <span class="con-sit__val">
              <PlayerCube v-if="winnerColor !== undefined" :color="winnerColor" :size="cubePx(11)" :glow="false" />
              <b>{{ nameOf(summary.winner.player) }}</b>
            </span>
          </div>
          <div v-if="tieKey !== undefined" class="con-sit__row con-sit__row--wide con-sit__tie" data-sit-row="tie">{{ $t(tieKey) }}</div>
        </div>
      </template>
    </section>

    <!-- ── ENACTMENT: the law, the party that rules by it, and what the table did with it. ── -->
    <section class="con-sit__panel con-sit__panel--enact" :class="{'con-sit__panel--on': stage === 'enact'}" data-sit-panel="enact">
      <span class="con-sit__kicker">{{ $t('Enacted resolution') }}</span>
      <template v-if="summary !== undefined">
        <div class="con-sit__head">
          <b class="con-sit__title">{{ $t(resolutionTitle(summary.enacted.resolution)) }}</b>
          <span class="con-sit__party"><img class="con-sit__emblem" :src="emblemUrl(summary.enacted.party)" alt="" />{{ $t('Ruling party') }} · {{ $t(partyNameKey(summary.enacted.party)) }}</span>
        </div>
        <div class="con-sit__rows">
          <div v-if="returned.length > 0" class="con-sit__row" data-sit-row="returned">
            <span class="con-parl__chip-dim">{{ $t('Delegates returned') }}</span>
            <span class="con-sit__chips">
              <span v-for="r in returned" :key="r.owner" class="con-sit__chip">
                <PlayerCube v-if="r.owner !== 'neutral'" :color="r.owner" :size="cubePx(11)" :glow="false" />
                <PlayerCube v-else color="neutral" steel :size="cubePx(11)" :glow="false" />
                <b>×{{ r.count }}</b>
              </span>
            </span>
          </div>
          <div v-if="summary.agenda !== undefined" class="con-sit__row" data-sit-row="agenda">
            <span class="con-parl__chip-dim">{{ $t('Agenda') }}</span>
            <span class="con-sit__val">
              <PlayerCube :color="summary.agenda.player" :size="cubePx(11)" :glow="false" />
              <b>{{ summary.agenda.from }} → {{ summary.agenda.to }}</b>
              <span v-if="agendaBonus !== undefined">{{ $t(agendaBonus) }}</span>
            </span>
          </div>
          <div v-if="supportGained.length > 0" class="con-sit__row" data-sit-row="support">
            <span class="con-parl__chip-dim">{{ $t('Popular support') }}</span>
            <span class="con-sit__chips">
              <span v-for="s in supportGained" :key="s.party" class="con-sit__chip">
                <img class="con-sit__emblem" :src="emblemUrl(s.party)" alt="" /><b>+{{ s.gained }}</b>
              </span>
            </span>
          </div>
        </div>
      </template>
    </section>

    <!-- ── REWARD: the reading of what the law pays THIS seat (the server's own
         amounts once they are recorded, the estimate before), the ruling
         party's answer, the winner's tile, a SKIP PLATE for what could not be
         paid (never a silent loss), the honest wait for another seat, and the
         ZONE the enacted resolution's own ask stands in. ── -->
    <section class="con-sit__panel con-sit__panel--reward" :class="{'con-sit__panel--on': stage === 'reward'}" data-sit-panel="reward">
      <!-- The kicker names the stage; ONE word of state beside it says which
           moment the numbers belong to — «this payout» until every chip has
           landed, «received» after (cyan → amber, the console's own
           pre-/post-commit accent). The readings print no caption of their own:
           one state, said once (law 19 — a word, never a sentence). -->
      <span class="con-sit__kicker">{{ $t(rewardKicker) }}<span v-if="rewardStateKey !== undefined" class="con-sit__kicker-state" :class="{'con-sit__kicker-state--received': rewardStateKey === 'Received'}" :data-sit-reward-state="rewardStateKey">{{ $t(rewardStateKey) }}</span></span>
      <div class="con-sit__reward" :class="{'con-sit__reward--field': field}">
        <div class="con-sit__hero" :class="{'con-sit__hero--field': field}">
          <!-- The carried enacted card lands here (one DOM instance, teleported by the government) while the stage holds the field. -->
          <div class="con-sit__card" data-parl-sit-hero></div>
          <!-- The readings only: the carrier card's own printed graphic (in the
               government, or carried onto the hero slot) IS the formula — a
               second copy of it stacked the reward past its tier over the
               Agenda track (measured at 1080 with the two-link chain). -->
          <ConsoleInfluenceYield v-if="yields.length > 0"
                                 class="con-sit__yield"
                                 :yields="yields"
                                 :size="field ? 'hero' : 'normal'"
                                 :formula="false"
                                 :captions="false"
                                 data-parl-sit-yield
                                 data-parl-sit-item />
          <ConsolePartyReaction v-for="r in reactions" :key="r.reaction.id"
                                class="con-sit__reaction"
                                :reading="r"
                                size="normal"
                                data-parl-sit-item />
          <ConsoleWinnerReward v-if="winnerReading !== undefined"
                               :reading="winnerReading"
                               :viewerColor="viewerColor"
                               :nameOf="nameOfColor"
                               size="normal"
                               :reasonElsewhere="true"
                               data-parl-sit-item />
          <div v-for="skip in skips" :key="skip.key" class="con-sit__skip" data-parl-sit-item data-sit-skip :data-sit-skip-amount="skip.amount">
            <span class="con-sit__skip-title">{{ $t('Skipped') }} · {{ $t(skip.title) }}</span>
            <!-- WHAT IT WOULD HAVE PAID, when the record honestly knows: the
                 same struck «✕ +K [unit]» language the yield block speaks for
                 a forfeited scaled part — never a silent loss (law 4). -->
            <span v-if="skip.amount !== undefined" class="con-sit__skip-amount con-iyield__out con-iyield__out--lost"><b>✕ +{{ skip.amount }}</b><i class="con-iyield__unit" :class="skip.unit" aria-hidden="true"></i></span>
            <span class="con-sit__skip-reason">{{ $t(skip.reason) }}</span>
          </div>
          <!-- The honest WAIT for ANOTHER seat — its cube, then who and what kind of answer. -->
          <span v-if="waiting !== undefined" class="con-sit__wait" data-sit-wait :data-sit-wait-for="waiting.player">
            <PlayerCube :color="waiting.player" :size="cubePx(11)" :glow="false" />{{ waiting.text }}
          </span>
          <span v-else-if="position.gate === 'assembly' && position.rewardStep === 'gate'" class="con-sit__awaiting" data-sit-awaiting>
            {{ $t('Waiting for the other seats') }}
            <span class="con-sit__chips">
              <span v-for="c in position.awaiting" :key="c" class="con-sit__chip"><PlayerCube :color="c" :size="cubePx(11)" :glow="false" />{{ nameOfColor(c) }}</span>
            </span>
          </span>
          <span v-else-if="position.rewardStep === 'received' && yields.length === 0 && skips.length === 0 && winnerReading === undefined" class="con-sit__note">{{ $t('Your record is in') }}</span>
        </div>
        <div class="con-sit__zone" :class="{'con-sit__zone--on': field}" data-parl-sit-item>
          <div class="con-sit__embed" data-embed-slot="parliament-stage"></div>
        </div>
      </div>
    </section>

    <!-- ── RENEWAL: the refreshed voting area — the losers that left for the
         discard (the summary names them; the beat flies them), the fresh
         resolutions and the neutral delegates that came with them; the lobby
         refilled. Objects only: an emblem, a name, a number. ── -->
    <section class="con-sit__panel con-sit__panel--renewal" :class="{'con-sit__panel--on': stage === 'renewal'}" data-sit-panel="renewal">
      <span class="con-sit__kicker">{{ $t('New resolutions') }}</span>
      <template v-if="summary !== undefined">
        <div class="con-sit__rows">
          <div v-for="loser in discarded" :key="loser.instance" class="con-sit__row con-sit__row--discarded" data-sit-row="discarded">
            <span class="con-sit__val"><img class="con-sit__emblem" :src="emblemUrl(loser.party)" alt="" /><b>{{ $t(resolutionTitle(loser.resolution)) }}</b></span>
            <span class="con-parl__chip-dim">{{ $t('To the discard') }}</span>
          </div>
          <div v-for="fresh in summary.refreshed" :key="fresh.instance" class="con-sit__row" data-sit-row="fresh">
            <span class="con-sit__val"><img class="con-sit__emblem" :src="emblemUrl(fresh.party)" alt="" /><b>{{ $t(resolutionTitle(fresh.resolution)) }}</b></span>
            <span v-if="returning.has(fresh.instance)" class="con-parl__chip-dim" data-sit-stays>{{ $t('stays · reshuffled') }}</span>
            <span v-if="fresh.neutralVotes > 0" class="con-parl__chip-dim">{{ neutralVotesText(fresh.neutralVotes) }}</span>
          </div>
          <!-- The lobby refilled: objects — the seats' cubes back in the lobby (P-23: a sentence stood here). -->
          <div v-if="summary.lobbyRefilled.length > 0" class="con-sit__row" data-sit-row="lobby">
            <span class="con-parl__chip-dim">{{ $t('To the lobby') }}</span>
            <span class="con-sit__chips">
              <span v-for="color in summary.lobbyRefilled" :key="color" class="con-sit__chip"><PlayerCube :color="color" :size="cubePx(11)" :glow="false" /></span>
            </span>
          </div>
        </div>
      </template>
    </section>

    <!-- ── CLOSING: the compact card — objects and numbers, one plate. ── -->
    <section class="con-sit__panel con-sit__panel--closing" :class="{'con-sit__panel--on': stage === 'closing'}" data-sit-panel="closing">
      <div v-if="summary !== undefined" class="con-sit__closing">
        <div class="con-sit__closing-head"><b class="con-sit__closing-title">{{ resultsTitle }}</b></div>
        <!-- The resolution is «принята», the player is the «победитель голосования» (P-24: one label named both). -->
        <div class="con-sit__row" data-sit-row="closing-winner">
          <span class="con-parl__chip-dim">{{ $t('Enacted') }}</span>
          <span class="con-sit__val"><img class="con-sit__emblem" :src="emblemUrl(summary.winner.party)" alt="" /><b>{{ $t(resolutionTitle(summary.winner.resolution)) }}</b></span>
        </div>
        <div class="con-sit__row" data-sit-row="closing-player">
          <span class="con-parl__chip-dim">{{ $t('Winning player') }}</span>
          <span class="con-sit__val">
            <PlayerCube v-if="winnerColor !== undefined" :color="winnerColor" :size="cubePx(11)" :glow="false" />
            <b>{{ nameOf(summary.winner.player) }}</b>
          </span>
        </div>
        <div class="con-sit__row" data-sit-row="closing-reward">
          <span class="con-parl__chip-dim">{{ $t('Your reward') }}</span>
          <span class="con-sit__val">
            <ConsoleInfluenceYield v-if="yields.length > 0" :yields="yields" size="compact" :formula="false" :captions="false" />
            <b v-else>{{ $t('No reward') }}</b>
          </span>
        </div>
        <div class="con-sit__row" data-sit-row="closing-fresh">
          <span class="con-parl__chip-dim">{{ $t('New resolutions') }}</span>
          <b>{{ summary.refreshed.length }}</b>
        </div>
        <span v-if="position.gate === 'adjourn' && position.rewardStep === 'gate'" class="con-sit__awaiting con-sit__row" data-sit-awaiting>
          {{ $t('Waiting for the other seats') }}
          <span class="con-sit__chips">
            <span v-for="c in position.awaiting" :key="c" class="con-sit__chip"><PlayerCube :color="c" :size="cubePx(11)" :glow="false" />{{ nameOfColor(c) }}</span>
          </span>
        </span>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import {REWARD_ADDRESS, rewardAddressOf} from '@/common/parliament/rewardAddress';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import ConsoleWinnerReward from '@/client/components/console/parliament/ConsoleWinnerReward.vue';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {translateTextWithParams} from '@/client/directives/i18n';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {parliamentPlayerName, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {SittingPosition, SittingStage} from '@/client/console/parliament/consoleSittingFlow';
import {returningInstances} from '@/client/console/parliament/sittingBeats';
import {enactedYieldsOf, resolvingYieldsOf, voteYieldsOf} from '@/client/console/parliament/influenceYieldModel';
import {parliamentRewardState, rewardLanded} from '@/client/console/parliament/parliamentRewardBeat';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from '@/client/console/parliament/partyReactionModel';
import {WinnerRewardReading, winnerRewardReadingOf, winnerRewardTableOf} from '@/client/console/parliament/winnerRewardModel';

/** A skipped effect on the reward stage: WHAT was skipped and WHY (both i18n keys), and what it would have paid when the record knows. */
type SkipPlate = {key: string, title: string, reason: string, amount?: number, unit?: string};

export default defineComponent({
  name: 'ConsoleParliamentSitting',
  components: {PlayerCube, ConsoleInfluenceYield, ConsolePartyReaction, ConsoleWinnerReward},
  props: {
    /** Where the sitting stands on the server (`consoleSittingFlow.sittingPositionOf`). */
    position: {type: Object as PropType<SittingPosition>, required: true},
    /** The stage on screen — the host's page cursor over the position's pages. */
    stage: {type: String as PropType<SittingStage>, required: true},
    /** The phase's summary — the live sitting's `phase.summary`, a review's finished summary. */
    summary: {type: Object as PropType<ParliamentPhaseSummaryModel | undefined>, default: undefined},
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The reward stage holds the FIELD (a hosted step stands in its zone). */
    field: {type: Boolean, default: false},
    /** Hosted inside another surface's zone (nothing of the chassis to strip — the sitting never titles itself). */
    embedded: {type: Boolean, default: false},
    /** `live` — the phase in progress; `review` — a finished sitting re-read (the protocol, later). */
    mode: {type: String as PropType<'live' | 'review'>, default: 'live'},
  },
  computed: {
    resolution(): IClientResolution | undefined {
      const id = this.summary?.enacted.resolution;
      return id === undefined ? undefined : getResolution(id);
    },
    winnerColor(): Color | undefined {
      const player = this.summary?.winner.player;
      return player === undefined || player === 'neutral' ? undefined : player;
    },
    /** A TIE was broken — one phrase of the rule that broke it. */
    tieKey(): string | undefined {
      switch (this.summary?.winner.tieBreak) {
      case 'slot-priority': return 'Tie broken by the slot order';
      case 'earlier-delegate': return 'Tie broken by the earlier delegate';
      default: return undefined;
      }
    },
    returned(): ReadonlyArray<{owner: Color | 'neutral', count: number}> {
      return this.summary?.returned ?? [];
    },
    agendaBonus(): string | undefined {
      switch (this.summary?.agenda?.bonus) {
      case 'tr': return '+1 TR';
      case 'card': return '+1 card';
      default: return undefined;
      }
    },
    supportGained(): ReadonlyArray<{party: ReduxParty, gained: number}> {
      return (this.summary?.support ?? []).filter((s) => s.gained > 0);
    },
    /** The losers the refresh sent to the discard, in their slot order (the server's own list — absent before the refresh). */
    /** The losers that LEFT — a card dealt straight back from the reshuffled discard stays on the table (P-22). */
    discarded(): ReadonlyArray<{instance: string, resolution: string, party: ReduxParty}> {
      const returning = this.returning;
      return (this.summary?.discarded ?? []).filter((loser) => !returning.has(loser.instance));
    },
    returning(): Set<string> {
      return this.summary === undefined ? new Set() : returningInstances(this.summary);
    },
    /** The viewer's OWN records among the phase's outcomes (the effects so far). */
    mine(): Array<ParliamentEnactOutcomeModel> {
      const outcomes = this.mode === 'review' ? this.summary?.outcomes : this.model?.phase?.outcomes;
      return this.viewerColor === undefined ? [] : (outcomes ?? []).filter((o) => o.player === this.viewerColor);
    },
    /**
     * THE READING: once the seat's record is in, the server's own amounts
     * (`resolving` while the phase pays, `applied` after); before that, the
     * ESTIMATE by the seat's final influence — the vote panel's own reading,
     * never a payout recomputed on the client.
     */
    yields(): Array<InfluenceYield> {
      const resolution = this.resolution;
      if (resolution === undefined) {
        return [];
      }
      const recorded = this.mine.length > 0 || this.position.step === 'adjourn' || this.position.step === 'done';
      if (!recorded) {
        // BEFORE THE RECORD (the assembly's reward page): «this payout» — the
        // declaration read at the seat's final influence, never a forecast (the
        // vote is over) and never «by your current influence» (the payout is
        // fixed). A review of a finished sitting keeps the vote's own reading.
        return this.mode === 'live' ?
          resolvingYieldsOf(resolution, this.model, this.viewerColor) :
          voteYieldsOf(resolution, this.model, this.viewerColor).filter((y) => y.context !== 'forecast');
      }
      return enactedYieldsOf(resolution, this.model, this.viewerColor, {live: this.mode === 'live' && this.rewardResolving});
    },
    /**
     * THE RECORD IS IN BUT NOT YET SHOWN TO LAND: a chip owed or in the air
     * (the reward ledger), or the seat's own hosted step still standing (the
     * take, the pick, the tile). Then the reading says «this payout»; on the
     * touchdown / the answer it says «received».
     */
    rewardResolving(): boolean {
      void parliamentRewardState.owed.length;
      void parliamentRewardState.flying.length;
      void parliamentRewardState.landed.length;
      const step = this.position.rewardStep;
      // The viewer's OWN part is still open: nothing recorded yet, or their
      // own step standing. Waiting on ANOTHER seat is not — their payout is
      // in, and the wait line names whose turn it is.
      if (this.position.step === 'effects' && (step === 'reading' || step === 'choice' || step === 'intake' || step === 'placement')) {
        return true;
      }
      return this.mine.some((o) => !rewardLanded(o));
    },
    /** …and the ruling party's answer to it (a seat that takes part is told; a spectator is not). */
    reactions(): Array<PartyReactionReading> {
      return viewerHasSeat(this.model, this.viewerColor) ? partyReactionsOf(this.resolution, this.yields) : [];
    },
    /** The winner's tile, when the law declares one — whose it is, and whether the table has room for it. */
    winnerReading(): WinnerRewardReading | undefined {
      return winnerRewardReadingOf(this.resolution, this.model, winnerRewardTableOf(this.playerView.game));
    },
    /**
     * THE SKIP PLATE — every record of the viewer's that paid nothing, named:
     * a `skipped` record by its own part and reason, a paying kind that paid
     * zero by its address's title. A scaled effect's skip is already read in
     * the yields block (with its reason), so it is not repeated here.
     */
    skips(): Array<SkipPlate> {
      const scaledIds = new Set((this.resolution?.scaled ?? []).map((e) => e.id));
      const out: Array<SkipPlate> = [];
      for (const outcome of this.mine) {
        const delivery = rewardAddressOf(outcome, this.viewerColor);
        if (delivery.skipped === undefined || (outcome.effect !== undefined && scaledIds.has(outcome.effect))) {
          continue;
        }
        const title = outcome.kind === 'skipped' ?
          (outcome.part === 'winner' ? 'Reward for the winner of the vote' : 'Resolution effect') :
          REWARD_ADDRESS[outcome.kind].skipTitle;
        const amount = delivery.payload.amount;
        out.push({
          key: `${outcome.step}:${outcome.part ?? ''}`, title, reason: delivery.skipped,
          ...(amount !== undefined && amount > 0 ? {amount, unit: this.skipUnitClass(outcome)} : {}),
        });
      }
      return out;
    },
    rewardKicker(): string {
      // ONE kicker for the panel's whole life (glossary §6, R-07): the STATE beside it is the one word
      // that moves («ЭТА ВЫПЛАТА» → «ПОЛУЧЕНО»); «ЭФФЕКТЫ ВЫПЛАЧИВАЮТСЯ | ПОЛУЧЕНО» was two voices.
      return 'Your reward';
    },
    /**
     * THE ONE WORD OF STATE beside the kicker: «this payout» while the numbers
     * are what the law is ABOUT to pay / is paying (before the record, chips
     * in the air, a step still standing), «received» once every chip has
     * landed. Absent when there is nothing of the viewer's to read.
     */
    rewardStateKey(): 'This payout' | 'Received' | undefined {
      if (this.yields.length === 0 && this.mine.length === 0 && this.winnerReading === undefined) {
        return undefined;
      }
      if (this.mode !== 'live') {
        return 'Received';
      }
      const recorded = this.mine.length > 0 || this.position.step === 'adjourn' || this.position.step === 'done';
      return !recorded || this.rewardResolving ? 'This payout' : 'Received';
    },
    /** The honest wait — WHO the effects are asking (their cube) and what kind of answer (the server's own input type). */
    waiting(): {player: Color, text: string} | undefined {
      const waiting = this.position.waitingFor;
      if (waiting === undefined) {
        return undefined;
      }
      const who = this.nameOfColor(waiting.player);
      switch (waiting.input) {
      case 'card': return {player: waiting.player, text: translateTextWithParams('Waiting for ${0} to choose a card', [who])};
      case 'space': return {player: waiting.player, text: translateTextWithParams('Waiting for ${0} to place a tile', [who])};
      default: return {player: waiting.player, text: translateTextWithParams('Waiting for ${0} to decide', [who])};
      }
    },
    resultsTitle(): string {
      return translateTextWithParams('Results of generation ${0}', [String(this.position.generation)]);
    },
  },
  methods: {
    partyNameKey(party: string): string {
      return partyNameKey(party);
    },
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    /** The icon of what a skipped record would have paid — the console's own sprite families, the production frame where it is production. */
    skipUnitClass(outcome: ParliamentEnactOutcomeModel): string {
      if (outcome.kind === 'skipped' || outcome.kind === 'production' || outcome.kind === 'stock' || outcome.kind === 'reaction') {
        const production = outcome.production;
        if (production !== undefined) {
          return iconClassFor(String(production)) + ' con-iyield__unit--prod';
        }
        if (outcome.stock !== undefined) {
          return iconClassFor(String(outcome.stock));
        }
      }
      if (outcome.resource !== undefined) {
        return iconClassFor(cardResourceKey(String(outcome.resource)));
      }
      return outcome.kind === 'cards' ? iconClassFor('cards') : '';
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    resolutionTitle(id: string): string {
      return resolutionTitleOf(this.view, id);
    },
    nameOf(color: Color | 'neutral' | undefined): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    nameOfColor(color: Color): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    neutralVotesText(n: number): string {
      return translateTextWithParams('Neutral delegates: ${0}', [String(n)]);
    },
  },
});
</script>
