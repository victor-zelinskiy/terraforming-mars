<template>
  <!-- data-motion-*: the surface-motion contract (surfaceMotionDirector) —
       the wheel's dim is the shared `.con-shade`; entry/exit/handoff are
       GSAP-choreographed on the panel (no own backdrop, no CSS entry). -->
  <div class="con-quick con-ws" role="dialog" :aria-label="$t(title)" data-motion-surface="quick">
    <div class="con-quick__panel" data-motion-panel>
      <!-- THE FOCUS HALO — the wheel's own pocket of depth: a wide radial
           concentration of light behind the cross that separates the command
           layer from the dimmed scene without a second backdrop (the ONE dim
           stays the shared .con-shade). Static gradients, rides the panel's
           GSAP tween — never its own animation. -->
      <div class="con-quick__halo" aria-hidden="true"></div>
      <div class="con-quick__kicker">
        <transition :name="swapName" mode="out-in">
          <span :key="trigger" class="con-quick__kicker-inner">
            <GamepadGlyph :control="trigger" class="con-quick__trigger" />
            <span>{{ $t(title) }}</span>
          </span>
        </transition>
      </div>
      <transition :name="swapName" mode="out-in">
        <div :key="trigger"
             class="con-quick__cross"
             :class="{'con-quick__cross--armed': armedSlot !== undefined}">
          <div v-for="entry in entries"
               :key="entry.id"
               class="con-quick__slot"
               :class="[`con-quick__slot--${entry.slot}`, {
                 'con-quick__slot--center': entry.slot === 'center',
                 'con-quick__slot--disabled': !entry.available,
                 'con-quick__slot--soft': !entry.available && entry.soft === true,
                 'con-quick__slot--focus': focusedSlot === entry.slot && armedSlot === undefined,
                 'con-quick__slot--armed': armedSlot === entry.slot,
                 'con-quick__slot--armed-blocked': armedSlot === entry.slot && armedBlocked,
                 'con-quick__slot--muted': armedSlot !== undefined && armedSlot !== entry.slot,
               }]">
            <!-- The KEY CAP floats on the shell — the tile's body sinks under
                 it while the physical button label holds its place. In
                 FOCUS & CONFIRM the caps change meaning: directions are
                 navigation (not activation), so only the FOCUSED tile wears
                 a cap — the universal A confirm. -->
            <GamepadGlyph v-if="slotCap(entry) !== undefined" :control="slotCap(entry)!" class="con-quick__slot-key" />
            <div class="con-quick__slot-body">
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
      </transition>
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
 * PRESS→RELEASE: the shell's arm machine (wheelArmModel) drives `armedSlot`
 * — the DOWN edge seats the tile (its body sinks, neighbours yield), the UP
 * edge commits. This component stays PURE presentation: the entries come
 * from consoleQuickModel (unit-tested); ALL input handling stays in
 * ConsoleShell (handleQuickIntent).
 *
 * The LT↔RT switch swaps the cross in place (same mounted surface): a short
 * keyed out-in slide whose direction follows the pulling trigger — LT draws
 * the basics in from the left, RT the categories from the right.
 */
import {defineComponent, PropType} from 'vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {QuickEntry, QuickSlot, QUICK_SLOT_GLYPH} from '@/client/console/consoleQuickModel';
import {WheelControlMode} from '@/client/console/quickWheel/wheelControlMode';

export default defineComponent({
  name: 'ConsoleQuickSelector',
  components: {BarButtonIcon, GamepadGlyph},
  props: {
    entries: {type: Array as PropType<ReadonlyArray<QuickEntry>>, required: true},
    /** English i18n key of the selector's kicker. */
    title: {type: String, required: true},
    /** Which trigger opened it (shown in the kicker). */
    trigger: {type: String as PropType<GlyphControl>, required: true},
    /** The active control style (wheelControlMode). */
    mode: {type: String as PropType<WheelControlMode>, default: 'quick-select'},
    /** FOCUS & CONFIRM only: the persistent focus cursor. */
    focusedSlot: {type: String as PropType<QuickSlot>, default: undefined},
    /** The slot seated / pressed under the player's finger (arm machine). */
    armedSlot: {type: String as PropType<QuickSlot>, default: undefined},
    /** The armed slot is unavailable — pressed against its stop. */
    armedBlocked: {type: Boolean, default: false},
  },
  computed: {
    swapName(): string {
      return this.trigger === 'triggerL' ? 'con-quick-swapl' : 'con-quick-swapr';
    },
  },
  methods: {
    /** The key cap a slot wears. QUICK SELECT: its direct activator (the
     *  spatial d-pad glyph / A on the centre). FOCUS & CONFIRM: directions
     *  no longer activate, so only the focused tile wears the A confirm. */
    slotCap(entry: QuickEntry): GlyphControl | undefined {
      if (this.mode === 'focus-confirm') {
        return (this.focusedSlot ?? (this.armedSlot ?? undefined)) === entry.slot ? 'confirm' : undefined;
      }
      return QUICK_SLOT_GLYPH[entry.slot];
    },
  },
});
</script>
