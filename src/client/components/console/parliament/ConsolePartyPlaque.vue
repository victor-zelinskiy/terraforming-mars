<template>
  <!--
    THE PARTY PLAQUE (Turmoil Redux) — the ONE visual family of a party, in
    three sizes. A party is not a project card: it has no cost, no art window
    and no play; what identifies it is its SEAL (the emblem), and what matters
    about it is its printed MECHANIC and its STATE for the viewer. So the
    plaque is a dark alloy plate with ONE anatomy in every size:

      ┌──────────────────────────────────┐
      │ (seal)  NAME              [act]  │   the seal with its STATE RING, the
      │         state chip               │   name in bright tracked caps, the
      │ [ mechanic module ]  [support]   │   action's state, then the printed
      └──────────────────────────────────┘   mechanic and the popular support.

    Three facts about the viewer are three DIFFERENT objects, never a row of
    look-alike dots: ACCESS BY DELEGATES is the mint ring + the viewer's own
    cubes in the two places of the threshold; POPULAR SUPPORT is the steel
    neutral cubes in the party's three places; a USED ACTION is the action
    badge itself, stamped. Colour discipline: the party's ACCENT is a
    material (the plate's seam, the seal's rim); the STATE colours are the
    console's (gold / mint / cyan); a PLAYER's colour appears only as a cube.

      · `tile` — the Parliament's parties row;
      · `hero` — the action composer's source column / the government badge;
      · `full` — the fullscreen inspector's subject (px-authored, zoomed by
        the viewer exactly like a card face; the same anatomy, so the tile
        morphs into it as ONE object).
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
           'con-pseal--used': actionState?.kind === 'used',
         },
       ]"
       :style="{'--parl-accent': accent}"
       :data-party="party">
    <div class="con-pseal__seal">
      <span class="con-pseal__ring" aria-hidden="true"></span>
      <img class="con-pseal__emblem" :src="emblemUrl" alt="" />
    </div>
    <div class="con-pseal__head">
      <span class="con-pseal__name">{{ $t(party) }}</span>
      <!-- THE ACTION BADGE — one object for one fact: available now (lit),
           used this generation (stamped ✓), not now / blocked (outlined). -->
      <span v-if="actionState !== undefined && actionState.kind !== 'none'"
            class="con-pseal__action"
            :class="'con-pseal__action--' + actionState.kind"
            :data-action-state="actionState.kind"
            aria-hidden="true">
        <span class="con-pseal__action-bolt">⚡</span>
        <span v-if="actionState.kind === 'used'" class="con-pseal__action-mark">✓</span>
      </span>
    </div>
    <!-- THE STATE CHIP — the viewer's relation to the party in one line; the
         delegate places are the viewer's OWN cubes (filled = placed, hollow =
         still needed for the effect). POPULAR SUPPORT closes the line: three
         places, a steel cube per neutral delegate waiting for the party's
         next resolution — so the printed mechanic below owns the plate's width. -->
    <div v-if="state !== undefined && size !== 'full'" class="con-pseal__state" :class="'con-pseal__state--' + state.tone">
      <span class="con-pseal__state-text">{{ stateText }}</span>
      <span v-if="showPlaces && viewerColor !== undefined" class="con-pseal__places" aria-hidden="true">
        <span v-for="n in placesCount" :key="n" class="con-pseal__place" :class="{'con-pseal__place--on': n <= (state?.delegates ?? 0)}">
          <PlayerCube v-if="n <= (state?.delegates ?? 0)" :color="viewerColor" :size="placeCubePx" :glow="false" />
        </span>
      </span>
      <span v-if="support !== undefined" class="con-pseal__support" :class="{'con-pseal__support--none': support === 0}" :data-support="support" aria-hidden="true">
        <span v-for="n in 3" :key="n" class="con-pseal__support-place" :class="{'con-pseal__support-place--on': n <= support}" :data-support-place="n">
          <PlayerCube v-if="n <= support" color="neutral" steel :size="supportCubePx" :glow="false" />
        </span>
      </span>
    </div>
    <ConsolePartyFormula v-if="formula" class="con-pseal__formula" :party="party" :size="size === 'tile' ? 'compact' : 'wide'" :dim="state !== undefined && !state.held" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ReduxParty, PARTY_EFFECT_DELEGATES} from '@/common/parliament/ParliamentTypes';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {PartyActionStateVm, PartyStateVm} from '@/client/console/parliament/consoleParliamentModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export type PartyPlaqueSize = 'tile' | 'hero' | 'full';

export default defineComponent({
  name: 'ConsolePartyPlaque',
  components: {ConsolePartyFormula, PlayerCube},
  props: {
    party: {type: String as PropType<ReduxParty>, required: true},
    size: {type: String as PropType<PartyPlaqueSize>, default: 'tile'},
    /** The viewer's access state (undefined = a plain identity plaque). */
    state: {type: Object as PropType<PartyStateVm | undefined>, default: undefined},
    /** The party action's state for the viewer (undefined = not shown). */
    actionState: {type: Object as PropType<PartyActionStateVm | undefined>, default: undefined},
    /** Popular support (0–3); undefined hides the places. */
    support: {type: Number as PropType<number | undefined>, default: undefined},
    /** The viewer's colour — their own delegate cubes in the threshold places. */
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
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
    /** The threshold places show while the party is IN the vote and the effect is not yet the viewer's by other means. */
    showPlaces(): boolean {
      const state = this.state;
      return state !== undefined && (state.kind === 'progress' || state.kind === 'in-area' || state.kind === 'delegates');
    },
    placesCount(): number {
      return PARTY_EFFECT_DELEGATES;
    },
    placeCubePx(): number {
      return Math.round((this.size === 'tile' ? 9 : 11) * conUiScale());
    },
    supportCubePx(): number {
      return Math.round((this.size === 'tile' ? 9 : 11) * conUiScale());
    },
    stateText(): string {
      const state = this.state;
      if (state === undefined) {
        return '';
      }
      switch (state.kind) {
      case 'ruling-default': return translateText('Rules by the starting rule');
      case 'ruling': return translateText('Ruling');
      case 'delegates': return translateText('Your effect · 2 delegates');
      case 'granted': return translateText('Your effect · granted by a card');
      case 'progress': return translateTextWithParams('In the vote · ${0} of ${1} delegates', [String(state.delegates), String(PARTY_EFFECT_DELEGATES)]);
      case 'in-area': return translateText('In the vote');
      default: return translateText('Not in the vote');
      }
    },
  },
});
</script>
