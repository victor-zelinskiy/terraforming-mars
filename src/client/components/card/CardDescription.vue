<template>
  <div :class="classes">(<span v-i18n>{{ description }}</span>)</div>
</template>

<script setup vapor lang="ts">
/*
 * A VAPOR component — one of the three leaves of the Vue 3.6 pilot (docs/claude/vapor/ROADMAP.md §3.6): this one is
 * the `v-i18n` directive over an interpolation (imported — `directives/vDirectives.ts`), on a component
 * that is rendered many times per screen inside a virtual-DOM tree.
 */
import {computed} from 'vue';
import {isIDescription} from '@/common/cards/render/ICardRenderDescription';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'CardDescription'});
const props = defineProps<{item: unknown}>();

const classes = computed((): ReadonlyArray<string> => {
  const classes: string[] = ['card-description'];
  if (isIDescription(props.item)) {
    if (props.item.align !== 'center') {
      // we want to reduce size for aligned left of right to 60%
      classes.push('card-description-aligned');
    }
    classes.push('card-description-align--' + props.item.align);
  }
  return classes;
});
const description = computed((): string => (isIDescription(props.item) ? props.item.text : String(props.item)));
</script>
