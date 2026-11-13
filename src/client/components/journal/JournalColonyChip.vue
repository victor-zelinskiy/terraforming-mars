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

<script setup vapor lang="ts">
import {ref, useTemplateRef} from 'vue';
import {vI18n} from '@/client/directives/vDirectives';
import {ColonyName} from '@/common/colonies/ColonyName';
import ColonyPreviewPopover from '@/client/components/journal/ColonyPreviewPopover.vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';

const HOVER_DELAY = 160;

/**
 * A COLONY name token that shows a read-only colony mini-card on hover (mirrors
 * `JournalCardChip`). Used in the journal feed + notifications (via
 * `JournalTokenRenderer`) + the drawn-cards source link.
 */
defineOptions({name: 'JournalColonyChip'});
defineProps({
  name: {
    type: String as () => ColonyName,
    required: true,
  },
});

const flow = useFlowScope('journal-colony-chip');
const chip = useTemplateRef<HTMLElement>('chip');
const previewVisible = ref(false);
const anchor = ref<DOMRect | undefined>(undefined);
let cancelHover = (() => {}) as () => void;

function onEnter(): void {
  clearTimer();
  cancelHover = flow.after(HOVER_DELAY, 'the chip\'s hover delay', () => {
    const el = chip.value ?? undefined;
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
