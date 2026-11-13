<template>
  <span class="con-handdock__pager con-album-spine"
        :class="{
          'con-album-spine--foot': variant === 'foot',
          'con-handdock__pager--single': album.pages <= 1,
          'con-handdock__pager--held': held,
          'con-handdock__pager--fired-next': pageFlash === 'next',
          'con-handdock__pager--fired-prev': pageFlash === 'prev',
        }"
        data-album-spine>
    <span class="con-handdock__pager-well" aria-hidden="true"></span>
    <button type="button" tabindex="-1"
            class="con-handdock__pager-side con-handdock__pager-side--prev"
            :class="{'con-handdock__pager-side--off': !album.canPrev}"
            @click.stop="onPage(-1)">
      <GamepadGlyph control="bumperL" />
      <span class="con-handdock__pager-arrow" aria-hidden="true">‹</span>
    </button>
    <span class="con-handdock__pager-pos">
      <!-- The POSITION: the current page is the line's loudest voice, the total a calm companion. Both cells are
           fixed-width, so 1/4 → 10/12 never moves the centre; the current number swaps DIRECTIONALLY. -->
      <span class="con-handdock__pager-now" :class="`con-handdock__pager-now--${turnDir}`">
        <b :key="album.page">{{ album.page }}</b>
      </span>
      <span class="con-handdock__pager-slash" aria-hidden="true">/</span>
      <span class="con-handdock__pager-total">{{ album.pages }}</span>
    </span>
    <button type="button" tabindex="-1"
            class="con-handdock__pager-side con-handdock__pager-side--next"
            :class="{'con-handdock__pager-side--off': !album.canNext}"
            @click.stop="onPage(1)">
      <span class="con-handdock__pager-arrow" aria-hidden="true">›</span>
      <GamepadGlyph control="bumperR" />
    </button>
    <!-- The PROGRESS hairline: segmented while the segments stay legible, one continuous fill past that. Absolute —
         it can never grow the instrument. -->
    <span v-if="album.pages > 1" class="con-handdock__pager-track" aria-hidden="true">
      <template v-if="album.pages <= 8">
        <span v-for="p in album.pages" :key="p"
              class="con-handdock__pager-seg"
              :class="{
                'con-handdock__pager-seg--on': p === album.page,
                'con-handdock__pager-seg--past': p < album.page,
              }"></span>
      </template>
      <span v-else class="con-handdock__pager-bar">
        <span class="con-handdock__pager-bar-fill" :style="progressStyle"></span>
      </span>
    </span>
  </span>
</template>

<script setup lang="ts">
/*
 * THE ALBUM SPINE — the ONE place an album's page position renders: «LB ‹ 2 / 4 › RB» seated in a chamfered
 * instrument well, a progress hairline under the numbers. Extracted from the hand dock's bay (P87) so every album
 * surface carries the SAME instrument: the hand's dock seats it in its plate, «Наследие проектов» in its own foot.
 * The class tree is the dock's (`con-handdock__pager*`) on purpose — one LESS, one look; the variant only positions
 * it. A direction with no page that way mutes IN PLACE (never hidden — the shape is constant); an actual page change
 * fires the side chip of its direction once.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType, ref, watch} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import type {AlbumSpinePosition} from '@/client/components/console/foundation/consoleAlbumSpineTypes';
import {useFlowScope} from '@/client/console/session/useFlowScope';

export type {AlbumSpinePosition};


/**
 * @console-shared LIVE — the album spine (P87). Hosts: `ConsoleHandDock` (the bay, variant `dock`) and
 * `ConsoleCarryoverPicker` (the stage's foot, variant `foot`).
 */
defineOptions({name: 'ConsoleAlbumSpine'});
const props = defineProps({
  album: {type: Object as PropType<AlbumSpinePosition>, required: true},
  /** Held transparent + pointer-inert (a reveal episode is airborne). */
  held: {type: Boolean, default: false},
  /** Where it is seated: the dock's plate (absolute, centred) or a surface's foot (in flow). */
  variant: {type: String as PropType<'dock' | 'foot'>, default: 'dock'},
});
const emit = defineEmits(['page']);

const flow = useFlowScope('album-spine');
/** Which way the last page turn went — the number enters from the opposite side. */
const turnDir = ref<'next' | 'prev'>('next');
/** An ACTUAL page change just landed — the side chip of its direction fires once. */
const pageFlash = ref<'next' | 'prev' | undefined>(undefined);
let cancelPageFlash: () => void = () => {};
/** The continuous progress fill (many-page albums). */
const progressStyle = computed((): Record<string, string> => {
  const a = props.album;
  return a.pages <= 1 ? {width: '0%'} : {width: `${(a.page / a.pages) * 100}%`};
});
/** A side clicked — the host turns the page. A muted side still swallows the click (the edge is felt). */
function onPage(dir: 1 | -1): void {
  if (dir === 1 ? props.album.canNext : props.album.canPrev) {
    emit('page', dir);
  }
}

/** The DIRECTION of a page change for the number's swap + the matching side chip, once (an availability re-derive
 *  without a page move fires nothing). */
watch(() => props.album.page, (now: number, was: number) => {
  if (now === was) {
    return;
  }
  turnDir.value = now > was ? 'next' : 'prev';
  pageFlash.value = turnDir.value;
  cancelPageFlash();
  cancelPageFlash = flow.after(motionMs(300), 'the page chip\'s flash reads', () => {
    pageFlash.value = undefined;
  });
});
</script>
