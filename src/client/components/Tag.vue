<template>
  <div :class="getClasses()" :data-tooltip="$t(tag)" />
</template>

<script setup lang="ts">

import {Tag} from '@/common/cards/Tag';
import {$t} from '@/client/directives/i18n';

defineOptions({name: 'Tag'});
const props = defineProps({
  tag: {
    type: String as () => Tag,
    required: true,
  },
  size: {
    type: String,
    required: true,
  },
  type: {
    type: String,
  },
});

function getClasses(): string {
  const classes = ['tag-count', 'tooltip', 'tooltip-bottom'];
  classes.push(`tag-${props.tag}`);
  if (props.size !== undefined) {
    classes.push(`tag-size-${props.size}`);
  }
  if (props.type !== undefined) {
    classes.push(`tag-type-${props.type}`);
  }
  return classes.join(' ');
}
</script>
