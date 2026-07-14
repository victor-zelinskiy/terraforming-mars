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

    <!-- Menu items -->
    <div v-else class="con-sysmenu__card">
      <div class="con-sysmenu__title">{{ $t('System') }}</div>
      <div class="con-sysmenu__items">
        <div v-for="(item, i) in items"
             :key="item.id"
             class="con-sysmenu__item"
             :class="{'con-sysmenu__item--selected': i === index}">
          <span class="con-sysmenu__item-glyph" aria-hidden="true">{{ item.glyph }}</span>
          <span class="con-sysmenu__item-label">
            {{ $t(item.label) }}<template v-if="item.id === 'display'">: {{ displayValueLabel }}</template>
          </span>
          <GamepadGlyph v-if="i === index" control="confirm" class="con-sysmenu__item-a" />
        </div>
      </div>
      <!-- Display diagnostics — shown while the display item is selected so
           the pick is informed (profile / viewport / physical / scale / why). -->
      <div v-if="displaySelected" class="con-sysmenu__diag" aria-live="polite">
        <div class="con-sysmenu__diag-row"><span>{{ $t('Profile') }}</span><b>{{ diag.profile }}{{ diag.forced ? ' · ' + $t('manual') : ' · ' + $t('auto') }}</b></div>
        <div class="con-sysmenu__diag-row"><span>Viewport</span><b>{{ diag.viewport }}</b></div>
        <div class="con-sysmenu__diag-row"><span>{{ $t('Panel') }}</span><b>{{ diag.physical }} · DPR {{ diag.devicePixelRatio }}</b></div>
        <div class="con-sysmenu__diag-row"><span>UI scale</span><b>×{{ diag.uiScale }}</b></div>
        <div class="con-sysmenu__diag-row con-sysmenu__diag-row--why"><span>{{ diag.reason }}</span></div>
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
 * command bar. Items: Controls (the mapping legend), Display (the layout
 * profile picker — Auto / Handheld / Standard / Large / TV 4K, persisted
 * like every user setting to localStorage `tm_console_profile`, the same
 * store `?consoleProfile=` uses; A cycles the value in place and the diag
 * block below shows what the choice resolves to), Exit to the main menu
 * (with a calm confirmation — the game is server-saved, but a full-screen
 * navigation must never be one accidental press), Return. Input is routed
 * by GamepadLayer; this component is presentation over its props + the
 * reactive consoleLayoutState.
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {consoleLayoutState, consoleDisplayDiagnostics, currentProfileOverride} from '@/client/console/consoleLayoutProfile';
import {translateText} from '@/client/directives/i18n';

export type SystemMenuItem = {
  id: 'controls' | 'display' | 'exit' | 'return',
  /** English i18n key. */
  label: string,
  glyph: string,
};

export const SYSTEM_MENU_ITEMS: ReadonlyArray<SystemMenuItem> = [
  {id: 'controls', label: 'Controls', glyph: '🎮'},
  {id: 'display', label: 'Display', glyph: '🖥'},
  {id: 'exit', label: 'To main menu', glyph: '⌂'},
  {id: 'return', label: 'Return to game', glyph: '↩'},
];

/** English i18n keys for the picker values (translated at render). */
export const PROFILE_LABELS: Readonly<Record<string, string>> = {
  auto: 'Auto',
  handheld: 'Handheld',
  standard: 'Standard',
  large: 'Large',
  tv: 'TV 4K',
};

export default defineComponent({
  name: 'ConsoleSystemMenu',
  components: {GamepadGlyph},
  props: {
    index: {type: Number, required: true},
    confirmExit: {type: Boolean, default: false},
    /** 'Return to game' reads oddly outside the game — swap the label. */
    inGame: {type: Boolean, default: true},
  },
  data() {
    return {consoleLayoutState};
  },
  computed: {
    items(): ReadonlyArray<SystemMenuItem> {
      if (this.inGame) {
        return SYSTEM_MENU_ITEMS;
      }
      return SYSTEM_MENU_ITEMS.map((i) => (i.id === 'return' ? {...i, label: 'Close'} : i));
    },
    displaySelected(): boolean {
      return this.items[this.index]?.id === 'display';
    },
    displayValueLabel(): string {
      const override = currentProfileOverride();
      const value = translateText(PROFILE_LABELS[override] ?? override);
      // Auto shows what it currently resolves to, so the pick is informed.
      return override === 'auto' ?
        `${value} (${translateText(PROFILE_LABELS[this.consoleLayoutState.profile] ?? this.consoleLayoutState.profile)})` :
        value;
    },
    diag() {
      // Recomputed on every re-render the state provokes (profile/scale are
      // reactive; viewport values are read fresh each time).
      return consoleDisplayDiagnostics();
    },
  },
});
</script>
