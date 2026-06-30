<template>
  <div class="exp-grid" role="group" :aria-label="$t('Expansions')">
    <button
      v-for="e in expansions"
      :key="e.id"
      type="button"
      class="exp-card"
      :class="{'exp-card--on': isOn(e.id)}"
      :aria-pressed="isOn(e.id) ? 'true' : 'false'"
      @click="toggle(e.id)"
      @mouseenter="focusInfo(e.id)"
      @focus="focusInfo(e.id)"
    >
      <span class="exp-card__icon" aria-hidden="true">
        <img class="exp-card__icon-img" :src="icon(e.id)" :alt="name(e.id)" />
      </span>
      <span class="exp-card__name" v-i18n>{{ name(e.id) }}</span>
      <span class="exp-card__check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5 L10 17.5 L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Expansion} from '@/common/cards/GameModule';
import {PREMIUM_EXPANSIONS, PremiumExpansionMeta, expansionIcon, expansionName} from './createGameMeta';
import {createGameState, setInfoFocus} from './createGameState';

export default defineComponent({
  name: 'ExpansionModuleGrid',
  computed: {
    expansions(): ReadonlyArray<PremiumExpansionMeta> {
      return PREMIUM_EXPANSIONS;
    },
  },
  methods: {
    isOn(id: Expansion): boolean {
      return createGameState.config.selectedExpansions[id] === true;
    },
    toggle(id: Expansion): void {
      createGameState.config.selectedExpansions[id] = !this.isOn(id);
      setInfoFocus({kind: 'expansion', id});
    },
    focusInfo(id: Expansion): void {
      setInfoFocus({kind: 'expansion', id});
    },
    icon(id: Expansion): string {
      return expansionIcon(id);
    },
    name(id: Expansion): string {
      return expansionName(id);
    },
  },
});
</script>
