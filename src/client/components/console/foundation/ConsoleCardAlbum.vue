<template>
  <!-- THE CARD ALBUM — host-agnostic (P87): strict pages solved from the BOX + the profile grid by the hand's own
       planner (`consoleHandAlbum.ts` — never from the card count), one page in the viewport, the strip slid one stride
       by transform, the ONE cursor grammar on the focused slot, a CHOSEN card standing in its own slot with a kant and
       its band (nothing leaves the album before the host commits). The page is DERIVED from `index` — no second page
       state exists. Geometry is the chassis' (`console_card_album.less` — the same mixins the hand applies), so a hand
       laid out here and in «Карты в руке» on the same box is the same plan.

       The HOST owns: the entries (+ their states), the focus index, the band words, the input (it steps the index with
       `step()` / `jumpPage()` and turns pages through the same verbs), and every flight (`slotEl()` names the live slot
       a card visually lives in). -->
  <div class="con-album" ref="album" @scroll.passive="pinScroll" :style="rootStyle">
    <div class="con-album__strip"
         :class="{'con-album__strip--live': motionLive, 'con-album__strip--turning': turning}"
         :style="stripStyle"
         @transitionend.self="onStripSettled">
      <div v-for="p in renderPages"
           :key="'page' + p"
           class="con-album__page"
           :style="pageStyle(p)">
        <div v-for="(row, ri) in pageRows(p)"
             :key="ri"
             class="con-album__row"
             :style="pageRowStyle(p)">
          <div v-for="cell in row"
               :key="cell.e.name"
               class="con-album__slot"
               :data-zoom-slot="cell.e.name"
               :data-album-slot="cell.e.name"
               :data-album-picked="cell.e.picked ? 'true' : undefined"
               :class="{
                 'con-album__slot--selected': cell.gi === index,
                 'con-album__slot--picked': cell.e.picked === true,
                 'con-album__slot--disabled': cell.e.disabled === true,
                 'con-album__slot--held': heldNames.includes(cell.e.name),
               }"
               @click="$emit('pick', cell.gi)">
            <Card :card="cell.e.card" :key="cell.e.name" :art-tier="artTier" lightweight :inert="true" />
            <span v-if="cell.e.band !== undefined" class="con-cards__pickband con-album__band"
                  :data-album-band="cell.e.name" aria-hidden="true">{{ cell.e.band }}</span>
            <span v-else-if="cell.e.disabled === true && cell.e.reason !== undefined" class="con-album__chip" aria-hidden="true">{{ cell.e.reason }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, markRaw, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardModel} from '@/common/models/CardModel';
import {artTierForWidth, CardArtTier} from '@/client/cards/cardArt';
import {
  AlbumPagePlan, AlbumSpec, albumSpecFor, HandAlbumPlan, HandNavDir, pageJumpIndex, pageOfIndex, pageRowsFor, planAlbumPage,
  planHandAlbum, stepHandAlbum,
} from '@/client/components/console/consoleHandAlbum';
import {albumLayoutState} from '@/client/console/consoleAlbumLayout';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';

/** One card of the album, with the states the host decided. */
export type CardAlbumEntry = {
  /** The identity (unique within the album). */
  name: string,
  card: CardModel,
  /** Chosen — the kant + the band stand in place. */
  picked?: boolean,
  /** The band's words (a chosen card's ordinal line). Absent: no band. */
  band?: string,
  /** Cannot be chosen (a reason chip names why). */
  disabled?: boolean,
  reason?: string,
};

/** The page position the host's spine reads. */
export type CardAlbumPosition = {page: number, pages: number, canPrev: boolean, canNext: boolean};

type AlbumCell = {e: CardAlbumEntry, gi: number};

/** The box before the first measure — the hand's own fallback (one planner, one fallback). */
const FALLBACK_W = 1280;
const FALLBACK_H = 560;
/** Safety release of the `--turning` will-change class. */
const TURN_SAFETY_MS = 420;

/**
 * @console-shared LIVE — the host-agnostic card album (P87; contract `docs/claude/console/card-album.md`).
 */
