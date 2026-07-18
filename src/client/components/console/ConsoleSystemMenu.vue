<template>
  <div class="con-sysmenu" role="dialog" :aria-label="$t('System')">
    <div class="con-sysmenu__backdrop" aria-hidden="true"></div>

    <!-- Exit confirmation sub-state -->
    <div v-if="confirmExit" class="con-sysmenu__card">
      <div class="con-sysmenu__title">{{ $t('To main menu') }}</div>
      <div class="con-sysmenu__body">{{ $t('Leave the game and return to the main menu?') }}</div>
      <div class="con-sysmenu__note">{{ $t('The game is saved and can be resumed later.') }}</div>
      <div class="con-sysmenu__confirm-actions">
        <span class="con-sysmenu__confirm-action con-sysmenu__confirm-action--yes"><GamepadGlyph control="confirm" /><span>{{ $t('Confirm') }}</span></span>
        <span class="con-sysmenu__confirm-action"><GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span></span>
      </div>
    </div>

    <!-- Diagnostics sub-state: live realtime / poll status (read from the couch,
         no DevTools / URL bar). Values live HERE, never inline in the fixed-shape
         menu list. -->
    <div v-else-if="showDiagnostics" class="con-sysmenu__card">
      <div class="con-sysmenu__title">{{ $t('Diagnostics') }}</div>
      <div class="con-sysmenu__diag">
        <div class="con-sysmenu__diag-row">
          <span class="con-sysmenu__diag-key">{{ $t('Realtime') }}</span>
          <span class="con-sysmenu__diag-val" :class="'con-sysmenu__diag-val--' + diag.statusTone">{{ $t(diag.statusLabel) }}</span>
        </div>
        <div class="con-sysmenu__diag-row">
          <span class="con-sysmenu__diag-key">{{ $t('Poll interval') }}</span>
          <span class="con-sysmenu__diag-val" :class="'con-sysmenu__diag-val--' + diag.pollTone">{{ diag.pollMs }} {{ $t('ms') }}</span>
        </div>
        <div class="con-sysmenu__diag-row">
          <span class="con-sysmenu__diag-key">{{ $t('Updates received') }}</span>
          <span class="con-sysmenu__diag-val">{{ diag.updates }}</span>
        </div>
        <div class="con-sysmenu__diag-row">
          <span class="con-sysmenu__diag-key">{{ $t('Client version') }}</span>
          <span class="con-sysmenu__diag-val con-sysmenu__diag-val--mono">{{ diag.clientVersion }}</span>
        </div>
        <div class="con-sysmenu__diag-row">
          <span class="con-sysmenu__diag-key">{{ $t('Server version') }}</span>
          <span class="con-sysmenu__diag-val con-sysmenu__diag-val--mono"
                :class="{'con-sysmenu__diag-val--bad': diag.versionMismatch}">{{ diag.serverVersion }}</span>
        </div>
        <div v-if="diag.versionMismatch" class="con-sysmenu__diag-note con-sysmenu__diag-note--bad">
          {{ $t('Client and server versions differ') }}
        </div>
      </div>
      <div class="con-sysmenu__foot" aria-hidden="true">
        <span class="con-sysmenu__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Back') }}</span></span>
      </div>
    </div>

    <!-- Menu items -->
    <div v-else class="con-sysmenu__card">
      <div class="con-sysmenu__title">{{ $t('System') }}</div>
      <div class="con-sysmenu__items">
        <div v-for="(item, i) in items"
             :key="item.id"
             class="con-sysmenu__item"
             :class="{'con-sysmenu__item--selected': i === index}">
          <span class="con-sysmenu__item-glyph" aria-hidden="true">{{ item.glyph }}</span>
          <span class="con-sysmenu__item-label">{{ $t(item.label) }}</span>
          <GamepadGlyph v-if="i === index" control="confirm" class="con-sysmenu__item-a" />
        </div>
      </div>
      <div class="con-sysmenu__foot" aria-hidden="true">
        <span class="con-sysmenu__foot-item"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
        <span class="con-sysmenu__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The console SYSTEM overlay menu (lifecycle iteration §4) — opened by the
 * controller Menu button from ANY lifecycle context. Replaces the alien
 * desktop «Главное меню» corner button on the board: system-level actions
 * live behind an explicit console overlay, gameplay commands stay on the
 * command bar. Items: Controls (the mapping legend), Diagnostics (live
 * realtime/poll status, in a SEPARATE sub-panel), Exit to the main menu
 * (with a calm confirmation — the game is server-saved, but a full-screen
 * navigation must never be one accidental press), Return.
 *
 * DELIBERATELY FIXED-SHAPE: every item is a plain label of a constant
 * height, so d-pad navigation never moves the plates under the cursor. The
 * display-profile picker used to live here and BROKE that — its value label
 * relabelled in place and a diagnostics block appeared/vanished with the
 * selection, re-laying the card out mid-navigation. Settings now live in
 * the main menu's OPTIONS screen (ConsoleOptionsPanel), which is built to
 * host variable-height rows. Keep this menu's items value-less — the
 * Diagnostics item shows its live values in a dedicated sub-panel
 * (mutually exclusive with the list, like the exit confirmation), NOT
 * inline, precisely so the list stays fixed-shape.
 *
 * Input is routed by GamepadLayer; this component is presentation over its
 * props.
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import raw_settings from '@/genfiles/settings.json';
import {realtimeState, realtimeHealthy, realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import {desktopBridge} from '@/client/components/desktop/desktopUpdateState';
import {buildVersionLabel} from '@/common/utils/buildVersion';

export type SystemMenuItem = {
  id: 'controls' | 'diagnostics' | 'exit' | 'return',
  /** English i18n key. */
  label: string,
  glyph: string,
};

export const SYSTEM_MENU_ITEMS: ReadonlyArray<SystemMenuItem> = [
  {id: 'controls', label: 'Controls', glyph: '🎮'},
  {id: 'diagnostics', label: 'Diagnostics', glyph: '📡'},
  {id: 'exit', label: 'To main menu', glyph: '⌂'},
  {id: 'return', label: 'Return to game', glyph: '↩'},
];

export default defineComponent({
  name: 'ConsoleSystemMenu',
  components: {GamepadGlyph},
  props: {
    index: {type: Number, required: true},
    confirmExit: {type: Boolean, default: false},
    /** Show the live realtime/poll diagnostics sub-panel instead of the list. */
    showDiagnostics: {type: Boolean, default: false},
    /** 'Return to game' reads oddly outside the game — swap the label. */
    inGame: {type: Boolean, default: true},
  },
  data() {
    return {
      /**
       * Baked Electron app version, fetched once on mount. Mirrors the main
       * menu so the Diagnostics «Client version» row reads the SAME friendly
       * version the menu shows (not the raw git head) on the desktop/TV build.
       */
      desktopVersion: '',
    };
  },
  mounted() {
    const bridge = desktopBridge();
    if (bridge !== undefined) {
      void bridge.getVersion().then((v) => {
        this.desktopVersion = typeof v === 'string' ? v : '';
      }).catch(() => undefined);
    }
  },
  computed: {
    items(): ReadonlyArray<SystemMenuItem> {
      if (this.inGame) {
        return SYSTEM_MENU_ITEMS;
      }
      return SYSTEM_MENU_ITEMS.map((i) => (i.id === 'return' ? {...i, label: 'Close'} : i));
    },
    /**
     * Live realtime/poll snapshot for the diagnostics sub-panel. Reads the
     * reactive `realtimeState` singleton, so it refreshes as the WS state
     * changes while the panel is open. The `Poll interval` row is the key
     * signal: 20000 ms = WS healthy (calm), the safe `waitingForTimeout`
     * (1000 ms) = fallback polling — i.e. the client is hammering the server.
     */
    diag(): {
      statusLabel: string,
      statusTone: 'ok' | 'warn' | 'dim',
      pollMs: number,
      pollTone: 'ok' | 'warn',
      updates: number,
      clientVersion: string,
      serverVersion: string,
      versionMismatch: boolean,
      } {
      const s = realtimeState;
      const healthy = realtimeHealthy();
      let statusLabel: string;
      let statusTone: 'ok' | 'warn' | 'dim';
      if (s.status === 'disabled' || s.status === 'closed') {
        statusLabel = 'Realtime off';
        statusTone = 'dim';
      } else if (healthy) {
        statusLabel = 'Realtime active';
        statusTone = 'ok';
      } else if (s.status === 'error') {
        statusLabel = 'Error';
        statusTone = 'warn';
      } else if (s.status === 'reconnecting') {
        statusLabel = 'Reconnecting';
        statusTone = 'warn';
      } else {
        statusLabel = 'Connecting';
        statusTone = 'warn';
      }
      const clientVersion = this.resolveClientVersion();
      const serverVersion = s.serverBuildVersion ?? '—';
      // Only a REAL mismatch flags red — both sides must be genuinely known
      // (a '—' just means "not reported yet / older server", not a conflict).
      const versionMismatch =
        clientVersion !== '—' && serverVersion !== '—' && clientVersion !== serverVersion;
      return {
        statusLabel,
        statusTone,
        pollMs: realtimePollIntervalMs(raw_settings.waitingForTimeout),
        pollTone: healthy ? 'ok' : 'warn',
        updates: s.invalidationsReceived,
        clientVersion,
        serverVersion,
        versionMismatch,
      };
    },
  },
  methods: {
    /**
     * The same client version the main menu shows (ConsoleMainMenu.version):
     * baked Electron app version → settings.json `version` → git `head`. The
     * settings-derived part goes through the SHARED buildVersionLabel — the
     * exact resolver the server runs — so «Client version» and «Server version»
     * are directly comparable. Falls back to '—' when nothing is available.
     */
    resolveClientVersion(): string {
      if (this.desktopVersion !== '') {
        return this.desktopVersion;
      }
      const label = buildVersionLabel(raw_settings);
      return label !== '' ? label : '—';
    },
  },
});
</script>
