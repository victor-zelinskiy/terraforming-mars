<template>
  <!-- ══ ЛЕНТА ЧТЕНИЯ («Заседание v5») — the middle zone's upper strip.
       It EXISTS ALWAYS: in the overview, at every beat of the sitting, behind
       the vote layer. Its height and its position never change on any profile;
       only its CONTENT crossfades, in one shared grid cell (`mode="out-in"`
       would empty the cell and blink — the crumb's tail grammar).
       It says WHY what is on the table is happening, and never repeats what an
       object already says itself. The model is pure (`parliamentBand.ts`);
       this file binds it and owns the reward's own reading. ══ -->
  <div class="con-band"
       :class="{'con-band--committed': line.committed}"
       :data-parl-band="line.key"
       :data-parl-band-kicker="line.kicker"
       :data-parl-band-quiet="line.quiet"
       data-parl-band-zone>
    <transition name="con-band-fade">
      <div :key="line.key" class="con-band__line" data-parl-band-line>
        <span class="con-band__kicker" data-parl-band-crumb>{{ $t(line.kicker) }}</span>
        <span v-if="stateKey !== undefined"
              class="con-band__state"
              :class="{'con-band__state--received': stateKey === 'Received'}"
              :data-parl-band-state="stateKey">{{ $t(stateKey) }}</span>
        <span class="con-band__chips">
          <template v-for="(chip, index) in line.chips" :key="index">
            <span v-if="chip.kind === 'label'" class="con-band__chip con-band__chip--label"
                  :class="{'con-band__chip--quiet': chip.tone === 'quiet'}" data-parl-band-chip="label">
              <span class="con-band__text">{{ $t(chip.key) }}</span>
            </span>
            <span v-else-if="chip.kind === 'resolution'" class="con-band__chip con-band__chip--res" data-parl-band-chip="resolution">
              <img class="con-band__emblem" :src="emblemUrl(chip.party)" alt="" />
              <b class="con-band__text con-band__text--strong">{{ $t(resolutionTitle(chip.resolution)) }}</b>
            </span>
            <span v-else-if="chip.kind === 'party'" class="con-band__chip" data-parl-band-chip="party">
              <img class="con-band__emblem" :src="emblemUrl(chip.party)" alt="" />
              <b class="con-band__text">{{ $t(partyNameKey(chip.party)) }}</b>
            </span>
            <span v-else-if="chip.kind === 'player'" class="con-band__chip" data-parl-band-chip="player">
              <PlayerCube v-if="chip.player !== 'neutral'" :color="chip.player" :size="cubePx(11)" :glow="false" />
              <PlayerCube v-else color="neutral" steel :size="cubePx(11)" :glow="false" />
              <b class="con-band__text con-band__text--strong">{{ nameOf(chip.player) }}</b>
            </span>
            <span v-else-if="chip.kind === 'count'" class="con-band__chip" data-parl-band-chip="count">
              <span class="con-band__text con-band__text--dim">{{ $t(chip.key) }}</span>
              <b class="con-band__num">{{ chip.amount }}</b>
            </span>
            <span v-else-if="chip.kind === 'agenda'" class="con-band__chip con-band__chip--agenda" data-parl-band-chip="agenda"
                  :data-parl-band-step="chip.to">
              <span class="con-band__text con-band__text--dim">{{ $t('Agenda step') }}</span>
              <b class="con-band__num">{{ chip.to }}</b>
              <span v-if="chip.bonus !== undefined" class="con-band__bonus" :data-parl-band-bonus="chip.bonus">
                <b>+1</b><i class="con-band__unit" :class="bonusClass(chip.bonus)" aria-hidden="true"></i>
              </span>
            </span>
            <ConsoleInfluenceYield v-else-if="chip.kind === 'yield'"
                                   class="con-band__yield"
                                   :yields="chip.yields"
                                   size="compact"
                                   :formula="false"
                                   :captions="false"
                                   data-parl-sit-yield
                                   data-parl-band-chip="yield" />
            <ConsolePartyReaction v-else-if="chip.kind === 'reaction' && reactionOf(chip.party) !== undefined"
                                  class="con-band__reaction"
                                  :reading="reactionOf(chip.party)!"
                                  size="compact"
                                  :withCaption="false"
                                  data-parl-band-chip="reaction" />
            <ConsoleWinnerReward v-else-if="chip.kind === 'tile' && winnerReading !== undefined"
                                 class="con-band__winner"
                                 :reading="winnerReading"
                                 :viewerColor="viewerColor"
                                 :nameOf="nameOfColor"
                                 size="compact"
                                 variant="inline"
                                 :reasonElsewhere="true"
                                 data-parl-band-chip="tile" />
            <span v-else-if="chip.kind === 'skip'" class="con-band__chip con-band__chip--skip"
                  data-parl-band-chip="skip" data-sit-skip :data-sit-skip-amount="chip.amount">
              <span class="con-band__text con-band__text--dim">{{ $t('Skipped') }} · {{ $t(chip.title) }}</span>
              <span v-if="chip.amount !== undefined" class="con-band__lost con-iyield__out con-iyield__out--lost">
                <b>✕ +{{ chip.amount }}</b><i class="con-iyield__unit" :class="chip.unit" aria-hidden="true"></i>
              </span>
              <span class="con-band__text con-band__text--quiet">{{ $t(chip.reason) }}</span>
            </span>
            <span v-else-if="chip.kind === 'awaiting'" class="con-band__chip con-band__chip--await" data-parl-band-chip="awaiting" data-sit-awaiting>
              <span class="con-band__text con-band__text--dim">{{ $t('Waiting for the other seats') }}</span>
              <span v-for="c in chip.seats" :key="c" class="con-band__seat">
                <PlayerCube :color="c" :size="cubePx(11)" :glow="false" /><span class="con-band__text">{{ nameOfColor(c) }}</span>
              </span>
            </span>
          </template>
        </span>
      </div>
    </transition>
  </div>
</template>
<script lang="ts">
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
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {parliamentPlayerName, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {BandLine, BandQuest, BandRewardReading, BandSitting, BandStanding, parliamentBandLine} from '@/client/console/parliament/parliamentBand';
import {chairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {quietRewardPoseOf, SittingPosition, SittingStage} from '@/client/console/parliament/consoleSittingFlow';
import {enactedYieldsOf, resolvingYieldsOf} from '@/client/console/parliament/influenceYieldModel';
import {parliamentRewardState, rewardLanded} from '@/client/console/parliament/parliamentRewardBeat';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from '@/client/console/parliament/partyReactionModel';
import {WinnerRewardReading, winnerRewardReadingOf, winnerRewardTableOf} from '@/client/console/parliament/winnerRewardModel';

export default defineComponent({
  name: 'ConsoleParliamentBand',
  components: {PlayerCube, ConsoleInfluenceYield, ConsolePartyReaction, ConsoleWinnerReward},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** Where the sitting stands — absent outside a live political phase this seat takes part in. */
    position: {type: Object as PropType<SittingPosition | undefined>, default: undefined},
    /** The sitting is the zone's subject right now (the section's own flow state). */
    sittingUp: {type: Boolean, default: false},
    stage: {type: String as PropType<SittingStage>, default: 'verdict'},
  },
  computed: {
    line(): BandLine {
      return parliamentBandLine({sitting: this.sitting, quest: this.quest, standing: this.standing});
    },
    /**
     * «ПРЕДСЕДАТЕЛЬСТВО»'s own context — the flow is never live during a
     * sitting (its gate is answered inside the player's own action phase), so
     * the two can never disagree about the zone.
     */
    quest(): BandQuest | undefined {
      if (!chairmanQuestFlow.live) {
        return undefined;
      }
      const move = chairmanQuestFlow.move;
      return {
        beat: chairmanQuestFlow.beat,
        ...(chairmanQuestFlow.player === undefined ? {} : {player: chairmanQuestFlow.player}),
        ...(chairmanQuestFlow.seatWas === undefined ? {} : {seatWas: chairmanQuestFlow.seatWas}),
        ...(move === undefined ? {} : {move: {from: move.from, to: move.to, ...(chairmanQuestFlow.bonus === undefined ? {} : {bonus: chairmanQuestFlow.bonus})}}),
      };
    },
    /** The sitting's own context, or `undefined` for the overview's line. */
    sitting(): BandSitting | undefined {
      const position = this.position;
      if (!this.sittingUp || position === undefined) {
        return undefined;
      }
      return {
        stage: this.stage,
        rewardStep: position.rewardStep,
        beat: sittingMotion.beat,
        supportWave: sittingMotion.supportWave,
        ...(sittingMotion.renewal === undefined ? {} : {renewal: sittingMotion.renewal}),
        generation: position.generation,
        awaiting: position.awaiting,
        summary: this.summary,
        reward: this.reward,
      };
    },
    summary(): ParliamentPhaseSummaryModel | undefined {
      return this.model?.phase?.summary;
    },
    /** The table AS IT STANDS: the resolution that would be enacted now and who would win it. */
    standing(): BandStanding {
      const slot = this.view.slots.find((s) => s.isWinning);
      if (slot === undefined) {
        return {votes: 0};
      }
      return {
        resolution: {resolution: slot.resolutionId, party: slot.party},
        ...(slot.leader === undefined ? {} : {player: slot.leader}),
        votes: slot.totalVotes,
      };
    },
    // ── the reward's reading (moved here from the sitting surface: the band is where it is read) ──
    resolution(): IClientResolution | undefined {
      const id = this.summary?.enacted.resolution;
      return id === undefined ? undefined : getResolution(id);
    },
    /** The viewer's OWN records among the phase's outcomes (the effects so far). */
    mine(): Array<ParliamentEnactOutcomeModel> {
      const outcomes = this.model?.phase?.outcomes;
      return this.viewerColor === undefined ? [] : (outcomes ?? []).filter((o) => o.player === this.viewerColor);
    },
    /**
     * THE READING: once the seat's record is in, the server's own amounts
     * (`resolving` while the phase pays, `applied` after); before that, the
     * declaration read at the seat's final influence — never a payout
     * recomputed on the client.
     */
    yields(): Array<InfluenceYield> {
      const resolution = this.resolution;
      const position = this.position;
      if (resolution === undefined || position === undefined) {
        return [];
      }
      const recorded = this.mine.length > 0 || position.step === 'adjourn' || position.step === 'done';
      if (!recorded) {
        return resolvingYieldsOf(resolution, this.model, this.viewerColor);
      }
      return enactedYieldsOf(resolution, this.model, this.viewerColor, {live: this.rewardResolving});
    },
    /** A chip owed or in the air, or the seat's own step still standing: the reading then says «this payout». */
    rewardResolving(): boolean {
      void parliamentRewardState.owed.length;
      void parliamentRewardState.flying.length;
      void parliamentRewardState.landed.length;
      const position = this.position;
      if (position === undefined) {
        return false;
      }
      const step = position.rewardStep;
      if (position.step === 'effects' && (step === 'reading' || step === 'choice' || step === 'intake' || step === 'placement')) {
        return true;
      }
      return this.mine.some((o) => !rewardLanded(o));
    },
    reactions(): Array<PartyReactionReading> {
      return viewerHasSeat(this.model, this.viewerColor) ? partyReactionsOf(this.resolution, this.yields) : [];
    },
    winnerReading(): WinnerRewardReading | undefined {
      return winnerRewardReadingOf(this.resolution, this.model, winnerRewardTableOf(this.playerView.game));
    },
    /** The reward's reading as the band's own data (the model orders it, this builds it). */
    reward(): BandRewardReading {
      const position = this.position;
      const quiet = quietRewardPoseOf(this.resolution);
      const yields = this.yields;
      const out: BandRewardReading = {
        yields,
        reactions: this.reactions.map((r) => ({party: r.party, amount: r.amount})),
        skips: this.skips,
      };
      if (this.winnerReading !== undefined) {
        out.tile = this.winnerReading.reward.tile;
      }
      if (yields.length === 0 && quiet !== undefined) {
        out.quiet = {kicker: quiet.kicker, kind: quiet.kind};
      }
      if (this.stateKey !== undefined) {
        out.state = this.stateKey;
      }
      if (position?.waitingFor !== undefined) {
        out.waitingFor = position.waitingFor.player;
      }
      return out;
    },
    /**
     * THE SKIPS — every record of the viewer's that paid nothing, named: a
     * `skipped` record by its own part and reason, a paying kind that paid zero
     * by its address's title. A scaled effect's skip is already read in the
     * yields block, so it is not repeated.
     */
    skips(): Array<{id: string, title: string, reason: string, amount?: number, unit?: string}> {
      const scaledIds = new Set((this.resolution?.scaled ?? []).map((e) => e.id));
      const out: Array<{id: string, title: string, reason: string, amount?: number, unit?: string}> = [];
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
          id: `${outcome.step}:${outcome.part ?? ''}`, title, reason: delivery.skipped,
          ...(amount !== undefined && amount > 0 ? {amount, unit: this.skipUnitClass(outcome)} : {}),
        });
      }
      return out;
    },
    /**
     * ONE WORD OF STATE beside the kicker, on the reward beat only: «эта
     * выплата» while the numbers are what the law is about to pay, «получено»
     * once every chip has landed. Absent everywhere else.
     */
    stateKey(): 'This payout' | 'Received' | undefined {
      const position = this.position;
      if (position === undefined || !this.sittingUp || this.stage !== 'reward') {
        return undefined;
      }
      if (this.yields.length === 0 && this.mine.length === 0 && this.winnerReading === undefined) {
        return undefined;
      }
      const recorded = this.mine.length > 0 || position.step === 'adjourn' || position.step === 'done';
      return !recorded || this.rewardResolving ? 'This payout' : 'Received';
    },
  },
  methods: {
    partyNameKey(party: string): string {
      return partyNameKey(party);
    },
    reactionOf(party: ReduxParty): PartyReactionReading | undefined {
      return this.reactions.find((r) => r.party === party);
    },
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    resolutionTitle(id: string): string {
      return resolutionTitleOf(this.view, id);
    },
    nameOf(color: Color | 'neutral'): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    nameOfColor(color: Color): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    bonusClass(bonus: 'tr' | 'card'): string {
      return iconClassFor(bonus === 'tr' ? 'tr' : 'cards');
    },
    /** The icon of what a skipped record would have paid — the console's own sprite families. */
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
  },
});
</script>
