<template>
  <div class="con-wheel" role="dialog" :aria-label="$t('Categories')">
    <div class="con-wheel__backdrop" aria-hidden="true"></div>
    <div class="con-wheel__ring">
      <div v-for="(entry, i) in entries"
           :key="entry.id"
           class="con-wheel__sector"
           :class="{'con-wheel__sector--selected': i === index, 'con-wheel__sector--disabled': !entry.available}"
           :style="sectorStyle(i)">
        <span class="con-wheel__sector-icon" aria-hidden="true">
          <BarButtonIcon v-if="entry.barIcon !== undefined" :name="entry.barIcon" />
          <span v-else class="con-wheel__sector-glyph">{{ entry.glyph }}</span>
        </span>
        <span class="con-wheel__sector-label">{{ $t(entry.label) }}</span>
        <!-- The DIRECT hotkey — every sector is one press away, no aiming. -->
        <GamepadGlyph v-if="entry.shortcut !== undefined" :control="entry.shortcut" class="con-wheel__sector-key" />
        <span v-if="entry.badge !== undefined && entry.badge > 0" class="con-wheel__sector-badge">{{ entry.badge }}</span>
      </div>

      <!-- Hub: the selected category's name + its state/reason. -->
      <div class="con-wheel__hub">
        <div class="con-wheel__hub-label">{{ selected !== undefined ? $t(selected.label) : '' }}</div>
        <div v-if="selected !== undefined && !selected.available" class="con-wheel__hub-reason">{{ $t(selected.reason) }}</div>
        <div v-else class="con-wheel__hub-hint"><GamepadGlyph control="confirm" /><span>{{ $t('Open') }}</span></div>
      </div>
    </div>
    <div class="con-wheel__foot" aria-hidden="true">
      <span class="con-wheel__foot-item"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
      <span class="con-wheel__foot-item"><GamepadGlyph control="confirm" /><span>{{ $t('Open') }} / {{ $t('Cards') }}</span></span>
      <span class="con-wheel__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The LT ACTION WHEEL (feedback iteration 2) — a fast CATEGORY entry point,
 * deliberately NOT a menu of concrete actions: picking a sector closes the
 * wheel and opens that category's own full TV surface. Sectors sit on a
 * ring (CSS polar placement); d-pad/stick steps the selection around it.
 * Disabled categories stay visible with an honest reason in the hub.
 * The Journal is deliberately NOT here — it owns the View button.
 */
import {defineComponent, PropType} from 'vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GlyphControl} from '@/client/gamepad/glyphSets';

export type WheelEntry = {
  id: string,
  /** English i18n key. */
  label: string,
  /** BarButtonIcon name (preferred) … */
  barIcon?: string,
  /** … or a text glyph fallback. */
  glyph?: string,
  /** The direct hotkey opening this category (shown on the sector). */
  shortcut?: GlyphControl,
  available: boolean,
  /** English i18n key ('' when available). */
  reason: string,
  badge?: number,
};

export default defineComponent({
  name: 'ConsoleActionWheel',
  components: {BarButtonIcon, GamepadGlyph},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<WheelEntry>>, required: true},
    index: {type: Number, required: true},
  },
  computed: {
    selected(): WheelEntry | undefined {
      return this.entries[this.index];
    },
  },
  methods: {
    /** Polar placement: sector i at angle around the ring (12 o'clock start). */
    sectorStyle(i: number): Record<string, string> {
      const n = Math.max(1, this.entries.length);
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const radius = 170;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      return {transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))`};
    },
  },
});
</script>
