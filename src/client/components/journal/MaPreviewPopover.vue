<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible && name !== ''"
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
        <div class="journal-ma-preview__desc" v-i18n>{{ description }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';

/**
 * Hover preview for a MILESTONE / AWARD token (journal feed / notifications) —
 * the name + its rule description (the same text the Milestones / Awards overlay
 * floating tooltip shows), pulled from the static manifest. Teleported,
 * `pointer-events: none`, mirrors the card/colony preview positioning.
 */
const PREVIEW_WIDTH = 248;
const APPROX_HEIGHT = 110;
const GAP = 14;
const VIEWPORT_MARGIN = 8;

export default defineComponent({
  name: 'MaPreviewPopover',
  components: {BarButtonIcon},
  props: {
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
  },
  computed: {
    description(): string {
      if (this.name === '') {
        return '';
      }
      try {
        return this.kind === 'milestone' ?
          getMilestone(this.name as MilestoneName).description :
          getAward(this.name as AwardName).description;
      } catch (e) {
        return '';
      }
    },
    positionStyle(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {display: 'none'};
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = a.left - GAP - PREVIEW_WIDTH;
      if (left < VIEWPORT_MARGIN) {
        left = a.right + GAP;
      }
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - PREVIEW_WIDTH - VIEWPORT_MARGIN));
      let top = a.top + a.height / 2 - APPROX_HEIGHT / 2;
      top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - APPROX_HEIGHT - VIEWPORT_MARGIN));
      return {left: `${Math.round(left)}px`, top: `${Math.round(top)}px`, width: `${PREVIEW_WIDTH}px`};
    },
  },
});
</script>
