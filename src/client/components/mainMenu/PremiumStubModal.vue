<template>
  <teleport to="body">
    <div class="pmm-stub" role="dialog" aria-modal="true" :aria-label="$t(title)" @keydown.esc="close">
      <div class="pmm-stub__backdrop" @click="close"></div>
      <div class="pmm-stub__card">
        <span class="pmm-stub__corner pmm-stub__corner--tl" aria-hidden="true"></span>
        <span class="pmm-stub__corner pmm-stub__corner--tr" aria-hidden="true"></span>
        <span class="pmm-stub__corner pmm-stub__corner--bl" aria-hidden="true"></span>
        <span class="pmm-stub__corner pmm-stub__corner--br" aria-hidden="true"></span>

        <div class="pmm-stub__badge" v-i18n>Coming soon</div>
        <h2 class="pmm-stub__title" v-i18n>{{ title }}</h2>
        <p class="pmm-stub__body" v-i18n>{{ body }}</p>

        <div class="pmm-stub__actions">
          <button ref="closeBtn" type="button" class="pmm-stub__close" @click="close">
            <span class="pmm-stub__close-label" v-i18n>Close</span>
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
    title: {type: String, required: true},
    body: {type: String, required: true},
  },
  emits: ['close'],
  mounted() {
    (this.$refs.closeBtn as HTMLButtonElement | undefined)?.focus();
  },
  methods: {
    close(): void {
      this.$emit('close');
    },
  },
});
</script>
