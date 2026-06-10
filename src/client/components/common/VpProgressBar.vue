<template>
  <!--
    The shared amber "X / N toward the next VP" progress bar. Style lives in
    `src/styles/vp_progress.less` (`.vp-progress*`, built from mixins also used by
    the additional-resource detail overlay) so every surface that shows VP /
    threshold progress looks identical. `reached` recolours the fill when the
    threshold has just been hit.
  -->
  <div class="vp-progress" :class="{'vp-progress--reached': reached}" :aria-label="$t('Progress to next VP')">
    <span class="vp-progress__track">
      <span class="vp-progress__fill" :style="{width: pct + '%'}"></span>
    </span>
    <span class="vp-progress__text">{{ filled }}/{{ per }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'VpProgressBar',
  props: {
    filled: {
      type: Number,
      required: true,
    },
    per: {
      type: Number,
      required: true,
    },
    reached: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    pct(): number {
      return this.per > 0 ? Math.round((this.filled / this.per) * 100) : 0;
    },
  },
});
</script>
