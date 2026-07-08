<template>
  <!--
    A small, review-LOCAL premium toast for turn-navigation boundaries (LB/RB
    or the desktop ◀/▶/[ ] at the first / last archived turn). The global
    notification layer is held while the review is the foreground item, so this
    boundary feedback lives on review state instead. `:key` on the nonce so a
    repeated press at the same edge replays the pop animation.
  -->
  <Transition name="mbr-edge">
    <div
      v-if="state.edge !== ''"
      :key="state.edgeNonce"
      class="mbr-edge"
      :class="['mbr-edge--' + state.edge, {'mbr-edge--large': large}]"
      role="status"
      aria-live="polite"
    >
      <span class="mbr-edge__glyph" aria-hidden="true">{{ state.edge === 'no-prev' ? '⟨' : '⟩' }}</span>
      <span class="mbr-edge__text">{{ $t(edgeText) }}</span>
    </div>
  </Transition>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {botTurnReviewState} from './botTurnReviewState';

export default defineComponent({
  name: 'BotReviewEdgeNotice',
  props: {
    /** TV-readable sizing to match the console review body. */
    large: {type: Boolean, default: false},
  },
  data() {
    return {state: botTurnReviewState};
  },
  computed: {
    edgeText(): string {
      return this.state.edge === 'no-prev' ? 'Previous turn unavailable' : 'The next turn has not been played yet';
    },
  },
});
</script>
