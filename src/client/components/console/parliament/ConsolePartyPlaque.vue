<template>
  <!--
    THE PARTY PLAQUE (Turmoil Redux) — the ONE visual family of a party, in
    four sizes. A party is not a project card: it has no cost, no art window
    and no play; what identifies it is its SEAL (the emblem), and what matters
    about it is its printed MECHANIC and its STATE for the viewer. So the
    plaque is a dark alloy plate with ONE anatomy in every size:

      ┌──────────────────────────────────┐
      │ (seal)  NAME              [act]  │   the seal with its STATE RING, the
      │                                  │   name in bright tracked caps, the
      │       [ mechanic module ]        │   action's badge; the MECHANIC owns
      │                                  │   the plate's centre at reading
      │ ○○ 1/2 · state       [support]   │   size; the foot is the viewer's
      └──────────────────────────────────┘   compact state + popular support.

    Three facts about the viewer are three DIFFERENT objects, never a row of
    look-alike dots: ACCESS BY DELEGATES is the mint ring + the viewer's own
    cubes in the two places of the threshold; POPULAR SUPPORT is the steel
    neutral cubes in the party's three places; a USED ACTION is the action
    badge itself, stamped. Colour discipline: the party's ACCENT is a
    material (the plate's seam, the seal's rim); the STATE colours are the
    console's (gold / mint / cyan); a PLAYER's colour appears only as a cube.
    A party the viewer does NOT hold keeps its mechanic READABLE — the state
    is what dims (ring, foot), never the formula.

      · `tile` — the Parliament's parties row (the mechanic in the centre);
      · `hero` — the action composer's source column;
      · `full` — the fullscreen inspector's subject (px-authored, zoomed by
        the viewer exactly like a card face; the same anatomy, so the tile
        morphs into it as ONE object);
      · `aside` — the party BESIDE a resolution in the fullscreen inspector:
        the tile's anatomy at reading size (rem-authored like the tile), the
        viewer's state replaced by ONE context line the host hands in
        (`note` — «if enacted, every player gets its effect»): the personal
        access is the footer's, never repeated on the plate.
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
      <span class="con-pseal__name">{{ $t(partyNameKey(party)) }}</span>
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
    <!-- THE CONTEXT LINE (the `aside` size): what the party's effect means
         for the resolution on the stage — a condition or a standing fact,
         translated by the host. -->
    <div v-if="note !== undefined" class="con-pseal__note">{{ note }}</div>
    <!-- THE MECHANIC — the plate's centre, the readable object. -->
    <ConsolePartyFormula v-if="formula" class="con-pseal__formula" :party="party" :size="size === 'tile' ? 'compact' : 'wide'" :dim="state !== undefined && !state.held" />
    <!-- THE FOOT — the viewer's relation to the party in the fewest marks:
         the delegate places (the viewer's OWN cubes; hollow = still needed)
         with the count, ONE short word only where a word says more than the
         places (ruling / held), and POPULAR SUPPORT closing the line: three
         places, a steel cube per neutral delegate waiting for the party's
         next resolution. A party outside the vote states nothing — the dim
         ring is its state. -->
    <!-- While the plaque is FOCUSED and its action cannot be taken, the foot
         says the ONE reason instead of the state (the ring and the badge keep
         saying the state) — the reason stands where the eye already is, and
         the row never reserves an empty line for it. -->
    <div v-if="state !== undefined && size !== 'full'" class="con-pseal__state" :class="['con-pseal__state--' + state.tone, {'con-pseal__state--reason': reason !== ''}]" :data-state-kind="state.kind">
      <!-- THE ROLL CALL's word (v3 В3): while the support scene names this party, its own state row says
           WHY it stands where it stands — «принимается» / «не принята» / «не на голосовании» / «правит».
           It takes the row in place of the live state: one line, written, never a flash. -->
      <span v-if="roll !== ''" class="con-pseal__roll" data-pseal-roll>{{ roll }}</span>
      <span v-if="roll === '' && reason !== ''" class="con-pseal__reason" :class="'con-pseal__reason--' + reasonTone" data-pseal-reason>{{ reason }}</span>
      <span v-if="roll === '' && reason === '' && showPlaces && viewerColor !== undefined" class="con-pseal__places" aria-hidden="true">
        <span v-for="n in placesCount" :key="n" class="con-pseal__place" :class="{'con-pseal__place--on': n <= (state?.delegates ?? 0)}">
          <PlayerCube v-if="n <= (state?.delegates ?? 0)" :color="viewerColor" :size="placeCubePx" :glow="false" />
        </span>
        <span class="con-pseal__places-count">{{ Math.min(state?.delegates ?? 0, placesCount) }}/{{ placesCount }}</span>
      </span>
      <span v-if="roll === '' && reason === '' && stateText !== ''" class="con-pseal__state-text">{{ stateText }}</span>
      <!-- POPULAR SUPPORT — three places, ALWAYS reserved (v3 В3): a socket that appears when the first
           cube lands would make the arrival its own layout jump. Empty sockets read as empty sockets; the
           landing socket answers ONCE, on contact (`--landed`, the director adds it at the touchdown). -->
      <span v-if="support !== undefined" class="con-pseal__support" :data-support="support" :data-parl-support="party" aria-hidden="true">
        <span v-for="n in 3" :key="n" class="con-pseal__support-place" :class="{'con-pseal__support-place--on': n <= support}" :data-support-place="n">
          <PlayerCube v-if="n <= support" color="neutral" steel :size="supportCubePx" :glow="false" />
        </span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ReduxParty, PARTY_EFFECT_DELEGATES} from '@/common/parliament/ParliamentTypes';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {PartyActionStateVm, PartyStateVm} from '@/client/console/parliament/consoleParliamentModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {translateText} from '@/client/directives/i18n';

