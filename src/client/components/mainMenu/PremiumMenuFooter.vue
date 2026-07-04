<template>
  <footer class="pmm-footer">
    <premium-identity-chip @open="$emit('edit-identity')" />

    <div class="pmm-footer__lang">
      <premium-language-switcher />
    </div>

    <div class="pmm-footer__divider" aria-hidden="true"></div>

    <div class="pmm-footer__meta">
      <span v-if="installerStale" class="pmm-footer__installer-warn">
        <span class="pmm-footer__installer-warn-glyph" aria-hidden="true">⚠</span>
        <span v-i18n>Installer updated — re-run the Steam Deck install</span>
      </span>
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
import {desktopBridge} from '@/client/components/desktop/desktopUpdateState';

export default defineComponent({
  name: 'PremiumMenuFooter',
  components: {
    PremiumLanguageSwitcher,
    PremiumIdentityChip,
  },
  emits: ['edit-identity'],
  data() {
    return {desktopVersion: '', installerStale: false};
  },
  mounted() {
    // On the desktop shell, prefer the authoritative baked app version (the release version,
    // e.g. 1.1.9). getVersion() is async; the web app has no bridge and uses settings.json.
    const bridge = desktopBridge();
    if (bridge !== undefined) {
      void bridge
        .getVersion()
        .then((v) => {
          this.desktopVersion = typeof v === 'string' ? v : '';
        })
        .catch(() => undefined);
      // Steam Deck: flag when the installed launcher wrapper predates the current
      // install-steamdeck.sh on GitHub (the updater can't rewrite the wrapper). Optional
      // bridge method — absent on older shells / the web, where it stays silent.
      void bridge
        .getInstallerNotice?.()
        .then((n) => {
          this.installerStale = n?.stale === true;
        })
        .catch(() => undefined);
    }
  },
  computed: {
    version(): string {
      if (this.desktopVersion !== '') {
        return this.desktopVersion;
      }
      // Real app version baked at build time; fall back to the short git hash only if a
      // build predates the `version` field.
      const settingsVersion = (raw_settings as {version?: string}).version;
      return settingsVersion !== undefined && settingsVersion !== '' ? settingsVersion : (raw_settings.head ?? '');
    },
  },
});
</script>
