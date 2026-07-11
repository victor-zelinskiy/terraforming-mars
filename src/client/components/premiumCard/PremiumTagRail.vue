<template>
  <!--
    TAG CLUSTER OVERLAY — premium medallions pinned OVER the right end of
    the title plate. Its own positioned layer (z above the plate AND the
    gold frame), own depth, no clipping; it NEVER participates in the
    header's layout flow — the plate keeps its full-width silhouette and
    only the title text's right safe-area accounts for the cluster width
    (see PremiumCard.headerVars). Leftmost (primary) tag stacks on top in
    overlap/stack modes — explicit z-order, not DOM paint order.
  -->
  <div class="pcard__tags" :class="'pcard__tags--' + plan.mode" aria-hidden="true">
    <span v-for="(tag, i) in tags"
          :key="i"
          class="pcard-tag"
          :style="{backgroundImage: `url(${tagUrl(tag)})`, zIndex: tags.length - i}"></span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {TagClusterPlan} from './tagLayout';
import {tagIconUrl} from './premiumCardIcons';

export default defineComponent({
  name: 'PremiumTagRail',
  props: {
    tags: {
      type: Array as () => ReadonlyArray<Tag>,
      required: true,
    },
    plan: {
      type: Object as () => TagClusterPlan,
      required: true,
    },
  },
  methods: {
    tagUrl(tag: Tag): string {
      return tagIconUrl(tag);
    },
  },
});
</script>
