<template>
  <div class="opt-child" @click="$emit('picked', label + '!')">
    <span class="opt-child__label" v-i18n>{{ label }}</span>
    <span class="opt-child__t">{{ $t(label) }}</span>
    <slot :value="clicks"></slot>
  </div>
</template>

<script lang="ts">
// An ordinary Options-API component of today: `this.$emit`, the GLOBAL `v-i18n` and `$t`.
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'OptionsChild',
  props: {label: {type: String, required: true}},
  emits: ['picked'],
  data() {
    return {clicks: 7};
  },
});
</script>
