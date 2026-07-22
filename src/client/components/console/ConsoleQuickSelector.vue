<template>
  <!-- data-motion-*: the surface-motion contract (surfaceMotionDirector) —
       the wheel's dim is the shared `.con-shade`; entry/exit/handoff are
       GSAP-choreographed on the panel (no own backdrop, no CSS entry). -->
  <div class="con-quick" role="dialog" :aria-label="$t(title)" data-motion-surface="quick">
    <div class="con-quick__panel" data-motion-panel>
      <div class="con-quick__kicker">
        <GamepadGlyph :control="trigger" class="con-quick__trigger" />
        <span>{{ $t(title) }}</span>
      </div>
      <div class="con-quick__cross">
        <div v-for="entry in entries"
             :key="entry.id"
             class="con-quick__slot"
             :class="[`con-quick__slot--${entry.slot}`, {
               'con-quick__slot--center': entry.slot === 'center',
               'con-quick__slot--disabled': !entry.available,
             }]">
          <GamepadGlyph :control="slotGlyph(entry.slot)" class="con-quick__slot-key" />
          <span class="con-quick__slot-icon" aria-hidden="true">
            <BarButtonIcon v-if="entry.barIcon !== undefined" :name="entry.barIcon" />
            <i v-else-if="entry.iconClass !== undefined" :class="entry.iconClass"></i>
            <span v-else-if="entry.glyph !== undefined" class="con-quick__slot-glyph">{{ entry.glyph }}</span>
          </span>
          <span class="con-quick__slot-label">{{ $t(entry.label) }}</span>
          <span v-if="entry.meta !== undefined && entry.available" class="con-quick__slot-meta">{{ entry.meta }}</span>
          <span v-if="entry.badge !== undefined && entry.badge > 0" class="con-quick__slot-badge">{{ entry.badge }}</span>
          <span v-if="!entry.available" class="con-quick__slot-reason">{{ $t(entry.reason) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * P27 — the QUICK SELECTOR: the controller-native cross layer behind RT
 * (action categories) and LT (basic actions). NOT a menu the player aims
 * through — every slot answers to a DIRECT input (A = center, a single
 * d-pad direction = its slot), so a category is always exactly one press
 * away. Disabled slots stay visible with an honest reason (never hidden).
 *
 * PURE presentation: the entries come from consoleQuickModel (unit-tested);
 * ALL input handling stays in ConsoleShell (handleQuickIntent).
 */
import {defineComponent, PropType} from 'vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {QuickEntry, QuickSlot, QUICK_SLOT_GLYPH} from '@/client/console/consoleQuickModel';

export default defineComponent({
  name: 'ConsoleQuickSelector',
  components: {BarButtonIcon, GamepadGlyph},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<QuickEntry>>, required: true},
    /** English i18n key of the selector's kicker. */
    title: {type: String, required: true},
    /** Which trigger opened it (shown in the kicker). */
    trigger: {type: String as PropType<GlyphControl>, required: true},
  },
  methods: {
    slotGlyph(slot: QuickSlot): GlyphControl {
      return QUICK_SLOT_GLYPH[slot];
    },
  },
});
</script>
