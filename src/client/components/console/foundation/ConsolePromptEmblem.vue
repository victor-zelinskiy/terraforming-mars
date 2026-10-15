<template>
  <!-- THE TONE EMBLEM — the decision's character as a SHAPE, so it never rests on colour alone:
         gain    — a circle with a plus;
         loss    — a warning triangle with a minus;
         neutral — the console's own ◈ diamond.
       Drawn in `currentColor`; the host's tone class colours it. Decorative (the tag beside it carries the word). -->
  <svg class="con-prompt-emblem" :class="'con-prompt-emblem--' + tone" viewBox="0 0 20 20" aria-hidden="true"
       :data-prompt-emblem="tone">
    <template v-if="tone === 'gain'">
      <circle cx="10" cy="10" r="8.1" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="1.6" />
      <path d="M10 5.6 V14.4 M5.6 10 H14.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" />
    </template>
    <template v-else-if="tone === 'loss'">
      <path d="M10 1.9 L18.6 17.1 H1.4 Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.6"
            stroke-linejoin="round" />
      <path d="M6.4 12.3 H13.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </template>
    <template v-else>
      <path d="M10 1.8 L18.2 10 L10 18.2 L1.8 10 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M10 6.6 L13.4 10 L10 13.4 L6.6 10 Z" fill="currentColor" />
    </template>
  </svg>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PromptTone} from '@/client/console/promptTone';

/**
 * @console-shared LIVE — the prompt-modal family's emblem (`console_prompt.less`).
 * One component for the head, the consequence footer and the mandatory
 * announcement, so a tone has ONE silhouette everywhere it is named.
 */
export default defineComponent({
  name: 'ConsolePromptEmblem',
  props: {
    tone: {type: String as PropType<PromptTone>, required: true},
  },
});
</script>
