<template>
  <div class="con-sheet" role="dialog" :aria-label="$t(title)">
    <div class="con-sheet__backdrop" aria-hidden="true"></div>
    <div class="con-sheet__panel">
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
      <div class="con-sheet__foot">
        <span class="con-sheet__foot-item"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
        <span class="con-sheet__foot-item"><GamepadGlyph control="stickScroll" /><span>{{ $t('Scroll') }}</span></span>
        <span class="con-sheet__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Generic console bottom sheet (CONSOLE_MODE_CONCEPT.md §9) — big TV rows
 * for the bounded lists (basic actions / standard projects / card actions /
 * the hydro pick). Rows are DATA; the shell supplies them + executes A on
 * the selected available row. The selected row carries the inline Ⓐ glyph.
 *
 * P26: milestones/awards moved OFF this sheet to the dedicated premium
 * `ConsoleMaScreen` — this component is a plain list again.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {Color} from '@/common/Color';

export type ConsoleSheetRow = {
  key: string,
  /** 'header' = a non-selectable group caption (nav skips it). */
  kind?: 'header',
  /** Icon CSS class (e.g. a std-icon pictogram) — premium rows are never bare text. */
  icon?: string,
  /** English i18n key (or literal already-translated text). */
  title: string,
  /** Rule / effect description (translated via v-i18n). */
  sub?: string,
  /** Cost / progress annotation (already formatted). */
  meta?: string,
  available: boolean,
  /** English i18n key ('' → no line). */
  reason?: string,
  takenBy?: {color: Color, name: string},
};

export default defineComponent({
  name: 'ConsoleSheet',
  components: {ConsoleScrollArea, GamepadGlyph},
  props: {
    title: {type: String, required: true},
    rows: {type: Array as PropType<ReadonlyArray<ConsoleSheetRow>>, required: true},
    index: {type: Number, required: true},
  },
  watch: {
    /** D-pad navigation keeps the selected row visible (auto-scroll). */
    index() {
      void this.$nextTick(() => {
        const slot = this.$refs.selectedRow as HTMLElement | Array<HTMLElement> | undefined;
        const el = Array.isArray(slot) ? slot[0] : slot;
        // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
        (this.$refs.rows as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(el);
      });
    },
    /** A tab/sheet switch resets the list to the top. */
    title() {
      (this.$refs.rows as {scrollToStart?: () => void} | undefined)?.scrollToStart?.();
    },
  },
});
</script>
