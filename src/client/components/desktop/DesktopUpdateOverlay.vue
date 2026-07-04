<template>
  <div v-if="visible" class="desktop-update" :class="blocking ? 'desktop-update--cover' : 'desktop-update--pill'">
    <!-- Non-blocking: a quiet corner pill while the startup compatibility check runs. -->
    <div v-if="!blocking" class="desktop-update__pill">
      <span class="desktop-update__spinner"></span>
      <span v-i18n>Checking for updates…</span>
    </div>

    <!-- Blocking: the full-screen mandatory update gate. -->
    <div v-else class="desktop-update__panel">
      <div class="desktop-update__glyph">⟳</div>

      <h1 class="desktop-update__title" v-i18n>Update required</h1>
      <p class="desktop-update__lead" v-i18n>A newer version is required to keep playing.</p>

      <div class="desktop-update__versions">
        <span><span v-i18n>Installed</span>: <b>{{ state.currentVersion || '—' }}</b></span>
        <span v-if="state.latestVersion"><span v-i18n>Latest</span>: <b>{{ state.latestVersion }}</b></span>
      </div>

      <ul v-if="notes.length" class="desktop-update__notes">
        <li v-for="(n, i) in notes" :key="i">{{ n }}</li>
      </ul>

      <!-- downloading -->
      <div v-if="state.mode === 'downloading'" class="desktop-update__progress-wrap">
        <div class="desktop-update__status" v-i18n>Downloading update…</div>
        <div class="desktop-update__bar">
          <div class="desktop-update__bar-fill" :style="{width: percent + '%'}"></div>
        </div>
        <div class="desktop-update__progress-meta">{{ percent }}%<span v-if="speed"> · {{ speed }}</span></div>
      </div>

      <!-- downloaded -->
      <div v-else-if="state.mode === 'downloaded'" class="desktop-update__cta-block">
        <div class="desktop-update__status desktop-update__status--ok" v-i18n>Update downloaded.</div>
        <!-- canRestart = Windows (NSIS) or Linux via the restart-loop wrapper → the app
             restarts itself. Otherwise (old wrapper / direct launch) it closes and the player
             reopens it (a detached relaunch can't rejoin the gamescope session). -->
        <p v-if="!canRestart" class="desktop-update__lead" v-i18n>The game will close to finish updating. Open it again from Steam.</p>
        <button v-if="canRestart" class="desktop-update__btn desktop-update__btn--primary" @click="install" v-i18n>Restart and install</button>
        <button v-else class="desktop-update__btn desktop-update__btn--primary" @click="install" v-i18n>Install and close</button>
      </div>

      <!-- installing -->
      <div v-else-if="state.mode === 'installing'" class="desktop-update__cta-block">
        <div class="desktop-update__status" v-i18n>Installing…</div>
        <p v-if="canRestart" class="desktop-update__lead" v-i18n>The game will restart automatically.</p>
        <p v-else class="desktop-update__lead" v-i18n>Update installed — the game will close. Open it again from Steam.</p>
      </div>

      <!-- offline: cannot reach the update server (client is known-outdated) -->
      <div v-else-if="state.mode === 'offlineBlocked'" class="desktop-update__cta-block">
        <div class="desktop-update__status desktop-update__status--err" v-i18n>Cannot reach the update server.</div>
        <div class="desktop-update__lead" v-i18n>Check your connection and try again.</div>
        <button class="desktop-update__btn desktop-update__btn--primary" @click="retry" v-i18n>Try again</button>
        <button v-if="state.downloadUrl" class="desktop-update__btn desktop-update__btn--ghost" @click="download" v-i18n>Download manually</button>
      </div>

      <!-- manual download fallback -->
      <div v-else-if="state.mode === 'manualDownloadRequired'" class="desktop-update__cta-block">
        <div class="desktop-update__status" v-i18n>Automatic update is unavailable. Please download the update manually.</div>
        <button class="desktop-update__btn desktop-update__btn--primary" @click="download" v-i18n>Download manually</button>
        <button class="desktop-update__btn desktop-update__btn--ghost" @click="retry" v-i18n>Try again</button>
      </div>

      <!-- error -->
      <div v-else-if="state.mode === 'error'" class="desktop-update__cta-block">
        <div class="desktop-update__status desktop-update__status--err" v-i18n>Update failed.</div>
        <div v-if="state.error" class="desktop-update__err-detail">{{ state.error }}</div>
        <button class="desktop-update__btn desktop-update__btn--primary" @click="retry" v-i18n>Try again</button>
        <button v-if="state.downloadUrl" class="desktop-update__btn desktop-update__btn--ghost" @click="download" v-i18n>Download manually</button>
      </div>

      <!-- required (pre-download / checking transition) -->
      <div v-else class="desktop-update__status" v-i18n>Preparing the update…</div>

      <!-- P15: console mode — the panel is pad-operable (its own focus
           scope drives the buttons); the glyph row makes that explicit. -->
      <div v-if="consoleEnabled" class="desktop-update__pad-hints" aria-hidden="true">
        <span class="desktop-update__pad-hint"><GamepadGlyph control="dpad" /><span v-i18n>Navigate</span></span>
        <span class="desktop-update__pad-hint"><GamepadGlyph control="confirm" /><span v-i18n>Select</span></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {
  desktopUpdateState,
  desktopBridge,
  isDesktop,
  updateOverlayBlocking,
} from '@/client/components/desktop/desktopUpdateState';
import {consoleModeState} from '@/client/console/consoleModeState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'desktop-update-overlay',
  components: {GamepadGlyph},
  computed: {
    state() {
      return desktopUpdateState;
    },
    /** P15: console posture — show the pad glyph row on the blocking panel. */
    consoleEnabled(): boolean {
      return consoleModeState.enabled && this.blocking;
    },
    isDesktop(): boolean {
      return isDesktop();
    },
    canRestart(): boolean {
      return this.state.restartSupported === true;
    },
    visible(): boolean {
      if (!this.isDesktop) {
        return false;
      }
      return this.state.mode === 'checking' || updateOverlayBlocking(this.state.mode);
    },
    blocking(): boolean {
      return updateOverlayBlocking(this.state.mode);
    },
    notes(): Array<string> {
      return this.state.releaseNotes ?? [];
    },
    percent(): number {
      return Math.min(100, Math.max(0, Math.round(this.state.progress?.percent ?? 0)));
    },
    speed(): string {
      const bps = this.state.progress?.bytesPerSecond;
      if (bps === undefined || bps <= 0) {
        return '';
      }
      const mbps = bps / (1024 * 1024);
      return mbps >= 1 ? `${mbps.toFixed(1)} MB/s` : `${(bps / 1024).toFixed(0)} KB/s`;
    },
  },
  methods: {
    install(): void {
      void desktopBridge()?.quitAndInstall();
    },
    retry(): void {
      void desktopBridge()?.recheck();
    },
    download(): void {
      void desktopBridge()?.openDownload();
    },
  },
});
</script>

