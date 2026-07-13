<template>
  <footer class="pmm-footer">
    <premium-identity-chip @open="$emit('edit-identity')" />

    <div class="pmm-footer__lang">
      <premium-language-switcher />
    </div>

    <div class="pmm-footer__divider" aria-hidden="true"></div>

    <div class="pmm-footer__meta">
      <!-- In-app "Add to Steam library" (Windows only) — replaces the removed NSIS installer
           checkbox now that Velopack's Setup.exe has no finish page. Feature-detected + hidden
           once the shortcut is added (shared steamShortcutState). Off on Linux/Steam Deck (the
           install script owns it) and on the web. -->
      <button
        v-if="showSteamButton"
        type="button"
        class="pmm-footer__steam-btn"
        :class="{'pmm-footer__steam-btn--fail': steamState.result === 'failed'}"
        :disabled="steamState.busy"
        @click="onAddToSteam">
        <span v-if="steamState.result === 'failed'" v-i18n>Could not add to Steam</span>
        <span v-else v-i18n>Add to Steam library</span>
      </button>
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
import {addToSteam, initSteamShortcut, steamButtonVisible, steamShortcutState} from '@/client/components/desktop/steamShortcutState';

export default defineComponent({
  name: 'PremiumMenuFooter',
  components: {
    PremiumLanguageSwitcher,
    PremiumIdentityChip,
  },
  emits: ['edit-identity'],
  data() {
    return {desktopVersion: '', installerStale: false, steamState: steamShortcutState};
  },
  mounted() {
    initSteamShortcut();
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
    /** Windows desktop, shortcut not yet added → show the button (shared steamShortcutState). */
    showSteamButton(): boolean {
      return steamButtonVisible();
    },
  },
  methods: {
    onAddToSteam(): void {
      void addToSteam();
    },
  },
});
</script>

<style scoped>
.pmm-footer__steam-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid rgba(56, 189, 248, 0.4);
  background: rgba(8, 20, 32, 0.7);
  color: #cfe9ff;
  font: inherit;
  font-size: 12px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease, transform 0.12s ease;
}
.pmm-footer__steam-btn:hover:not(:disabled) {
  border-color: rgba(56, 189, 248, 0.85);
  background: rgba(14, 32, 48, 0.9);
  color: #eaf6ff;
  transform: translateY(-1px);
}
.pmm-footer__steam-btn:disabled {
  cursor: default;
  opacity: 0.75;
}
.pmm-footer__steam-btn--done {
  border-color: rgba(52, 211, 153, 0.7);
  color: #b6f5d8;
}
.pmm-footer__steam-btn--fail {
  border-color: rgba(248, 113, 113, 0.7);
  color: #fecaca;
}
</style>
