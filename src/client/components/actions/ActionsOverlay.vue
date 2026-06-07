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
        <span class="actions-board__empty-sub" v-i18n>This player has no cards or corporation with an action.</span>
      </div>
      <div v-else-if="filtered.length === 0" class="actions-board__empty">
        <span class="actions-board__empty-glyph" aria-hidden="true">⌁</span>
        <span class="actions-board__empty-text" v-i18n>No actions match the filter</span>
        <span class="actions-board__empty-sub" v-i18n>Adjust the filters above to see other actions.</span>
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

    <!-- Shared source-card hover popover — passes live CardModel for resource counts. -->
    <CardPreviewPopover :name="hoverName" :card="hoverCard" :visible="hoverVisible" :anchor="hoverAnchor" />

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

const CARD_MIN = 290;         // min comfortable action-card width
const CARD_IDEAL = 324;       // target width per column
const CARD_MAX = 430;         // cap so a card never sprawls
const CARD_HERO_MAX = 540;    // a lone action can be a touch wider (hero)
const GAP = 16;               // grid gap
// Total horizontal space reserved for the left panel + right sidebar + breathing
// room (matches --left-panel-width:160 + --right-sidebar-width:62 + 16px gutter).
const SIDE_MARGIN = 238;
const FIT_MAX_W = 1640;       // hard cap on panel width
const BODY_PAD_X = 36;        // .actions-board__body horizontal padding
const MIN_W = 600;            // floor so the (compact) header never wraps
const MAX_COLS = 4;           // never spread the grid thinner than this
const HOVER_DELAY = 260;      // ms before the source-card popover appears

type DataModel = {
  filter: ActionFilterState;
  hoverName: CardName;
  hoverCard: CardModel | undefined;
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
      hoverCard: undefined,
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
    // Live CardModel lookup by name — used to enrich hover previews with current
    // resource counts (animals/microbes/floaters/etc. on the card right now).
    tableauByName(): Map<CardName, CardModel> {
      const map = new Map<CardName, CardModel>();
      for (const card of this.displayedPlayer.tableau) {
        map.set(card.name, card);
      }
      return map;
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
    // ─── Adaptive fit ──────────────────────────────────────────────────────
    //
    // COUNT-AWARE, measurement-free: the column count + card width + overlay
    // width are derived purely from the visible-action COUNT and the viewport.
    // The key adaptivity (vs the effects overlay) is that FEW actions FILL THE
    // WIDTH with columns rather than stacking into one tall lonely column, so a
    // 1–2-action overlay reads as a compact premium dashboard. The body hugs its
    // content height (CSS), so there's never dead air below the cards; a large
    // collection simply scrolls.
    applyLayout(cols: number, width: number, cardW: number): void {
      const root = this.$refs.root as HTMLElement | undefined;
      const grid = this.$refs.grid as HTMLElement | undefined;
      root?.style.setProperty('--actions-overlay-width', Math.round(width) + 'px');
      grid?.style.setProperty('--actions-cols', String(cols));
      grid?.style.setProperty('--actions-card-w', Math.round(cardW) + 'px');
    },
    fit(): void {
      const n = this.filtered.length;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const availW = clamp(window.innerWidth - SIDE_MARGIN, MIN_W, FIT_MAX_W);
      if (n === 0) {
        this.applyLayout(1, MIN_W, CARD_IDEAL);
        return;
      }
      // Columns: spread few cards across the width (1 per card up to MAX_COLS,
      // capped by how many fit at the min card width).
      const colsByWidth = Math.max(1, Math.floor((availW - BODY_PAD_X + GAP) / (CARD_MIN + GAP)));
      const cols = clamp(Math.min(n, colsByWidth), 1, MAX_COLS);
      // Share a COMFORTABLE width budget among the columns (don't let 1–2 cards
      // sprawl to the whole viewport); the panel floors at MIN_W for the header.
      const comfortableW = cols * CARD_IDEAL + (cols - 1) * GAP + BODY_PAD_X;
      const targetW = Math.min(availW, Math.max(MIN_W, comfortableW));
      const cardW = clamp(
        (targetW - BODY_PAD_X - (cols - 1) * GAP) / cols,
        CARD_MIN,
        cols === 1 ? CARD_HERO_MAX : CARD_MAX);
      const width = clamp(cols * cardW + (cols - 1) * GAP + BODY_PAD_X, MIN_W, FIT_MAX_W);
      this.applyLayout(cols, width, cardW);
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
      this.hoverCard = this.tableauByName.get(payload.name);
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
      this.hoverCard = undefined;
    },
    openFullscreen(name: CardName): void {
      this.clearHover();
      // Use the live CardModel from the tableau so the fullscreen viewer also
      // shows current resource counts.
      this.zoomCard = this.tableauByName.get(name) ?? ({name} as CardModel);
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
