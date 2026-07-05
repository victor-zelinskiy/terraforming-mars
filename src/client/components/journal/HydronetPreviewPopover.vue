<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible"
        class="journal-sp-preview journal-sp-preview--hydro"
        :style="positionStyle"
        role="tooltip"
        aria-hidden="true">
        <span class="journal-sp-preview__corner journal-sp-preview__corner--tl" aria-hidden="true"></span>
        <span class="journal-sp-preview__corner journal-sp-preview__corner--br" aria-hidden="true"></span>
        <div class="journal-sp-preview__icon journal-sp-preview__icon--hydro">
          <BarButtonIcon name="hydronetwork" />
        </div>
        <div class="journal-sp-preview__body">
          <div class="journal-sp-preview__kicker" v-i18n>Hydronetwork</div>
          <div class="journal-sp-preview__name" v-i18n>{{ titleKey }}</div>
          <div class="journal-sp-preview__desc" v-i18n>{{ descriptionKey }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {HYDRO_PREVIEW} from '@/client/components/hydronetwork/hydroPreview';

/**
 * P29 — compact hover preview for the HYDRONETWORK journal token (the
 * Delta Project system chip used to show NOTHING on hover — the one
 * journal entity with no preview at all). A visual twin of
 * `StandardProjectPreviewPopover` (shares its `.journal-sp-preview`
 * chrome); the copy comes from the SHARED `HYDRO_PREVIEW` source the
 * console journal inspect card reads too, so the two shells can't
 * diverge. Fullscreen stays intentionally unavailable (no card exists).
 */

const PREVIEW_WIDTH = 264;
const PREVIEW_HEIGHT = 104;
const GAP = 14;
const VIEWPORT_MARGIN = 8;

export default defineComponent({
  name: 'HydronetPreviewPopover',
  components: {BarButtonIcon},
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    anchor: {
      type: Object as () => DOMRect | undefined,
      default: undefined,
    },
    prefer: {
      type: String as () => 'left' | 'right',
      default: 'left',
    },
  },
  computed: {
    titleKey(): string {
      return HYDRO_PREVIEW.titleKey;
    },
    descriptionKey(): string {
      return HYDRO_PREVIEW.descriptionKey;
    },
    positionStyle(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {display: 'none'};
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const leftSide = a.left - GAP - PREVIEW_WIDTH;
      const rightSide = a.right + GAP;
      let left;
      if (this.prefer === 'right') {
        left = rightSide;
        if (left + PREVIEW_WIDTH > vw - VIEWPORT_MARGIN) {
          left = leftSide;
        }
      } else {
        left = leftSide;
        if (left < VIEWPORT_MARGIN) {
          left = rightSide;
        }
      }
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - PREVIEW_WIDTH - VIEWPORT_MARGIN));

      let top = a.top + a.height / 2 - PREVIEW_HEIGHT / 2;
      top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - PREVIEW_HEIGHT - VIEWPORT_MARGIN));

      return {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
      };
    },
  },
});
</script>
