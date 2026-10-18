<template>
  <!-- ── THE GOVERNMENT («Зал» v7) — the left wing of the chamber: the RULING PARTY's MEDALLION (the same DOM
       instance as the party's row in the opposition column, teleported here by the parties tier — a change of
       government FLIPs it across the stage), under it the ENACTED RESOLUTION (carried onto the payout stage
       while it pays), and the strip «ВАШИ ЭФФЕКТЫ» — the only formulas the overview prints: the effects the
       viewer HOLDS right now (the ruling party's, everyone's; the parties their delegates hold; a card's grant)
       and the enacted law's own standing effect. The chairman's chair and its quest stand at the head of the
       career track (`ConsoleParliamentEngine`), not here. No caption says what is absent: an empty seat is an
       outline, the reading line names the basis under the cursor.
       DURING THE SITTING the block shows the PREVIOUS government until the enactment's beat has moved each
       piece (the display holds: the old card, the old ruler). ── -->
  <div class="con-parl__gov"
       :class="{
         'con-parl__gov--focus': flow.zone === 'government' && flow.stage === 'browse',
         'con-parl__gov--lit': sittingLit,
         'con-parl__gov--enacted': enactedShown !== undefined,
       }"
       :style="{'--parl-accent': partyAccent(rulerShown)}"
       :data-parl-gov-basis="govBasisKey"
       data-parl-gov
       data-parl-recede>
    <div class="con-parl__gov-head">
      <span class="con-parl__kicker">{{ $t('Government') }}</span>
    </div>
    <div class="con-parl__ruling" ref="rulingEl">
      <!-- THE RULER — the party's medallion lands here (teleported by the parties tier). A focus stop of its own
           (X inspects the enacted law — or the party, before any law — and A is the party action's door). -->
      <div class="con-parl__ruler" :class="{'con-parl__ruler--focus': flow.zone === 'ruler' && flow.stage === 'browse'}" :data-zoom-slot="partyKeyOf(rulerShown)" data-parl-ruler>
        <div class="con-parl__ruler-slot" data-parl-ruler-slot></div>
      </div>
      <!-- The enacted card is ONE instance: while the resolution pays out it is TELEPORTED onto the enactment
           stage's hero slot (and FLIPs there and back) — never a copy beside the government. -->
      <Teleport v-if="enactedVm !== undefined" defer to="[data-parl-sit-hero]" :disabled="!enactCarried">
        <div class="con-parl__gov-carry" data-parl-gov-carry>
          <div class="con-parl__gov-card"
               :class="{'con-parl__gov-card--awaiting': holds.govAwaits !== undefined && holds.govAwaits === enactedShown?.instance}"
               :data-zoom-slot="'resolution:' + enactedShown?.resolutionId">
            <premium-card-face :vmOverride="enactedVm" :lightweight="!enactCarried" :artTier="artTier" :inert="true" />
          </div>
        </div>
      </Teleport>
      <!-- THE EMPTY SEAT — until the first political phase: an honest outline where the law will stand, no words. -->
      <div v-else class="con-parl__gov-empty" data-parl-gov-empty>
        <span class="con-parl__gov-empty-mark" aria-hidden="true">◇</span>
      </div>
      <!-- «ВАШИ ЭФФЕКТЫ» — the formulas that are the VIEWER'S now, and the law's own standing effect. -->
      <div v-if="effectRows.length > 0 || enactedOwnMechanics !== undefined" class="con-parl__effects" data-parl-effects>
        <span class="con-parl__effects-kicker">{{ $t('Your effects') }}</span>
        <div v-if="enactedOwnMechanics !== undefined" class="con-parl__ruler-own" data-parl-enacted-effect>
          <span class="con-parl__ruler-own-kicker" :data-parl-enacted-part="enactedOwnPart"><i class="con-parl__card-mark resource_icon resource_icon--cards" aria-hidden="true"></i>{{ $t(enactedOwnPart === 'action' ? 'Resolution action' : 'Resolution effect') }}</span>
          <PremiumMechanicsPanel class="con-parl__ruler-own-mech" :mechanics="enactedOwnMechanics" />
        </div>
        <div v-for="row in effectRows" :key="row.party" class="con-parl__effects-row" :class="'con-parl__effects-row--' + row.why" :data-party="row.party" :style="{'--parl-accent': partyAccent(row.party)}">
          <img class="con-parl__effects-emblem" :src="emblemUrl(row.party)" alt="" />
          <ConsolePartyFormula class="con-parl__effects-formula" :party="row.party" size="compact" />
          <!-- WHY it is yours, by a MARK («Зал» v7, П2): the ruler's formula needs none (its place under the medallion
               says it), your delegates' are their two filled places, a card's grant is the card glyph; the words stay
               for assistive tech and the reading line. -->
          <span class="con-parl__effects-why" :class="'con-parl__effects-why--' + row.why" :data-parl-effects-why="row.why" :aria-label="$t(whyKey(row.why))">
            <template v-if="row.why === 'delegates'">
              <span v-for="n in 2" :key="n" class="con-parl__effects-place" aria-hidden="true"><PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(9)" :glow="false" /></span>
            </template>
            <i v-else-if="row.why === 'granted'" class="con-parl__card-mark resource_icon resource_icon--cards" aria-hidden="true"></i>
          </span>
        </div>
      </div>
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
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {PARLIAMENT_GRAPHIC, resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {parliamentArtTier} from '@/client/console/parliament/parliamentArtTier';
import {fitParliamentCards} from '@/client/console/parliament/parliamentCardFit';
import {CardArtTier} from '@/client/cards/cardArt';
import {AgendaVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {partyTileKey} from '@/client/console/parliament/partyActionKey';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';

/** WHY the viewer holds a party's effect — the strip's one word per row. */
type EffectWhy = 'ruling' | 'delegates' | 'granted';

export default defineComponent({
  name: 'ConsoleParliamentGovernment',
  components: {ConsolePartyFormula, PlayerCube, PremiumMechanicsPanel},
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
    /** THE RULING PARTY AS SHOWN: the previous ruler until the medallions have changed places. */
    rulerShown(): ReduxParty {
      return this.holds.rulerBefore ?? this.view.rulingParty;
    },
    /**
     * THE BASIS OF THE GOVERNMENT, published as data for the reading line and the probes (never a caption here).
     * While the enacted card is still on its way the previous basis stands; while the sitting decides, the block
     * is the one that is LEAVING and may not call itself the enacted resolution before the new card has arrived.
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
      if (parliamentFlow.stage === 'sitting' && !this.govArrived) {
        return 'Outgoing government';
      }
      return 'Enacted resolution';
    },
    /** The enacted card is on the sitting's stage (the one instance, teleported) — the stage took the field for a hosted step. */
    enactCarried(): boolean {
      return parliamentFlow.stage === 'sitting' && parliamentFlow.sittingField && this.enactedShown !== undefined;
    },
    /**
     * THE NEW SET HAS ARRIVED (v4 §2.3): the gold seam is the mark of the government IN POWER. At the verdict the
     * block is the OUTGOING one and during the enactment it is in transit — the seam lights only once the new card
     * has landed AND the new medallion stands in its slot.
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
     * The ENACTED resolution's OWN standing effect / action (its printed graphic) — a second source beside the
     * parties', the first row of the strip. Undefined for a resolution whose only effect was the enactment itself.
     */
    enactedOwnMechanics(): MechanicsVM | undefined {
      const resolution = this.enactedShown?.resolution;
      if (resolution === undefined || !(resolution.hasPassive || resolution.hasAction)) {
        return undefined;
      }
      const mechanics = buildMechanics(resolution.renderData, PARLIAMENT_GRAPHIC);
      return mechanics.textOnly ? undefined : mechanics;
    },
    /** Which part of the enacted card the graphic IS — an action is not an effect. */
    enactedOwnPart(): 'effect' | 'action' {
      const resolution = this.enactedShown?.resolution;
      return resolution !== undefined && resolution.hasAction && !resolution.hasPassive ? 'action' : 'effect';
    },
    /**
     * THE PARTY EFFECTS THE VIEWER HOLDS, in the rules' own rank: the ruling party's (everyone's — printed first, with
     * the ruler AS SHOWN during the swap, so the strip changes in the frame the medallion lands), then every party
     * whose resolution carries the viewer's delegates, then a card's grant. A spectator holds nothing and sees nothing.
     */
    effectRows(): Array<{party: ReduxParty, why: EffectWhy}> {
      const viewer = this.view.viewer;
      if (viewer === undefined) {
        return [];
      }
      const out: Array<{party: ReduxParty, why: EffectWhy}> = [];
      const ruler = this.rulerShown;
      if (this.view.parties.some((p) => p.party === ruler && p.effect !== undefined)) {
        out.push({party: ruler, why: 'ruling'});
      }
      for (const access of viewer.access) {
        if (!access.hasEffect || access.party === ruler) {
          continue;
        }
        out.push({party: access.party, why: access.byDelegates ? 'delegates' : 'granted'});
      }
      return out;
    },
  },
  methods: {
    cubePx(px: number): number {
      return Math.round(conLogicalPx(px));
    },
    whyKey(why: EffectWhy): string {
      switch (why) {
      case 'ruling': return 'for everyone';
      case 'delegates': return 'Your effect';
      default: return 'Your effect · granted by a card';
      }
    },
    /**
     * THE RULING COLUMN IS THE ROOM THE ENACTED CARD IS SOLVED INTO (`fitParliamentCards`: the column minus its other
     * blocks), and that room settles a beat AFTER the section's mount-time fit (the strip's zoomed graphics and the
     * medallion's seal take their size on the next frame). So the column itself is observed: whatever changes it
     * re-solves the card from the room that stands. Loop-safe: the column is flex-sized by the chamber and its content
     * never grows it (the fit never reads its own output); a frozen fit stays frozen.
     */
    observeRoom(): void {
      const room = this.$refs.rulingEl as HTMLElement | undefined;
      if (room === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      // A browser object in `data()` is kept RAW on purpose — nothing reactive ever reads it.
      this.roomObs = markRaw(new ResizeObserver(() => fitParliamentCards()));
      this.roomObs.observe(room);
    },
    partyKeyOf(party: ReduxParty): string {
      return partyTileKey(party);
    },
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
  },
});
</script>
