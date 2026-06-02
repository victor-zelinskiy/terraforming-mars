<template>
  <div class="played-empty">
    <span class="played-empty__glyph" aria-hidden="true">⊘</span>
    <span v-if="reason === 'filtered'" class="played-empty__text" v-i18n>No cards match the selected filters</span>
    <span v-else class="played-empty__text" v-i18n>No cards have been played yet</span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/**
 * Calm empty state — never reads as an error. `filtered` when the active
 * filters hide everything, `none` when the player has played nothing.
 */
export default defineComponent({
  name: 'PlayedCardsEmptyState',
  props: {
    reason: {
      type: String as () => 'none' | 'filtered',
      default: 'none',
    },
  },
});
</script>
