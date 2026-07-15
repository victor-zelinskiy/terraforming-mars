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
 * command bar. Items: Controls (the mapping legend), Exit to the main menu
 * (with a calm confirmation — the game is server-saved, but a full-screen
 * navigation must never be one accidental press), Return.
 *
 * DELIBERATELY FIXED-SHAPE: every item is a plain label of a constant
 * height, so d-pad navigation never moves the plates under the cursor. The
 * display-profile picker used to live here and BROKE that — its value label
 * relabelled in place and a diagnostics block appeared/vanished with the
 * selection, re-laying the card out mid-navigation. Settings now live in
 * the main menu's OPTIONS screen (ConsoleOptionsPanel), which is built to
 * host variable-height rows. Keep this menu's items value-less.
 *
 * Input is routed by GamepadLayer; this component is presentation over its
 * props.
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export type SystemMenuItem = {
  id: 'controls' | 'exit' | 'return',
  /** English i18n key. */
  label: string,
  glyph: string,
};

export const SYSTEM_MENU_ITEMS: ReadonlyArray<SystemMenuItem> = [
  {id: 'controls', label: 'Controls', glyph: '🎮'},
  {id: 'exit', label: 'To main menu', glyph: '⌂'},
  {id: 'return', label: 'Return to game', glyph: '↩'},
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
  computed: {
    items(): ReadonlyArray<SystemMenuItem> {
      if (this.inGame) {
        return SYSTEM_MENU_ITEMS;
      }
      return SYSTEM_MENU_ITEMS.map((i) => (i.id === 'return' ? {...i, label: 'Close'} : i));
    },
  },
});
</script>
