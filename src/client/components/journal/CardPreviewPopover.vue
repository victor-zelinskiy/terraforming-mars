<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible"
        class="journal-card-preview"
        :style="positionStyle"
        role="tooltip"
        aria-hidden="true">
        <div class="journal-card-preview__inner">
          <Card :card="resolvedCard" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import Card from '@/client/components/card/Card.vue';
import {withLiveResources} from '@/client/components/card/liveCardResources';

/**
 * Lightweight hover preview for a card token inside the journal feed.
 *
 * Rendered via <Teleport to="body"> so it floats above the journal panel
 * and the board regardless of the feed's overflow clipping. The whole
 * popover is `pointer-events: none` — it's a pure read-only preview that
 * must never steal hover from the token that spawned it (the token owns
 * the show/hide lifecycle).
 *
 * Smart positioning: the journal lives on the RIGHT edge of the screen,
 * so we prefer placing the preview to the LEFT of the token (over the
 * board area, where there's room). If the card would clip the left edge
 * we flip to the right; vertically we clamp so a card near the top/bottom
 * of the feed stays fully visible.
 *
 * The `card` prop takes priority over `name` — pass a live CardModel to show
 * current resource counts (used by the Actions/Effects overlays). The journal
 * and other static-name callers can omit `card` and rely on `name` alone.
 */

// Approximate rendered size of the scaled-down preview card. Used only
// for positioning math; the real card sizes itself.
const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = 336;
const GAP = 14;
const VIEWPORT_MARGIN = 8;

export default defineComponent({
  name: 'CardPreviewPopover',
  components: {Card},
  props: {
    name: {
      type: String as () => CardName,
      default: '' as CardName,
    },
    // When provided, the live CardModel is rendered (includes current resources).
    // Falls back to {name} when absent.
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
    visible: {
      type: Boolean,
      default: false,
    },
    // Bounding rect of the token that triggered the preview, in viewport
    // coordinates (from getBoundingClientRect()).
    anchor: {
      type: Object as () => DOMRect | undefined,
      default: undefined,
    },
  },
  computed: {
    resolvedCard(): CardModel {
      // Fill the live resource count for played cards shown by name only (the
      // journal builds {name}); a caller-supplied live card keeps its own value.
      return withLiveResources(this.card ?? ({name: this.name} as CardModel));
    },
    positionStyle(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {display: 'none'};
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Horizontal: prefer left of the token.
      let left = a.left - GAP - PREVIEW_WIDTH;
      if (left < VIEWPORT_MARGIN) {
        // Not enough room on the left — flip to the right of the token.
        left = a.right + GAP;
      }
      // Final clamp so we never spill off either edge.
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - PREVIEW_WIDTH - VIEWPORT_MARGIN));

      // Vertical: centre on the token, then clamp into the viewport.
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
