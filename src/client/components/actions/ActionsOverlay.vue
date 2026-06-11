<template>
  <!--
    Premium "Действия" action control center — a MASTER-DETAIL surface. LEFT: a
    compact 3-column grid of action GROUP cards (one slim header + N selectable
    compact rows per source; the stored-resource count stays at the header). RIGHT:
    a static details panel for the SELECTED action (full text + cost/result + what-
    happens-next + a context-aware CTA). Selecting a row never executes — only the
    panel's CTA opens the confirmation modal. Shows ALL actions behind two faceted
    filters; nothing is silently hidden. State (selection, filters, the lazy preview
    cache) lives in `actionsOverlayState` so it survives the playerkey remount.
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
      <div v-else class="actions-board__split">
        <div class="actions-board__master" ref="grid">
          <ActionGroupCard v-for="e in filtered"
                           :key="e.cardName"
                           :entry="e"
                           :card="tableauByName.get(e.cardName)"
                           :selectedKey="selectedKey"
                           @select="onSelect"
                           @activate="$emit('activate', $event)" />
        </div>
        <ActionDetailsPanel class="actions-board__detail"
                            :entry="selectedEntry"
                            :nodeIndex="selectedNodeIndex"
                            :preview="selectedPreview"
                            :card="selectedCardModel"
                            :loadingPreview="previewLoading"
                            @activate="$emit('activate', $event)"
                            @open="openFullscreen" />
      </div>
    </div>

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
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
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
import {
  actionsOverlayState,
  actionRowKey,
  setActionSelection,
  setActionPreview,
  resetActionsOverlay,
} from '@/client/components/actions/actionsOverlayState';
import ActionGroupCard from '@/client/components/actions/ActionGroupCard.vue';
import ActionDetailsPanel from '@/client/components/actions/ActionDetailsPanel.vue';
import ActionsFilters from '@/client/components/actions/ActionsFilters.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

// Master grid sizing — a fixed compact 3-column grid + a static detail column.
const MASTER_COL_MIN = 240;   // min comfortable width of a master column
const MASTER_COL_MAX = 320;   // cap so a column never sprawls
const DETAIL_W = 380;         // the static details panel width
const GAP = 16;
const SPLIT_GAP = 18;         // gap between master + detail
const SIDE_MARGIN = 238;      // left panel + right sidebar + gutter
const FIT_MAX_W = 1680;       // hard cap on overlay width
const BODY_PAD_X = 36;
const MIN_W = 640;            // floor so the header never wraps
const MAX_COLS = 3;           // the master is at most 3 columns

type DataModel = {
  zoomCard: CardModel | undefined;
  resizeObserver: ResizeObserver | undefined;
  fitScheduled: boolean;
  // Whether the SELECTED card's preview fetch is in flight (drives the panel skeleton).
  previewLoading: boolean;
  // The current master column count (for keyboard up/down).
  cols: number;
};

