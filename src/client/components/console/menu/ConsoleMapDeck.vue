<template>
  <!-- THE MAP SHOWCASE (P44 · ledger ER — the owner: «сетка, а не ряд»): the «Карта» deck on the grammar of «Мои
       партии» — a GRID SOLVED FROM THE MEASURED STAGE (`mapGridPlan`: 4 × 3 for the eleven maps on the TV and FHD, strict
       PAGES on the Deck), the cursor inside the stage BY CONSTRUCTION (no clip, no transform carousel), the d-pad the
       lobby's (`showcaseStep`: ◀ ▶ the ring, ▲ ▼ a row with a wall). A tile is the board's fingerprint + its name (the
       loudest voice) + its state in MATERIAL: «ТЕКУЩАЯ» a gold kant, «ФАН» a fan-made board, the MarsBot mark BEFORE the
       pick (a board the seated bot cannot play recedes with its reason — never a red ring after A). The DOSSIER of the
       cursored map stands beside the grid on the wide creator (the hero fingerprint with its bonus legend, the
       description, the chips, the bot's blocker in words); the Deck keeps one detail line under the grid. -->
  <div class="cm-deckbody cm-maps cm-maps--grid" :class="{'cm-maps--wide': wide}" ref="stageEl"
       data-map-showcase :data-map-cols="plan.cols" :data-map-rows="plan.rows" :data-map-pages="plan.pages">
    <div class="cm-maps__stage" ref="gridEl">
      <div class="cm-maps__grid" :style="gridStyle">
        <button
          v-for="tile in pageTiles"
          :key="tile.row.meta.id"
          type="button"
          class="cm-map"
          :class="{
            'cm-map--cursor': tile.index === cursor,
            'cm-row--shake': tile.index === shakeRow,
            'cm-map--selected': tile.row.selected,
            'cm-map--conflict': tile.row.conflict,
            'cm-map--botless': botBlocked(tile.row),
          }"
          :style="{'--map-accent': tile.row.meta.accent}"
          :data-map-tile="tile.row.meta.id"
          :data-map-index="tile.index"
          @click="$emit('activate', tile.index)"
          @mousemove="$emit('hover', tile.index)"
        >
          <span class="cm-map__thumb">
            <premium-map-fingerprint :map-id="boardId(tile.row.meta)" :random="tile.row.meta.random" :accent="tile.row.meta.accent" variant="card" />
          </span>
          <span class="cm-map__name">{{ $t(tile.row.meta.labelKey) }}</span>
          <span class="cm-map__chips">
            <span v-if="tile.row.selected" class="cm-map__chip cm-map__chip--current" data-map-current>{{ $t('Current map') }}</span>
            <span v-if="tile.row.meta.fan === true" class="cm-map__chip cm-map__chip--fan" data-map-fan>{{ $t('Fan map') }}</span>
            <span v-if="botMark(tile.row) !== undefined" class="cm-map__chip cm-map__chip--bot"
                  :class="{'cm-map__chip--botno': botMark(tile.row) === 'no'}" :data-map-bot="botMark(tile.row)">
              {{ $t('MarsBot') }} {{ botMark(tile.row) === 'yes' ? '✓' : '—' }}
            </span>
          </span>
        </button>
      </div>
      <div v-if="plan.pages > 1" class="cm-maps__spine" data-map-spine>{{ page + 1 }} / {{ plan.pages }}</div>
    </div>

    <!-- THE DOSSIER of the cursored map — wide creator only (the Deck reads the detail line below). -->
    <aside v-if="wide && cursorRow !== undefined" class="cm-maps__dossier" data-map-dossier :data-map-dossier-id="cursorRow.meta.id">
      <span class="cm-maps__dossier-map">
        <premium-map-fingerprint :map-id="boardId(cursorRow.meta)" :random="cursorRow.meta.random" :accent="cursorRow.meta.accent" variant="hero" />
      </span>
      <span class="cm-maps__dossier-name">{{ $t(cursorRow.meta.labelKey) }}</span>
      <span class="cm-maps__dossier-desc">{{ $t(descKeyFor(cursorRow)) }}</span>
      <span class="cm-map__chips">
        <span v-if="cursorRow.selected" class="cm-map__chip cm-map__chip--current">{{ $t('Current map') }}</span>
        <span v-if="cursorRow.meta.fan === true" class="cm-map__chip cm-map__chip--fan">{{ $t('Fan map') }}</span>
        <span v-if="botMark(cursorRow) !== undefined" class="cm-map__chip cm-map__chip--bot" :class="{'cm-map__chip--botno': botMark(cursorRow) === 'no'}">
          {{ $t('MarsBot') }} {{ botMark(cursorRow) === 'yes' ? '✓' : '—' }}
        </span>
      </span>
      <span v-if="botBlocked(cursorRow)" class="cm-row__issue" data-map-blocker>{{ $t(boardBlocker) }}</span>
    </aside>
    <div v-else class="cm-maps__detail">
      <span v-if="cursorRow !== undefined && botBlocked(cursorRow)" class="cm-row__issue" data-map-blocker>{{ $t(boardBlocker) }}</span>
      <template v-else-if="cursorRow !== undefined">
        <span class="cm-maps__detail-name">{{ $t(cursorRow.meta.labelKey) }}</span>
        <span class="cm-maps__detail-desc">{{ $t(descKeyFor(cursorRow)) }}</span>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * MAP deck renderer (console create) — the SHOWCASE GRID (P44 · ledger ER). The plan is solved from the stage's own
 * measured box (`mapGridPlan`) on every resize and published UP (`layout` — the cursor's walk needs the columns); the
 * page shown is DERIVED from the cursor (no second page state). Pure presentation: the selection, the conflicts and
 * the persistence stay the model's (`consoleCreateModel.mapRows` / `selectMap`).
 */
import {defineComponent, PropType} from 'vue';
import {MapRow} from '@/client/console/menu/consoleCreateModel';
import {automaBlockerText, botSeatedInState} from '@/client/components/create/premium/createGameState';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {PremiumMapMeta} from '@/client/components/create/premium/createGameMeta';
import {BoardName} from '@/common/boards/BoardName';
import {AUTOMA_SUPPORTED_BOARDS} from '@/common/automa/automaCompatibility';
import {mapGridPlan, MapGridPlan} from '@/client/console/menu/lobbyCardModel';

/** The tile's proportions in rem — the fingerprint's own aspect, the name + chips under it. */
const TILE_MIN_REM = 9.5;
const TILE_MAX_REM = 17;
const TILE_GAP_REM = 1;
const TILE_ASPECT = 0.62;
const TILE_CHROME_REM = 6;

export default defineComponent({
  name: 'ConsoleMapDeck',
  components: {PremiumMapFingerprint},
  props: {
    rows: {type: Array as PropType<ReadonlyArray<MapRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
    /** The wide creator (`CREATE_WIDE_MIN_WIDTH`): the dossier stands beside the grid. */
    wide: {type: Boolean, default: false},
  },
  emits: ['activate', 'hover', 'layout'],
  data() {
    return {
      stageW: 0,
      stageH: 0,
      remPx: 16,
      observer: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    cursorRow(): MapRow | undefined {
      return this.rows[this.cursor];
    },
    boardBlocker(): string {
      return automaBlockerText('board');
    },
    plan(): MapGridPlan {
      const r = this.remPx;
      return mapGridPlan(this.stageW, this.stageH, this.rows.length, {
        gap: TILE_GAP_REM * r, minW: TILE_MIN_REM * r, maxW: TILE_MAX_REM * r, aspect: TILE_ASPECT, chromeH: TILE_CHROME_REM * r,
      });
    },
    page(): number {
      return Math.floor(Math.max(0, this.cursor) / Math.max(1, this.plan.perPage));
    },
    pageTiles(): ReadonlyArray<{row: MapRow, index: number}> {
      const start = this.page * this.plan.perPage;
      return this.rows.slice(start, start + this.plan.perPage).map((row, i) => ({row, index: start + i}));
    },
    gridStyle(): Record<string, string> {
      if (this.stageW <= 0) {
        return {};
      }
      return {
        'gridTemplateColumns': `repeat(${this.plan.cols}, ${this.plan.tileW}px)`,
        'gridAutoRows': `${this.plan.tileH}px`,
        '--cm-map-tile-w': `${this.plan.tileW}px`,
      };
    },
  },
  watch: {
    'plan.cols': {
      immediate: true,
      handler(cols: number): void {
        this.$emit('layout', {cols, perPage: this.plan.perPage});
      },
    },
  },
  mounted(): void {
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.measure());
      const el = this.$refs.gridEl as HTMLElement | undefined;
      if (el !== undefined) {
        this.observer.observe(el);
      }
    }
  },
  beforeUnmount(): void {
    this.observer?.disconnect();
  },
  methods: {
    measure(): void {
      const el = this.$refs.gridEl as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      this.remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // The page spine's own row is reserved out of the height (a page count can never push a tile off the stage).
      const spine = 2.2 * this.remPx;
      this.stageW = el.clientWidth;
      this.stageH = Math.max(0, el.clientHeight - spine);
    },
    boardId(meta: PremiumMapMeta): BoardName | undefined {
      return meta.random ? undefined : meta.id as BoardName;
    },
    /** The MarsBot mark BEFORE the pick — only while the bot is seated (`yes` its board exists, `no` it has none). */
    botMark(row: MapRow): 'yes' | 'no' | undefined {
      if (!botSeatedInState() || row.meta.random) {
        return undefined;
      }
      return AUTOMA_SUPPORTED_BOARDS.includes(row.meta.id as BoardName) ? 'yes' : 'no';
    },
    /** A board the seated bot cannot play — it recedes with its reason (and the SELECTED one is the model's conflict). */
    botBlocked(row: MapRow): boolean {
      return row.conflict || this.botMark(row) === 'no';
    },
    descKeyFor(row: MapRow): string {
      // With MarsBot seated the random pool narrows to the boards the bot has
      // an adaptation for — say so instead of the generic rotation line.
      if (row.meta.id === 'random-all' && botSeatedInState()) {
        return 'One of the maps adapted for MarsBot will be chosen at game start.';
      }
      return row.meta.descKey;
    },
  },
});
</script>
