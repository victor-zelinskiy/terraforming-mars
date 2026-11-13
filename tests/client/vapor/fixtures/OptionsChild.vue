<template>
  <div class="opt-child" @click="$emit('picked', label + '!')">
    <span class="opt-child__label" v-i18n>{{ label }}</span>
    <span class="opt-child__t">{{ $t(label) }}</span>
    <slot :value="clicks"></slot>
  </div>
</template>

<script lang="ts">
// An Options-API component on the virtual DOM: `this.$emit`, and `v-i18n` / `$t` as its OWN imports — the app
// registers no global for them (a local directive, `$t` as a method), exactly as every product component.
import {defineComponent} from 'vue';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

export default defineComponent({
  name: 'OptionsChild',
  directives: {i18n: vI18n},
  props: {label: {type: String, required: true}},
  emits: ['picked'],
  data() {
    return {clicks: 7};
  },
  // `methods`, not a `setup()` return: Vue reserves the `$` prefix of setup state and never resolves it in a template.
  methods: {$t},
});
</script>
