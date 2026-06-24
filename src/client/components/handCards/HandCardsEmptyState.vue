<template>
  <div class="hand-board__empty" :class="{'hand-board__empty--filtered': reason === 'filtered'}" role="status">
    <span class="hand-board__empty-glyph" aria-hidden="true"></span>
    <span class="hand-board__empty-text" v-i18n>{{ message }}</span>
    <!-- Filtered → no permanent top-bar "reset" button (would clutter the
         filter row for an edge case); instead a compact, in-place reset lives
         right here where the player is looking when the list is empty. -->
    <button
      v-if="reason === 'filtered'"
      type="button"
      class="hand-board__empty-reset"
      @click="$emit('reset')">
      <span class="hand-board__empty-reset-glyph" aria-hidden="true">⟲</span>
      <span v-i18n>Reset filters</span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/**
 * Calm empty state for the hand overlay. `none` = the player literally
 * holds no cards; `filtered` = the current filters hid everything (and the
 * player can reset them in place via the reset button).
 */
export default defineComponent({
  name: 'HandCardsEmptyState',
  emits: ['reset'],
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
