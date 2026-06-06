<template>
  <!--
    Premium "Действия" overlay — the displayed player's ACTIVATABLE actions
    (blue cards + corporations) as a grid of action BUTTONS. The sibling of the
    Effects overlay (passive abilities): same dark-glass HUD frame, adaptive JS
    fit engine, hover source-card preview + fullscreen. But the blocks are
    interactive — each is a button that opens a confirmation modal before the
    action is submitted. Shows ALL actions (available / unavailable-with-reason /
    activated-this-generation) behind two faceted filters; nothing is silently
    hidden.
  -->
  <div class="actions-board-overlay" ref="root" data-test="actions-overlay">
    <div class="actions-board__corner actions-board__corner--tl" aria-hidden="true"></div>
    <div class="actions-board__corner actions-board__corner--tr" aria-hidden="true"></div>
    <div class="actions-board__corner actions-board__corner--bl" aria-hidden="true"></div>
    <div class="actions-board__corner actions-board__corner--br" aria-hidden="true"></div>

    <header class="actions-board__header" ref="header">
      <div class="actions-board__title-row">
        <span class="actions-board__glyph" aria-hidden="true"></span>
        <h2 class="actions-board__title" v-i18n>Actions</h2>
        <span class="actions-board__count">{{ entries.length }}</span>
        <span class="actions-board__ready"
              :class="{'actions-board__ready--zero': availableCount === 0}">
          <span class="actions-board__ready-dot" aria-hidden="true"></span>
          <span class="actions-board__ready-label"><span v-i18n>Can activate</span>: {{ availableCount }}</span>
        </span>
        <span class="actions-board__player" :class="'player_translucent_bg_color_' + displayedPlayer.color">
          <span class="actions-board__player-dot" :class="'player_bg_color_' + displayedPlayer.color" aria-hidden="true"></span>
          <span class="actions-board__player-name">{{ displayedPlayer.name }}</span>
          <span v-if="displayedPlayer.color === viewerColor" class="actions-board__player-you" v-i18n>You</span>
        </span>
        <button class="actions-board__close" @click="$emit('close')" :title="$t('Close')" data-test="actions-overlay-close">✕</button>
      </div>
      <ActionsFilters
        :availabilityChips="availabilityChips"
        :activationChips="activationChips"
        @availability="setAvailability"
        @activation="setActivation" />
    </header>

    <div class="actions-board__body" ref="body">
      <div v-if="entries.length === 0" class="actions-board__empty">
        <span class="actions-board__empty-glyph" aria-hidden="true">⌁</span>
        <span class="actions-board__empty-text" v-i18n>No activatable actions</span>
      </div>
      <div v-else-if="filtered.length === 0" class="actions-board__empty">
        <span class="actions-board__empty-glyph" aria-hidden="true">⌁</span>
        <span class="actions-board__empty-text" v-i18n>No actions match the filter</span>
      </div>
      <div v-else class="actions-board__grid" ref="grid">
        <ActionBlock v-for="e in filtered"
                     :key="e.cardName"
                     :entry="e"
                     @namehover="onNameHover"
                     @open="openFullscreen"
                     @activate="$emit('activate', $event)" />
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
import {
  ActionEntry,
  ActionFilterState,
  AvailabilityFilter,
  ActivationFilter,
  AvailabilityChip,
  ActivationChip,
  buildActionEntries,
  filterActionEntries,
  buildAvailabilityChips,
  buildActivationChips,
  availableActionCount,
} from '@/client/components/actions/actionModel';
import ActionBlock from '@/client/components/actions/ActionBlock.vue';
import ActionsFilters from '@/client/components/actions/ActionsFilters.vue';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

const BLOCK_W = 344;          // target block width (px) — wider than effects (footer button)
const GAP = 16;
const SIDE_MARGIN = 120;
const FIT_MAX_W = 1700;
const BODY_PAD_X = 36;
const VIEWPORT_H_RATIO = 0.86;
const EST_ROW_H = 210;        // taller than effects (header + graphic + footer)
const HOVER_DELAY = 260;

