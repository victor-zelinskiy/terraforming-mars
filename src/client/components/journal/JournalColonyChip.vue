<template>
  <span ref="chip"
        class="journal-token journal-token--colony"
        tabindex="0"
        @mouseenter="onEnter"
        @mouseleave="onLeave"
        @focus="onEnter"
        @blur="onLeave"
        v-i18n>{{ name }}</span>
  <ColonyPreviewPopover :name="name" :anchor="anchor" :visible="previewVisible" />
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import ColonyPreviewPopover from '@/client/components/journal/ColonyPreviewPopover.vue';

const HOVER_DELAY = 160;

/**
 * A COLONY name token that shows a read-only colony mini-card on hover (mirrors
 * `JournalCardChip`). Used in the journal feed + notifications (via
 * `JournalTokenRenderer`) + the drawn-cards source link.
 */
export default defineComponent({
  name: 'JournalColonyChip',
  components: {ColonyPreviewPopover},
  props: {
    name: {
      type: String as () => ColonyName,
      required: true,
    },
  },
  data() {
    return {
      previewVisible: false,
      anchor: undefined as DOMRect | undefined,
      hoverTimer: undefined as number | undefined,
    };
  },
  methods: {
    onEnter(): void {
      this.clearTimer();
      this.hoverTimer = window.setTimeout(() => {
        const el = this.$refs.chip as HTMLElement | undefined;
        this.anchor = el?.getBoundingClientRect();
        this.previewVisible = true;
      }, HOVER_DELAY);
    },
    onLeave(): void {
      this.clearTimer();
      this.previewVisible = false;
    },
    clearTimer(): void {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
    },
  },
  beforeUnmount(): void {
    this.clearTimer();
  },
});
</script>
