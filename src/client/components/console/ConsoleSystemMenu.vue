<template>
  <div class="con-sys con-sys--menu" role="dialog" :aria-label="$t('System')">
    <div class="con-sys__backdrop" aria-hidden="true"></div>

    <div class="con-sys__card">
      <!-- The SAME crumb grammar the settings console uses: stable root, and a
           tail that only ever gets ADDED (the exit confirmation is a stage of
           this surface, not a second dialog that arrived over it). -->
      <div class="con-sys__head">
        <span class="con-sys__emblem" aria-hidden="true">⌸</span>
        <span class="con-sys__crumb">
          <span class="con-sys__crumb-root">{{ $t('System') }}</span>
          <span class="con-sys__crumb-slot">
            <transition name="con-sys-stage">
              <span v-if="confirmExit" key="exit" class="con-sys__crumb-tail">
                <span class="con-sys__crumb-sep" aria-hidden="true">›</span>
                <span class="con-sys__crumb-stage con-sys__crumb-stage--commit">{{ $t('Exit') }}</span>
              </span>
            </transition>
          </span>
        </span>
        <span v-if="version !== ''" class="con-sys__tag">{{ $t('version') }} <b>{{ version }}</b></span>
      </div>

      <div class="con-sys__body">
        <!-- Leaving the game: a calm confirmation IN PLACE. The game is
             server-saved, but a full-screen navigation must never be one
             accidental press. -->
        <div v-if="confirmExit" class="con-sysconfirm">
          <div class="con-sysconfirm__body">{{ $t('Leave the game and return to the main menu?') }}</div>
          <div class="con-sysconfirm__note">{{ $t('The game is saved and can be resumed later.') }}</div>
        </div>

        <div v-else class="con-sysact">
          <button
            v-for="(item, i) in items"
            :key="item.id"
            type="button"
            class="con-sysact__plate"
            :class="{'con-sysact__plate--cursor': i === index, 'con-sysact__plate--exit': item.id === 'exit'}"
            @click="$emit('activate', i)"
            @mousemove="$emit('cursor', i)"
          >
            <span class="con-sysact__glyph" aria-hidden="true">{{ item.glyph }}</span>
            <span class="con-sysact__text">
              <span class="con-sysact__label">{{ $t(item.label) }}</span>
              <span class="con-sysact__sub">{{ $t(item.sub) }}</span>
            </span>
            <GamepadGlyph control="confirm" class="con-sysact__go" />
          </button>
        </div>
      </div>

      <div class="con-sys__foot">
        <template v-if="confirmExit">
          <span class="con-sys__hint con-sys__hint--danger"><GamepadGlyph control="confirm" />{{ $t('Confirm') }}</span>
          <span class="con-sys__hint"><GamepadGlyph control="back" />{{ $t('Cancel') }}</span>
        </template>
        <template v-else>
          <span class="con-sys__hint"><GamepadGlyph control="dpad" />{{ $t('Navigate') }}</span>
          <span class="con-sys__hint"><GamepadGlyph control="confirm" />{{ $t('Select') }}</span>
          <span class="con-sys__hint"><GamepadGlyph control="back" />{{ $t('Close') }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The console SYSTEM overlay — opened by the controller Menu button from the
 * game. Replaces the alien desktop «Главное меню» corner button: system-level
 * actions live behind an explicit console overlay, gameplay commands stay on
 * the command bar.
 *
 * ITERATION 2 — ONE PREMIUM FAMILY. The menu and the settings console used to
 * be visibly different products (its own `.con-sysmenu` glass, its own title
 * style, its own hand-built diagnostics panel). Both now stand on the SHARED
 * `.con-sys` chassis (console_settings.less): same card, same crumb head, same
 * foot bar, same focus language. Two consequences worth stating:
 *
 *  · Items are PLATES with a subtitle now — the labels still never relabel in
 *    place, so this stays a fixed-shape list (the property that keeps d-pad
 *    navigation from moving the plates under the cursor, and the reason no
 *    SETTING may ever live here — CLAUDE.md).
 *  · «Диагностика» no longer renders a second panel here: it opens the
 *    settings console straight onto its (minor) ДИАГНОСТИКА category, where
 *    the connection readout and the display readout now sit together. ONE home
 *    for the readout, one implementation, one look.
 *
 * The exit confirmation is a STAGE of this surface: the frame does not move,
 * the crumb gains an amber `› ВЫХОД` tail, the foot swaps its verbs.
 *
 * Input is routed by GamepadLayer; this component is presentation over its
 * props (mouse clicks emit the same intents the pad produces).
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import raw_settings from '@/genfiles/settings.json';
import {desktopBridge} from '@/client/components/desktop/desktopUpdateState';

export type SystemMenuItem = {
  id: 'settings' | 'controls' | 'diagnostics' | 'exit' | 'return',
  /** English i18n key. */
  label: string,
  /** English i18n key — what the plate leads to. Static: never a value. */
  sub: string,
  glyph: string,
};

/**
 * Fixed shape (see the class comment): every plate is a constant-height pair
 * of STATIC labels, so d-pad navigation never moves the plates. «Настройки»
 * and «Диагностика» both open the settings console (the latter on its
 * diagnostics category) — neither relabels anything here.
 */
export const SYSTEM_MENU_ITEMS: ReadonlyArray<SystemMenuItem> = [
  {id: 'settings', label: 'Settings', sub: 'Interface, controls, graphics', glyph: '⚙'},
  {id: 'controls', label: 'Controls', sub: 'Gamepad button map', glyph: '◎'},
  {id: 'diagnostics', label: 'Diagnostics', sub: 'Connection, versions, display', glyph: '⊙'},
  {id: 'exit', label: 'To main menu', sub: 'The game will be saved', glyph: '⌂'},
  {id: 'return', label: 'Return to game', sub: 'Close this menu', glyph: '↩'},
];

export default defineComponent({
  name: 'ConsoleSystemMenu',
  components: {GamepadGlyph},
  props: {
    index: {type: Number, required: true},
    confirmExit: {type: Boolean, default: false},
    /** 'Return to game' reads oddly outside the game — swap the label. */
    inGame: {type: Boolean, default: true},
  },
  emits: {
    /** A mouse click on a plate — the host runs the same branch A would. */
    activate: (_index: number) => true,
    /** Hover moves the host's cursor, exactly as on every console surface. */
    cursor: (_index: number) => true,
  },
  data() {
    return {
      /**
       * Baked Electron app version, fetched once on mount. The head tag mirrors
       * the main menu's footer so «what am I running» is answerable without
       * opening the diagnostics readout.
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
      return SYSTEM_MENU_ITEMS.map((i) => (i.id === 'return' ? {...i, label: 'Close', sub: 'Close this menu'} : i));
    },
    /** Desktop shell app version → settings.json `version` → git head. */
    version(): string {
      if (this.desktopVersion !== '') {
        return this.desktopVersion;
      }
      const settingsVersion = (raw_settings as {version?: string}).version;
      return settingsVersion !== undefined && settingsVersion !== '' ? settingsVersion : (raw_settings.head ?? '');
    },
  },
});
</script>