type DataModel = {
  filter: ActionFilterState;
  hoverName: CardName;
  hoverVisible: boolean;
  hoverAnchor: DOMRect | undefined;
  hoverTimer: number | undefined;
  zoomCard: CardModel | undefined;
  resizeObserver: ResizeObserver | undefined;
  fitScheduled: boolean;
};

export default defineComponent({
  name: 'ActionsOverlay',
  components: {ActionBlock, ActionsFilters, CardPreviewPopover, CardZoomModal},
  props: {
    displayedPlayer: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    viewerColor: {
      type: String as PropType<Color>,
      required: true,
    },
    // Card names in the server's 'Perform an action from a played card'
    // SelectCard — the authoritative "available right now" set (own seat only).
    availableActionNames: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
    // The server is waiting on some input (mid sub-action) — soft-reason text.
    awaitingInput: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'activate'],
  data(): DataModel {
    return {
      filter: {availability: 'all', activation: 'dormant'},
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
    isViewerSeat(): boolean {
      return this.displayedPlayer.color === this.viewerColor;
    },
    entries(): ReadonlyArray<ActionEntry> {
      return buildActionEntries(this.displayedPlayer, {
        availableNames: new Set(this.availableActionNames),
        isViewerSeat: this.isViewerSeat,
        awaitingInput: this.awaitingInput,
        usedNames: new Set(this.displayedPlayer.actionsThisGeneration),
      });
    },
    filtered(): ReadonlyArray<ActionEntry> {
      return filterActionEntries(this.entries, this.filter);
    },
    availabilityChips(): ReadonlyArray<AvailabilityChip> {
      return buildAvailabilityChips(this.entries, this.filter);
    },
    activationChips(): ReadonlyArray<ActivationChip> {
      return buildActivationChips(this.entries, this.filter);
    },
    availableCount(): number {
      return availableActionCount(this.entries);
    },
  },
  watch: {
    'displayedPlayer.color'(): void {
      this.clearHover();
      nextTick(() => this.fit());
    },
    filtered(): void {
      nextTick(() => this.scheduleFit());
    },
  },
  mounted(): void {
    nextTick(() => this.fit());
    window.setTimeout(() => this.fit(), 220);
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
    setAvailability(value: AvailabilityFilter): void {
      this.filter = {...this.filter, availability: value};
    },
    setActivation(value: ActivationFilter): void {
      this.filter = {...this.filter, activation: value};
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (this.zoomCard !== undefined) {
          this.zoomCard = undefined;
        } else {
          this.$emit('close');
        }
      }
    },
    // ─── Adaptive fit (mirrors EffectsOverlay) ─────────────────────────────
    applyLayout(cols: number, width: number): void {
      const root = this.$refs.root as HTMLElement | undefined;
      const grid = this.$refs.grid as HTMLElement | undefined;
      root?.style.setProperty('--actions-overlay-width', Math.round(width) + 'px');
      grid?.style.setProperty('--actions-cols', String(cols));
    },
    fit(): void {
      const grid = this.$refs.grid as HTMLElement | undefined;
      const n = this.filtered.length;
      const availW = Math.max(360, Math.min(FIT_MAX_W, window.innerWidth - SIDE_MARGIN));
      if (grid === undefined || n === 0) {
        this.applyLayout(1, Math.min(availW, BLOCK_W + BODY_PAD_X));
        return;
      }
      const colsMax = Math.max(1, Math.floor((availW - BODY_PAD_X + GAP) / (BLOCK_W + GAP)));
      const headerH = (this.$refs.header as HTMLElement | undefined)?.offsetHeight ?? 130;
      const availBodyH = window.innerHeight * VIEWPORT_H_RATIO - headerH - 28;
      const rowsFit = Math.max(1, Math.floor(availBodyH / EST_ROW_H));
      let cols = Math.max(1, Math.min(colsMax, Math.ceil(n / rowsFit)));
      const widthFor = (c: number): number =>
        Math.min(availW, c * BLOCK_W + (c - 1) * GAP + BODY_PAD_X);
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
    // ─── Source-card hover + fullscreen ────────────────────────────────────
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
      this.zoomCard = {name} as CardModel;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
