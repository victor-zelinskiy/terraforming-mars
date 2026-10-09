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
              :class="{'con-band__state--received': stateKey === 'Received' || stateKey === 'Taken'}"
              :data-parl-band-state="stateKey">{{ $t(stateKey) }}</span>
        <span class="con-band__chips">
          <!-- A walk's step chip is keyed on its STEP: the line stands for the whole walk and a landing inserts one
               node, whose own entrance is the step's arrival (PL-119) — the chips already read keep theirs. -->
          <template v-for="(chip, index) in line.chips" :key="chip.kind === 'agenda' ? 'agenda:' + chip.to : index">
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
            <span v-else-if="chip.kind === 'count'" class="con-band__chip" data-parl-band-chip="count" :data-parl-count-id="chip.id">
              <span class="con-band__text con-band__text--dim">{{ $t(chip.key) }}</span>
              <!-- A NAMED count ticks IN PLACE (the rally's recount — one mark per task): its own key, never the line's. -->
              <b v-if="chip.id !== undefined" :key="'n' + chip.amount" class="con-band__num con-parl__tick" :data-parl-count="chip.amount">{{ chip.amount }}</b>
              <b v-else class="con-band__num">{{ chip.amount }}</b>
            </span>
            <span v-else-if="chip.kind === 'agenda'" class="con-band__chip con-band__chip--agenda" data-parl-band-chip="agenda"
                  :data-parl-band-step="chip.to" :data-parl-band-level="chip.level">
              <span class="con-band__text con-band__text--dim">{{ $t('Agenda step') }}</span>
              <b class="con-band__num">{{ chip.to }}</b>
              <span v-if="chip.bonus !== undefined" class="con-band__bonus" :data-parl-band-bonus="chip.bonus">
                <b>+1</b><i class="con-band__unit" :class="bonusClass(chip.bonus)" aria-hidden="true"></i>
              </span>
              <!-- An INFLUENCE step: the glyph with the level in one disc (law 14 — a bare numeral reads as an ordinal). -->
              <span v-else-if="chip.level !== undefined" class="con-band__bonus con-band__bonus--inf">
                <i class="con-band__unit con-band__unit--inf" aria-hidden="true"></i><b>{{ chip.level }}</b>
              </span>
            </span>
            <ConsoleInfluenceYield v-else-if="chip.kind === 'yield'"
                                   class="con-band__yield"
                                   :yields="chip.yields"
                                   :levy="chip.levy"
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
            <!-- A TILE GRANTED BY THRESHOLD (Skyscrapers): the viewer's own tier — theirs by the vote or the
                 line, its destinations, the stack it became. A skipped seat reads its skip chip instead. -->
            <ConsoleTileGrant v-else-if="chip.kind === 'grant' && grantReading !== undefined"
                              class="con-band__grant"
                              :reading="grantReading"
                              size="compact"
                              variant="inline"
                              :reasonElsewhere="true"
                              data-parl-band-chip="grant" />
            <!-- THE PLANET'S OWN MOVE: no seat, no chip in anybody's hands — the
                 parameter, the step it made, and «РТ никому». A lowering is
                 stated in the LOSS tone; nothing here celebrates. -->
            <span v-else-if="chip.kind === 'world'" class="con-band__chip con-band__chip--world"
                  :class="{'con-band__chip--world-down': chip.steps < 0, 'con-band__chip--world-blocked': chip.skipped !== undefined}"
                  data-parl-band-chip="world" :data-parl-band-world="chip.parameter">
              <i class="con-band__unit" :class="worldUnitClass(chip.parameter)" aria-hidden="true"></i>
              <span v-if="chip.skipped !== undefined" class="con-band__text con-band__text--quiet">{{ $t(chip.skipped) }}</span>
              <template v-else>
                <b class="con-band__num">{{ chip.before }}{{ worldSuffix(chip.parameter) }}</b>
                <span class="con-band__text con-band__text--dim">→</span>
                <b class="con-band__num">{{ chip.after }}{{ worldSuffix(chip.parameter) }}</b>
                <span v-if="chip.unrewarded" class="con-band__text con-band__text--quiet">{{ $t('nobody gets the TR') }}</span>
              </template>
            </span>
            <!-- THE COLONY TABLE'S OWN MOVE (Unity Budget): no seat, no chip in anybody's hands — the declared
                 steps, then every tile with its marker before → after; a track at its end is NAMED on its own
                 member («на максимуме»), never dropped. Nothing here celebrates: it is a budget programme. -->
            <span v-else-if="chip.kind === 'tracks'" class="con-band__chip con-band__chip--tracks"
                  :class="{'con-band__chip--tracks-blocked': chip.skipped !== undefined}"
                  data-parl-band-chip="tracks" :data-parl-band-tracks="chip.steps">
              <span v-if="chip.skipped !== undefined" class="con-band__text con-band__text--quiet">{{ $t(chip.skipped) }}</span>
              <template v-else>
                <span class="con-band__text con-band__text--dim">{{ tracksLabel(chip.steps) }}</span>
                <span v-for="tile in chip.tiles" :key="tile.colony" class="con-band__track" :class="{'con-band__track--max': tile.atMax}"
                      data-parl-band-track :data-parl-band-track-colony="tile.colony" :data-parl-band-track-steps="tile.steps">
                  <span class="con-band__planet" :class="planetClass(tile.colony)" aria-hidden="true"></span>
                  <span v-if="tile.atMax" class="con-band__text con-band__text--quiet">{{ $t('track at its maximum') }}</span>
                  <template v-else>
                    <b class="con-band__num">{{ tile.before }}</b>
                    <span class="con-band__text con-band__text--dim">→</span>
                    <b class="con-band__num">{{ tile.after }}</b>
                  </template>
                </span>
              </template>
            </span>
            <span v-else-if="chip.kind === 'skip'" class="con-band__chip con-band__chip--skip"
                  data-parl-band-chip="skip" data-sit-skip :data-sit-skip-amount="chip.amount">
              <span class="con-band__text con-band__text--dim">{{ $t('Skipped') }} · {{ $t(chip.title) }}</span>
              <span v-if="chip.amount !== undefined" class="con-band__lost con-iyield__out con-iyield__out--lost">
                <b>✕ +{{ chip.amount }}</b><ConsoleYieldUnit :classes="chip.units ?? [chip.unit ?? '']" />
              </span>
              <span class="con-band__text con-band__text--quiet">{{ $t(chip.reason) }}</span>
            </span>
            <!-- A PARTY'S SUPPORT LEAVING (TR12 «САНКЦИИ»): the emblem, the neutral cube, the count — the cubes the press
                 sends back to the common supply. -->
            <span v-else-if="chip.kind === 'supportDelta'" class="con-band__chip con-band__chip--support" data-parl-band-chip="supportDelta"
                  :data-parl-band-support="chip.party" :data-parl-band-support-delta="chip.amount">
              <img class="con-band__emblem" :src="emblemUrl(chip.party)" alt="" />
              <b class="con-band__text">{{ $t(partyNameKey(chip.party)) }}</b>
              <PlayerCube color="neutral" steel :size="cubePx(11)" :glow="false" />
              <b class="con-band__num">−{{ chip.amount }}</b>
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
import ConsoleYieldUnit from '@/client/components/console/parliament/ConsoleYieldUnit.vue';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import ConsoleWinnerReward from '@/client/components/console/parliament/ConsoleWinnerReward.vue';
import ConsoleTileGrant from '@/client/components/console/parliament/ConsoleTileGrant.vue';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {parliamentPlayerName, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {
  BandLine, BandQuest, BandRally, BandRewardReading, BandRewardState, bandRewardTakes, BandSitting, BandStanding, BandSupport, BandWalk, parliamentBandLine,
} from '@/client/console/parliament/parliamentBand';
import {chairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {agendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {quietRewardPoseOf, SittingPosition, SittingStage} from '@/client/console/parliament/consoleSittingFlow';
import {enactedLevyOf, enactedYieldsOf, resolvingLevyOf, resolvingYieldsOf} from '@/client/console/parliament/influenceYieldModel';
import {LevyReading} from '@/common/parliament/resolutionLevy';
import {parliamentRewardState, rewardLanded} from '@/client/console/parliament/parliamentRewardBeat';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from '@/client/console/parliament/partyReactionModel';
import {WinnerRewardReading, winnerRewardGlyph, winnerRewardReadingOf, winnerRewardTableOf} from '@/client/console/parliament/winnerRewardModel';
import {TileGrantReading, tileGrantReadingOf} from '@/client/console/parliament/tileGrantModel';
import {worldMoveReadingOf, worldParameterUnit} from '@/client/console/parliament/worldMoveModel';
import {COLONY_TRACK_SUMMARY_KEY, ColonyTrackMoveChip, colonyTrackChipsOf, colonyTrackReadingOf} from '@/client/console/parliament/colonyTrackModel';
import {tileRemovalChipOf, tileRemovalReadingOf, tileRemovalTableOf} from '@/client/console/parliament/tileRemovalModel';
import {translateTextWithParams} from '@/client/directives/i18n';
import {ParameterMoveId} from '@/common/parliament/parameterMove';

export default defineComponent({
  name: 'ConsoleParliamentBand',
  components: {PlayerCube, ConsoleInfluenceYield, ConsolePartyReaction, ConsoleWinnerReward, ConsoleTileGrant, ConsoleYieldUnit},
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
    /** «САНКЦИИ»'s own context — the support-area mode's cursor and its press (undefined outside the mode). */
    support: {type: Object as PropType<BandSupport | undefined>, default: undefined},
    /** «ДЕЛЕГАТЫ»'s own context — a card's rally of neutral delegates, live in this section (undefined outside it). */
    rally: {type: Object as PropType<BandRally | undefined>, default: undefined},
  },
  computed: {
    line(): BandLine {
      return parliamentBandLine({sitting: this.sitting, quest: this.quest, walk: this.walk, rally: this.rally, support: this.support, standing: this.standing});
    },
    /**
     * «КАРЬЕРА»'s own context — a card's walk, live in this section: the seat and the steps LANDED so far.
     * An influence step carries the level it set (the track's own arithmetic), a paying step its bonus.
     */
    walk(): BandWalk | undefined {
      const flow = agendaWalkFlow;
      if (!flow.live || flow.owed === undefined) {
        return undefined;
      }
      return {
        player: flow.owed.player,
        landed: flow.landed.map((step) => step.bonus === undefined ? {to: step.to, level: influenceAtAgenda(step.to)} : {to: step.to, bonus: step.bonus}),
      };
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
    /** THE LEVY a budget takes first — the same moments as `yields`: the estimate as «this payout», then the seat's record. */
    levy(): LevyReading | undefined {
      const resolution = this.resolution;
      const position = this.position;
      if (resolution === undefined || position === undefined || resolution.levy === undefined) {
        return undefined;
      }
      const recorded = this.mine.length > 0 || position.step === 'adjourn' || position.step === 'done';
      if (!recorded) {
        return resolvingLevyOf(resolution, this.model, this.viewerColor);
      }
      return enactedLevyOf(resolution, this.model, this.viewerColor, {live: this.rewardResolving});
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
      if (position.step === 'effects' && (step === 'reading' || step === 'choice' || step === 'distribution' || step === 'intake' || step === 'placement')) {
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
    /** A tile granted by threshold (Skyscrapers): the viewer's own reading — the same model the vote block and the inspector read. */
    grantReading(): TileGrantReading | undefined {
      const reading = tileGrantReadingOf(this.resolution, this.model, this.viewerColor);
      return reading === undefined || reading.context === 'reference' ? undefined : reading;
    },
    /**
     * DOES THIS SEAT HAVE A PART OF ITS OWN on the reward line — a reading that pays or takes (a SKIP is
     * not a part: it names what did not happen), a levy, a party's answer, a granted tier, the quiet
     * standing effect, or the winner's part when this seat IS the winner. Without one the line is the
     * WINNER'S (docs/TURMOIL_REDUX_MARSBOT.md §8.6 — a bot's win draws the spectator no «Ваша награда»),
     * and no state word («получено») is said about a reward nobody here received.
     */
    ownPartOnLine(): boolean {
      if (this.yields.some((y) => y.skipped === undefined) || this.levy !== undefined || this.reactions.length > 0) {
        return true;
      }
      if (this.grantReading !== undefined && this.grantReading.skipped === undefined) {
        return true;
      }
      if (this.yields.length === 0 && quietRewardPoseOf(this.resolution) !== undefined) {
        return true;
      }
      const winner = this.model?.phase?.summary?.winner.player;
      return this.winnerReading !== undefined && winner !== undefined && winner === this.viewerColor;
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
      const levy = this.levy;
      if (levy !== undefined) {
        out.levy = levy;
      }
      if (this.winnerReading !== undefined) {
        out.tile = winnerRewardGlyph(this.winnerReading.reward);
        if (!this.ownPartOnLine) {
          out.winnerElsewhere = true;
        }
      }
      // A SKIPPED grant reads as its skip chip (the record's reason) — the grant chip is for a tier owed or placed.
      if (this.grantReading !== undefined && this.grantReading.skipped === undefined) {
        out.grant = this.grantReading.grant.tile;
      }
      const world = this.worldMoves;
      if (world.length > 0) {
        out.world = world;
      }
      const tracks = this.trackMoves;
      if (tracks !== undefined) {
        out.tracks = tracks;
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
     * THE WORLD'S OWN MOVES, from the phase's records — the ones that name no
     * seat. Read by every viewer alike; a move that could not happen carries
     * its reason instead of an arrow (no silent loss).
     */
    worldMoves(): Array<{parameter: ParameterMoveId, before: number, after: number, steps: number, unrewarded: boolean, skipped?: string}> {
      const outcomes = this.model?.phase?.outcomes ?? [];
      const out: Array<{parameter: ParameterMoveId, before: number, after: number, steps: number, unrewarded: boolean, skipped?: string}> = [];
      for (const reading of worldMoveReadingOf(this.resolution, winnerRewardTableOf(this.playerView.game), {enacted: true, outcomes})) {
        const applied = reading.applied;
        if (applied === undefined && reading.room === undefined) {
          continue;
        }
        out.push({
          parameter: reading.parameter,
          before: applied?.before ?? reading.room?.current ?? 0,
          after: applied?.after ?? reading.room?.resulting ?? 0,
          steps: applied?.steps ?? reading.room?.applied ?? 0,
          unrewarded: reading.unrewarded,
          ...(reading.skipped === undefined ? {} : {skipped: reading.skipped}),
        });
      }
      // …and a TILE TAKEN OFF THE BOARD (Water Export): the ocean count as the planet's own chip — the
      // record's before → after once the first player has chosen, the live room while the question stands,
      // or the named edge (the maximum, nothing to remove).
      const removal = tileRemovalReadingOf(this.resolution, tileRemovalTableOf(this.playerView.game.spaces), {enacted: true, outcomes});
      const chip = removal === undefined ? undefined : tileRemovalChipOf(removal);
      if (chip !== undefined) {
        out.push(chip);
      }
      return out;
    },
    /**
     * THE COLONY TABLE'S OWN MOVE (Unity Budget), from the phase's record — the
     * one that names no seat. Read by every viewer alike, once the server has
     * recorded it: before that the line has nothing honest to print (the
     * table is still to move), and the declaration reads on the card itself.
     */
    trackMoves(): {steps: number, tiles: ReadonlyArray<ColonyTrackMoveChip>, skipped?: string} | undefined {
      const outcomes = this.model?.phase?.outcomes ?? [];
      const reading = colonyTrackReadingOf(this.resolution, undefined, {enacted: true, outcomes});
      if (reading === undefined || reading.context !== 'applied') {
        return undefined;
      }
      return {steps: reading.advance.steps, tiles: colonyTrackChipsOf(reading), ...(reading.skipped === undefined ? {} : {skipped: reading.skipped})};
    },
    /**
     * THE SKIPS — every record of the viewer's that paid nothing, named: a
     * `skipped` record by its own part and reason, a paying kind that paid zero
     * by its address's title. A scaled effect's skip is already read in the
     * yields block, so it is not repeated.
     */
    skips(): Array<{id: string, title: string, reason: string, amount?: number, unit?: string, units?: Array<string>}> {
      const scaledIds = new Set((this.resolution?.scaled ?? []).map((e) => e.id));
      const out: Array<{id: string, title: string, reason: string, amount?: number, unit?: string, units?: Array<string>}> = [];
      for (const outcome of this.mine) {
        const delivery = rewardAddressOf(outcome, this.viewerColor);
        if (delivery.skipped === undefined || (outcome.effect !== undefined && scaledIds.has(outcome.effect))) {
          continue;
        }
        const title = outcome.kind === 'skipped' ?
          (outcome.part === 'winner' ? 'Reward for the winner of the vote' : 'Resolution effect') :
          REWARD_ADDRESS[outcome.kind].skipTitle;
        const amount = delivery.payload.amount;
        // A card-resource skip over SEVERAL kinds («data or microbe») names its unit by both icons, joined by «or».
        const units = outcome.resource === undefined && outcome.resources !== undefined && outcome.resources.length > 1 ?
          outcome.resources.map((r) => iconClassFor(cardResourceKey(String(r)))) : undefined;
        out.push({
          id: `${outcome.step}:${outcome.part ?? ''}`, title, reason: delivery.skipped,
          ...(amount !== undefined && amount > 0 ? {amount, unit: this.skipUnitClass(outcome), ...(units === undefined ? {} : {units})} : {}),
        });
      }
      return out;
    },
    /**
     * ONE WORD OF STATE beside the kicker, on the reward beat only: «эта
     * выплата» while the numbers are what the law is about to pay, «получено»
     * once every chip has landed. Absent everywhere else.
     */
    stateKey(): BandRewardState | undefined {
      const position = this.position;
      if (position === undefined || !this.sittingUp || this.stage !== 'reward') {
        return undefined;
      }
      if (this.yields.length === 0 && this.mine.length === 0 && this.winnerReading === undefined && this.grantReading === undefined) {
        return undefined;
      }
      // Nothing of this seat's own on the line (the winner's part is another seat's, its own part a skip at
      // most): no «эта выплата» / «получено» about a reward nobody here received.
      if (!this.ownPartOnLine) {
        return undefined;
      }
      const recorded = this.mine.length > 0 || position.step === 'adjourn' || position.step === 'done';
      const live = !recorded || this.rewardResolving;
      // A CUT keeps the same two moments and names them its own way — «эта потеря» while the
      // chips are still leaving, «отнято» once they are gone: never «получено».
      if (bandRewardTakes(this.yields)) {
        return live ? 'This loss' : 'Taken';
      }
      return live ? 'This payout' : 'Received';
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
    /** The parameter's own icon — the game's vocabulary, the same asset the HUD's status strip prints. */
    worldUnitClass(parameter: ParameterMoveId): string {
      switch (parameter) {
      case 'oxygen': return 'wgt-icon wgt-icon--oxygen';
      case 'oceans': return 'wgt-icon wgt-icon--ocean';
      case 'venus': return 'wgt-icon wgt-icon--venus';
      case 'temperature': return 'wgt-icon wgt-icon--temperature';
      }
    },
    /** …and its unit suffix («5 %», «−30 °C», a bare count of oceans). */
    worldSuffix(parameter: ParameterMoveId): string {
      return worldParameterUnit(parameter);
    },
    /** «Все треки колоний +2» — the ONE sentence of the colony table's part. */
    tracksLabel(steps: number): string {
      return translateTextWithParams(COLONY_TRACK_SUMMARY_KEY, [String(steps)]);
    },
    /** A tile's planet medallion — the colonies' own background class (the results panel prints the same). */
    planetClass(colony: string): string {
      return colony.replace(' ', '-') + '-background';
    },
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
