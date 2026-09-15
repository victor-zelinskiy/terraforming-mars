<template>
  <!--
    THE PARTY PLAQUE (Turmoil Redux) — the ONE visual family of a party, in
    three sizes. A party is not a project card: it has no cost, no art window
    and no play; what identifies it is its SEAL (the emblem), and what matters
    about it is its printed MECHANIC and its STATE for the viewer. So the
    plaque is a dark alloy plate carrying exactly those: the seal with a
    STATE RING (gold = the party rules · mint = the viewer holds its effect ·
    cyan dashes = in the vote, the viewer's delegates as filled dots · none =
    absent), the name in tracked caps, the mechanic module (the same
    render-DSL nodes the inspector and the action menu draw — never a second
    drawing), the popular support as three neutral places, and the action's
    state as a glyph.

    Colour discipline: the party's ACCENT is a material (the plate's seam and
    the seal's rim); the STATE colours are the console's (gold / mint / cyan);
    a PLAYER's colour appears only as a PlayerCube — the three never share a
    meaning.

      · `tile` — the Parliament's parties row (six plaques, one line);
      · `hero` — the action composer's source column and the government's
        ruling party (the carried object of the descent);
      · `full` — the fullscreen inspector's subject (px-authored, zoomed by
        the viewer exactly like a card face).
  -->
  <div class="con-pseal"
       :class="[
         'con-pseal--' + size,
         state !== undefined ? 'con-pseal--' + state.kind : '',
         state !== undefined ? 'con-pseal--tone-' + state.tone : '',
         {
           'con-pseal--held': state?.held === true,
           'con-pseal--focus': focused,
           'con-pseal--dim': state !== undefined && !state.held && state.kind === 'absent',
         },
       ]"
       :style="{'--parl-accent': accent}"
       :data-party="party">
    <div class="con-pseal__seal" :data-zoom-slot="zoomSlot">
      <span class="con-pseal__ring" aria-hidden="true"></span>
      <img class="con-pseal__emblem" :src="emblemUrl" alt="" />
      <!-- THE VIEWER'S DELEGATES on the party's resolution, as dots on the
           ring: filled = placed, hollow = still needed for the effect. Read
           by SHAPE (a hollow place is a place), never by colour alone. -->
      <span v-if="progressDots > 0" class="con-pseal__dots" aria-hidden="true">
        <i v-for="n in progressDots" :key="n" class="con-pseal__dot" :class="{'con-pseal__dot--on': n <= (state?.delegates ?? 0)}"></i>
      </span>
    </div>
    <div class="con-pseal__body">
      <span class="con-pseal__name">{{ $t(party) }}</span>
      <span v-if="state !== undefined && size !== 'full'" class="con-pseal__state" :class="'con-pseal__state--' + state.tone">{{ stateText }}</span>
      <ConsolePartyFormula v-if="formula" class="con-pseal__formula" :party="party" :size="size === 'tile' ? 'compact' : 'wide'" :dim="state !== undefined && !state.held" />
    </div>
    <!-- POPULAR SUPPORT — the neutral delegates waiting for the party's next
         resolution: three places, filled per supporting delegate. -->
    <span v-if="support !== undefined" class="con-pseal__support" :data-support="support" aria-hidden="true">
      <i v-for="n in 3" :key="n" class="con-pseal__support-cube" :class="{'con-pseal__support-cube--on': n <= support}"></i>
    </span>
    <!-- THE ACTION'S STATE — one glyph: ◈ available now · ⟳ used this
         generation · ◇ the party has an action the viewer cannot take now. -->
    <span v-if="actionState !== undefined && actionState.kind !== 'none'" class="con-pseal__action" :class="'con-pseal__action--' + actionState.kind" aria-hidden="true">
      {{ actionState.kind === 'used' ? '⟳' : (actionState.kind === 'available' ? '◈' : '◇') }}
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ReduxParty, PARTY_EFFECT_DELEGATES} from '@/common/parliament/ParliamentTypes';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {PartyActionStateVm, PartyStateVm} from '@/client/console/parliament/consoleParliamentModel';
import {partyTileKey} from '@/client/console/parliament/partyActionKey';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export type PartyPlaqueSize = 'tile' | 'hero' | 'full';

export default defineComponent({
  name: 'ConsolePartyPlaque',
  components: {ConsolePartyFormula},
  props: {
    party: {type: String as PropType<ReduxParty>, required: true},
    size: {type: String as PropType<PartyPlaqueSize>, default: 'tile'},
    /** The viewer's access state (undefined = a plain identity plaque). */
    state: {type: Object as PropType<PartyStateVm | undefined>, default: undefined},
    /** The party action's state for the viewer (undefined = not shown). */
    actionState: {type: Object as PropType<PartyActionStateVm | undefined>, default: undefined},
    /** Popular support (0–3); undefined hides the places. */
    support: {type: Number as PropType<number | undefined>, default: undefined},
    /** Draw the printed mechanic module. */
    formula: {type: Boolean, default: true},
    focused: {type: Boolean, default: false},
  },
  computed: {
    accent(): string {
      return partyAccent(this.party);
    },
    emblemUrl(): string {
      return partyEmblemUrl(this.party);
    },
    zoomSlot(): string {
      return partyTileKey(this.party);
    },
    /** The ring carries delegate dots only while the party is IN the vote and the effect is not yet the viewer's by delegates. */
    progressDots(): number {
      const state = this.state;
      if (state === undefined) {
        return 0;
      }
      return state.kind === 'progress' || state.kind === 'in-area' || state.kind === 'delegates' ? PARTY_EFFECT_DELEGATES : 0;
    },
    stateText(): string {
      const state = this.state;
      if (state === undefined) {
        return '';
      }
      return state.params.length > 0 ? translateTextWithParams(state.label, [...state.params]) : translateText(state.label);
    },
  },
});
</script>
