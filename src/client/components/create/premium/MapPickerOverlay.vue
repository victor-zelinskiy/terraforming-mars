<template>
  <teleport to="body">
    <div class="map-picker" role="dialog" aria-modal="true" :aria-label="$t('Map selection')">
      <div class="map-picker__backdrop" @click="cancel"></div>
      <div class="map-picker__panel">
        <span class="map-picker__corner map-picker__corner--tl" aria-hidden="true"></span>
        <span class="map-picker__corner map-picker__corner--tr" aria-hidden="true"></span>
        <span class="map-picker__corner map-picker__corner--bl" aria-hidden="true"></span>
        <span class="map-picker__corner map-picker__corner--br" aria-hidden="true"></span>

        <header class="map-picker__head">
          <div class="map-picker__titles">
            <h2 class="map-picker__title" v-i18n>Map selection</h2>
            <p class="map-picker__subtitle" v-i18n>Choose a map or keep the random pick.</p>
          </div>
          <button type="button" class="map-picker__close" :aria-label="$t('Close')" @click="cancel">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </header>

        <div class="map-picker__body">
          <div class="map-picker__grid" role="radiogroup" :aria-label="$t('Map')">
            <button
              v-for="(m, i) in maps"
              :key="m.id"
              type="button"
              role="radio"
              class="map-picker__card"
              :class="{'map-picker__card--on': isSelected(m)}"
              :aria-checked="isSelected(m) ? 'true' : 'false'"
              :tabindex="tabindexFor(m, i)"
              :ref="(el) => setRef(el, i)"
              :style="{'--map-accent': m.accent}"
              @click="select(m)"
              @keydown="onKey($event, i)"
              @mouseenter="hover(m)"
              @focus="hover(m)"
            >
              <span class="map-picker__card-thumb">
                <premium-map-fingerprint :map-id="boardId(m)" :random="m.random" :accent="m.accent" variant="card" />
              </span>
              <span class="map-picker__card-name" v-i18n>{{ m.labelKey }}</span>
              <span class="map-picker__card-check" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5 L10 17.5 L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </button>
          </div>

          <aside class="map-picker__detail" :style="{'--map-accent': detail.accent}">
            <div class="map-picker__detail-preview">
              <premium-map-fingerprint :map-id="detailBoardId" :random="detail.random" :accent="detail.accent" variant="hero" />
            </div>
            <transition name="map-picker-detail" mode="out-in">
              <div :key="detail.id" class="map-picker__detail-text">
                <h3 class="map-picker__detail-name" v-i18n>{{ detail.labelKey }}</h3>
                <p class="map-picker__detail-desc" v-i18n>{{ detail.descKey }}</p>
              </div>
            </transition>
          </aside>
        </div>

        <footer class="map-picker__foot">
          <button type="button" class="map-picker__confirm" @click="confirm"><span v-i18n>Select</span></button>
          <button type="button" class="map-picker__ghost" @click="cancel"><span v-i18n>Cancel</span></button>
        </footer>
      </div>
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import {PREMIUM_MAPS, PremiumMapMeta, mapMeta} from './createGameMeta';
import {createGameState, setInfoFocus, closeMapPicker} from './createGameState';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';

const COLS = 4;

export default defineComponent({
  name: 'MapPickerOverlay',
  components: {PremiumMapFingerprint},
  data() {
    return {
      els: [] as Array<HTMLButtonElement>,
      hoveredId: undefined as BoardName | 'random-all' | undefined,
    };
  },
  computed: {
    maps(): ReadonlyArray<PremiumMapMeta> {
      return PREMIUM_MAPS;
    },
    selectedId(): BoardName | 'random-all' {
      return createGameState.config.mapMode === 'random-all' ? 'random-all' : createGameState.config.mapId;
    },
    // The detail panel previews the hovered map, falling back to the selection.
    detail(): PremiumMapMeta {
      return mapMeta(this.hoveredId ?? this.selectedId);
    },
    detailBoardId(): BoardName | undefined {
      return this.detail.random ? undefined : (this.detail.id as BoardName);
    },
  },
  mounted() {
    window.addEventListener('keydown', this.onWindowKey);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onWindowKey);
  },
  methods: {
    boardId(m: PremiumMapMeta): BoardName | undefined {
      return m.random ? undefined : (m.id as BoardName);
    },
    isSelected(m: PremiumMapMeta): boolean {
      return m.id === this.selectedId;
    },
    select(m: PremiumMapMeta): void {
      const c = createGameState.config;
      if (m.random) {
        c.mapMode = 'random-all';
      } else {
        c.mapMode = 'specific';
        c.mapId = m.id as BoardName;
      }
      this.hoveredId = m.id;
      setInfoFocus({kind: 'map', id: m.id});
    },
    hover(m: PremiumMapMeta): void {
      this.hoveredId = m.id;
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
    onWindowKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        this.cancel();
      }
    },
    confirm(): void {
      closeMapPicker(true);
    },
    cancel(): void {
      closeMapPicker(false);
    },
  },
});
</script>
