<template>
  <!-- ── THE GOVERNMENT — the enacted resolution is the MAIN OBJECT;
       beside it the RULING PARTY with its printed effect LARGE (one
       caption: it is every player's), and — apart from it — the enacted
       resolution's OWN standing effect when it has one; under both, the
       chairman quest. ── -->
  <div class="con-parl__gov"
       :class="{
         'con-parl__gov--focus': flow.zone === 'government' && flow.stage === 'browse',
         'con-parl__gov--lit': sittingLit,
         'con-parl__gov--enacted': view.enacted !== undefined,
       }"
       :style="{'--parl-accent': partyAccent(view.rulingParty)}"
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
    <div class="con-parl__ruling">
      <!-- The enacted card is ONE instance: while the resolution pays out it
           is TELEPORTED onto the enactment stage's hero slot (and FLIPs
           there and back) — never a copy beside the government. -->
      <Teleport v-if="enactedVm !== undefined" defer to="[data-parl-sit-hero]" :disabled="!enactCarried">
        <div class="con-parl__gov-carry" data-parl-gov-carry>
          <div class="con-parl__gov-card"
               :class="{'con-parl__gov-card--awaiting': holds.govAwaits !== undefined && holds.govAwaits === view.enacted?.instance}"
               :data-zoom-slot="'resolution:' + view.enacted?.resolutionId">
            <premium-card-face :vmOverride="enactedVm" :lightweight="!enactCarried" :inert="true" />
          </div>
        </div>
      </Teleport>
      <!-- The ENACTED slot stands empty until the first political phase:
           an honest empty seat, never a placeholder card. -->
      <div v-else class="con-parl__gov-empty" data-parl-gov-empty>
        <span class="con-parl__gov-empty-mark" aria-hidden="true">◇</span>
        <span class="con-parl__gov-empty-text">{{ $t('No resolution enacted yet') }}</span>
      </div>
      <!-- THE RULER — the identity line, then the effect everyone holds
           while the party rules: its printed formula LARGE, one caption.
           The resolution's OWN standing effect (when it has one) is a
           separate row under its own mark — two sources, told apart. -->
      <div class="con-parl__ruler" :data-zoom-slot="partyKeyOf(view.rulingParty)" data-parl-ruler>
        <div class="con-parl__ruler-ident">
          <img class="con-parl__ruler-emblem" :src="emblemUrl(view.rulingParty)" alt="" />
          <div class="con-parl__ruler-text">
            <span class="con-parl__ruler-kicker">{{ $t('Ruling party') }}</span>
            <span class="con-parl__ruler-title">
              <b class="con-parl__ruler-name">{{ $t(partyNameKey(view.rulingParty)) }}</b>
              <!-- Whose the effect is — beside the name, never a caption a panel away. -->
              <span class="con-parl__ruler-scope">{{ $t('Available to every player') }}</span>
            </span>
          </div>
        </div>
        <!-- The mechanic: its printed graphic, and under it the ONE short
             reading the catalog carries for it (the full sentences are
             the inspector's). Centred together in the plate's height. -->
        <div class="con-parl__ruler-body">
          <ConsolePartyFormula class="con-parl__ruler-formula" :party="view.rulingParty" size="wide" />
          <!-- No sentence on the game screen (R-13): the printed formula above IS the effect; the
               words are the inspector's (X on the ruler). -->
        </div>
        <div v-if="enactedOwnMechanics !== undefined" class="con-parl__ruler-own" data-parl-enacted-effect>
          <span class="con-parl__ruler-own-kicker" :data-parl-enacted-part="enactedOwnPart"><i class="con-parl__card-mark resource_icon resource_icon--cards" aria-hidden="true"></i>{{ $t(enactedOwnPart === 'action' ? 'Resolution action' : 'Resolution effect') }}</span>
          <PremiumMechanicsPanel class="con-parl__ruler-own-mech" :mechanics="enactedOwnMechanics" />
        </div>
      </div>
    </div>

    <!-- THE CHAIRMAN QUEST: the printed condition (a graphic + its short
         words), the race per seat, the reward as two things — the SEAT
         and ONE STEP of the Agenda (with what the viewer's next step
         pays) — and the chairman. -->
    <div v-if="view.quest !== undefined" class="con-parl__quest"
         :class="{'con-parl__quest--done': view.quest.completedBy !== undefined, 'con-parl__quest--pulse': questPulse}"
         @animationend="onQuestPulseEnd"
         data-parl-quest>
      <div class="con-parl__quest-head">
        <span class="con-parl__kicker">{{ $t('Chairman quest') }}</span>
        <span v-if="view.quest.completedBy !== undefined" class="con-parl__quest-state">✓ {{ $t('Completed') }}</span>
      </div>
      <div class="con-parl__quest-cond">
        <PremiumMechanicsPanel v-if="questMechanics !== undefined && !questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
        <span class="con-parl__quest-text">{{ $t(view.quest.text) }}</span>
      </div>
      <div v-if="view.quest.completedBy === undefined" class="con-parl__quest-progress" data-parl-quest-progress>
        <span v-for="row in questRows" :key="row.color" class="con-parl__quest-row"
              :class="{'con-parl__quest-row--me': row.color === viewerColor, 'con-parl__quest-row--close': row.value > 0 && row.value >= view.quest.definition.count - 1}">
          <PlayerCube :color="row.color" :size="cubePx(12)" />
          <b :key="row.value" class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ view.quest.definition.count }}</span>
        </span>
      </div>
      <div class="con-parl__quest-foot">
        <span class="con-parl__quest-reward" data-parl-quest-reward>
          <span class="con-parl__quest-reward-kicker">{{ $t(view.quest.completedBy !== undefined ? 'Won by' : 'Reward') }}</span>
          <template v-if="view.quest.completedBy !== undefined">
            <PlayerCube :color="view.quest.completedBy" :size="cubePx(12)" />
            <b>{{ nameOf(view.quest.completedBy) }}</b>
          </template>
          <template v-else>
            <span class="con-parl__reward-seat" :class="{'con-parl__reward-seat--kept': viewerIsChairman}">
              <!-- The reward is the OFFICE, not the chair (glossary §4, R-05): «ПРЕДСЕДАТЕЛЬСТВО + ШАГ ПОВЕСТКИ». -->
              <span class="con-parl__seat-glyph" aria-hidden="true"></span>{{ $t(viewerIsChairman ? 'Chairmanship (kept)' : 'Chairmanship') }}
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
        <span class="con-parl__chair" :class="{'con-parl__chair--won': view.quest.completedBy !== undefined && view.quest.completedBy === view.chairman, 'con-parl__chair--pulse': flow.chairPulse}" data-parl-chair @animationend="onChairPulseEnd">
          <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
          <template v-if="view.chairman !== undefined">
            <!-- The SEAT's cube — the place the chairman's delegate flies to. -->
            <span class="con-parl__chair-cube" :data-parl-seat-chair="view.chairman"><PlayerCube :color="view.chairman" :size="cubePx(12)" /></span>
            <b>{{ nameOf(view.chairman) }}</b>
          </template>
          <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
        </span>
      </div>
    </div>
    <div v-else class="con-parl__chair con-parl__chair--alone" :class="{'con-parl__chair--pulse': flow.chairPulse}" data-parl-chair @animationend="onChairPulseEnd">
      <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
      <template v-if="view.chairman !== undefined">
        <span class="con-parl__chair-cube" :data-parl-seat-chair="view.chairman"><PlayerCube :color="view.chairman" :size="cubePx(12)" /></span>
        <b>{{ nameOf(view.chairman) }}</b>
      </template>
      <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
    </div>
  </div>
