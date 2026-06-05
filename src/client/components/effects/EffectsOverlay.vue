<template>
  <!--
    Premium "Эффекты" overlay — a player's ongoing/passive rules as a grid of
    effect blocks. Effects are OPEN information, so the header lets you switch the
    viewed player. The grid is ADAPTIVE: a small JS fit engine picks the column
    count + the overlay width from the effect COUNT + viewport, so few effects sit
    large in 1 column and many spread across 2/3+ columns up to nearly the whole
    centre zone — vertical scroll only as a last resort. Hover a block → the
    SOURCE card floats in (single shared popover); click → fullscreen.
  -->
  <div class="effects-board-overlay" ref="root" data-test="effects-overlay">
    <div class="effects-board__corner effects-board__corner--tl" aria-hidden="true"></div>
    <div class="effects-board__corner effects-board__corner--tr" aria-hidden="true"></div>
    <div class="effects-board__corner effects-board__corner--bl" aria-hidden="true"></div>
    <div class="effects-board__corner effects-board__corner--br" aria-hidden="true"></div>

    <header class="effects-board__header" ref="header">
      <div class="effects-board__title-row">
        <span class="effects-board__glyph" aria-hidden="true"></span>
        <h2 class="effects-board__title" v-i18n>Effects</h2>
        <span class="effects-board__count">{{ effects.length }}</span>
        <button class="effects-board__close" @click="$emit('close')" :title="$t('Close')" data-test="effects-overlay-close">✕</button>
      </div>
      <!-- Player switcher — effects are public, so any seat can be inspected. -->
      <div v-if="players.length > 1" class="effects-board__players">
        <button v-for="p in players"
                :key="p.color"
                type="button"
                class="effects-board__player"
                :class="{'effects-board__player--active': p.color === displayedPlayer.color}"
                @click="$emit('selectPlayer', p.color)"
                :data-test="'effects-player-' + p.color">
          <span class="effects-board__player-dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
          <span class="effects-board__player-name">{{ p.name }}</span>
          <span v-if="p.color === viewerColor" class="effects-board__player-you" v-i18n>You</span>
        </button>
      </div>
    </header>

    <div class="effects-board__body" ref="body">
      <div v-if="effects.length === 0" class="effects-board__empty">
        <span class="effects-board__empty-glyph" aria-hidden="true">∅</span>
        <span class="effects-board__empty-text" v-i18n>No active effects</span>
      </div>
      <div v-else class="effects-board__grid" ref="grid">
        <EffectBlock v-for="entry in effects"
                     :key="entry.key"
                     :entry="entry"
                     @namehover="onNameHover"
                     @open="openFullscreen" />
      </div>
    </div>

    <!-- Shared source-card hover popover. -->
    <CardPreviewPopover :name="hoverName" :visible="hoverVisible" :anchor="hoverAnchor" />

    <!-- Shared fullscreen source-card viewer. -->
    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoomModal"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick, markRaw} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {playerEffects, EffectEntry} from '@/client/components/effects/effectExtraction';
import EffectBlock from '@/client/components/effects/EffectBlock.vue';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

const BLOCK_W = 326;          // target block width (px)
const GAP = 16;               // grid gap (px)
const SIDE_MARGIN = 120;      // viewport breathing room (left + right)
const FIT_MAX_W = 1680;       // hard cap so the panel never spans edge-to-edge
const BODY_PAD_X = 36;        // .effects-board__body horizontal padding
const VIEWPORT_H_RATIO = 0.86;
const EST_ROW_H = 168;        // avg block height for the initial column estimate
const HOVER_DELAY = 260;      // ms before the source-card popover appears

type DataModel = {
  hoverName: CardName;
  hoverVisible: boolean;
  hoverAnchor: DOMRect | undefined;
  hoverTimer: number | undefined;
  zoomCard: CardModel | undefined;
  resizeObserver: ResizeObserver | undefined;
  fitScheduled: boolean;
};