export default defineComponent({
  name: 'ActionsOverlay',
  components: {ActionGroupCard, ActionDetailsPanel, ActionsFilters, CardZoomModal},
  props: {
    displayedPlayer: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    viewerColor: {
      type: String as PropType<Color>,
      required: true,
    },
    viewerId: {
      type: String,
      default: '',
    },
    availableActionNames: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
    awaitingInput: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'activate'],
  data(): DataModel {
    return {
      zoomCard: undefined,
      resizeObserver: undefined,
      fitScheduled: false,
      previewLoading: false,
      cols: MAX_COLS,
    };
  },
  computed: {
    isViewerSeat(): boolean {
      return this.displayedPlayer.color === this.viewerColor;
    },
    filter(): ActionFilterState {
      return {availability: actionsOverlayState.availability, activation: actionsOverlayState.activation};
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
    tableauByName(): Map<CardName, CardModel> {
      const map = new Map<CardName, CardModel>();
      for (const card of this.displayedPlayer.tableau) {
        map.set(card.name, card);
      }
      return map;
    },
    // ─── Selection (from module state, survives the remount) ───
    selectedKey(): string | undefined {
      return actionsOverlayState.selectedKey;
    },
    selectedCardName(): CardName | undefined {
      const key = this.selectedKey;
      if (key === undefined) {
        return undefined;
      }
      const i = key.lastIndexOf('#');
      return (i >= 0 ? key.slice(0, i) : key) as CardName;
    },
    selectedNodeIndex(): number {
      const key = this.selectedKey;
      if (key === undefined) {
        return 0;
      }
      const i = key.lastIndexOf('#');
      return i >= 0 ? (parseInt(key.slice(i + 1), 10) || 0) : 0;
    },
    selectedEntry(): ActionEntry | undefined {
      return this.filtered.find((e) => e.cardName === this.selectedCardName);
    },
    selectedPreview(): ActionPreview | undefined {
      return this.selectedCardName !== undefined ? actionsOverlayState.previewCache[this.selectedCardName] : undefined;
    },
    selectedCardModel(): CardModel | undefined {
      return this.selectedCardName !== undefined ? this.tableauByName.get(this.selectedCardName) : undefined;
    },
    // Flat master order of selectable rows (for keyboard nav).
    flatRows(): ReadonlyArray<string> {
      const rows: Array<string> = [];
      for (const e of this.filtered) {
        e.group.nodes.forEach((_n, i) => rows.push(actionRowKey(e.cardName, i)));
      }
      return rows;
    },
  },
  watch: {
    'displayedPlayer.color'(): void {
      resetActionsOverlay();
      nextTick(() => {
        this.ensureSelection();
        this.fit();
      });
    },
    filtered(): void {
      this.ensureSelection();
      nextTick(() => this.scheduleFit());
    },
  },
  mounted(): void {
    actionsOverlayState.open = true;
    this.ensureSelection();
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
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.scheduleFit);
    window.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    setAvailability(value: AvailabilityFilter): void {
      actionsOverlayState.availability = value;
    },
    setActivation(value: ActivationFilter): void {
      actionsOverlayState.activation = value;
    },
    // Keep a valid selection: re-fetch the preview for the still-valid selection,
    // else auto-select the first AVAILABLE action (else the first), so the details
    // panel always has something to show.
    ensureSelection(): void {
      const current = this.selectedEntry;
      if (current !== undefined) {
        this.fetchPreviewFor(current.cardName);
        return;
      }
      const first = this.filtered.find((e) => e.state.status === 'available') ?? this.filtered[0];
      if (first !== undefined) {
        setActionSelection(actionRowKey(first.cardName, 0));
        this.fetchPreviewFor(first.cardName);
      } else {
        setActionSelection(undefined);
      }
    },
    onSelect(payload: {cardName: CardName, nodeIndex: number}): void {
      setActionSelection(actionRowKey(payload.cardName, payload.nodeIndex));
      this.fetchPreviewFor(payload.cardName);
    },
    // Lazily fetch the read-only action preview for the SELECTED card (own seat
    // only), into the shared cache. The panel renders manifest content immediately
    // and refines when this resolves.
    fetchPreviewFor(cardName: CardName): void {
      if (!this.isViewerSeat || this.viewerId === '' || actionsOverlayState.previewCache[cardName] !== undefined) {
        return;
      }
      this.previewLoading = true;
      const url = paths.API_ACTION_PREVIEW +
        '?id=' + encodeURIComponent(this.viewerId) +
        '&card=' + encodeURIComponent(cardName);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (p !== undefined) {
            setActionPreview(cardName, p as ActionPreview);
          }
        })
        .catch(() => { /* best-effort: the modal re-fetches its own preview anyway */ })
        .finally(() => {
          this.previewLoading = false;
        });
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (this.zoomCard !== undefined) {
          this.zoomCard = undefined;
        } else {
          this.$emit('close');
        }
        return;
      }
      const rows = this.flatRows;
      if (rows.length === 0) {
        return;
      }
      const cur = this.selectedKey === undefined ? -1 : rows.indexOf(this.selectedKey);
      // The master is column-major (CSS multi-column packs the DOM order top→bottom
      // down each column), so Down/Up step ±1 (the next item IS visually below) and
      // Left/Right jump ~one column's worth of rows.
      const perCol = Math.max(1, Math.ceil(rows.length / Math.max(1, this.cols)));
      let next = cur;
      switch (e.key) {
      case 'ArrowDown': next = cur + 1; break;
      case 'ArrowUp': next = cur - 1; break;
      case 'ArrowRight': next = cur + perCol; break;
      case 'ArrowLeft': next = cur - perCol; break;
      case 'Home': next = 0; break;
      case 'End': next = rows.length - 1; break;
      case 'Enter': case ' ':
        this.activateSelected();
        e.preventDefault();
        return;
      default: return;
      }
      next = Math.max(0, Math.min(rows.length - 1, next));
      if (next !== cur && rows[next] !== undefined) {
        const key = rows[next];
        const i = key.lastIndexOf('#');
        const card = (i >= 0 ? key.slice(0, i) : key) as CardName;
        setActionSelection(key);
        this.fetchPreviewFor(card);
        e.preventDefault();
      }
    },
    activateSelected(): void {
      const e = this.selectedEntry;
      if (e === undefined || e.state.status !== 'available') {
        return;
      }
      this.$emit('activate', {cardName: e.cardName, nodeIndex: this.selectedNodeIndex});
    },
    // ─── Adaptive fit: a fixed compact master grid + a static detail column ───
    fit(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      const grid = this.$refs.grid as HTMLElement | undefined;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const availW = clamp(window.innerWidth - SIDE_MARGIN, MIN_W, FIT_MAX_W);
      const n = this.filtered.length;
      // The width left for the master after the detail column + gaps + padding.
      const masterAvail = availW - BODY_PAD_X - DETAIL_W - SPLIT_GAP;
      const colsByWidth = Math.max(1, Math.floor((masterAvail + GAP) / (MASTER_COL_MIN + GAP)));
      const cols = clamp(Math.min(n, colsByWidth), 1, MAX_COLS);
      // A comfortable master width (don't let 1–2 groups sprawl).
      const comfortable = cols * MASTER_COL_MAX + (cols - 1) * GAP;
      const masterW = Math.min(masterAvail, comfortable);
      const overlayW = clamp(masterW + DETAIL_W + SPLIT_GAP + BODY_PAD_X, MIN_W, FIT_MAX_W);
      this.cols = cols;
      root?.style.setProperty('--actions-overlay-width', Math.round(overlayW) + 'px');
      grid?.style.setProperty('--actions-master-cols', String(cols));
      root?.style.setProperty('--detail-width', DETAIL_W + 'px');
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
    // Fullscreen the SELECTED source card (opened from the details panel's ⤢). The
    // overlay grid no longer shows a hover popover — the source preview now lives
    // INSIDE the details panel, so it can't cover the action rows.
    openFullscreen(name: CardName): void {
      this.zoomCard = this.tableauByName.get(name) ?? ({name} as CardModel);
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
