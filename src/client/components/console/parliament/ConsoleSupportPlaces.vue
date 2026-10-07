<template>
  <!--
    POPULAR SUPPORT AS PLACES — the ONE markup of a party's support area: three
    sockets, a steel cube per neutral delegate standing in it. Shared by the
    party PLAQUE (its foot — the stock as it stands) and the vote mode's party
    block (a door that also pays the party: the places ARRIVING with the press
    are drawn as hollow outlines, and fill on each neutral cube's touchdown).
    The sockets are ALWAYS reserved — one that appears with its first cube
    makes the arrival its own layout jump (v3 В3). The host names the block
    through its own attributes (`data-parl-support` on a plaque,
    `data-parl-vote-support` in the vote panel): the sitting's flights address
    a PLAQUE's sockets and must never find this block's.
    VOID EMPTY PLACES (the ruler's plaque): a place that can never fill keeps
    its room but draws nothing, one by one — a cube that IS standing is a fact
    and is always drawn; with no cube at all the whole block is void.
    OUTGOING PLACES (TR12 Party Sanctions — the support-area mode's cursor on a
    candidate): the cubes the press would send back to the common supply keep
    standing, drawn as an OUTLINE over a faded cube (a forecast is not a fact,
    and the state never rides colour alone).
  -->
  <span class="con-pseal__support" :class="{'con-pseal__support--void': allVoid}" aria-hidden="true">
    <span v-for="n in places" :key="n" class="con-pseal__support-place"
          :class="{
            'con-pseal__support-place--on': n <= filled,
            'con-pseal__support-place--incoming': n > filled && n <= filled + incoming,
            'con-pseal__support-place--void': voidEmpty && n > filled + incoming,
            'con-pseal__support-place--outgoing': n <= filled && n > filled - outgoing,
            'con-pseal__support-place--counted': n <= counted,
          }"
          :data-support-place="n"
          :data-support-incoming="n > filled && n <= filled + incoming ? '' : undefined"
          :data-support-outgoing="n <= filled && n > filled - outgoing ? '' : undefined"
          :data-support-counted="n <= counted ? '' : undefined">
      <PlayerCube v-if="n <= filled" color="neutral" steel :size="cubePx" :glow="false" />
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {PARLIAMENT_MAX_POPULAR_SUPPORT} from '@/common/parliament/ParliamentTypes';

export default defineComponent({
  name: 'ConsoleSupportPlaces',
  components: {PlayerCube},
  props: {
    /** Neutral delegates standing in the area now (0–3). */
    filled: {type: Number, required: true},
    /** Places that WILL be taken by the press being decided — hollow outlines, never cubes (a forecast is not a fact). */
    incoming: {type: Number, default: 0},
    /** Standing cubes the press being decided would SEND AWAY (counted from the last place) — drawn as outlines. */
    outgoing: {type: Number, default: 0},
    /** The cube's size in device px (the host's own profile). */
    cubePx: {type: Number, required: true},
    /** The EMPTY places keep their room but draw nothing — they can never fill (the ruling party's — see the plaque). */
    voidEmpty: {type: Boolean, default: false},
    /**
     * THE RECOUNT'S MARKS (TR31 Nationalist Movement — «M€ per neutral delegate in use»): the first `counted`
     * standing cubes have been counted — each marked the moment the recount reached it (one class flip, the
     * mark's own one-shot pulse and a ring that stays for the read). Never a cube that is not standing.
     */
    counted: {type: Number, default: 0},
  },
  data() {
    return {places: PARLIAMENT_MAX_POPULAR_SUPPORT};
  },
  computed: {
    /** Nothing in the block is drawn: every place is a void empty one. */
    allVoid(): boolean {
      return this.voidEmpty && this.filled + this.incoming <= 0;
    },
  },
});
</script>