export default defineComponent({
  name: 'EffectsOverlay',
  components: {EffectBlock, CardPreviewPopover, CardZoomModal},
  props: {
    displayedPlayer: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    players: {
      type: Array as PropType<ReadonlyArray<PublicPlayerModel>>,
      default: () => [],
    },
    viewerColor: {
      type: String as PropType<Color>,
      required: true,
    },
  },
  emits: ['close', 'selectPlayer'],
  data(): DataModel {
    return {
      hoverName: '' as CardName,
      hoverVisible: false,
      hoverAnchor: undefined,
      hoverTimer: undefined,
      zoomCard: undefined,
      resizeObserver: undefined,
      fitScheduled: false,
    };
  },
  computed: {
    effects(): ReadonlyArray<EffectEntry> {
      return playerEffects(this.displayedPlayer.tableau);
    },
  },
  watch: {
    // Re-fit when the viewed player (and thus the effect count) changes.
    'displayedPlayer.color'(): void {
      this.clearHover();
      nextTick(() => this.fit());
    },
  },
  mounted(): void {
    nextTick(() => this.fit());
    window.setTimeout(() => this.fit(), 220); // re-fit after icon/font settle
    const root = this.$refs.root as HTMLElement | undefined;
    if (root !== undefined && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.scheduleFit());
      ro.observe(root);
      this.resizeObserver = markRaw(ro);
    }
    window.addEventListener('resize', this.scheduleFit);
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    this.clearHover();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.scheduleFit);
    window.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (this.zoomCard !== undefined) {
          this.zoomCard = undefined;
        } else {
          this.$emit('close');
        }
      }
    },
    // ─── Adaptive fit ───────────────────────────────────────────────────
    applyLayout(cols: number, width: number): void {
      const root = this.$refs.root as HTMLElement | undefined;
      const grid = this.$refs.grid as HTMLElement | undefined;
      root?.style.setProperty('--effects-overlay-width', Math.round(width) + 'px');
      grid?.style.setProperty('--effects-cols', String(cols));
    },
    fit(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      const n = this.effects.length;
      const availW = Math.max(360, Math.min(FIT_MAX_W, window.innerWidth - SIDE_MARGIN));
      if (grid === undefined || n === 0) {
        this.applyLayout(1, Math.min(availW, BLOCK_W + BODY_PAD_X));
        return;
      }
      const colsMax = Math.max(1, Math.floor((availW - BODY_PAD_X + GAP) / (BLOCK_W + GAP)));
      const headerH = (this.$refs.header as HTMLElement | undefined)?.offsetHeight ?? 96;
      const availBodyH = window.innerHeight * VIEWPORT_H_RATIO - headerH - 28;
      const rowsFit = Math.max(1, Math.floor(availBodyH / EST_ROW_H));
      let cols = Math.max(1, Math.min(colsMax, Math.ceil(n / rowsFit)));

      // Width for a given column count (capped to the viewport budget).
      const widthFor = (c: number): number =>
        Math.min(availW, c * BLOCK_W + (c - 1) * GAP + BODY_PAD_X);

      // Post-measure: variable block heights mean the estimate can under-count;
      // bump columns until the grid fits the available height or we hit colsMax.
      for (let i = 0; i < colsMax; i++) {
        this.applyLayout(cols, widthFor(cols));
        void grid.offsetHeight;
        if (grid.scrollHeight <= availBodyH + 10 || cols >= colsMax) {
          break;
        }
        cols++;
      }
    },
    scheduleFit(): void {
      if (this.fitScheduled) {
        return;
      }
      this.fitScheduled = true;
      requestAnimationFrame(() => {
        this.fitScheduled = false;
        this.fit();
      });
    },
    // ─── Source-card hover + fullscreen ────────────────────────────────
    onNameHover(payload: {name: CardName, rect: DOMRect} | null): void {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
      if (payload === null) {
        this.hoverVisible = false;
        return;
      }
      if (this.zoomCard !== undefined) {
        return;
      }
      this.hoverName = payload.name;
      this.hoverAnchor = payload.rect;
      this.hoverTimer = window.setTimeout(() => {
        this.hoverVisible = true;
      }, HOVER_DELAY);
    },
    clearHover(): void {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
      this.hoverVisible = false;
    },
    openFullscreen(name: CardName): void {
      this.clearHover();
      this.zoomCard = {name};
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
