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
    // In sell-patents sale mode the "no cards" wording is sale-specific.
    saleMode: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    message(): string {
      if (this.reason === 'none') {
        return this.saleMode ? 'No cards to sell' : 'No cards in hand';
      }
      return 'No cards match these filters';
    },
  },
});
</script>
