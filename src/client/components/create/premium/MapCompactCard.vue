<template>
  <div class="map-compact" @mouseenter="focusInfo" @focusin="focusInfo">
    <div class="map-compact__preview" :style="{'--map-accent': meta.accent}">
      <premium-map-fingerprint :map-id="boardId" :random="meta.random" :accent="meta.accent" variant="card" />
    </div>
    <div class="map-compact__info">
      <span class="map-compact__name" v-i18n>{{ meta.labelKey }}</span>
      <span class="map-compact__desc" v-i18n>{{ meta.descKey }}</span>
      <button type="button" class="map-compact__change" @click="open">
        <span class="map-compact__change-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7 H9 L17 17 H20 M16 14 L20 17 L16 20 M4 17 H9 L11 14.5 M14 9.5 L17 7 H20 M16 4 L20 7 L16 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span v-i18n>Change map</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import {PremiumMapMeta, mapMeta} from './createGameMeta';
import {createGameState, setInfoFocus, openMapPicker} from './createGameState';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';

export default defineComponent({
  name: 'MapCompactCard',
  components: {PremiumMapFingerprint},
  computed: {
    meta(): PremiumMapMeta {
      return createGameState.config.mapMode === 'random-all' ?
        mapMeta('random-all') :
        mapMeta(createGameState.config.mapId);
    },
    boardId(): BoardName | undefined {
      return this.meta.random ? undefined : (this.meta.id as BoardName);
    },
  },
  methods: {
    focusInfo(): void {
      setInfoFocus({kind: 'map', id: this.meta.id});
    },
    open(): void {
      openMapPicker();
    },
  },
});
</script>
