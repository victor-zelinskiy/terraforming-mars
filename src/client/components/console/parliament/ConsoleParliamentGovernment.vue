<template>
  <!-- ── THE GOVERNMENT — the enacted resolution is the MAIN OBJECT; beside
       it the RULING PARTY's own TILE (the same chassis and size as the five
       opposition tiles below — one DOM instance per party, teleported here
       by the parties tier; focusable: X inspects the party, A is the party
       action's door), the enacted resolution's OWN standing effect when it
       has one; under both, the chairman quest.
       DURING THE SITTING the block shows the PREVIOUS government until the
       enactment's beat has moved each piece (the display holds: the old
       card, the old ruler, the old quest closed with its outcome). ── -->
  <div class="con-parl__gov"
       :class="{
         'con-parl__gov--focus': flow.zone === 'government' && flow.stage === 'browse',
         'con-parl__gov--lit': sittingLit,
         'con-parl__gov--enacted': enactedShown !== undefined,
       }"
       :style="{'--parl-accent': partyAccent(rulerShown)}"
       data-parl-gov
       data-parl-recede>
    <div class="con-parl__gov-head">
      <span class="con-parl__kicker">{{ $t('Government') }}</span>
      <!-- The basis, and only the basis: a wait on ANOTHER seat is said ONCE, on the
           reward panel's own wait line with the seat's chip (registry R-11 — the same
           sentence stood here as a second kicker and was cut on the Deck). -->
      <span class="con-parl__gov-basis" :class="{'con-parl__gov-basis--default': govBasisKey === 'Starting rule'}">
        {{ $t(govBasisKey) }}
      </span>
    </div>
    <div class="con-parl__ruling" ref="rulingEl">
      <!-- The enacted card is ONE instance: while the resolution pays out it
           is TELEPORTED onto the enactment stage's hero slot (and FLIPs
           there and back) — never a copy beside the government. -->
      <Teleport v-if="enactedVm !== undefined" defer to="[data-parl-sit-hero]" :disabled="!enactCarried">
        <div class="con-parl__gov-carry" data-parl-gov-carry>
          <div class="con-parl__gov-card"
               :class="{'con-parl__gov-card--awaiting': holds.govAwaits !== undefined && holds.govAwaits === enactedShown?.instance}"
               :data-zoom-slot="'resolution:' + enactedShown?.resolutionId">
            <premium-card-face :vmOverride="enactedVm" :lightweight="!enactCarried" :artTier="artTier" :inert="true" />
          </div>
        </div>
      </Teleport>
      <!-- The ENACTED slot stands empty until the first political phase:
           an honest empty seat, never a placeholder card. -->
      <div v-else class="con-parl__gov-empty" data-parl-gov-empty>
        <span class="con-parl__gov-empty-mark" aria-hidden="true">◇</span>
        <span class="con-parl__gov-empty-text">{{ $t('No resolution enacted yet') }}</span>
      </div>
      <!-- THE RULER — the party's TILE lands here (teleported by the parties tier);
           under it the resolution's OWN standing effect (a second source, told apart). -->
      <div class="con-parl__ruler" :class="{'con-parl__ruler--focus': flow.zone === 'ruler' && flow.stage === 'browse'}" :data-zoom-slot="partyKeyOf(rulerShown)" data-parl-ruler>
        <span class="con-parl__ruler-kicker">{{ $t('Ruling party') }}</span>
        <div class="con-parl__ruler-slot" data-parl-ruler-slot></div>
        <div v-if="enactedOwnMechanics !== undefined" class="con-parl__ruler-own" data-parl-enacted-effect>
          <span class="con-parl__ruler-own-kicker" :data-parl-enacted-part="enactedOwnPart"><i class="con-parl__card-mark resource_icon resource_icon--cards" aria-hidden="true"></i>{{ $t(enactedOwnPart === 'action' ? 'Resolution action' : 'Resolution effect') }}</span>
          <PremiumMechanicsPanel class="con-parl__ruler-own-mech" :mechanics="enactedOwnMechanics" />
        </div>
      </div>
    </div>

    <!-- THE CHAIRMAN QUEST: the printed condition (a graphic + its short
         words), the race per seat, the reward as two things — the SEAT
         and ONE STEP of the Agenda (with what the viewer's next step
         pays) — and the chairman. While the sitting holds the OLD quest, it
         reads CLOSED: its outcome (who completed it, or nobody) instead of a race. -->
    <div v-if="questShown !== undefined" class="con-parl__quest"
         :class="{'con-parl__quest--done': questShown.completedBy !== undefined, 'con-parl__quest--closed': questClosed, 'con-parl__quest--pulse': questPulse || flow.questPulse}"
         @animationend="onQuestPulseEnd"
         data-parl-quest
         :data-parl-quest-closed="questClosed ? '' : undefined">
      <div class="con-parl__quest-head">
        <!-- THE CHAIR beside its words: a resolution's face prints this mark INSTEAD of the caption, so the
             block that owns the words is where the player learns it (one drawing — `PremiumChairGlyph`). -->
        <span class="con-parl__kicker"><PremiumChairGlyph class="con-parl__seat-glyph" />{{ $t('Chairman quest') }}</span>
        <span v-if="questShown.completedBy !== undefined" class="con-parl__quest-state">✓ {{ $t('Completed') }}</span>
        <span v-else-if="questClosed" class="con-parl__quest-state con-parl__quest-state--none">{{ $t('Nobody completed it') }}</span>
      </div>
      <div class="con-parl__quest-cond">
        <PremiumMechanicsPanel v-if="questMechanics !== undefined && !questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
        <span class="con-parl__quest-text">{{ $t(questShown.text) }}</span>
      </div>
      <!-- THE RACE IS ALWAYS RENDERED (v4 §2.4). It used to be dropped the moment the quest closed, and the
           government's whole geometry is solved against the room this block leaves: the sitting opens with the
           quest already CLOSED (the announce plate's A mounts the section there), so the enacted face was fitted
           against a block short by the race, and when the NEXT quest unfolded with its rows the card painted over
           the quest's own head. Closed, the rows are the FINAL standings — dimmed by `--closed` / `--done`, the
           same count of rows, the same height: the column stops moving under a solved zoom, and the outcome line
           («никто не выполнил») gains the numbers that explain it. -->
      <div v-if="questRows.length > 0" class="con-parl__quest-progress" data-parl-quest-progress>
        <span v-for="row in questRows" :key="row.color" class="con-parl__quest-row"
              :class="{'con-parl__quest-row--me': row.color === viewerColor, 'con-parl__quest-row--close': row.value > 0 && row.value >= questShown.definition.count - 1}">
          <PlayerCube :color="row.color" :size="cubePx(12)" />
          <b :key="row.value" class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ questShown.definition.count }}</span>
        </span>
      </div>
      <div class="con-parl__quest-foot">
        <!-- THE REWARD IS ALWAYS STATED (v4 §2.4/§2.6). It is what the quest PAYS — a property of the printed
             condition, not of the race — so hiding it while the quest reads closed said less AND changed the
             block's height by a whole foot line: the government's card zoom is solved against the room this
             block leaves, and a foot that grows one line mid-walk overflowed the card by 51 px at 4K (the
             geometry probe's own numbers). What §2.6 forbade was a SECOND sentence about the outcome («ИТОГ
             Никто» beside «НИКТО НЕ ВЫПОЛНИЛ»), and that row is gone; the reward is a different fact. -->
        <span class="con-parl__quest-reward" data-parl-quest-reward>
          <span class="con-parl__quest-reward-kicker">{{ $t(questShown.completedBy !== undefined ? 'Won by' : 'Reward') }}</span>
          <template v-if="questShown.completedBy !== undefined">
            <PlayerCube :color="questShown.completedBy" :size="cubePx(12)" />
            <b>{{ nameOf(questShown.completedBy) }}</b>
          </template>

          <template v-else>
            <span class="con-parl__reward-seat" :class="{'con-parl__reward-seat--kept': viewerIsChairman}">
              <!-- The reward is the OFFICE, not the chair (glossary §4, R-05): «ПРЕДСЕДАТЕЛЬСТВО + ШАГ ПОВЕСТКИ». -->
              <PremiumChairGlyph class="con-parl__seat-glyph" />{{ $t(viewerIsChairman ? 'Chairmanship (kept)' : 'Chairmanship') }}
            </span>
            <span class="con-parl__reward-tail">
            <span class="con-parl__reward-plus" aria-hidden="true">+</span>
            <span class="con-parl__reward-move">{{ $t('Agenda step') }}</span>
            <template v-if="agendaVm.nextStep !== undefined">
              <span class="con-parl__reward-arrow" aria-hidden="true">→</span>
              <span class="con-parl__reward-step" :class="'con-parl__reward-step--' + agendaVm.nextStep.kind" data-parl-reward-step>
                <template v-if="agendaVm.nextStep.kind === 'influence'"><span class="con-parl__step-level">{{ agendaVm.nextStep.influence }}</span></template>
                <template v-else-if="agendaVm.nextStep.kind === 'tr'"><i class="con-parl__step-res resource_icon resource_icon--rating" aria-hidden="true"></i></template>
                <template v-else><i class="con-parl__step-res resource_icon resource_icon--cards" aria-hidden="true"></i></template>
              </span>
            </template>
            </span>
          </template>
        </span>
        <span class="con-parl__chair" :class="{'con-parl__chair--won': questShown.completedBy !== undefined && questShown.completedBy === chairmanShown, 'con-parl__chair--pulse': flow.chairPulse}" data-parl-chair @animationend="onChairPulseEnd">
          <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
          <template v-if="chairmanShown !== undefined">
            <!-- The SEAT's cube — the place the chairman's delegate flies to. -->
            <span class="con-parl__chair-cube" :data-parl-seat-chair="chairmanShown"><PlayerCube :color="chairmanShown" :size="cubePx(12)" /></span>
            <b>{{ nameOf(chairmanShown) }}</b>
          </template>
          <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
        </span>
      </div>
    </div>
    <div v-else class="con-parl__chair con-parl__chair--alone" :class="{'con-parl__chair--pulse': flow.chairPulse}" data-parl-chair @animationend="onChairPulseEnd">
      <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
      <template v-if="chairmanShown !== undefined">
        <span class="con-parl__chair-cube" :data-parl-seat-chair="chairmanShown"><PlayerCube :color="chairmanShown" :size="cubePx(12)" /></span>
        <b>{{ nameOf(chairmanShown) }}</b>
      </template>
      <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, markRaw, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import PlayerCube from '@/client/components/PlayerCube.vue';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {PARLIAMENT_GRAPHIC, resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent} from '@/client/components/premiumCard/partyEmblems';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {parliamentFlow, settleParliamentChairPulse, settleParliamentQuestPulse} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {parliamentArtTier} from '@/client/console/parliament/parliamentArtTier';
