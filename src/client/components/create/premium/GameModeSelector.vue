<template>
  <div class="pc-mode" role="radiogroup" :aria-label="$t('Game mode')" @mouseenter="focusInfo" @focusin="focusInfo">
    <button
      type="button"
      role="radio"
      class="pc-mode__chip"
      :class="{'pc-mode__chip--active': mode === 'multiplayer'}"
      :aria-checked="mode === 'multiplayer' ? 'true' : 'false'"
      @click="select('multiplayer')"
    >
      <span class="pc-mode__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="3.2" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19 C3.5 15.2 6 13 9 13 C12 13 14.5 15.2 14.5 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="17" cy="10" r="2.5" stroke="currentColor" stroke-width="1.4"/><path d="M15.5 15 C19 14.6 21 17 21 19" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </span>
      <span class="pc-mode__text">
        <span class="pc-mode__title" v-i18n>Multiplayer</span>
        <span class="pc-mode__help" v-i18n>Play with other people at the table</span>
      </span>
    </button>
    <button
      type="button"
      role="radio"
      class="pc-mode__chip pc-mode__chip--bot"
      :class="{'pc-mode__chip--active': mode === 'marsbot'}"
      :aria-checked="mode === 'marsbot' ? 'true' : 'false'"
      @click="select('marsbot')"
    >
      <span class="pc-mode__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <span class="pc-mode__text">
        <span class="pc-mode__title" v-i18n>Solo vs MarsBot</span>
        <span class="pc-mode__help" v-i18n>The official Automa opponent runs itself</span>
      </span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {GameMode, createGameState, setGameMode, setInfoFocus} from './createGameState';

export default defineComponent({
  name: 'GameModeSelector',
  computed: {
    mode(): GameMode {
      return createGameState.config.gameMode;
    },
  },
  methods: {
    focusInfo(): void {
      setInfoFocus({kind: 'mode'});
    },
    select(mode: GameMode): void {
      setGameMode(mode);
      setInfoFocus(mode === 'marsbot' ? {kind: 'bot', difficulty: createGameState.config.botDifficulty} : {kind: 'mode'});
    },
  },
});
</script>
