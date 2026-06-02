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
          <div class="journal-sp-preview__kicker" v-i18n>{{ kicker }}</div>
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
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {standardProjectVisual, StandardProjectVisual} from '@/client/components/overview/standardProjectVisuals';

/**
 * Compact hover preview for a STANDARD-PROJECT or STANDARD-ACTION card
 * token in the journal.
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
    // Which side of the anchor to prefer. Journal tokens live on the
    // RIGHT of the screen → prefer 'left' (over the board). Left-panel
    // convert buttons → prefer 'right'. Either way we flip if there's no
    // room on the preferred side.
    prefer: {
      type: String as () => 'left' | 'right',
      default: 'left',
    },
  },
  computed: {
    visual(): StandardProjectVisual {
      return standardProjectVisual(this.name);
    },
    // Convert Plants / Convert Heat are STANDARD ACTIONS, not projects —
    // label the kicker accordingly so the journal stops mislabelling them.
    kicker(): string {
      if (getCard(this.name)?.type === CardType.STANDARD_ACTION) {
        return 'Standard action';
      }
      return 'Standard project';
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

      const leftSide = a.left - GAP - PREVIEW_WIDTH;
      const rightSide = a.right + GAP;
      let left;
      if (this.prefer === 'right') {
        // Prefer the board side; flip to the left only if it would clip.
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
