<template>
  <div class="pcard__tags" :class="'pcard__tags--' + layout" aria-hidden="true">
    <span v-for="(tag, i) in tags"
          :key="i"
          class="pcard-tag"
          :style="{backgroundImage: `url(${tagUrl(tag)})`}"></span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {TagLayoutMode} from './tagLayout';
import {tagIconUrl} from './premiumCardIcons';

/** Top-right medallion cluster; layout preset comes from tagLayout.ts. */
export default defineComponent({
  name: 'PremiumTagRail',
  props: {
    tags: {
      type: Array as () => ReadonlyArray<Tag>,
      required: true,
    },
    layout: {
      type: String as () => TagLayoutMode,
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
