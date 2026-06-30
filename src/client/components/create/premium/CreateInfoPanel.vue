<template>
  <aside class="info-panel" :style="accentStyle">
    <div class="info-panel__head">
      <span class="info-panel__icon" aria-hidden="true">
        <img v-if="info.kind === 'expansion'" class="info-panel__icon-img" :src="expansionIconSrc" :alt="title" />
        <span v-else-if="info.kind === 'map'" class="info-panel__map map-preview" :class="{'map-preview--random': mapIsRandom}">
          <span class="map-preview__planet"></span>
          <span class="map-preview__grid"></span>
        </span>
        <svg v-else viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>
      </span>
      <span class="info-panel__kicker" v-i18n>Briefing</span>
    </div>

    <transition name="info-fade" mode="out-in">
      <div :key="transitionKey" class="info-panel__content">
        <h3 class="info-panel__title" :class="{capitalized: titleCapitalized}" v-i18n>{{ title }}</h3>
        <p class="info-panel__desc" v-i18n>{{ desc }}</p>
        <div v-if="chips.length > 0" class="info-panel__chips">
          <span v-for="c in chips" :key="c" class="info-panel__chip" v-i18n>{{ c }}</span>
        </div>
      </div>
    </transition>
  </aside>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {createGameState, InfoFocus} from './createGameState';
import {PREMIUM_EXPANSIONS, expansionIcon, expansionName, mapMeta, mapNameSource} from './createGameMeta';

export default defineComponent({
  name: 'CreateInfoPanel',
  computed: {
    info(): InfoFocus {
      return createGameState.info;
    },
    transitionKey(): string {
      const i = this.info;
      return i.kind + ('id' in i ? ':' + String(i.id) : '');
    },
    title(): string {
      const i = this.info;
      switch (i.kind) {
      case 'expansion': return expansionName(i.id);
      case 'map': return mapNameSource(i.id);
      case 'rule': return i.id === 'draft' ? 'Draft Variant' : 'Random Milestones/Awards';
      case 'trBoost': return 'TR Boost';
      case 'players': return 'Number of players';
      default: return 'Mission setup';
      }
    },
    titleCapitalized(): boolean {
      return this.info.kind === 'map' && this.info.id !== 'random-all';
    },
    desc(): string {
      const i = this.info;
      switch (i.kind) {
      case 'expansion': return PREMIUM_EXPANSIONS.find((e) => e.id === i.id)?.descKey ?? '';
      case 'map': return mapMeta(i.id).descKey;
      case 'rule': return i.id === 'draft' ? 'Players pick cards through a draft.' : 'Milestones and awards are chosen at random.';
      case 'trBoost': return 'Extra starting Terraform Rating for you, from 0 to 10.';
      case 'players': return 'Choose how many players join the mission, from 2 to 6.';
      default: return 'Hover or focus any option to see what it does, then launch your mission.';
      }
    },
    chips(): ReadonlyArray<string> {
      const i = this.info;
      if (i.kind === 'expansion') {
        return [createGameState.config.selectedExpansions[i.id] === true ? 'Enabled' : 'Disabled'];
      }
      if (i.kind === 'map') {
        return [i.id === 'random-all' ? 'Random All' : 'Map'];
      }
      return [];
    },
    expansionIconSrc(): string {
      return this.info.kind === 'expansion' ? expansionIcon(this.info.id) : '';
    },
    mapIsRandom(): boolean {
      return this.info.kind === 'map' && this.info.id === 'random-all';
    },
    accentStyle(): Record<string, string> {
      if (this.info.kind === 'map') {
        return {'--info-accent': mapMeta(this.info.id).accent};
      }
      return {'--info-accent': '240, 168, 80'};
    },
  },
});
</script>
