<template>
  <footer class="pmm-footer">
    <premium-identity-chip @open="$emit('edit-identity')" />

    <div class="pmm-footer__lang">
      <premium-language-switcher />
    </div>

    <div class="pmm-footer__divider" aria-hidden="true"></div>

    <div class="pmm-footer__meta">
      <span v-if="version !== ''" class="pmm-footer__version">
        <span class="pmm-footer__version-tag" v-i18n>version</span>
        <span class="pmm-footer__version-value">{{ version }}</span>
      </span>
    </div>
  </footer>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PremiumLanguageSwitcher from '@/client/components/mainMenu/PremiumLanguageSwitcher.vue';
import PremiumIdentityChip from '@/client/components/mainMenu/PremiumIdentityChip.vue';
import raw_settings from '@/genfiles/settings.json';

export default defineComponent({
  name: 'PremiumMenuFooter',
  components: {
    PremiumLanguageSwitcher,
    PremiumIdentityChip,
  },
  emits: ['edit-identity'],
  computed: {
    version(): string {
      return raw_settings.head ?? '';
    },
  },
});
</script>
