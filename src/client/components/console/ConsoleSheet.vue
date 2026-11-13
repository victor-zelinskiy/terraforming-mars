<template>
  <div class="con-sheet con-ws" role="dialog" :aria-label="$t(title)" data-motion-surface="sheet">
    <div class="con-sheet__backdrop" aria-hidden="true"></div>
    <div class="con-sheet__panel" data-motion-panel>
      <div class="con-sheet__head">
        <div class="con-sheet__title">{{ $t(title) }}</div>
      </div>
      <ConsoleScrollArea class="con-sheet__scroll-host" content-class="con-sheet__rows" ref="rows">
        <template v-for="(row, i) in rows" :key="row.key">
          <div v-if="row.kind === 'header'" class="con-sheet__group">{{ $t(row.title) }}</div>

          <div v-else
               class="con-sheet__row"
               :class="{'con-sheet__row--selected': i === index, 'con-sheet__row--disabled': !row.available}"
               :ref="i === index ? 'selectedRow' : undefined">
            <div class="con-sheet__row-main">
              <i v-if="row.icon" class="con-sheet__row-icon" :class="row.icon" aria-hidden="true"></i>
              <span class="con-sheet__row-title">{{ $t(row.title) }}</span>
              <span v-if="row.meta" class="con-sheet__row-meta">{{ row.meta }}</span>
              <span v-if="row.takenBy !== undefined" class="con-sheet__row-taken">
                <span :class="'con-status__dot player_bg_color_' + row.takenBy.color"></span>
                {{ row.takenBy.name }}
              </span>
              <GamepadGlyph v-if="row.available && i === index" control="confirm" class="con-sheet__a" />
            </div>
            <div v-if="row.sub" class="con-sheet__row-sub" v-i18n>{{ row.sub }}</div>
            <div v-if="!row.available && row.reason" class="con-sheet__row-reason">{{ $t(row.reason) }}</div>
          </div>
        </template>
      </ConsoleScrollArea>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * data-motion-*: the director animates the panel (its authored
 *       rise-from-the-bar-band entry is re-expressed in GSAP); the OWN light
 *       0.6 dim stays by design (NON_SHADE_OWNERS).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * Generic console bottom sheet (docs/CONSOLE_MODE_CONCEPT.md §9) — big TV rows
 * for the bounded lists (basic actions / standard projects / card actions /
 * the hydro pick). Rows are DATA; the shell supplies them + executes A on
 * the selected available row. The selected row carries the inline Ⓐ glyph.
 *
 * P26: milestones/awards moved OFF this sheet to the dedicated premium
 * `ConsoleMaScreen` — this component is a plain list again.
 */
import {nextTick, PropType, useTemplateRef, watch} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import type {ConsoleSheetRow} from '@/client/components/console/consoleSheetTypes';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

export type {ConsoleSheetRow};

defineOptions({name: 'ConsoleSheet'});
const props = defineProps({
  title: {type: String, required: true},
  rows: {type: Array as PropType<ReadonlyArray<ConsoleSheetRow>>, required: true},
  index: {type: Number, required: true},
});

const selectedRow = useTemplateRef<HTMLElement | Array<HTMLElement>>('selectedRow');
const rowsEl = useTemplateRef<{ensureVisible?: (el: Element | null | undefined) => void} & {scrollToStart?: () => void}>('rows');

/** D-pad navigation keeps the selected row visible (auto-scroll). */
watch(() => props.index, () => {
  void nextTick(() => {
    const slot = selectedRow.value ?? undefined;
    const el = Array.isArray(slot) ? slot[0] : slot;
    // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
    rowsEl.value?.ensureVisible?.(el);
  });
});
/** A tab/sheet switch resets the list to the top. */
watch(() => props.title, () => {
  rowsEl.value?.scrollToStart?.();
});
</script>
