<template>
  <footer class="pmm-footer">
    <div class="pmm-footer__lang">
      <premium-language-switcher />
    </div>

    <div class="pmm-footer__divider" aria-hidden="true"></div>

    <div class="pmm-footer__meta">
      <a class="pmm-footer__legacy" href="legacy">
        <span class="pmm-footer__legacy-label" v-i18n>Legacy menu</span>
        <span class="pmm-footer__legacy-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </a>

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
import raw_settings from '@/genfiles/settings.json';

export default defineComponent({
  name: 'PremiumMenuFooter',
  components: {
    PremiumLanguageSwitcher,
  },
  computed: {
    version(): string {
      return raw_settings.head ?? '';
    },
  },
});
</script>
