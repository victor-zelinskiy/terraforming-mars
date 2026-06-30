<template>
  <div class="map-select">
    <div class="map-select__hero">
      <div class="map-hero" :style="{'--map-accent': heroMeta.accent}">
        <premium-map-fingerprint
          :map-id="heroBoardId"
          :random="heroMeta.random"
          :accent="heroMeta.accent"
          variant="hero" />
        <div class="map-hero__caption">
          <span class="map-hero__name" v-i18n>{{ heroMeta.labelKey }}</span>
          <span class="map-hero__desc" v-i18n>{{ heroMeta.descKey }}</span>
        </div>
      </div>
    </div>

    <div class="map-select__cards" role="radiogroup" :aria-label="$t('Map')">
      <button
        v-for="(m, i) in maps"
        :key="m.id"
        type="button"
        role="radio"
        class="map-card"
        :class="{'map-card--on': isSelected(m)}"
        :aria-checked="isSelected(m) ? 'true' : 'false'"
        :tabindex="tabindexFor(m, i)"
        :ref="(el) => setRef(el, i)"
        :style="{'--map-accent': m.accent}"
        @click="select(m)"
        @keydown="onKey($event, i)"
        @mouseenter="focusInfo(m)"
        @focus="focusInfo(m)"
      >
        <span class="map-card__thumb">
          <premium-map-fingerprint :map-id="boardId(m)" :random="m.random" :accent="m.accent" variant="thumb" />
        </span>
        <span class="map-card__name" v-i18n>{{ m.labelKey }}</span>
        <span class="map-card__check" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5 L10 17.5 L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import {PREMIUM_MAPS, PremiumMapMeta, mapMeta} from './createGameMeta';
import {createGameState, setInfoFocus} from './createGameState';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';

const COLS = 5;

export default defineComponent({
  name: 'MapSelection',
  components: {PremiumMapFingerprint},
  data() {
    return {els: [] as Array<HTMLButtonElement>};
  },
  computed: {
    maps(): ReadonlyArray<PremiumMapMeta> {
      return PREMIUM_MAPS;
    },
    heroMeta(): PremiumMapMeta {
      return createGameState.config.mapMode === 'random-all' ?
        mapMeta('random-all') :
        mapMeta(createGameState.config.mapId);
    },
    heroBoardId(): BoardName | undefined {
      return this.heroMeta.random ? undefined : (this.heroMeta.id as BoardName);
    },
  },
  methods: {
    boardId(m: PremiumMapMeta): BoardName | undefined {
      return m.random ? undefined : (m.id as BoardName);
    },
    isSelected(m: PremiumMapMeta): boolean {
      const c = createGameState.config;
      return m.random ? c.mapMode === 'random-all' : (c.mapMode === 'specific' && c.mapId === m.id);
    },
    select(m: PremiumMapMeta): void {
      const c = createGameState.config;
      if (m.random) {
        c.mapMode = 'random-all';
      } else {
        c.mapMode = 'specific';
        c.mapId = m.id as BoardName;
      }
      setInfoFocus({kind: 'map', id: m.id});
    },
    focusInfo(m: PremiumMapMeta): void {
      setInfoFocus({kind: 'map', id: m.id});
    },
    setRef(el: unknown, i: number): void {
      if (el instanceof HTMLButtonElement) {
        this.els[i] = el;
      }
    },
    tabindexFor(m: PremiumMapMeta, i: number): number {
      if (this.isSelected(m)) {
        return 0;
      }
      const anySelected = this.maps.some((x) => this.isSelected(x));
      return (!anySelected && i === 0) ? 0 : -1;
    },
    onKey(e: KeyboardEvent, i: number): void {
      const last = this.maps.length - 1;
      let next = i;
      switch (e.key) {
      case 'ArrowRight': next = Math.min(i + 1, last); break;
      case 'ArrowLeft': next = Math.max(i - 1, 0); break;
      case 'ArrowDown': next = Math.min(i + COLS, last); break;
      case 'ArrowUp': next = Math.max(i - COLS, 0); break;
      case 'Home': next = 0; break;
      case 'End': next = last; break;
      default: return;
      }
      e.preventDefault();
      this.select(this.maps[next]);
      this.$nextTick(() => this.els[next]?.focus());
    },
  },
});
</script>
