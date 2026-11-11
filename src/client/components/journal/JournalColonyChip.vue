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
import {useFlowScope} from '@/client/console/session/useFlowScope';

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
  setup() {
    return {flow: useFlowScope('journal-colony-chip')};
  },
  data() {
    return {
      previewVisible: false,
      anchor: undefined as DOMRect | undefined,
      cancelHover: (() => {}) as () => void,
    };
  },
  methods: {
    onEnter(): void {
      this.clearTimer();
      this.cancelHover = this.flow.after(HOVER_DELAY, 'the chip\'s hover delay', () => {
        const el = (this.$refs.chip ?? undefined) as HTMLElement | undefined;
        this.anchor = el?.getBoundingClientRect();
        this.previewVisible = true;
      });
    },
    onLeave(): void {
      this.clearTimer();
      this.previewVisible = false;
    },
    clearTimer(): void {
      this.cancelHover();
    },
  },
});
</script>
