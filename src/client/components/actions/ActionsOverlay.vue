<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
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
      <!-- PICK MODE strip — names the "choose an action to repeat" context + a
           Cancel; the master-detail body + filters below are SHARED with the
           normal mode (same layout, same details view). -->
      <div v-if="pickMode" class="actions-board__pickstrip">
        <span class="actions-board__pickstrip-dot" aria-hidden="true"></span>
        <span class="actions-board__pickstrip-text">{{ pickTitle }}</span>
        <button type="button" class="actions-board__pickstrip-cancel" @click="$emit('close')" v-i18n>Cancel</button>
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
                           :preview="previewFor(e.cardName)"
                           :selectedKey="selectedKey"
                           :pickMode="pickMode"
                           :pickSelectable="!pickMode || pickSelectable(e.cardName)"
                           @select="onSelect"
                           @activate="$emit('activate', $event)" />
        </div>
        <!-- The detail lives in a RELATIVE cell + is ABSOLUTE inside it, so its
             (variable) content height NEVER drives the split's row height — the
             overlay size is fixed by the master + a min-height, NOT by which action
             is selected (no jump when switching details). -->
        <div class="actions-board__detail-cell">
          <ActionDetailsPanel class="actions-board__detail"
                              :entry="selectedEntry"
                              :nodeIndex="selectedNodeIndex"
                              :preview="selectedPreview"
                              :card="selectedCardModel"
                              :stat="selectedStat"
                              :loadingPreview="previewLoading"
                              :pickMode="pickMode"
                              :pickSelectable="selectedPickSelectable"
                              @activate="$emit('activate', $event)"
                              @pick="onPickResolve"
                              @open="openFullscreen" />
        </div>
      </div>

      <!-- HIDDEN height-probe: one lightweight (card-less) details panel per action
           ROW, measured to find the TALLEST detail so the overlay opens at a size
           where NO detail scrolls (the size is pre-computed, not grown per click). -->
      <div v-if="filtered.length > 0" class="actions-board__measure" ref="measure" aria-hidden="true">
        <ActionDetailsPanel v-for="m in measureItems"
                            :key="m.key"
                            :measuring="true"
                            :entry="m.entry"
                            :nodeIndex="m.nodeIndex"
                            :preview="previewFor(m.entry.cardName)"
                            :stat="statForCard(m.entry.cardName)"
                            :loadingPreview="false" />
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
import {apiUrl} from '@/client/utils/runtimeConfig';
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
import {EffectOverlayStat} from '@/common/events/aggregate';
import {
  actionsOverlayState,
  actionRowKey,
  setActionSelection,
  setActionPreview,
  setActionPreviewScope,
  setActionStatsScope,
  setActionStats,
  getActionStats,
  resetActionsOverlay,
} from '@/client/components/actions/actionsOverlayState';
import {actionsPickState, resolveActionsPick, isActionsPickCandidate} from '@/client/components/actions/actionsPickState';
import {translateText, translateMessage} from '@/client/directives/i18n';
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
  measureScheduled: boolean;
  // Whether the SELECTED card's preview fetch is in flight (drives the panel skeleton).
  previewLoading: boolean;
  // The current master column count (for keyboard up/down).
  cols: number;
  // OV-2 (docs/PERFORMANCE_AUDIT.md): last overlay width fit() wrote — an unchanged
  // re-fit skips the CSS-var write so the RO (observing root, whose width IS
  // --actions-overlay-width) isn't self-triggered by a no-op set.
  lastFitWidth: number | undefined;
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
    previewCacheKey: {
      type: String,
      default: '',
    },
    // Scope key (the generation) for the per-game ACTION-usage stats cache.
    statsCacheKey: {
      type: String,
      default: '',
    },
    awaitingInput: {
      type: Boolean,
      default: false,
    },
    // PICK MODE — the overlay is hosting a "choose an ACTION to repeat" pick
    // (ProjectInspection / Viron, ≥4 candidates) instead of its normal master-
    // detail browser. Candidates highlight + resolve on click; the rest dim. The
    // details panel + filters + fit machinery are suppressed. Bound to
    // `actionsPickState.active` by PlayerHome.
    pickMode: {
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
      measureScheduled: false,
      previewLoading: false,
      cols: MAX_COLS,
      lastFitWidth: undefined,
    };
  },
  computed: {
    isViewerSeat(): boolean {
      return this.displayedPlayer.color === this.viewerColor;
    },
    filter(): ActionFilterState {
      // Pick-mode keeps its OWN filters (default Activated + All) so a pick doesn't
      // clobber the player's normal browse prefs.
      if (this.pickMode) {
        return {availability: actionsPickState.availability, activation: actionsPickState.activation};
      }
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
    // The whole-game ACTION-usage stat for the selected card (undefined → not used /
    // loading → the panel shows the "not used yet" note).
    selectedStat(): EffectOverlayStat | undefined {
      return this.selectedCardName !== undefined ? this.statForCard(this.selectedCardName) : undefined;
    },
    // Flat master order of selectable rows (for keyboard nav).
    flatRows(): ReadonlyArray<string> {
      const rows: Array<string> = [];
      for (const e of this.filtered) {
        e.group.nodes.forEach((_n, i) => rows.push(actionRowKey(e.cardName, i)));
      }
      return rows;
    },
    // One probe per action ROW (different nodes → different reasons/results → height)
    // for the hidden height measurer.
    measureItems(): ReadonlyArray<{key: string, entry: ActionEntry, nodeIndex: number}> {
      const items: Array<{key: string, entry: ActionEntry, nodeIndex: number}> = [];
      for (const e of this.filtered) {
        e.group.nodes.forEach((_n, i) => items.push({key: actionRowKey(e.cardName, i), entry: e, nodeIndex: i}));
      }
      return items;
    },
    // Re-measure the detail height whenever a new preview lands (results add height).
    previewCount(): number {
      return Object.keys(actionsOverlayState.previewCache).length;
    },
    // ─── Pick mode ───
    // The prompt label for the pick strip (e.g. "Perform an action from a played
    // card again"), translated from the pick state's title.
    pickTitle(): string {
      const t = actionsPickState.title;
      return t === '' ? translateText('Choose an action to repeat') : (typeof t === 'string' ? translateText(t) : translateMessage(t));
    },
    // Whether the currently-FOCUSED action is a valid repeat candidate — gates the
    // details panel's «ВЫБРАТЬ» CTA in pick-mode.
    selectedPickSelectable(): boolean {
      return this.selectedCardName !== undefined && this.pickSelectable(this.selectedCardName);
    },
  },
  watch: {
    previewCacheKey(): void {
      setActionPreviewScope(this.previewCacheKey);
      this.prefetchBranchPreviews();
      nextTick(() => {
        this.scheduleMeasure();
      });
    },
    'displayedPlayer.color'(): void {
      resetActionsOverlay();
      setActionPreviewScope(this.previewCacheKey);
      setActionStatsScope(this.statsCacheKey);
      this.fetchActionStats();
      this.prefetchBranchPreviews();
      nextTick(() => {
        this.ensureSelection();
        this.fit();
        this.scheduleMeasure();
      });
    },
    statsCacheKey(): void {
      setActionStatsScope(this.statsCacheKey);
      this.fetchActionStats();
    },
    filtered(): void {
      this.ensureSelection();
      this.prefetchBranchPreviews();
      nextTick(() => {
        this.scheduleFit();
        this.scheduleMeasure();
      });
    },
    previewCount(): void {
      this.scheduleMeasure();
    },
  },
  mounted(): void {
    // Pick mode reuses the FULL master-detail surface (filters + details view); the
    // only differences are its own filters (defaults set in enterActionsPick) and
    // the «ВЫБРАТЬ» CTA. So the setup is shared — just don't flag the NORMAL overlay
    // as open (pick is a transient sub-flow, not the browse overlay).
    if (!this.pickMode) {
      actionsOverlayState.open = true;
    }
    setActionPreviewScope(this.previewCacheKey);
    setActionStatsScope(this.statsCacheKey);
    this.fetchActionStats();
    this.ensureSelection();
    this.prefetchBranchPreviews();
    nextTick(() => {
      this.fit();
      this.scheduleMeasure();
    });
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
      if (this.pickMode) {
        actionsPickState.availability = value;
      } else {
        actionsOverlayState.availability = value;
      }
    },
    setActivation(value: ActivationFilter): void {
      if (this.pickMode) {
        actionsPickState.activation = value;
      } else {
        actionsOverlayState.activation = value;
      }
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
      // Auto-focus the first sensible action so the details panel always has
      // something: in pick-mode prefer a selectable CANDIDATE, else the first
      // available, else the first shown.
      const first = (this.pickMode ? this.filtered.find((e) => this.pickSelectable(e.cardName)) : undefined) ??
        this.filtered.find((e) => e.state.status === 'available') ?? this.filtered[0];
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
    // Lazily fetch the read-only action preview for a card (own seat only), into
    // the shared cache. `silent` suppresses the details skeleton — used by the
    // background prefetch so it doesn't flicker the panel. The panel renders
    // manifest content immediately and refines when this resolves.
    // The per-game action-usage stat for a card (from the cached, colour-keyed feed).
    statForCard(cardName: CardName): EffectOverlayStat | undefined {
      return getActionStats(this.displayedPlayer.color)?.find((s) => s.card === cardName);
    },
    // Fetch the per-game ACTION-usage stats for the displayed player (stale-while-
    // revalidate, mirroring the Эффекты overlay): events accumulate within a
    // generation, so always refetch on open / seat change but show cached instantly.
    // No id (playground) or no fetch (JSDOM) → the panel shows the "not used yet" note.
    fetchActionStats(): void {
      if (this.viewerId === '' || typeof fetch !== 'function') {
        return;
      }
      const color = this.displayedPlayer.color;
      const url = apiUrl(paths.API_GAME_ACTION_STATS) +
        '?id=' + encodeURIComponent(this.viewerId) +
        '&color=' + encodeURIComponent(color);
      const scope = actionsOverlayState.statsScope;
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((s) => {
          if (s !== undefined) {
            setActionStats(color, s as ReadonlyArray<EffectOverlayStat>, scope);
          }
        })
        .catch(() => { /* best-effort: the panel falls back to the "not used yet" note */ })
        .finally(() => nextTick(() => this.scheduleMeasure()));
    },
    fetchPreviewFor(cardName: CardName, silent = false): void {
      if (!this.isViewerSeat || this.viewerId === '' || actionsOverlayState.previewCache[cardName] !== undefined) {
        return;
      }
      if (!silent) {
        this.previewLoading = true;
      }
      const url = apiUrl(paths.API_ACTION_PREVIEW) +
        '?id=' + encodeURIComponent(this.viewerId) +
        '&card=' + encodeURIComponent(cardName);
      const scope = actionsOverlayState.previewCacheScope;
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (p !== undefined) {
            setActionPreview(cardName, p as ActionPreview, scope);
          }
        })
        .catch(() => { /* best-effort: the modal re-fetches its own preview anyway */ })
        .finally(() => {
          if (!silent) {
            this.previewLoading = false;
          }
        });
    },
    // Background-prefetch ALL available cards' previews (silent): multi-node cards
    // need it to mark a single UNAVAILABLE branch (Rotator Impacts), and ALL of them
    // feed the height measurer (results add height) so the overlay opens pre-sized.
    prefetchBranchPreviews(): void {
      // In pick-mode prefetch the repeat CANDIDATES (the details panel shows their
      // result + the height measurer needs them); else the normally-available ones.
      if (this.pickMode) {
        for (const name of actionsPickState.selectable) {
          this.fetchPreviewFor(name, true);
        }
        return;
      }
      for (const e of this.entries) {
        if (e.state.status === 'available') {
          this.fetchPreviewFor(e.cardName, true);
        }
      }
    },
    // Measure the TALLEST detail (the hidden card-less probes) and set the split
    // min-height to it (capped to the viewport), so the overlay opens at a size where
    // no detail scrolls — pre-computed, never grown per selection.
    measureDetailHeight(): void {
      // Both refs can be null (not just undefined) — the measurer host is behind
      // `v-if="filtered.length > 0"`, so a rAF scheduled before the filter emptied
      // fires after Vue nulls the ref. `!ref` catches null AND undefined.
      const measure = this.$refs.measure as HTMLElement | null | undefined;
      const root = this.$refs.root as HTMLElement | null | undefined;
      if (!measure || !root) {
        return;
      }
      let maxH = 0;
      for (const child of Array.from(measure.children)) {
        maxH = Math.max(maxH, (child as HTMLElement).offsetHeight);
      }
      if (maxH <= 0) {
        return;
      }
      // Cap to the viewport (then that one tall detail scrolls — unavoidable on a
      // short screen); floor so it never collapses.
      const cap = Math.max(360, Math.floor(window.innerHeight * 0.82) - 150);
      root.style.setProperty('--actions-detail-min-h', Math.min(maxH, cap) + 'px');
    },
    scheduleMeasure(): void {
      if (this.measureScheduled) {
        return;
      }
      this.measureScheduled = true;
      requestAnimationFrame(() => {
        this.measureScheduled = false;
        this.measureDetailHeight();
      });
    },
    // The cached preview for a card (drives the grid's per-branch row availability).
    previewFor(cardName: CardName): ActionPreview | undefined {
      return actionsOverlayState.previewCache[cardName];
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
      if (e === undefined) {
        return;
      }
      // PICK MODE: Enter resolves the pick on the focused candidate (the «ВЫБРАТЬ»
      // CTA), if it's selectable.
      if (this.pickMode) {
        if (this.selectedPickSelectable) {
          this.onPickResolve({cardName: e.cardName, nodeIndex: this.selectedNodeIndex});
        }
        return;
      }
      if (e.state.status !== 'available') {
        return;
      }
      this.$emit('activate', {cardName: e.cardName, nodeIndex: this.selectedNodeIndex});
    },
    // ─── Adaptive fit: a fixed compact master grid + a static detail column ───
    // (shared by normal + pick mode — both render the master-detail split). ───
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
      const roundedW = Math.round(overlayW);
      // OV-2: nothing changed → skip the writes so the RO (root's width IS
      // --actions-overlay-width) isn't re-triggered by a no-op set.
      if (roundedW === this.lastFitWidth && cols === this.cols) {
        return;
      }
      this.lastFitWidth = roundedW;
      this.cols = cols;
      root?.style.setProperty('--actions-overlay-width', roundedW + 'px');
      grid?.style.setProperty('--actions-master-cols', String(cols));
      root?.style.setProperty('--detail-width', DETAIL_W + 'px');
      // The viewport may have changed → the detail-height cap with it.
      this.scheduleMeasure();
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
    // Whether an action SOURCE card is selectable in the current pick (a candidate).
    pickSelectable(name: CardName): boolean {
      return isActionsPickCandidate(name);
    },
    // PICK MODE — the details panel's «ВЫБРАТЬ» CTA (or Enter) resolves the pick on
    // the focused candidate, then closes the overlay; the activeOverlay watcher /
    // initiating modal restores the originating surface + applies the choice.
    onPickResolve(payload: {cardName: CardName, nodeIndex: number}): void {
      if (!this.pickMode || !this.pickSelectable(payload.cardName)) {
        return;
      }
      resolveActionsPick(payload.cardName, payload.nodeIndex);
      this.$emit('close');
    },
  },
});
</script>