</template>
<script lang="ts">
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import PlayerCube from '@/client/components/PlayerCube.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {parliamentFlow, settleParliamentChairPulse} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {AgendaVm, parliamentPlayerName, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {partyTileKey} from '@/client/console/parliament/partyActionKey';

/**
 * The GOVERNMENT tier: the enacted resolution (carried onto the payout stage
 * while it pays), the ruling party's printed effect, the resolution's own
 * standing effect, the chairman quest and the chair.
 */
export default defineComponent({
  name: 'ConsoleParliamentGovernment',
  components: {PlayerCube, PremiumMechanicsPanel, ConsolePartyFormula},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    agendaVm: {type: Object as PropType<AgendaVm>, required: true},
    /** The SITTING's stage on screen ('' outside the sitting) — the verdict and the enactment light the government. */
    sittingStage: {type: String, default: ''},
    /** The results scene's current focus ('' outside the scene). */
  },
  data() {
    return {
      questPulse: false,
    };
  },
  computed: {
    /**
     * THE BASIS THE SEAT SHOWS. While the enacted card is still on its way (the sitting's verdict
     * and enactment beats hold the seat empty — `holds.govAwaits`), the kicker keeps the PREVIOUS
     * basis: «принятая резолюция» over an empty seat named a card that had not arrived (P-16).
     */
    govBasisKey(): string {
      const enacted = this.view.enacted;
      if (enacted === undefined) {
        return 'Starting rule';
      }
      const awaiting = this.holds.govAwaits !== undefined && this.holds.govAwaits === enacted.instance;
      if (awaiting && this.model?.phase?.summary?.discardedEnacted === undefined) {
        return 'Starting rule';
      }
      return 'Enacted resolution';
    },
    flow() {
      return parliamentFlow;
    },
    holds() {
      return parliamentHolds;
    },
    viewerIsChairman(): boolean {
      return this.viewerColor !== undefined && this.view.chairman === this.viewerColor;
    },
    /** The enacted card is on the sitting's stage (the one instance, teleported) — the stage took the field for a hosted step. */
    enactCarried(): boolean {
      return parliamentFlow.stage === 'sitting' && parliamentFlow.sittingField && this.view.enacted !== undefined;
    },
    /** The SITTING lights the government: the verdict names the winner (now enacted), the enactment names the law. */
    sittingLit(): boolean {
      return parliamentFlow.stage === 'sitting' && (this.sittingStage === 'verdict' || this.sittingStage === 'enact');
    },
    enactedVm(): PremiumCardVM | undefined {
      return this.view.enacted === undefined ? undefined : resolutionPremiumVmById(this.view.enacted.resolutionId);
    },
    /**
     * The ENACTED resolution's OWN standing effect / action (its printed
     * graphic) — a second source beside the ruling party's, told apart in
     * the government. Undefined for a resolution whose only effect was the
     * enactment itself (already paid, nothing stands).
     */
    enactedOwnMechanics(): MechanicsVM | undefined {
      const resolution = this.view.enacted?.resolution;
      if (resolution === undefined || !(resolution.hasPassive || resolution.hasAction)) {
        return undefined;
      }
      const mechanics = buildMechanics(resolution.renderData);
      return mechanics.textOnly ? undefined : mechanics;
    },
    /** Which part of the enacted card the graphic IS — an action is not an effect (the families rehearsal, frame 33). */
    enactedOwnPart(): 'effect' | 'action' {
      const resolution = this.view.enacted?.resolution;
      return resolution !== undefined && resolution.hasAction && !resolution.hasPassive ? 'action' : 'effect';
    },
    questMechanics(): MechanicsVM | undefined {
      const root = this.view.quest?.renderData;
      return root === undefined ? undefined : buildMechanics(root);
    },
    questRows(): ReadonlyArray<{color: Color, value: number}> {
      return (this.view.quest?.progress ?? []).filter((row) => row.participates);
    },
    questCompletedBy(): Color | undefined {
      return this.view.quest?.completedBy;
    },
  },
  watch: {
    questCompletedBy(now: Color | undefined, was: Color | undefined): void {
      if (now !== undefined && was === undefined) {
        // A CSS one-shot (`con-parl-quest-pulse`): the flag is cleared by the
        // animation's own end, never by a timer guessing its length.
        this.questPulse = true;
      }
    },
  },
  methods: {
    partyNameKey(party: string): string {
      return partyNameKey(party);
    },
    onQuestPulseEnd(event: AnimationEvent): void {
      if (event.animationName === 'con-parl-quest-pulse') {
        this.questPulse = false;
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
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
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
