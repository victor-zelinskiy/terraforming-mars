<template>
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

<script setup lang="ts">
/*
 * THE CARD ALBUM — host-agnostic (P87): strict pages solved from the BOX + the profile grid by the hand's own
 *       planner (`consoleHandAlbum.ts` — never from the card count), one page in the viewport, the strip slid one stride
 *       by transform, the ONE cursor grammar on the focused slot, a CHOSEN card standing in its own slot with a kant and
 *       its band (nothing leaves the album before the host commits). The page is DERIVED from `index` — no second page
 *       state exists. Geometry is the chassis' (`console_card_album.less` — the same mixins the hand applies), so a hand
 *       laid out here and in «Карты в руке» on the same box is the same plan.
 *
 *       The HOST owns: the entries (+ their states), the focus index, the band words, the input (it steps the index with
 *       `step()` / `jumpPage()` and turns pages through the same verbs), and every flight (`slotEl()` names the live slot
 *       a card visually lives in).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardModel} from '@/common/models/CardModel';
import {artTierForWidth, CardArtTier} from '@/client/cards/cardArt';
import {
  AlbumPagePlan, AlbumSpec, albumSpecFor, HandAlbumPlan, HandNavDir, pageJumpIndex, pageOfIndex, pageRowsFor, planAlbumPage,
  planHandAlbum, stepHandAlbum,
} from '@/client/components/console/consoleHandAlbum';
import {albumLayoutState} from '@/client/console/consoleAlbumLayout';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {useFlowScope} from '@/client/console/session/useFlowScope';

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
defineOptions({name: 'ConsoleCardAlbum'});
const props = defineProps({
  entries: {type: Array as PropType<ReadonlyArray<CardAlbumEntry>>, required: true},
  /** The focused entry — the page is derived from it. */
  index: {type: Number, required: true},
  /** Names whose slot face is withheld (a flight owns the card right now). */
  heldNames: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
});
const emit = defineEmits(['pick', 'position']);

const flow = useFlowScope('card-album');
const album = useTemplateRef<HTMLElement>('album');
const layout = consoleLayoutState;
const albumLayout = albumLayoutState;
const box = ref({w: 0, h: 0});
const motionLive = ref(false);
const turning = ref(false);
const settledPage = ref(0);
let cancelTurnSafety = (() => {}) as () => void;
let ro: ResizeObserver | undefined;
/** A measure is scheduled for the next frame (its cancel) — `undefined` when none stands. */
let cancelMeasure: (() => void) | undefined;

const spec = computed((): AlbumSpec => {
  return albumSpecFor(layout.profile, albumLayout.layout);
});
/** THE BACKBONE PLAN — the hand's `plan` byte for byte (capacity, the standard card, the stride). */
const plan = computed((): HandAlbumPlan => {
  return planHandAlbum({
    availW: box.value.w > 0 ? box.value.w : FALLBACK_W,
    availH: box.value.h > 0 ? box.value.h : FALLBACK_H,
    count: props.entries.length,
    spec: spec.value,
    uiScale: conUiScale(),
  });
});
const activePage = computed((): number => {
  const clamped = Math.max(0, Math.min(Math.max(0, props.entries.length - 1), props.index));
  return Math.min(plan.value.pageCount - 1, pageOfIndex(clamped, plan.value.perPage));
});
/** The active page ± 1, plus the last settled page's neighbourhood — a sliding page never unmounts mid-turn. */
const renderPages = computed((): Array<number> => {
  if (props.entries.length === 0) {
    return [];
  }
  const last = plan.value.pageCount - 1;
  const keep = new Set<number>();
  for (const centre of [activePage.value, Math.min(last, settledPage.value)]) {
    for (let p = Math.max(0, centre - 1); p <= Math.min(last, centre + 1); p++) {
      keep.add(p);
    }
  }
  return [...keep].sort((a, b) => a - b);
});
const rootStyle = computed((): Record<string, string> => {
  return {'--con-hand-zoom': String(plan.value.cardZoom)};
});
const artTier = computed((): CardArtTier => {
  return artTierForWidth(plan.value.slotW);
});
const stripStyle = computed((): Record<string, string> => {
  return {transform: `translateX(${-activePage.value * plan.value.stride}px)`};
});
const position = computed((): CardAlbumPosition => {
  const pages = plan.value.pageCount;
  return {page: activePage.value + 1, pages, canPrev: activePage.value > 0, canNext: activePage.value < pages - 1};
});

