<template>
  <div class="pcard__tags" :class="'pcard__tags--' + plan.mode" aria-hidden="true">
    <span v-for="(tag, i) in tags"
          :key="i"
          class="pcard-tag"
          :data-tag="tag"
          :style="{...tagStyle(tag), zIndex: String(tags.length - i)}"></span>
  </div>
</template>

<script setup lang="ts">
/*
 * TAG CLUSTER OVERLAY — premium medallions pinned OVER the right end of
 * the title plate. Its own positioned layer (z above the plate AND the
 * gold frame), own depth, no clipping; it NEVER participates in the
 * header's layout flow — the plate keeps its full-width silhouette and
 * only the title text's right safe-area accounts for the cluster width
 * (see PremiumCard.headerVars). Leftmost (primary) tag stacks on top in
 * overlap/stack modes — explicit z-order, not DOM paint order.
 * `data-tag` names each medallion so a HOST can mark one as a state
 * without re-drawing it (the discard viewer's «thrown away for this tag»).
 */
import {Tag} from '@/common/cards/Tag';
import {TagClusterPlan} from './tagLayout';
import {tagIconStyle} from './premiumCardIcons';

defineOptions({name: 'PremiumTagRail'});
defineProps({
  tags: {
    type: Array as () => ReadonlyArray<Tag>,
    required: true,
  },
  plan: {
    type: Object as () => TagClusterPlan,
    required: true,
  },
});

function tagStyle(tag: Tag): Record<string, string> {
  return tagIconStyle(tag);
}
</script>
