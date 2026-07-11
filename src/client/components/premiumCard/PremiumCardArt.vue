<template>
  <div class="pcard__art"
       :class="{
         'pcard__art--loaded': loaded,
         'pcard__art--fallback': onFallback,
         'pcard__art--void': exhausted,
       }"
       aria-hidden="true">
    <img v-if="!exhausted"
         :src="src"
         alt=""
         loading="lazy"
         decoding="async"
         draggable="false"
         @load="loaded = true"
         @error="onError" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CARD_ART_FALLBACK_URL, PremiumCardArt} from '@/client/cards/cardArt';

/**
 * The art viewport. Failure chain is one-shot and can never loop:
 * per-card art → shared fallback (-1.webp) → procedural theme body
 * (`pcard__art--void`, no <img> at all).
 */
export default defineComponent({
  name: 'PremiumCardArt',
  props: {
    art: {
      type: Object as () => PremiumCardArt,
      required: true,
    },
  },
  data() {
    return {
      loaded: false,
      failedPrimary: false,
      exhausted: false,
    };
  },
  computed: {
    src(): string {
      return this.failedPrimary ? CARD_ART_FALLBACK_URL : this.art.url;
    },
    onFallback(): boolean {
      return this.art.fallback || this.failedPrimary;
    },
  },
  watch: {
    // A re-pointed keyless card face re-arms the load chain for the new art.
    'art.url'() {
      this.loaded = false;
      this.failedPrimary = false;
      this.exhausted = false;
    },
  },
  methods: {
    onError(): void {
      if (!this.failedPrimary && !this.art.fallback) {
        this.failedPrimary = true; // retry once with the shared fallback
        this.loaded = false;
        return;
      }
      this.exhausted = true; // even -1.webp failed → procedural body
    },
  },
});
</script>
