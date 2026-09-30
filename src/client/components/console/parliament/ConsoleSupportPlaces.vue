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
  -->
  <span class="con-pseal__support" :class="{'con-pseal__support--void': hidden}" aria-hidden="true">
    <span v-for="n in places" :key="n" class="con-pseal__support-place"
          :class="{'con-pseal__support-place--on': n <= filled, 'con-pseal__support-place--incoming': n > filled && n <= filled + incoming}"
          :data-support-place="n"
          :data-support-incoming="n > filled && n <= filled + incoming ? '' : undefined">
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
    /** The cube's size in device px (the host's own profile). */
    cubePx: {type: Number, required: true},
    /** The block keeps its room but draws nothing (the ruling party's void sockets — see the plaque). */
    hidden: {type: Boolean, default: false},
  },
  data() {
    return {places: PARLIAMENT_MAX_POPULAR_SUPPORT};
  },
});
</script>