export type PartyPlaqueSize = 'tile' | 'hero' | 'full' | 'aside';

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
    /** ONE translated context line under the name (the `aside` size) — undefined draws none. */
    note: {type: String as PropType<string | undefined>, default: undefined},
    /** The ONE translated reason the party's action cannot be taken right now (the focused tile's foot); '' draws the state. */
    reason: {type: String, default: ''},
    reasonTone: {type: String as PropType<'dim' | 'warn'>, default: 'dim'},
    /** This tile stands in the GOVERNMENT's slot: it is the ruling party's, and its state row says so (v4 §2.5). */
    ruling: {type: Boolean, default: false},
    /** The roll call's word for this party while the support scene runs (v3 В3) — it takes the state row in place of the live state. */
    roll: {type: String, default: ''},
  },
  methods: {
    partyNameKey(party: string): string {
      return partyNameKey(party);
    },
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
      // A tile STANDING IN THE GOVERNMENT is the ruling party's: its state is «правит» and its support
      // sockets, never the access counter of an opposition tile (v4 §2.5 — «0/2» стояло на месте правителя).
      return !this.ruling && state !== undefined && (state.kind === 'progress' || state.kind === 'in-area' || state.kind === 'delegates');
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
    /**
     * ONE short word where a word says more than the places: the ruling
     * party, a held effect. A party in the vote is said by its places and
     * their count alone; a party outside the vote says nothing (its dim ring
     * is the state) — the fewest marks a glance can read.
     */
    stateText(): string {
      const state = this.state;
      if (state === undefined) {
        return '';
      }
      switch (state.kind) {
      // «ПРАВИТ» alone: the government block beside the tile already names the basis («СТАРТОВОЕ ПРАВИЛО» /
      // the enacted card) — saying it twice on one screen was registry row R-03.
      case 'ruling-default': return translateText('Ruling');
      case 'ruling': return translateText('Ruling');
      // The same word order as the voting columns' «ЭФФЕКТ ВАШ» (glossary §3, R-04) — the keys' RU line.
      case 'delegates': return translateText('Your effect');
      case 'granted': return translateText('Your effect · granted by a card');
      default: return '';
      }
    },
  },
});
</script>
