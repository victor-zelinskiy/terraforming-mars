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
         'con-parl__voting--carried': slotsCarried || (flow.voteLeaving && !hall),
         'con-parl__voting--selecting': voteSelecting && hall,
         'con-parl__voting--lit': flow.stage === 'sitting' && (sittingStage === 'renewal' || sittingStage === 'results'),
       }"
       data-parl-voting>
    <div class="con-parl__voting-head" data-parl-recede>
      <span class="con-parl__kicker">{{ $t('Voting') }}</span>
    </div>
    <div class="con-parl__slots">
      <div v-for="(slot, i) in shownSlots" :key="slot.instance" class="con-parl__slot-home" :class="{'con-parl__slot-home--vacated': homeEmptied(slot)}" :data-home="slot.instance" :data-parl-slot-vacated="homeEmptied(slot) ? '' : undefined" data-parl-body-item>
        <!-- A HELD slot whose card has LEFT — for the government (v2), or for the discard at the renewal («departed»):
             an empty outline in its OWN place — the row never re-orders under the player. -->
        <div v-if="homeEmptied(slot)" class="con-parl__slot-empty" data-parl-slot-empty>
          <!-- (v3 В6) It explains itself EXACTLY like the empty slot beside it — a place that says «пусто» next to
               a mute place of the same size was the emptier of the two. The label names the place, the plate says
               why it is empty: this card has just been enacted, or has just been discarded. -->
          <!-- «Зал» v7 (П2): the empty place is its OUTLINE — no label, no sentence; WHY it is empty rides the node
               for the probes and the reading line. -->
          <div class="con-parl__slot-empty-card" data-parl-slot-empty-card aria-hidden="true"
               :data-parl-slot-empty-why="holds.departed.has(slot.instance) ? 'discarded' : 'enacted'"></div>
        </div>
        <Teleport v-else defer to="[data-parl-vrow]" :disabled="!slotsCarried">
          <div class="con-parl__slot"
               :class="{
                 'con-parl__slot--selected': voteSelecting && flow.slotIndex === i,
                 'con-parl__slot--focus': flow.stage === 'browse' && flow.zone === 'voting' && flow.slotIndex === i,
                 'con-parl__slot--winning': winningShownOf(slot),
                 // THE SITTING'S VERDICT (the owner, 2026-10-24): the resolution that WON and is being enacted is the table's
                 // one subject — its card rings strongest, the others recede while the verdict reads.
                 'con-parl__slot--enacting': sittingWinnerInstance === slot.instance,
                 'con-parl__slot--outvoted': sittingStage === 'verdict' && sittingWinnerInstance !== undefined && sittingWinnerInstance !== slot.instance,
                 'con-parl__slot--lit': motion.litSlot === slot.instance,
                 'con-parl__slot--awaiting': awaitingDeal(slot),
                 'con-parl__slot--target': (flow.stage === 'seat' || (flow.stage === 'submitting' && flow.stageBeforeSubmit === 'seat')) && flow.slotIndex === i,
                 'con-parl__slot--candidate': flow.stage === 'seat' && seatCandidates.includes(i),
                 'con-parl__slot--mine': tallyOf(slot, i).leader !== undefined && tallyOf(slot, i).leader === viewerColor,
                 'con-parl__slot--landed': flow.landedSeq !== undefined && slot.votes.some((v) => v.seq === flow.landedSeq || flow.landedSeqs.includes(v.seq)),
               }"
               :style="{'--parl-accent': partyAccent(slot.party)}"
               :data-instance="slot.instance"
               :data-party="slot.party"
               :data-order="slot.tiePriority"
               :data-votes="slot.totalVotes"
               :data-parl-slot-awaiting="awaitingDeal(slot) ? '' : undefined">
            <div class="con-parl__card"
                 :class="{'con-parl__card--dealing': awaitingDeal(slot) || holds.liftedFaces.has(slot.instance)}"
                 :data-zoom-slot="'resolution:' + slot.resolutionId"
                 :data-zoom-handoff="voteSelecting && flow.slotIndex === i ? 'parliament-vote' : undefined"
                 :data-parl-vote-card="voteSelecting && flow.slotIndex === i ? '' : undefined">
              <premium-card-face v-if="slotVms[i] !== undefined" :vmOverride="slotVms[i]" :lightweight="true" :artTier="artTier" :inert="true" />
              <!-- THE CROWN («Зал» v7): the table's ONE accent — the winner glyph on the bill's own corner, one form on
                   every profile, the word for assistive tech only. The VERDICT's mark (v4 §2.1) is the same object a
                   step brighter, carrying the seat that won as a cube; it stands only while the verdict is the subject. -->
              <span v-if="winningShownOf(slot)" class="con-parl__slot-win con-parl__slot-win--glyph" :data-hint="$t('Leading the vote')" :aria-label="$t('Leading the vote')" role="img"></span>
              <span v-else-if="sittingWinnerInstance === slot.instance" class="con-parl__slot-win con-parl__slot-win--verdict con-parl__slot-win--glyph"
                    :data-hint="$t('Being enacted')" :aria-label="$t('Being enacted')" role="img" data-parl-slot-verdict>
                <PlayerDelegate v-if="sittingWinnerColor !== undefined" class="con-parl__slot-win-cube"
                            :color="sittingWinnerColor === 'neutral' ? 'neutral' : sittingWinnerColor"
                            :steel="sittingWinnerColor === 'neutral'" :size="figurePx(18)" :glow="false" />
              </span>
            </div>
            <!-- THE DELEGATE RIBBON — every delegate on the card, in placement
                 order (the order that breaks a tie among players), and — in
                 the vote mode, on the selected card — the PLACE the next
                 delegate takes (hollow until it lands: a forecast, never a
                 placement). -->
            <div class="con-parl__ribbon" :class="{'con-parl__ribbon--dense': slot.votes.length > DENSE_RIBBON}" :data-votes="slot.totalVotes" :data-parl-vote-ribbon="voteSelecting && flow.slotIndex === i ? '' : undefined">
              <template v-if="slot.votes.length <= DENSE_RIBBON">
                <span v-for="vote in slot.votes" :key="vote.seq" class="con-parl__vote-cube"
                      :class="{'con-parl__vote-cube--landed': vote.seq === flow.landedSeq || flow.landedSeqs.includes(vote.seq), 'con-parl__vote-cube--hidden': vote.seq === flow.flightSeq || flow.pendingSeqs.includes(vote.seq) || holds.hiddenCubes.has(slot.instance + '#' + vote.seq), 'con-parl__vote-cube--arrived': rival.arrived.has(slot.instance + '#' + vote.seq), 'con-parl__vote-cube--counted': countedOf(slot, vote.seq), 'con-parl__vote-cube--outgoing': outgoingOf(slot, vote.seq)}"
                      :data-seq="vote.seq"
                      :data-delegate-outgoing="outgoingOf(slot, vote.seq) ? '' : undefined"
                      :data-landed="vote.seq === flow.landedSeq || flow.landedSeqs.includes(vote.seq) ? '' : undefined"
                      :data-arrived="rival.arrived.has(slot.instance + '#' + vote.seq) ? '' : undefined"
                      :data-counted="countedOf(slot, vote.seq) ? '' : undefined">
                  <PlayerDelegate v-if="vote.owner !== 'neutral'" :color="vote.owner" />
                  <PlayerDelegate v-else color="neutral" steel />
                </span>
              </template>
              <template v-else>
                <span v-for="group in ribbonGroups(slot)" :key="group.owner" class="con-parl__vote-stack"
                      :class="{'con-parl__vote-stack--landed': group.hasSeq(flow.landedSeq) || flow.landedSeqs.some((seq) => group.hasSeq(seq)), 'con-parl__vote-cube--counted': group.seqs.some((seq) => countedOf(slot, seq)), 'con-parl__vote-stack--outgoing': group.seqs.some((seq) => outgoingOf(slot, seq))}"
                      :data-seq="group.seqs[group.seqs.length - 1]"
                      :data-counted="group.seqs.some((seq) => countedOf(slot, seq)) ? '' : undefined">
                  <PlayerDelegate v-if="group.owner !== 'neutral'" :color="group.owner" />
                  <PlayerDelegate v-else color="neutral" steel />
                  <b>×{{ group.count }}</b>
                </span>
              </template>
              <span v-if="placeShownOn(i)" class="con-parl__vote-cube con-parl__vote-cube--place" data-parl-vote-place aria-hidden="true"></span>
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
                  <!-- «Зал» v7: the number alone — the ribbon above IS the delegates; the leader is its first cube, said
                       once more here as the cube beside the count (a11y: the sentence). -->
                  <b :key="'t' + tallyOf(slot, i).votes" class="con-parl__tally-num con-parl__tick" :aria-label="tallyOf(slot, i).votes + ' ' + delegatesWord(tallyOf(slot, i).votes)">{{ tallyOf(slot, i).votes }}</b>
                </span>
                <span v-if="tallyOf(slot, i).leader !== undefined" class="con-parl__tally-row con-parl__tally-row--leader" data-parl-leader :aria-label="$t('Leader')">
                  <PlayerDelegate v-if="tallyOf(slot, i).leader !== 'neutral'" :color="tallyOf(slot, i).leader" :size="figurePx(18)" :glow="false" />
                  <PlayerDelegate v-else color="neutral" steel :size="figurePx(18)" :glow="false" />
                </span>
                <!-- No leader: the fact row's own dash (P-02: «0 делегатов · Лидера пока нет · Делегатов пока нет» said it three times). -->
                <span v-else class="con-parl__tally-row con-parl__tally-row--none" aria-hidden="true">—</span>
              </span>
              <span class="con-parl__tally-line con-parl__tally-line--mine">
                <!-- THE PLACES are the PRINTED two, always in the flow; a place past the viewer's OWN threshold for this
                     party (a card lowered it — TR36) is VOID: hidden, its room kept. «Эффект ваш» is judged by that same
                     number, and it ENTERS as a phrase on a well that opens (one class flip; the row re-centres over the
                     same motion instead of jumping) — the moment the effect becomes the viewer's is read, never blinked. -->
                <span v-if="viewerParticipates && viewerColor !== undefined" class="con-parl__tally-row con-parl__tally-row--mine"
                      :class="{'con-parl__tally-row--held': tallyOf(slot, i).mine >= slot.viewerEffectDelegates}" data-parl-mine
                      :data-parl-mine-threshold="slot.viewerEffectDelegates" :data-parl-mine-count="tallyOf(slot, i).mine" :aria-label="$t('Yours') + ' ' + tallyOf(slot, i).mine + '/' + slot.viewerEffectDelegates">
                  <!-- «Зал» v7: the two filled places ARE «effect is yours» — no phrase; the marker rides the places for the probes. -->
                  <span class="con-parl__places" aria-hidden="true" :data-parl-held="tallyOf(slot, i).mine >= slot.viewerEffectDelegates ? '' : undefined">
                    <span v-for="n in PARTY_EFFECT_PLACES" :key="n" class="con-parl__place"
                          :class="{'con-parl__place--on': n <= tallyOf(slot, i).mine && n <= slot.viewerEffectDelegates, 'con-parl__place--void': n > slot.viewerEffectDelegates}"
                          :data-parl-place-void="n > slot.viewerEffectDelegates ? '' : undefined">
                      <PlayerDelegate v-if="n <= tallyOf(slot, i).mine && n <= slot.viewerEffectDelegates" :color="viewerColor" :size="figurePx(18)" :glow="false" />
                    </span>
                  </span>
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
      <div v-for="n in emptySlotCount" :key="'empty-' + n" class="con-parl__slot-home con-parl__slot-home--empty" data-parl-slot-empty :data-parl-slot-empty-held="holds.parked !== undefined ? 'true' : undefined" data-parl-body-item>
        <div class="con-parl__slot-empty">
          <!-- «Зал» v7 (П2): the outline alone; WHY the deck could not fill it rides the node for the reading line. -->
          <div class="con-parl__slot-empty-card" data-parl-slot-empty-card aria-hidden="true" :data-parl-slot-empty-why="holds.parked === undefined ? emptySlotReason : undefined"></div>
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
import {PARLIAMENT_VOTING_SLOTS, ReduxParty} from '@/common/parliament/ParliamentTypes';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {translateTextWithParams} from '@/client/directives/i18n';
import {consoleParliamentUi, parliamentFlow, parliamentSlotsCarried, parliamentVoteSelecting} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {rivalVotes} from '@/client/console/parliament/parliamentRivalVotes';
import {rallyMarked, rallyVoteKey, rallyWinnerShown} from '@/client/console/parliament/neutralRally';
import {parliamentArtTier} from '@/client/console/parliament/parliamentArtTier';
import {CardArtTier} from '@/client/cards/cardArt';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {PARTY_EFFECT_PLACES, ParliamentSlotVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {
  DENSE_RIBBON, placeShownOn, RibbonGroup, ribbonGroupsOf, tallyShownOf, winningShownOf,
} from '@/client/console/parliament/parliamentVoteView';
import {voteDecidedAt} from '@/client/console/parliament/consoleSittingFlow';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import {delegateRemovalGhostVote} from '@/client/console/parliament/delegateRemoval';

/**
 * The VOTING AREA tier: the resolution slots (each ONE DOM instance the vote
 * mode teleports into its row), their ribbons and tallies as SHOWN — every
 * number waits for the delegate's touchdown, every hidden cube for its flight.
 */
export default defineComponent({
  name: 'ConsoleParliamentVotingArea',
  components: {PlayerDelegate},
  setup() {
    const {isHandheld, isTv} = useConsoleViewport();
    return {isHandheld, isTv};
  },
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
    /**
     * THE DELEGATE MODE's cursor on a bill (TR72): the figure under the cursor — its bill's party and the vote that
     * would leave (the owner's latest). It takes the cursor and stands «outgoing» (faded, its trace dashed) — a
     * forecast, never a removal. Undefined elsewhere (the cursor on an area, past the press, outside the mode).
     */
    delegateTarget: {type: Object as PropType<{party: string, seq: number} | undefined>, default: undefined},
  },
  data() {
    return {DENSE_RIBBON, PARTY_EFFECT_PLACES};
  },
  computed: {
    /**
     * THE WINNER OF THE VOTE, as a chip AT THE CARD (v4 §2.1): while the sitting stands, the card being
     * enacted carries its badge and, beside it, the winning player's own cube. The verdict is read on the
     * objects — there is no panel over the row to read it from.
     */
    /**
     * THE SEAT THAT CARRIED THE RESOLUTION, as a cube in the winning card's own chip — the verdict read on the
     * OBJECT (v4 §2.1), because in table mode there is no panel to read it from. Only while the verdict IS the
     * subject: past the enactment the table has been refreshed and its «ПРИНИМАЕТСЯ» chip belongs to the NEXT
     * vote, so a cube from the summary of the vote just closed would be two facts under one mark.
     */
    sittingWinnerColor(): Color | 'neutral' | undefined {
      return this.sittingWinnerInstance === undefined ? undefined : this.model?.phase?.summary?.winner.player;
    },
    /** …and the card it belongs to: the instance the SUMMARY enacted, never the table's live re-ranking. */
    sittingWinnerInstance(): string | undefined {
      return this.sittingStage === 'verdict' || this.sittingStage === 'enact' ?
        this.model?.phase?.summary?.winner.instance : undefined;
    },
    /**
     * ONE form per profile (P-12): the word on the 1080 label row (every party name fits beside it — the
     * vote-fit clip probe), the winner glyph with its hint on the Deck AND the couch (measured on the TV:
     * «ИНДУСТРИАЛИСТЫ» 311 px + the word 292 px + the emblem and gaps = 681 px on a 608 px row — the word
     * cut the party name).
     */
    glyphBadge(): boolean {
      return this.isHandheld || this.isTv;
    },
    flow() {
      return parliamentFlow;
    },
    holds() {
      return parliamentHolds;
    },
    /** A rival's delegates that arrived (the ribbon's arrival mark plays once per cube). */
    rival() {
      return rivalVotes;
    },
    /** The director's poses (the verdict's lit slot). */
    motion() {
      return sittingMotion;
    },
    /** The three slots are in the vote row (up, or folding back — the leave animates them home first). */
    slotsCarried(): boolean {
      return parliamentSlotsCarried();
    },
    /** The vote mode selects a bill — the selection paints on the slot wherever it stands (the hall keeps it on the table). */
    voteSelecting(): boolean {
      return parliamentVoteSelecting();
    },
    /** The Parliament is the hall (v8): the bills never leave the table for the vote. */
    hall(): boolean {
      return consoleParliamentUi.hall;
    },
    /**
     * THE SLOTS AS SHOWN: the live model — or, while the sitting HOLDS the
     * reward pose through a step that already refreshed the table, the slots
     * as they stood (registry R-25в). The director's holds hide what the
     * renewal beat has yet to move; this hold keeps what it has yet to
     * take away.
     */
    shownSlots(): ReadonlyArray<ParliamentSlotVm> {
      const slots = this.holds.heldSlots ?? this.view.slots;
      // A FIGURE TAKEN OFF A BILL (TR72) still stands on its ribbon until it lifts off: the answer already removed its
      // vote, the ribbon keeps drawing it at its place (and the count with it) until the flight takes it.
      return slots.map((slot) => {
        const ghost = delegateRemovalGhostVote(slot.instance);
        if (ghost === undefined || slot.votes.some((vote) => vote.seq === ghost.seq)) {
          return slot;
        }
        return {...slot, votes: [...slot.votes, ghost].sort((a, b) => a.seq - b.seq), totalVotes: slot.totalVotes + 1};
      });
    },
    /** The surface's ONE art tier (`parliamentArtTier`) — the same from the overview to the vote row, the same as a proxy's. */
    artTier(): CardArtTier {
      return parliamentArtTier();
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
    figurePx(logical: number): number {
      return delegateFigurePx(logical);
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
    /**
     * A slot whose card is still ON THE DECK — a waiting place. Only on the LIVE table: while the sitting still HOLDS the
     * table as voted, a loser that will be dealt straight back is the same instance as its own fresh face, and the
     * held slot must go on showing the card that stands there (it leaves physically, in the tact, before the deal).
     */
    awaitingDeal(slot: ParliamentSlotVm): boolean {
      return this.holds.heldSlots === undefined && this.holds.freshFaces.has(slot.instance);
    },
    /** The card that has left its held slot: for the government (the winner), or for the discard (a loser at the renewal). */
    homeEmptied(slot: ParliamentSlotVm): boolean {
      return this.holds.vacated.has(slot.instance) || this.holds.departed.has(slot.instance);
    },
    winningShownOf(slot: ParliamentSlotVm): boolean {
      // While the renewal still has cards on the deck or cubes in the air, no card reads «принимается» yet: the
      // badge would name a verdict about objects that have not arrived (a caption never runs ahead of its object).
      // A card's RALLY (TR31) hides its own cubes the same way, but its marker is HELD, not silenced: the hold
      // says which card wins until the cube that changed it has landed (`rallyWinnerShown`).
      const renewing = rallyWinnerShown() === undefined && (this.holds.freshFaces.size > 0 || this.holds.hiddenCubes.size > 0);
      return winningShownOf(slot, voteDecidedAt(this.model?.phase?.step) || renewing);
    },
    /** The DELEGATE mode's cursor stands on this figure (TR72) — the one the press would take. */
    outgoingOf(slot: ParliamentSlotVm, seq: number): boolean {
      return this.delegateTarget !== undefined && this.delegateTarget.party === slot.party && this.delegateTarget.seq === seq;
    },
    /** The recount of a card's rally (TR31) has MARKED this neutral cube. */
    countedOf(slot: ParliamentSlotVm, seq: number): boolean {
      return rallyMarked(rallyVoteKey(slot.instance, seq));
    },
    partyNameKey(party: PartyName): string {
      return partyNameKey(party);
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
  },
});
</script>
