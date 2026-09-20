<template>
  <!--
    ONE FACT OF A VOTE, as the vote panel prints it (Turmoil Redux):
    «ЛИДЕР [cube] → вы», «ПРИНИМАЕТСЯ нет → да» — the key, then the current
    value → the projected one. A fact that does not change is ONE value: an
    arrow to the same reading is noise on a decision line. The leader's
    «before» is its cube alone (a dash without one); the inspector never says
    it in words either.

    The vote panel («ВАШ ГОЛОС») and the fullscreen inspector's footer render
    this same row — one markup, two hosts (registry R-10: the inspector spoke
    the same facts as sentences in the party column). Host attributes
    (`data-parl-vote-late`, a size class) fall through to the root.
  -->
  <div class="con-parl__fact"
       :class="{'con-parl__fact--gain': fact.tone === 'gain', 'con-parl__fact--dim': fact.tone === 'none'}"
       :data-parl-fact="fact.id"
       :data-parl-fact-tone="fact.tone">
    <span class="con-parl__fact-key">{{ $t(fact.label) }}</span>
    <span class="con-parl__fact-val">
      <template v-if="!fact.unchanged">
        <template v-if="fact.id === 'lead'">
          <PlayerCube v-if="fact.before.cube !== undefined && fact.before.cube !== 'neutral'" :color="fact.before.cube" :size="cubePx" :glow="false" />
          <PlayerCube v-else-if="fact.before.cube === 'neutral'" color="neutral" steel :size="cubePx" :glow="false" />
          <span v-else class="con-parl__fact-none">—</span>
        </template>
        <b v-else>{{ text(fact.before) }}</b>
        <span class="con-parl__fact-arrow" aria-hidden="true">→</span>
      </template>
      <template v-if="fact.after.cube !== undefined">
        <PlayerCube v-if="fact.after.cube !== 'neutral'" :color="fact.after.cube" :size="cubePx" :glow="false" />
        <PlayerCube v-else color="neutral" steel :size="cubePx" :glow="false" />
      </template>
      <b :class="{'con-parl__fact-after': !fact.unchanged}">{{ text(fact.after) }}</b>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {FactValue, factValueText, VoteFactVm} from '@/client/console/parliament/voteInfoModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleVoteFactRow',
  components: {PlayerCube},
  props: {
    fact: {type: Object as PropType<VoteFactVm>, required: true},
    /** The cube's size in device px (the host's profile scale). */
    cubePx: {type: Number, required: true},
  },
  methods: {
    /** One side of the fact as words (a seat's NAME is a display string, never a key). */
    text(value: FactValue): string {
      return factValueText(value, (key, params) => params === undefined ? translateText(key) : translateTextWithParams(key, [...params]));
    },
  },
});
</script>
