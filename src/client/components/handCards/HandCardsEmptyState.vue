<template>
  <div class="hand-board__empty" role="status">
    <span class="hand-board__empty-glyph" aria-hidden="true"></span>
    <span class="hand-board__empty-text" v-i18n>{{ message }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/**
 * Calm empty state for the hand overlay. `none` = the player literally
 * holds no cards; `filtered` = the current filters hid everything.
 */
export default defineComponent({
  name: 'HandCardsEmptyState',
  props: {
    reason: {
      type: String as () => 'none' | 'filtered',
      required: true,
    },
  },
  computed: {
    message(): string {
      return this.reason === 'none' ? 'No cards in hand' : 'No cards match these filters';
    },
  },
});
</script>
