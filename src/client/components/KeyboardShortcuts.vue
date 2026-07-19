<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <PopupPanel @close="$emit('close')">
    <template v-slot:header>
      <h2>Keyboard Shortcuts</h2>
    </template>
    A - Main Board<br/>
    S - Players Overview Table<br/>
    D - Cards in Hand<br/>
    F - Colonies<br/>
    <template v-if="preferences().experimental_ui">
      <br/>
      1-9 - Scroll through the player board.
    </template>
    <br/>
    ? - Show this help<br/>
    ESC - close this help<br/>
    <br/>More coming.
  </PopupPanel>
</template>
<script lang="ts">
import {defineComponent} from 'vue';
import PopupPanel from './common/PopupPanel.vue';
import {getPreferences} from '../utils/PreferencesManager';

export default defineComponent({
  name: 'KeyboardShortcuts',
  components: {
    PopupPanel,
  },
  computed: {
    preferences(): typeof getPreferences {
      return getPreferences;
    },
  },
});
</script>
