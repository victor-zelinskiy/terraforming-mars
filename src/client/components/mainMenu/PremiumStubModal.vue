<template>
  <teleport to="body">
    <div class="pmm-stub" role="dialog" aria-modal="true" :aria-label="$t(feature)">
      <div class="pmm-stub__backdrop" @click="$emit('close')"></div>
      <div class="pmm-stub__card">
        <span class="pmm-stub__corner pmm-stub__corner--tl" aria-hidden="true"></span>
        <span class="pmm-stub__corner pmm-stub__corner--tr" aria-hidden="true"></span>
        <span class="pmm-stub__corner pmm-stub__corner--bl" aria-hidden="true"></span>
        <span class="pmm-stub__corner pmm-stub__corner--br" aria-hidden="true"></span>

        <span class="pmm-stub__badge" v-i18n>Coming soon</span>
        <h2 class="pmm-stub__title" v-i18n>{{ feature }}</h2>
        <p class="pmm-stub__body" v-i18n>This section is not available yet.</p>

        <div class="pmm-stub__actions">
          <button ref="close" type="button" class="pmm-stub__close" @click="$emit('close')">
            <span v-i18n>Got it</span>
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'PremiumStubModal',
  props: {
    // English source label of the feature (e.g. "Cards list"), also the i18n key.
    feature: {type: String, required: true},
  },
  emits: ['close'],
  mounted() {
    window.addEventListener('keydown', this.onKey);
    (this.$refs.close as HTMLElement | undefined)?.focus();
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey);
  },
  methods: {
    onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.$emit('close');
      }
    },
  },
});
</script>
