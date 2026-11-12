<template>
  <i class="opt-ctx" :data-theme="theme">{{ clicks }}</i>
</template>

<script lang="ts">
// An Options-API child of today: it `inject`s what an ancestor provided and has a METHOD its parent calls through a ref.
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'OptionsContextChild',
  inject: {theme: {from: 'probe-theme', default: 'none'}},
  data() {
    return {clicks: 0};
  },
  methods: {
    press(): number {
      return ++this.clicks;
    },
  },
});
</script>
