<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible && name !== ''"
        ref="box"
        class="journal-ma-preview"
        :class="'journal-ma-preview--' + kind"
        :style="positionStyle"
        role="tooltip"
        aria-hidden="true">
        <div class="journal-ma-preview__head">
          <span class="journal-ma-preview__icon" aria-hidden="true">
            <BarButtonIcon :name="kind === 'milestone' ? 'milestones' : 'awards'" />
          </span>
          <div class="journal-ma-preview__headtext">
            <div class="journal-ma-preview__kicker" v-i18n>{{ kind === 'milestone' ? 'Achievement' : 'Award' }}</div>
            <div class="journal-ma-preview__name" v-i18n>{{ name }}</div>
          </div>
        </div>
        <div class="journal-ma-preview__body">
          <div v-if="art !== ''" class="journal-ma-preview__art" :style="{backgroundImage: `url(${art})`}" aria-hidden="true"></div>
          <div class="journal-ma-preview__desc" v-i18n>{{ description }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup vapor lang="ts">
import {computed, PropType, useTemplateRef} from 'vue';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {useMeasuredPreviewStyle} from '@/client/components/journal/previewPlacement';
import {AwardName} from '@/common/ma/AwardName';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {maArtUrl} from '@/client/components/ma/maArt';
import {vI18n} from '@/client/directives/vDirectives';

/**
 * Hover preview for a MILESTONE / AWARD token (journal feed / notifications) —
 * the name + its rule description (the same text the Milestones / Awards overlay
 * floating tooltip shows), pulled from the static manifest. Teleported,
 * `pointer-events: none`; placed beside its token by its MEASURED box (`previewPlacement.ts` — the width is this
 * popover's own, the height is whatever the rule's text takes).
 */
const PREVIEW_WIDTH = 300;
/** The guess of the one unpainted pass before the measure. */
const GUESS = {width: PREVIEW_WIDTH, height: 132};

defineOptions({name: 'MaPreviewPopover'});
const props = defineProps({
  kind: {
    type: String as () => 'milestone' | 'award',
    required: true,
  },
  name: {
    type: String as () => MilestoneName | AwardName | '',
    default: '',
  },
  visible: {
    type: Boolean,
    default: false,
  },
  anchor: {
    type: Object as PropType<DOMRect | undefined>,
    default: undefined,
  },
});

const description = computed((): string => {
  if (props.name === '') {
    return '';
  }
  try {
    return props.kind === 'milestone' ?
      getMilestone(props.name as MilestoneName).description :
      getAward(props.name as AwardName).description;
  } catch (e) {
    return '';
  }
});
// The per-ITEM art (assets/ma/<name>.png) — same set + name→file transform
// the Milestones / Awards overlays use.
const art = computed((): string => {
  if (props.name === '') {
    return '';
  }
  return maArtUrl(props.name as string);
});
const box = useTemplateRef<HTMLElement>('box');
const placed = useMeasuredPreviewStyle(box, () => props.visible && props.name !== '', () => props.anchor, GUESS);
const positionStyle = computed((): Record<string, string> => {
  return placed.value.display === 'none' ? placed.value : {...placed.value, width: `${PREVIEW_WIDTH}px`};
});
</script>
