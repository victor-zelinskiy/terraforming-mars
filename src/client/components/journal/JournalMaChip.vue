<template>
  <span ref="chip"
        class="journal-token"
        :class="'journal-token--' + kind"
        tabindex="0"
        @mouseenter="onEnter"
        @mouseleave="onLeave"
        @focus="onEnter"
        @blur="onLeave"
        v-i18n>{{ name }}</span>
  <MaPreviewPopover :kind="kind" :name="name" :anchor="anchor" :visible="previewVisible" />
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import MaPreviewPopover from '@/client/components/journal/MaPreviewPopover.vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';

const HOVER_DELAY = 160;

/**
 * A MILESTONE / AWARD name token that shows its rule description on hover
 * (mirrors `JournalCardChip` / `JournalColonyChip`). Used in the journal feed +
 * notifications via `JournalTokenRenderer`.
 */
export default defineComponent({
  name: 'JournalMaChip',
  components: {MaPreviewPopover},
  props: {
    kind: {
      type: String as () => 'milestone' | 'award',
      required: true,
    },
    name: {
      type: String as () => MilestoneName | AwardName,
      required: true,
    },
  },
  setup() {
    return {flow: useFlowScope('journal-ma-chip')};
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
