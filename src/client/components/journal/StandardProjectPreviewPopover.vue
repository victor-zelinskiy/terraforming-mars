<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible"
        class="journal-sp-preview"
        :style="positionStyle"
        role="tooltip"
        aria-hidden="true">
        <span class="journal-sp-preview__corner journal-sp-preview__corner--tl" aria-hidden="true"></span>
        <span class="journal-sp-preview__corner journal-sp-preview__corner--br" aria-hidden="true"></span>
        <div class="journal-sp-preview__icon" :class="visual.iconClass"></div>
        <div class="journal-sp-preview__body">
          <div class="journal-sp-preview__kicker" v-i18n>Standard project</div>
          <div class="journal-sp-preview__name" v-i18n>{{ displayName }}</div>
          <div class="journal-sp-preview__desc" v-if="visual.description" v-i18n>{{ visual.description }}</div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {standardProjectVisual, StandardProjectVisual} from '@/client/components/overview/standardProjectVisuals';

/**
 * Compact hover preview for a STANDARD-PROJECT card token in the journal.
 *
 * Per the journal spec, standard projects must NOT show a legacy full
 * card — they show a compact, informative preview that mirrors the
 * fork's modern Standard Projects overlay (pictogram + name + one-line
 * effect). We reuse the very same `PROJECT_VISUAL` table the overlay
 * uses (`standardProjectVisuals.ts`). No fullscreen affordance for
 * standard projects (spec: "fullscreen по клику ... НЕ нужен").
 *
 * Positioning mirrors CardPreviewPopover: prefer the LEFT of the token
 * (board side), flip / clamp to stay on-screen.
 */

const PREVIEW_WIDTH = 244;
const PREVIEW_HEIGHT = 96;
const GAP = 14;
const VIEWPORT_MARGIN = 8;

export default defineComponent({
  name: 'StandardProjectPreviewPopover',
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
    visible: {
      type: Boolean,
      default: false,
    },
    anchor: {
      type: Object as () => DOMRect | undefined,
      default: undefined,
    },
  },
  computed: {
    visual(): StandardProjectVisual {
      return standardProjectVisual(this.name);
    },
    displayName(): string {
      // Strip any ":" suffix the same way the rest of the log UI does.
      return this.name.split(':')[0];
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