import {fitParliamentCards} from '@/client/console/parliament/parliamentCardFit';
import {CardArtTier} from '@/client/cards/cardArt';
import {AgendaVm, parliamentPlayerName, ParliamentQuestVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {partyTileKey} from '@/client/console/parliament/partyActionKey';

/**
 * The GOVERNMENT tier: the enacted resolution (carried onto the payout stage
 * while it pays), the ruling party's TILE (teleported in by the parties tier),
 * the resolution's own standing effect, the chairman quest and the chair —
 * each read through the sitting's display holds (the previous government
 * stands until the enactment's beat has moved it).
 */
export default defineComponent({
  name: 'ConsoleParliamentGovernment',
  components: {PlayerCube, PremiumChairGlyph, PremiumMechanicsPanel},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    agendaVm: {type: Object as PropType<AgendaVm>, required: true},
    /** The SITTING's stage on screen ('' outside the sitting) — the verdict and the enactment light the government. */
    sittingStage: {type: String, default: ''},
  },
  data() {
    return {
      questPulse: false,
      roomObs: undefined as ResizeObserver | undefined,
    };
  },
  mounted() {
    this.observeRoom();
  },
  beforeUnmount() {
    this.roomObs?.disconnect();
    this.roomObs = undefined;
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    holds() {
      return parliamentHolds;
    },
    /** THE CARD AS SHOWN: the previous law while the enactment's beat still holds it, else the live one. */
    enactedShown(): ParliamentViewVm['enacted'] {
      const before = this.holds.govBefore;
      return before !== undefined ? before.enacted : this.view.enacted;
    },
    /** THE RULING PARTY AS SHOWN: the previous ruler until the plaques have changed places. */
    rulerShown(): ReduxParty {
      return this.holds.rulerBefore ?? this.view.rulingParty;
    },
    /** THE QUEST AS SHOWN: the previous quest (closed) until the new one unfolds. */
    questShown(): ParliamentQuestVm | undefined {
      const before = this.holds.questBefore;
      return before !== undefined ? before.quest : this.view.quest;
    },
    chairmanShown(): Color | undefined {
      // «ПРЕДСЕДАТЕЛЬСТВО»: the office has changed on the server and NOT on
      // screen yet — the chair keeps the previous holder (and reads empty from
      // the frame the outgoing delegate lifts off) until the new cube lands.
      const chair = this.holds.chairAwaits;
      if (chair !== undefined) {
        return chair.from;
      }
      const before = this.holds.questBefore;
      return before !== undefined ? before.chairman : this.view.chairman;
    },
    /**
     * THE QUEST READS CLOSED from the VERDICT on (v3 В2): the generation is over, so its race is over —
     * the block states its OUTCOME (who took the chairmanship, or nobody) where the verdict can be read,
     * and the enactment then has nothing to add: the whole block simply leaves and the new one unfolds.
     * Before v3 the outcome appeared mid-enactment, a third object changing inside one phrase.
     */
    questClosed(): boolean {
      return this.holds.questBefore !== undefined || this.sittingStage === 'verdict';
    },
    /**
     * THE BASIS THE SEAT SHOWS. While the enacted card is still on its way (the enactment beat holds the seat
     * empty — `holds.govAwaits`), the kicker keeps the PREVIOUS basis: «принятая резолюция» over an empty seat
     * named a card that had not arrived (P-16).
     */
    govBasisKey(): string {
      const enacted = this.enactedShown;
      if (enacted === undefined) {
        return 'Starting rule';
      }
      const awaiting = this.holds.govAwaits !== undefined && this.holds.govAwaits === enacted.instance;
      if (awaiting && this.model?.phase?.summary?.discardedEnacted === undefined) {
        return 'Starting rule';
      }
      // …and while the sitting is deciding, this block is the one that is LEAVING (v4 §2.3): it may not
      // call itself the enacted resolution before the new card has taken its place.
      if (parliamentFlow.stage === 'sitting' && !this.govArrived) {
        return 'Outgoing government';
      }
      return 'Enacted resolution';
    },
    viewerIsChairman(): boolean {
      return this.viewerColor !== undefined && this.chairmanShown === this.viewerColor;
    },
    /** The enacted card is on the sitting's stage (the one instance, teleported) — the stage took the field for a hosted step. */
    enactCarried(): boolean {
      return parliamentFlow.stage === 'sitting' && parliamentFlow.sittingField && this.enactedShown !== undefined;
    },
    /**
     * THE NEW SET HAS ARRIVED (v4 §2.3): the gold seam is the mark of the government IN POWER. At the
     * verdict the block is the OUTGOING one (nothing has moved yet) and during the enactment it is in
     * transit — the seam lights only once the new card has landed AND the new tile stands in its slot.
     * Gold may burn neither over what is leaving nor over what has not come.
     */
    govArrived(): boolean {
      const h = this.holds;
      return h.govBefore === undefined && h.rulerBefore === undefined && h.govAwaits === undefined && h.questBefore === undefined;
    },
    /** The SITTING lights the government — once its new set is in place, and for the rest of the sitting. */
    sittingLit(): boolean {
      return parliamentFlow.stage === 'sitting' && this.sittingStage !== 'verdict' && this.govArrived;
    },
    /** The surface's ONE art tier (`parliamentArtTier`) — the same in the government and on the payout's hero slot. */
    artTier(): CardArtTier {
      return parliamentArtTier();
    },
    enactedVm(): PremiumCardVM | undefined {
      const shown = this.enactedShown;
      return shown === undefined ? undefined : resolutionPremiumVmById(shown.resolutionId);
    },
    /**
     * The ENACTED resolution's OWN standing effect / action (its printed
     * graphic) — a second source beside the ruling party's, told apart in
     * the government. Undefined for a resolution whose only effect was the
     * enactment itself (already paid, nothing stands).
     */
    enactedOwnMechanics(): MechanicsVM | undefined {
      const resolution = this.enactedShown?.resolution;
      if (resolution === undefined || !(resolution.hasPassive || resolution.hasAction)) {
        return undefined;
      }
      const mechanics = buildMechanics(resolution.renderData, PARLIAMENT_GRAPHIC);
      return mechanics.textOnly ? undefined : mechanics;
    },
    /** Which part of the enacted card the graphic IS — an action is not an effect (the families rehearsal, frame 33). */
    enactedOwnPart(): 'effect' | 'action' {
      const resolution = this.enactedShown?.resolution;
      return resolution !== undefined && resolution.hasAction && !resolution.hasPassive ? 'action' : 'effect';
    },
    questMechanics(): MechanicsVM | undefined {
      const root = this.questShown?.renderData;
      return root === undefined ? undefined : buildMechanics(root, PARLIAMENT_GRAPHIC);
    },
    questRows(): ReadonlyArray<{color: Color, value: number}> {
      return (this.questShown?.progress ?? []).filter((row) => row.participates);
    },
    questCompletedBy(): Color | undefined {
      return this.view.quest?.completedBy;
    },
  },
  watch: {
    questCompletedBy(now: Color | undefined, was: Color | undefined): void {
      if (now !== undefined && was === undefined && parliamentFlow.stage !== 'sitting') {
        // A CSS one-shot (`con-parl-quest-pulse`): the flag is cleared by the
        // animation's own end, never by a timer guessing its length.
        this.questPulse = true;
      }
    },
  },
  methods: {
    /**
     * THE RULING ROW IS THE ROOM THE ENACTED CARD IS SOLVED INTO (`fitParliamentCards`: the column minus its
     * other blocks), and that room settles a beat AFTER the section's mount-time fit — measured at 4K: the
     * quest block read 387.8 px at the fit and 392.5 settled (its zoomed graphic and the race's cubes take
     * their size on the next frame), the head's kicker re-wraps when its font swaps in — while the FIELD the
     * section observes is frame-sized and never moves. Solved against the early room, the card stood 2 px past
     * its row (one run in eight). So the row itself is observed: whatever shrinks it — the quest, the head, a
     * gap — re-solves the card from the room that stands. Loop-safe: the row is flex-sized by the column and
     * its content never grows it (the fit never reads its own output); the monotonic reserve keeps the re-solve
     * honest (a card only ever shrinks from it); a frozen fit stays frozen.
     */
    observeRoom(): void {
      const room = this.$refs.rulingEl as HTMLElement | undefined;
      if (room === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      // A browser object in `data()` is kept RAW on purpose — nothing reactive ever reads it, and a native
      // method must never be reached through a reactive wrapper.
      this.roomObs = markRaw(new ResizeObserver(() => fitParliamentCards()));
      this.roomObs.observe(room);
    },
    onQuestPulseEnd(event: AnimationEvent): void {
      if (event.animationName === 'con-parl-quest-pulse') {
        this.questPulse = false;
        settleParliamentQuestPulse();
      }
    },
    onChairPulseEnd(event: AnimationEvent): void {
      if (event.animationName === 'con-parl-land-flash') {
        settleParliamentChairPulse();
      }
    },
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    partyKeyOf(party: ReduxParty): string {
      return partyTileKey(party);
    },
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    nameOf(color: Color | 'neutral' | undefined): string {
      return parliamentPlayerName(this.players, color);
    },
  },
});
</script>