export default defineComponent({
  name: 'ConsoleCardAlbum',
  components: {Card},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<CardAlbumEntry>>, required: true},
    /** The focused entry — the page is derived from it. */
    index: {type: Number, required: true},
    /** Names whose slot face is withheld (a flight owns the card right now). */
    heldNames: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  },
  emits: ['pick', 'position'],
  data() {
    return {
      layout: consoleLayoutState,
      albumLayout: albumLayoutState,
      box: {w: 0, h: 0},
      motionLive: false,
      turning: false,
      settledPage: 0,
      turnSafety: undefined as number | undefined,
      ro: undefined as ResizeObserver | undefined,
      rafMeasure: undefined as number | undefined,
    };
  },
  computed: {
    spec(): AlbumSpec {
      return albumSpecFor(this.layout.profile, this.albumLayout.layout);
    },
    /** THE BACKBONE PLAN — the hand's `plan` byte for byte (capacity, the standard card, the stride). */
    plan(): HandAlbumPlan {
      return planHandAlbum({
        availW: this.box.w > 0 ? this.box.w : FALLBACK_W,
        availH: this.box.h > 0 ? this.box.h : FALLBACK_H,
        count: this.entries.length,
        spec: this.spec,
        uiScale: conUiScale(),
      });
    },
    activePage(): number {
      const clamped = Math.max(0, Math.min(Math.max(0, this.entries.length - 1), this.index));
      return Math.min(this.plan.pageCount - 1, pageOfIndex(clamped, this.plan.perPage));
    },
    /** The active page ± 1, plus the last settled page's neighbourhood — a sliding page never unmounts mid-turn. */
    renderPages(): Array<number> {
      if (this.entries.length === 0) {
        return [];
      }
      const last = this.plan.pageCount - 1;
      const keep = new Set<number>();
      for (const centre of [this.activePage, Math.min(last, this.settledPage)]) {
        for (let p = Math.max(0, centre - 1); p <= Math.min(last, centre + 1); p++) {
          keep.add(p);
        }
      }
      return [...keep].sort((a, b) => a - b);
    },
    rootStyle(): Record<string, string> {
      return {'--con-hand-zoom': String(this.plan.cardZoom)};
    },
    artTier(): CardArtTier {
      return artTierForWidth(this.plan.slotW);
    },
    stripStyle(): Record<string, string> {
      return {transform: `translateX(${-this.activePage * this.plan.stride}px)`};
    },
    position(): CardAlbumPosition {
      const pages = this.plan.pageCount;
      return {page: this.activePage + 1, pages, canPrev: this.activePage > 0, canNext: this.activePage < pages - 1};
    },
  },
  watch: {
    activePage(now: number) {
      if (!this.motionLive) {
        this.settledPage = now;
        return;
      }
      this.turning = true;
      if (this.turnSafety !== undefined) {
        window.clearTimeout(this.turnSafety);
      }
      this.turnSafety = window.setTimeout(() => {
        this.turning = false;
        this.settledPage = this.activePage;
        this.turnSafety = undefined;
      }, TURN_SAFETY_MS);
    },
    position: {
      immediate: true,
      handler(now: CardAlbumPosition) {
        this.$emit('position', now);
      },
    },
  },
  mounted() {
    const album = (this.$refs.album ?? undefined) as HTMLElement | undefined;
    if (album !== undefined && typeof ResizeObserver !== 'undefined') {
      this.ro = markRaw(new ResizeObserver(() => this.scheduleMeasure()));
      this.ro.observe(album);
    }
    this.measure();
    this.settledPage = this.activePage;
    // The slide arms only after the first paint settled: a fresh open lands ON its page, it never slides there.
    void this.$nextTick(() => requestAnimationFrame(() => {
      this.motionLive = true;
    }));
  },
  beforeUnmount() {
    this.ro?.disconnect();
    if (this.rafMeasure !== undefined) {
      cancelAnimationFrame(this.rafMeasure);
    }
    if (this.turnSafety !== undefined) {
      window.clearTimeout(this.turnSafety);
    }
  },
  methods: {
    pagePlanFor(page: number): AlbumPagePlan {
      const start = page * this.plan.perPage;
      const n = Math.max(0, Math.min(this.entries.length - start, this.plan.perPage));
      return planAlbumPage({
        availW: this.box.w > 0 ? this.box.w : FALLBACK_W,
        availH: this.box.h > 0 ? this.box.h : FALLBACK_H,
        count: n,
        spec: this.spec,
        uiScale: conUiScale(),
      }, n, this.plan);
    },
    pageRows(page: number): Array<Array<AlbumCell>> {
      const start = page * this.plan.perPage;
      const slice = this.entries.slice(start, start + this.plan.perPage);
      const rows: Array<Array<AlbumCell>> = [];
      let at = 0;
      for (const len of this.pagePlanFor(page).rows) {
        rows.push(slice.slice(at, at + len).map((e, ci) => ({e, gi: start + at + ci})));
        at += len;
      }
      return rows;
    },
    pageStyle(page: number): Record<string, string> {
      const pp = this.pagePlanFor(page);
      return {
        'transform': `translate(${page * this.plan.stride + pp.padX}px, ${pp.padTop}px)`,
        'width': pp.pageW + 'px',
        'rowGap': pp.gapY + 'px',
        '--con-hand-zoom': String(pp.zoom),
      };
    },
    pageRowStyle(page: number): Record<string, string> {
      const pp = this.pagePlanFor(page);
      return {height: pp.slotH + 'px', columnGap: pp.gapX + 'px'};
    },
    onStripSettled(e: TransitionEvent): void {
      if (e.propertyName !== 'transform') {
        return;
      }
      this.turning = false;
      this.settledPage = this.activePage;
      if (this.turnSafety !== undefined) {
        window.clearTimeout(this.turnSafety);
        this.turnSafety = undefined;
      }
    },
    /** The d-pad step — the hand's own walk (across the page edge IS the page turn; rows within a page). */
    step(from: number, dir: HandNavDir): number {
      const perPage = this.plan.perPage;
      const start = pageOfIndex(Math.max(0, from), perPage) * perPage;
      const rows = pageRowsFor(Math.max(0, Math.min(this.entries.length - start, perPage)), this.spec);
      return stepHandAlbum(from, dir, this.entries.length, {perPage, rows});
    },
    /** LB / RB — the same relative slot on the neighbouring page. */
    jumpPage(from: number, dir: 1 | -1): number {
      return pageJumpIndex(from, dir, this.entries.length, this.plan.perPage);
    },
    /** The live slot a card visually lives in (a flight's end, the zoom's physical origin) — null off the mounted pages. */
    slotEl(name: string): HTMLElement | null {
      const root = (this.$refs.album ?? undefined) as HTMLElement | undefined;
      if (root === undefined) {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-album-slot="${esc}"]`);
    },
    /** The card face inside a slot (what a clone flight copies). */
    faceEl(name: string): HTMLElement | null {
      return this.slotEl(name)?.querySelector<HTMLElement>(':scope > :is(.card-container, .pcard)') ?? null;
    },
    /** The names standing on the ACTIVE page, in order — what an entry deal lands into. */
    activePageNames(): Array<string> {
      const start = this.activePage * this.plan.perPage;
      return this.entries.slice(start, start + this.plan.perPage).map((e) => e.name);
    },
    /** A scroll here is always programmatic (overflow hidden, no wheel) — pin it so nothing shifts the strip. */
    pinScroll(): void {
      const album = (this.$refs.album ?? undefined) as HTMLElement | undefined;
      if (album !== undefined && (album.scrollLeft !== 0 || album.scrollTop !== 0)) {
        album.scrollLeft = 0;
        album.scrollTop = 0;
      }
    },
    measure(): void {
      const album = (this.$refs.album ?? undefined) as HTMLElement | undefined;
      if (album === undefined) {
        return;
      }
      const w = album.clientWidth;
      const h = album.clientHeight;
      if (w !== this.box.w || h !== this.box.h) {
        this.box = {w, h};
      }
    },
    scheduleMeasure(): void {
      if (this.rafMeasure !== undefined) {
        return;
      }
      this.rafMeasure = requestAnimationFrame(() => {
        this.rafMeasure = undefined;
        this.measure();
      });
    },
  },
});
</script>