<style scoped>
.desktop-update--cover {
  position: fixed;
  inset: 0;
  z-index: 13000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 30%, rgba(10, 20, 30, 0.92), rgba(4, 8, 12, 0.98));
  backdrop-filter: blur(8px);
}
.desktop-update--pill {
  position: fixed;
  top: 14px;
  right: 18px;
  z-index: 13000;
}
.desktop-update__pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 8px;
  background: rgba(10, 20, 28, 0.86);
  border: 1px solid rgba(90, 200, 245, 0.35);
  color: #cfe9f5;
  font-size: 12.5px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.4);
}
.desktop-update__spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(120, 210, 245, 0.3);
  border-top-color: #6fd3f5;
  animation: desktop-update-spin 0.8s linear infinite;
}
.desktop-update__panel {
  width: min(560px, 92vw);
  padding: 40px 44px;
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(16, 28, 38, 0.96), rgba(8, 14, 20, 0.98));
  border: 1px solid rgba(90, 200, 245, 0.28);
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(120, 210, 245, 0.08);
  color: #e6f3fa;
  text-align: center;
}
.desktop-update__glyph {
  font-size: 44px;
  color: #6fd3f5;
  animation: desktop-update-spin 3.2s linear infinite;
  margin-bottom: 8px;
}
.desktop-update__title {
  font-size: 26px;
  margin: 0 0 8px;
  letter-spacing: 0.4px;
}
.desktop-update__lead {
  margin: 0 0 20px;
  color: #a9c6d6;
  font-size: 14.5px;
}
.desktop-update__versions {
  display: flex;
  gap: 20px;
  justify-content: center;
  font-size: 13px;
  color: #9fbccb;
  margin-bottom: 16px;
}
.desktop-update__versions b {
  color: #e6f3fa;
}
.desktop-update__notes {
  text-align: left;
  max-height: 140px;
  overflow: auto;
  margin: 0 0 20px;
  padding: 12px 16px 12px 30px;
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  font-size: 13px;
  color: #bcd6e3;
}
.desktop-update__status {
  font-size: 14px;
  color: #cfe9f5;
  margin-bottom: 14px;
}
.desktop-update__status--ok {
  color: #7fe0a8;
}
.desktop-update__status--err {
  color: #ff9b9b;
}
.desktop-update__err-detail {
  font-size: 12px;
  color: #d99;
  margin-bottom: 14px;
  word-break: break-word;
}
.desktop-update__bar {
  height: 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-bottom: 8px;
}
.desktop-update__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3aa0d8, #6fd3f5);
  transition: width 0.25s ease;
}
.desktop-update__progress-meta {
  font-size: 12.5px;
  color: #9fbccb;
}
.desktop-update__cta-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
.desktop-update__btn {
  min-width: 220px;
  padding: 11px 20px;
  border-radius: 9px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: filter 0.15s ease, transform 0.05s ease;
}
.desktop-update__btn:active {
  transform: translateY(1px);
}
.desktop-update__btn--primary {
  background: linear-gradient(180deg, #63c8ee, #2f9ed0);
  color: #04121a;
}
.desktop-update__btn--primary:hover {
  filter: brightness(1.08);
}
.desktop-update__btn--ghost {
  background: transparent;
  border-color: rgba(120, 210, 245, 0.35);
  color: #bcdcea;
}
.desktop-update__btn--ghost:hover {
  background: rgba(120, 210, 245, 0.1);
}
@keyframes desktop-update-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .desktop-update__spinner,
  .desktop-update__glyph {
    animation: none;
  }
}
</style>
