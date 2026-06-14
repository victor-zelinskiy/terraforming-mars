<template>
  <!--
    Premium "Эффекты" overlay — a MASTER-DETAIL surface. LEFT: the adaptive grid of
    effect blocks (one per source card, each effect its own block). RIGHT: a static
    details panel for the SELECTED/hovered effect — its printed rule + a per-game
    summary ("what this effect actually did this game": trigger count, impact,
    current value, last trigger) or a thematic note. Hover previews, click pins;
    the panel's ⤢ opens the source card fullscreen. The whole-game per-player stats
    are fetched once (bounded `/api/game/effect-stats`) and cached. Selection + the
    stats cache live in `effectsOverlayState` so they survive the playerkey remount.
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
        <!-- Read-only player context. Switching seats is done the generic way:
             clicking a player's panel (top-left) re-points displayedPlayer. -->
        <span class="effects-board__player" :class="'player_translucent_bg_color_' + displayedPlayer.color">
          <span class="effects-board__player-dot" :class="'player_bg_color_' + displayedPlayer.color" aria-hidden="true"></span>
          <span class="effects-board__player-name">{{ displayedPlayer.name }}</span>
          <span v-if="displayedPlayer.color === viewerColor" class="effects-board__player-you" v-i18n>You</span>
        </span>
        <button class="effects-board__close" @click="$emit('close')" :title="$t('Close')" data-test="effects-overlay-close">✕</button>
      </div>
    </header>

    <div class="effects-board__body" ref="body">
      <div v-if="effects.length === 0" class="effects-board__empty">
        <span class="effects-board__empty-glyph" aria-hidden="true">∅</span>
        <span class="effects-board__empty-text" v-i18n>No active effects</span>
      </div>
      <div v-else class="effects-board__split">
        <div class="effects-board__master" ref="grid">
          <EffectBlock v-for="g in groups"
                       :key="g.key"
                       :group="g"
                       :selectedKey="activeKey"
                       @namehover="onNameHover"
                       @open="onPin" />
        </div>
        <!-- The detail lives in a RELATIVE cell + is ABSOLUTE inside it, so its
             (variable) content height NEVER drives the split's row height — the
             overlay size is fixed by the master + a min-height (no jump on select). -->
        <div class="effects-board__detail-cell">
          <EffectDetailsPanel class="effects-board__detail"
                              :group="selectedGroup"
                              :stat="selectedStat"
                              :card="selectedCardModel"
                              :loading="loadingStats"
                              @open="openFullscreen" />
        </div>
      </div>

      <!-- HIDDEN height-probe: one card-less details panel per group, measured to
           find the TALLEST detail so the overlay opens at a size where no detail
           scrolls (pre-computed, not grown per selection). -->
      <div v-if="effects.length > 0" class="effects-board__measure" ref="measure" aria-hidden="true">
        <EffectDetailsPanel v-for="g in measureItems"
                            :key="g.key"
                            :measuring="true"
                            :group="g"
                            :stat="statForGroup(g.cardName)" />
      </div>
    </div>

    <!-- Shared fullscreen source-card viewer (opened from the details panel's ⤢). -->
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
import {EffectOverlayStat} from '@/common/events/aggregate';
import {paths} from '@/common/app/paths';
import {playerEffects, playerEffectGroups, EffectEntry, EffectGroup} from '@/client/components/effects/effectExtraction';
import {
  effectsOverlayState,
  setEffectSelection,
  setEffectStatsScope,
  setEffectStats,
  getEffectStats,
  resetEffectsOverlay,
} from '@/client/components/effects/effectsOverlayState';
import EffectBlock from '@/client/components/effects/EffectBlock.vue';
import EffectDetailsPanel from '@/client/components/effects/EffectDetailsPanel.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

// Master grid sizing — a fixed compact grid + a static detail column (mirrors the
// Actions overlay). Effect blocks run a touch wider than action columns.
const MASTER_COL_MIN = 290;   // min comfortable width of a master column
const MASTER_COL_MAX = 340;   // cap so a column never sprawls
const DETAIL_W = 380;         // the static details panel width
const GAP = 16;
const SPLIT_GAP = 18;         // gap between master + detail
const SIDE_MARGIN = 238;      // left panel + right sidebar + gutter
const FIT_MAX_W = 1680;       // hard cap on overlay width
const BODY_PAD_X = 36;        // .effects-board__body horizontal padding
const MIN_W = 640;            // floor so the header never wraps
const MAX_COLS = 3;           // the master is at most 3 columns

type DataModel = {
  hoverKey: CardName | undefined;
  zoomCard: CardModel | undefined;
  loadingStats: boolean;
  resizeObserver: ResizeObserver | undefined;
  fitScheduled: boolean;
  measureScheduled: boolean;
  cols: number;
};

export default defineComponent({
  name: 'EffectsOverlay',
  components: {EffectBlock, EffectDetailsPanel, CardZoomModal},
  props: {
    displayedPlayer: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    viewerColor: {
      type: String as PropType<Color>,
      required: true,
    },
    // The viewer's own participant id — auth for the bounded stats fetch. Empty
    // (e.g. the playground) skips the fetch (the panel then shows base rule + notes).
    viewerId: {
      type: String,
      default: '',
    },
    // Snapshot key (the generation) — invalidates the cached stats when the game
    // advances so the summary reflects the latest events.
    statsCacheKey: {
      type: String,
      default: '',
    },
  },
  emits: ['close'],
  data(): DataModel {
    return {
      hoverKey: undefined,
      zoomCard: undefined,
      loadingStats: false,
      resizeObserver: undefined,
      fitScheduled: false,
      measureScheduled: false,
      cols: MAX_COLS,
    };
  },
  computed: {
    // Flat list — drives the header count (= number of effects).
    effects(): ReadonlyArray<EffectEntry> {
      return playerEffects(this.displayedPlayer.tableau);
    },
    // Grouped by source card — one grid block per source, each effect a sub-block.
    groups(): ReadonlyArray<EffectGroup> {
      return playerEffectGroups(this.displayedPlayer.tableau);
    },
    tableauByName(): Map<CardName, CardModel> {
      const map = new Map<CardName, CardModel>();
      for (const card of this.displayedPlayer.tableau) {
        map.set(card.name, card);
      }
      return map;
    },
    // The pinned selection (module state, survives the remount).
    selectedKey(): CardName | undefined {
      return effectsOverlayState.selectedKey;
    },
    // The effect whose detail is shown: a hover preview overrides the pin.
    activeKey(): CardName | undefined {
      return this.hoverKey ?? this.selectedKey;
    },
    selectedGroup(): EffectGroup | undefined {
      return this.groups.find((g) => g.cardName === this.activeKey);
    },
    selectedStat(): EffectOverlayStat | undefined {
      return this.statForGroup(this.selectedGroup?.cardName);
    },
    selectedCardModel(): CardModel | undefined {
      return this.selectedGroup !== undefined ? this.tableauByName.get(this.selectedGroup.cardName) : undefined;
    },
    // One height-probe per group.
    measureItems(): ReadonlyArray<EffectGroup> {
      return this.groups;
    },
    // The fetched stats for the viewed seat (re-measure when they land).
    statsCount(): number {
      return getEffectStats(this.displayedPlayer.color)?.length ?? 0;
    },
  },
  watch: {
    'displayedPlayer.color'(): void {
      resetEffectsOverlay();
      setEffectStatsScope(this.statsCacheKey);
      this.fetchStats();
      this.hoverKey = undefined;
      nextTick(() => {
        this.ensureSelection();
        this.fit();
        this.scheduleMeasure();
      });
    },
    statsCacheKey(): void {
      setEffectStatsScope(this.statsCacheKey);
      this.fetchStats();
      this.scheduleMeasure();
    },
    groups(): void {
      this.ensureSelection();
      nextTick(() => {
        this.scheduleFit();
        this.scheduleMeasure();
      });
    },
    statsCount(): void {
      this.scheduleMeasure();
    },
  },
  mounted(): void {
    setEffectStatsScope(this.statsCacheKey);
    this.ensureSelection();
    this.fetchStats();
    nextTick(() => {
      this.fit();
      this.scheduleMeasure();
    });
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
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.scheduleFit);
    window.removeEventListener('keydown', this.onKeydown);
  },
  methods: {
    // ─── Selection ──────────────────────────────────────────────────────
    // Keep a valid pinned selection, else auto-select the first group so the
    // details panel always has content.
    ensureSelection(): void {
      const current = this.groups.find((g) => g.cardName === this.selectedKey);
      if (current === undefined) {
        setEffectSelection(this.groups[0]?.cardName);
      }
    },
    onNameHover(payload: {name: CardName} | null): void {
      this.hoverKey = payload === null ? undefined : payload.name;
    },
    // A click on an effect block PINS it (the panel's ⤢ is the fullscreen path).
    onPin(name: CardName): void {
      setEffectSelection(name);
    },
    openFullscreen(name: CardName): void {
      this.zoomCard = this.tableauByName.get(name) ?? ({name} as CardModel);
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    // ─── Stats fetch (whole-game per-player aggregate, bounded + cached) ──
    statForGroup(cardName: CardName | undefined): EffectOverlayStat | undefined {
      if (cardName === undefined) {
        return undefined;
      }
      return getEffectStats(this.displayedPlayer.color)?.find((s) => s.card === cardName);
    },
    fetchStats(): void {
      // No id (playground) or no fetch (JSDOM) → the panel still shows the base
      // rule + thematic notes (no per-game numbers).
      if (this.viewerId === '' || typeof fetch !== 'function') {
        return;
      }
      const color = this.displayedPlayer.color;
      if (getEffectStats(color) !== undefined) {
        return; // already cached for this scope
      }
      this.loadingStats = true;
      const url = paths.API_GAME_EFFECT_STATS +
        '?id=' + encodeURIComponent(this.viewerId) +
        '&color=' + encodeURIComponent(color);
      const scope = effectsOverlayState.statsScope;
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((s) => {
          if (s !== undefined) {
            setEffectStats(color, s as ReadonlyArray<EffectOverlayStat>, scope);
          }
        })
        .catch(() => { /* best-effort: the panel falls back to base rule + notes */ })
        .finally(() => {
          this.loadingStats = false;
          nextTick(() => this.scheduleMeasure());
        });
    },
    // ─── Adaptive fit: a compact master grid + a static detail column ─────
    fit(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      const grid = this.$refs.grid as HTMLElement | undefined;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const availW = clamp(window.innerWidth - SIDE_MARGIN, MIN_W, FIT_MAX_W);
      const n = this.groups.length;
      if (grid === undefined || n === 0) {
        root?.style.setProperty('--effects-overlay-width', String(MIN_W) + 'px');
        return;
      }
      const masterAvail = availW - BODY_PAD_X - DETAIL_W - SPLIT_GAP;
      const colsByWidth = Math.max(1, Math.floor((masterAvail + GAP) / (MASTER_COL_MIN + GAP)));
      const cols = clamp(Math.min(n, colsByWidth), 1, MAX_COLS);
      const comfortable = cols * MASTER_COL_MAX + (cols - 1) * GAP;
      const masterW = Math.min(masterAvail, comfortable);
      const overlayW = clamp(masterW + DETAIL_W + SPLIT_GAP + BODY_PAD_X, MIN_W, FIT_MAX_W);
      this.cols = cols;
      root?.style.setProperty('--effects-overlay-width', Math.round(overlayW) + 'px');
      grid.style.setProperty('--effects-master-cols', String(cols));
      root?.style.setProperty('--detail-width', DETAIL_W + 'px');
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
    // Measure the TALLEST detail (the hidden card-less probes) and set the split
    // min-height to it, so the overlay opens where no detail scrolls.
    measureDetailHeight(): void {
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
      const cap = Math.max(360, Math.floor(window.innerHeight * 0.82) - 150);
      root.style.setProperty('--effects-detail-min-h', Math.min(maxH, cap) + 'px');
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
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        if (this.zoomCard !== undefined) {
          this.zoomCard = undefined;
        } else {
          this.$emit('close');
        }
        return;
      }
      const keys = this.groups.map((g) => g.cardName);
      if (keys.length === 0) {
        return;
      }
      const cur = this.selectedKey === undefined ? -1 : keys.indexOf(this.selectedKey);
      const perCol = Math.max(1, Math.ceil(keys.length / Math.max(1, this.cols)));
      let next = cur;
      switch (e.key) {
      case 'ArrowDown': next = cur + 1; break;
      case 'ArrowUp': next = cur - 1; break;
      case 'ArrowRight': next = cur + perCol; break;
      case 'ArrowLeft': next = cur - perCol; break;
      case 'Home': next = 0; break;
      case 'End': next = keys.length - 1; break;
      default: return;
      }
      next = Math.max(0, Math.min(keys.length - 1, next));
      if (next !== cur && keys[next] !== undefined) {
        this.hoverKey = undefined;
        setEffectSelection(keys[next]);
        e.preventDefault();
      }
    },
  },
});
</script>
