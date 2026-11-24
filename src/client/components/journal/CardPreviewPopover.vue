<template>
  <Teleport to="body">
    <Transition name="journal-preview">
      <div
        v-if="visible"
        class="journal-card-preview"
        :style="positionStyle"
        role="tooltip"
        aria-hidden="true">
        <div ref="box" class="journal-card-preview__inner">
          <Card :card="resolvedCard" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup vapor lang="ts">
import {computed, PropType, useTemplateRef} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {useMeasuredPreviewStyle} from '@/client/components/journal/previewPlacement';
import {CardModel} from '@/common/models/CardModel';
import Card from '@/client/components/card/CardFace.vue';
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

// The guess of the one unpainted pass before the measure: the preview is placed by the box its scaled-down card
// REALLY has (`previewPlacement.ts` — the inner node's on-screen rect, its scale included).
const GUESS = {width: 240, height: 336};

defineOptions({name: 'CardPreviewPopover'});
const props = defineProps({
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
});

const resolvedCard = computed((): CardModel => {
  // Fill the live resource count for played cards shown by name only (the
  // journal builds {name}); a caller-supplied live card keeps its own value.
  return withLiveResources(props.card ?? ({name: props.name} as CardModel));
});
const box = useTemplateRef<HTMLElement>('box');
const positionStyle = useMeasuredPreviewStyle(box, () => props.visible, () => props.anchor, GUESS);
</script>
