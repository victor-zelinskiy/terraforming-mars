<template>
  <div class="marsbot-slot" @mouseenter="focusInfo" @focusin="focusInfo">
    <div class="marsbot-slot__head">
      <span class="marsbot-slot__avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <span class="marsbot-slot__name">{{ $t('MarsBot') }}</span>
      <span class="marsbot-slot__chip" v-i18n>Automa opponent</span>
    </div>

    <div class="marsbot-slot__difficulty" role="radiogroup" :aria-label="$t('MarsBot difficulty')">
      <button
        v-for="d in difficulties"
        :key="d.id"
        type="button"
        role="radio"
        class="marsbot-slot__diff"
        :class="['marsbot-slot__diff--' + d.id, {'marsbot-slot__diff--active': d.id === difficulty}]"
        :aria-checked="d.id === difficulty ? 'true' : 'false'"
        @click="select(d.id)"
        @mouseenter="hover(d.id)"
        @focus="hover(d.id)"
      ><span v-i18n>{{ d.labelKey }}</span></button>
    </div>

    <p class="marsbot-slot__desc" v-i18n>{{ activeDesc }}</p>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
import {BOT_DIFFICULTIES, BotDifficultyMeta, botDifficultyMeta} from './createGameMeta';
import {createGameState, setBotDifficulty, setInfoFocus} from './createGameState';

export default defineComponent({
  name: 'MarsBotSlot',
  computed: {
    difficulties(): ReadonlyArray<BotDifficultyMeta> {
      return BOT_DIFFICULTIES;
    },
    difficulty(): DifficultyLevel {
      return createGameState.config.botDifficulty;
    },
    activeDesc(): string {
      return botDifficultyMeta(this.difficulty).descKey;
    },
  },
  methods: {
    focusInfo(): void {
      setInfoFocus({kind: 'bot', difficulty: this.difficulty});
    },
    hover(id: DifficultyLevel): void {
      setInfoFocus({kind: 'bot', difficulty: id});
    },
    select(id: DifficultyLevel): void {
      setBotDifficulty(id);
    },
  },
});
</script>
