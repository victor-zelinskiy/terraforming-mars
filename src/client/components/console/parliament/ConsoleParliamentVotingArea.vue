<template>
  <!-- ── THE VOTING AREA — ONE focus zone: three resolutions in the order
       that breaks ties (the first stands closest to the government), the
       delegates on each in placement order, the leader, the winning card
       (ONE accent: its badge and its gold seam — never a second line).
       Its slots are the vote mode's cards too: each is one DOM instance,
       teleported into the vote row while the mode stands. ── -->
  <div class="con-parl__voting"
       :class="{
         'con-parl__voting--focus': flow.zone === 'voting' && flow.stage === 'browse',
         'con-parl__voting--carried': slotsCarried || flow.voteLeaving,
         'con-parl__voting--lit': flow.stage === 'sitting' && sittingStage === 'renewal',
       }"
       data-parl-voting>
    <div class="con-parl__voting-head" data-parl-recede>
      <span class="con-parl__kicker">{{ $t('Voting') }}</span>
    </div>
    <div class="con-parl__slots">
      <div v-for="(slot, i) in shownSlots" :key="slot.instance" class="con-parl__slot-home" :data-home="slot.instance">
        <Teleport defer to="[data-parl-vrow]" :disabled="!slotsCarried">
          <div class="con-parl__slot"
               :class="{
                 'con-parl__slot--selected': slotsCarried && flow.slotIndex === i,
                 'con-parl__slot--winning': winningShownOf(slot),
                 'con-parl__slot--target': (flow.stage === 'seat' || (flow.stage === 'submitting' && flow.stageBeforeSubmit === 'seat')) && flow.slotIndex === i,
                 'con-parl__slot--candidate': flow.stage === 'seat' && seatCandidates.includes(i),
                 'con-parl__slot--mine': tallyOf(slot, i).leader !== undefined && tallyOf(slot, i).leader === viewerColor,
                 'con-parl__slot--landed': flow.landedSeq !== undefined && slot.votes.some((v) => v.seq === flow.landedSeq),
               }"
               :style="{'--parl-accent': partyAccent(slot.party)}"
               :data-instance="slot.instance"
               :data-party="slot.party"
               :data-order="slot.tiePriority"
               :data-votes="slot.totalVotes">
            <div class="con-parl__slot-label">
              <img class="con-parl__slot-emblem" :src="emblemUrl(slot.party)" alt="" />
              <span class="con-parl__slot-party">{{ $t(slot.party) }}</span>
              <span v-if="winningShownOf(slot)" class="con-parl__slot-win" :class="{'con-parl__slot-win--glyph': partyNameLong(slot.party)}"><span class="con-parl__slot-win-text">{{ $t('Winning') }}</span></span>
            </div>
            <div class="con-parl__card"
                 :class="{'con-parl__card--dealing': holds.freshFaces.has(slot.instance)}"
                 :data-zoom-slot="'resolution:' + slot.resolutionId"
                 :data-zoom-handoff="slotsCarried && flow.slotIndex === i ? 'parliament-vote' : undefined"
                 :data-parl-vote-card="slotsCarried && flow.slotIndex === i ? '' : undefined">
              <premium-card-face v-if="slotVms[i] !== undefined" :vmOverride="slotVms[i]" :lightweight="true" :inert="true" />
            </div>
            <!-- THE DELEGATE RIBBON — every delegate on the card, in placement
                 order (the order that breaks a tie among players), and — in
                 the vote mode, on the selected card — the PLACE the next
                 delegate takes (hollow until it lands: a forecast, never a
                 placement). -->
            <div class="con-parl__ribbon" :class="{'con-parl__ribbon--dense': slot.votes.length > DENSE_RIBBON}" :data-votes="slot.totalVotes" :data-parl-vote-ribbon="slotsCarried && flow.slotIndex === i ? '' : undefined">
              <template v-if="slot.votes.length <= DENSE_RIBBON">
                <span v-for="vote in slot.votes" :key="vote.seq" class="con-parl__vote-cube"
                      :class="{'con-parl__vote-cube--landed': vote.seq === flow.landedSeq, 'con-parl__vote-cube--hidden': vote.seq === flow.flightSeq || holds.hiddenCubes.has(slot.instance + '#' + vote.seq)}"
                      :data-seq="vote.seq"
                      :data-landed="vote.seq === flow.landedSeq ? '' : undefined">
                  <PlayerCube v-if="vote.owner !== 'neutral'" :color="vote.owner" :size="cubePx(RIBBON_CUBE)" />
                  <PlayerCube v-else color="neutral" steel :size="cubePx(RIBBON_CUBE)" />
                </span>
              </template>
              <template v-else>
                <span v-for="group in ribbonGroups(slot)" :key="group.owner" class="con-parl__vote-stack"
                      :class="{'con-parl__vote-stack--landed': group.hasSeq(flow.landedSeq)}"
                      :data-seq="group.seqs[group.seqs.length - 1]">
                  <PlayerCube v-if="group.owner !== 'neutral'" :color="group.owner" :size="cubePx(RIBBON_CUBE)" />
                  <PlayerCube v-else color="neutral" steel :size="cubePx(RIBBON_CUBE)" />
                  <b>×{{ group.count }}</b>
                </span>
              </template>
              <span v-if="placeShownOn(i)" class="con-parl__vote-cube con-parl__vote-cube--place" data-parl-vote-place aria-hidden="true"></span>
              <span v-if="slot.votes.length === 0 && !placeShownOn(i)" class="con-parl__ribbon-empty">{{ $t('No delegates yet') }}</span>
            </div>
            <!-- THE TALLY — TWO FIXED LINES for every slot: «N delegates ·
                 leader», then «yours ○○ n» with the two places of the
                 party-effect threshold — the same rows at the same heights
                 whatever the count, so no card ever moves because its
                 neighbour's line wrapped. In flight, the selected card's
                 numbers wait for the touchdown. -->
            <div class="con-parl__tally" data-parl-tally>
              <span class="con-parl__tally-line">
                <span class="con-parl__tally-total">
                  <b :key="'t' + tallyOf(slot, i).votes" class="con-parl__tally-num con-parl__tick">{{ tallyOf(slot, i).votes }}</b>
                  <span class="con-parl__tally-unit">{{ delegatesWord(tallyOf(slot, i).votes) }}</span>
                </span>
                <span v-if="tallyOf(slot, i).leader !== undefined" class="con-parl__tally-row con-parl__tally-row--leader" data-parl-leader>
                  <span class="con-parl__tally-key">{{ $t('Leader') }}</span>
                  <PlayerCube v-if="tallyOf(slot, i).leader !== 'neutral'" :color="tallyOf(slot, i).leader" :size="cubePx(12)" :glow="false" />
                  <PlayerCube v-else color="neutral" steel :size="cubePx(12)" :glow="false" />
                </span>
                <span v-else class="con-parl__tally-row con-parl__tally-row--none">{{ $t('No leader yet') }}</span>
              </span>
              <span class="con-parl__tally-line con-parl__tally-line--mine">
                <span v-if="viewerParticipates && viewerColor !== undefined" class="con-parl__tally-row con-parl__tally-row--mine"
                      :class="{'con-parl__tally-row--held': tallyOf(slot, i).mine >= PARTY_EFFECT_THRESHOLD}" data-parl-mine>
                  <span class="con-parl__tally-key">{{ $t('Yours') }}</span>
                  <span class="con-parl__places" aria-hidden="true">
                    <span v-for="n in PARTY_EFFECT_THRESHOLD" :key="n" class="con-parl__place" :class="{'con-parl__place--on': n <= tallyOf(slot, i).mine}">
                      <PlayerCube v-if="n <= tallyOf(slot, i).mine" :color="viewerColor" :size="cubePx(10)" :glow="false" />
                    </span>
                  </span>
                  <b :key="'m' + tallyOf(slot, i).mine" class="con-parl__tick">{{ tallyOf(slot, i).mine }}</b>
                  <span v-if="tallyOf(slot, i).mine >= PARTY_EFFECT_THRESHOLD" class="con-parl__tally-held">{{ $t('effect is yours') }}</span>
                </span>
              </span>
            </div>
          </div>
        </Teleport>
      </div>
      <!-- AN EMPTY SLOT NAMES ITSELF. While few parties have real
           resolutions the refresh finds nothing for a slot (distinct
           parties, never the ruling one's) and leaves it EMPTY: the same
           anatomy as a slot, a card-shaped outline where a card would
           stand and one line that says why — never an unexplained hole.
           A card enacted from this position still leaves from HERE. -->
      <!-- …but it names itself only once the ENACTED card has physically left (registry R-25): while the
           director still parks that card over its former slot, the model already lists the slot as empty
           and «ПУСТОЙ СЛОТ» stood over a card the player could see. The head and the reason wait for
           the enactment beat; the outline stays. -->
      <div v-for="n in emptySlotCount" :key="'empty-' + n" class="con-parl__slot-home con-parl__slot-home--empty" data-parl-slot-empty :data-parl-slot-empty-held="holds.parked !== undefined ? 'true' : undefined">
        <div class="con-parl__slot-empty">
          <div class="con-parl__slot-label">
            <span v-if="holds.parked === undefined" class="con-parl__slot-party">{{ $t('Empty slot') }}</span>
          </div>
          <div class="con-parl__slot-empty-card" data-parl-slot-empty-card aria-hidden="true"></div>
          <span v-if="holds.parked === undefined" class="con-parl__slot-empty-reason">{{ $t(emptySlotReason) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PARLIAMENT_VOTING_SLOTS, PARTY_EFFECT_DELEGATES as PARTY_EFFECT_THRESHOLD, ReduxParty} from '@/common/parliament/ParliamentTypes';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {parliamentFlow, parliamentSlotsCarried} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {ParliamentSlotVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {
  DENSE_RIBBON, placeShownOn, RIBBON_CUBE, RibbonGroup, ribbonGroupsOf, tallyShownOf, winningShownOf,
} from '@/client/console/parliament/parliamentVoteView';

/**
 * The VOTING AREA tier: the resolution slots (each ONE DOM instance the vote
 * mode teleports into its row), their ribbons and tallies as SHOWN — every
 * number waits for the delegate's touchdown, every hidden cube for its flight.
 */
export default defineComponent({
  name: 'ConsoleParliamentVotingArea',
  components: {PlayerCube},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    viewerParticipates: {type: Boolean, default: false},
    benchWarn: {type: Boolean, default: false},
    /** The seat pick's candidate slots (indices). */
    seatCandidates: {type: Array as PropType<ReadonlyArray<number>>, default: () => []},
    /** The results scene's current focus ('' outside the scene). */
    /** The SITTING's stage on screen ('' outside the sitting) — the renewal lights the refreshed area. */
    sittingStage: {type: String, default: ''},
  },
  data() {
    return {DENSE_RIBBON, PARTY_EFFECT_THRESHOLD, RIBBON_CUBE};
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    holds() {
      return parliamentHolds;
    },
    /** The three slots are in the vote row (up, or folding back — the leave animates them home first). */
    slotsCarried(): boolean {
      return parliamentSlotsCarried();
    },
    /**
     * THE SLOTS AS SHOWN: the live model — or, while the sitting HOLDS the
     * reward pose through a step that already refreshed the table, the slots
     * as they stood (registry R-25в). The director's holds hide what the
     * renewal beat has yet to move; this hold keeps what it has yet to
     * take away.
     */
    shownSlots(): ReadonlyArray<ParliamentSlotVm> {
      return this.holds.heldSlots ?? this.view.slots;
    },
    slotVms(): Array<PremiumCardVM | undefined> {
      return this.shownSlots.map((slot) => resolutionPremiumVmById(slot.resolutionId));
    },
    /** Voting slots the refresh could not fill (distinct parties, never the ruling one's) — each shown as an EMPTY slot. */
    emptySlotCount(): number {
      return Math.max(0, PARLIAMENT_VOTING_SLOTS - this.shownSlots.length);
    },
    /** WHY a slot stands empty: the final vote deals nothing after it; otherwise nothing of another party was left to deal. */
    emptySlotReason(): string {
      return this.model?.phase === undefined && this.model?.lastPhase?.final === true ?
        'No new resolution after the final vote' :
        'The deck has no resolution of another party';
    },
  },
  methods: {
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    /** «N delegates» with the language's own plural forms. */
    delegatesWord(n: number): string {
      return translateTextWithParams('${0} delegates', [String(n)]).replace(/^\d+\s*/, '');
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    /** A slot's tally as SHOWN: the selected card waits for the touchdown before its numbers move. */
    tallyOf(slot: ParliamentSlotVm, index: number): {votes: number, mine: number, leader: Color | 'neutral' | undefined} {
      return tallyShownOf(slot, index);
    },
    winningShownOf(slot: ParliamentSlotVm): boolean {
      return winningShownOf(slot);
    },
    placeShownOn(index: number): boolean {
      return placeShownOn(index, this.benchWarn);
    },
    ribbonGroups(slot: ParliamentSlotVm): Array<RibbonGroup> {
      return ribbonGroupsOf(slot);
    },
    /**
     * A party name too long to share the slot's label row with the «winning»
     * WORD on a narrow slot (calibrated on the Deck: «МАРС ВПЕРЕД», 11, fits
     * beside it; «ИНДУСТРИАЛИСТЫ», 14, does not) — its badge says it with the
     * vote's winner glyph instead, never by cutting the name.
     */
    partyNameLong(party: PartyName): boolean {
      return translateText(party).length > 12;
    },
  },
});
</script>