function pagePlanFor(page: number): AlbumPagePlan {
  const start = page * plan.value.perPage;
  const n = Math.max(0, Math.min(props.entries.length - start, plan.value.perPage));
  return planAlbumPage({
    availW: box.value.w > 0 ? box.value.w : FALLBACK_W,
    availH: box.value.h > 0 ? box.value.h : FALLBACK_H,
    count: n,
    spec: spec.value,
    uiScale: conUiScale(),
  }, n, plan.value);
}
function pageRows(page: number): Array<Array<AlbumCell>> {
  const start = page * plan.value.perPage;
  const slice = props.entries.slice(start, start + plan.value.perPage);
  const rows: Array<Array<AlbumCell>> = [];
  let at = 0;
  for (const len of pagePlanFor(page).rows) {
    rows.push(slice.slice(at, at + len).map((e, ci) => ({e, gi: start + at + ci})));
    at += len;
  }
  return rows;
}
function pageStyle(page: number): Record<string, string> {
  const pp = pagePlanFor(page);
  return {
    'transform': `translate(${page * plan.value.stride + pp.padX}px, ${pp.padTop}px)`,
    'width': pp.pageW + 'px',
    'rowGap': pp.gapY + 'px',
    '--con-hand-zoom': String(pp.zoom),
  };
}
function pageRowStyle(page: number): Record<string, string> {
  const pp = pagePlanFor(page);
  return {height: pp.slotH + 'px', columnGap: pp.gapX + 'px'};
}
function onStripSettled(e: TransitionEvent): void {
  if (e.propertyName !== 'transform') {
    return;
  }
  turning.value = false;
  settledPage.value = activePage.value;
  cancelTurnSafety();
}
/** The d-pad step — the hand's own walk (across the page edge IS the page turn; rows within a page). */
function step(from: number, dir: HandNavDir): number {
  const perPage = plan.value.perPage;
  const start = pageOfIndex(Math.max(0, from), perPage) * perPage;
  const rows = pageRowsFor(Math.max(0, Math.min(props.entries.length - start, perPage)), spec.value);
  return stepHandAlbum(from, dir, props.entries.length, {perPage, rows});
}
/** LB / RB — the same relative slot on the neighbouring page. */
function jumpPage(from: number, dir: 1 | -1): number {
  return pageJumpIndex(from, dir, props.entries.length, plan.value.perPage);
}
/** The live slot a card visually lives in (a flight's end, the zoom's physical origin) — null off the mounted pages. */
function slotEl(name: string): HTMLElement | null {
  const root = album.value ?? undefined;
  if (root === undefined) {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  return root.querySelector<HTMLElement>(`[data-album-slot="${esc}"]`);
}
/** The card face inside a slot (what a clone flight copies). */
function faceEl(name: string): HTMLElement | null {
  return slotEl(name)?.querySelector<HTMLElement>(':scope > :is(.card-container, .pcard)') ?? null;
}
/** The names standing on the ACTIVE page, in order — what an entry deal lands into. */
function activePageNames(): Array<string> {
  const start = activePage.value * plan.value.perPage;
  return props.entries.slice(start, start + plan.value.perPage).map((e) => e.name);
}
/** A scroll here is always programmatic (overflow hidden, no wheel) — pin it so nothing shifts the strip. */
function pinScroll(): void {
  const albumNow = album.value ?? undefined;
  if (albumNow !== undefined && (albumNow.scrollLeft !== 0 || albumNow.scrollTop !== 0)) {
    albumNow.scrollLeft = 0;
    albumNow.scrollTop = 0;
  }
}
function measure(): void {
  const albumNow = album.value ?? undefined;
  if (albumNow === undefined) {
    return;
  }
  const w = albumNow.clientWidth;
  const h = albumNow.clientHeight;
  if (w !== box.value.w || h !== box.value.h) {
    box.value = {w, h};
  }
}
function scheduleMeasure(): void {
  if (cancelMeasure !== undefined) {
    return;
  }
  cancelMeasure = flow.afterFrame('the album is re-measured', () => {
    cancelMeasure = undefined;
    measure();
  });
}

watch(() => activePage.value, (now: number) => {
  if (!motionLive.value) {
    settledPage.value = now;
    return;
  }
  turning.value = true;
  cancelTurnSafety();
  cancelTurnSafety = flow.after(TURN_SAFETY_MS, 'the page turn\'s safety release', () => {
    turning.value = false;
    settledPage.value = activePage.value;
  });
});
watch(() => position.value, (now: CardAlbumPosition) => {
  emit('position', now);
}, {immediate: true});

onMounted(() => {
  const albumNow = album.value ?? undefined;
  if (albumNow !== undefined && typeof ResizeObserver !== 'undefined') {
    ro = markRaw(new ResizeObserver(() => scheduleMeasure()));
    ro.observe(albumNow);
  }
  measure();
  settledPage.value = activePage.value;
  // The slide arms only after the first paint settled: a fresh open lands ON its page, it never slides there.
  void nextTick(() => flow.afterFrame('the first paint settles', () => {
    motionLive.value = true;
  }));
});
onBeforeUnmount(() => {
  ro?.disconnect();
});
defineExpose({activePageNames, faceEl, jumpPage, slotEl, step});
</script>
