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

<script setup lang="ts">
import {ref, useTemplateRef} from 'vue';
import {vI18n} from '@/client/directives/vDirectives';
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
defineOptions({name: 'JournalMaChip'});
defineProps({
  kind: {
    type: String as () => 'milestone' | 'award',
    required: true,
  },
  name: {
    type: String as () => MilestoneName | AwardName,
    required: true,
  },
});

const flow = useFlowScope('journal-ma-chip');
const chip = useTemplateRef<HTMLElement>('chip');
const previewVisible = ref(false);
const anchor = ref<DOMRect | undefined>(undefined);
let cancelHover = (() => {}) as () => void;
function onEnter(): void {
  clearTimer();
  cancelHover = flow.after(HOVER_DELAY, 'the chip\'s hover delay', () => {
    const el = chip.value;
    anchor.value = el?.getBoundingClientRect();
    previewVisible.value = true;
  });
}
function onLeave(): void {
  clearTimer();
  previewVisible.value = false;
}
function clearTimer(): void {
  cancelHover();
}
</script>
