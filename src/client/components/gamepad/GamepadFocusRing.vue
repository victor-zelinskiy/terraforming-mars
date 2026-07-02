<template>
  <div v-if="ring.visible && gamepadActive"
       class="gp-ring"
       :class="['gp-ring--' + ring.variant, {'gp-ring--denied': deniedFlash}]"
       :style="ringStyle"
       aria-hidden="true">
    <span class="gp-ring__tick gp-ring__tick--tl"></span>
    <span class="gp-ring__tick gp-ring__tick--tr"></span>
    <span class="gp-ring__tick gp-ring__tick--bl"></span>
    <span class="gp-ring__tick gp-ring__tick--br"></span>
    <GamepadGlyph v-if="showConfirmBadge" class="gp-ring__badge" control="confirm" />
  </div>
</template>

<script lang="ts">
/**
 * THE focus ring (GAMEPAD_SUPPORT_DESIGN.md §5.8) — one fixed,
 * pointer-events-none element that morphs to the focused element's rect.
 * A single ring needs no per-component CSS and survives any re-render (it
 * tracks RECTS, not elements). Motion rides the unified system: the CSS
 * transition durations are calc(…*var(--motion-scale)); reduced-motion
 * snaps instantly (gamepad.less). The corner A-badge labels the primary
 * action at the point of attention (§6).
 */
import {defineComponent} from 'vue';
import {focusState} from '@/client/gamepad/focusEngine';
import {inputModeState} from '@/client/gamepad/inputModeState';
import {motionMs} from '@/client/components/motion/motionTokens';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'GamepadFocusRing',
  components: {GamepadGlyph},
  data() {
    return {
      focusState,
      inputModeState,
      deniedFlash: false,
      deniedTimer: undefined as number | undefined,
    };
  },
  computed: {
    ring() {
      return this.focusState.ring;
    },
    gamepadActive(): boolean {
      return this.inputModeState.mode === 'gamepad';
    },
    showConfirmBadge(): boolean {
      return this.ring.variant !== 'illegal';
    },
    ringStyle(): Record<string, string> {
      return {
        transform: `translate3d(${this.ring.left - 4}px, ${this.ring.top - 4}px, 0)`,
        width: `${this.ring.width + 8}px`,
        height: `${this.ring.height + 8}px`,
      };
    },
  },
  watch: {
    'focusState.ring.deniedEpoch'() {
      // A refused action: short refusal shake, re-armable.
      this.deniedFlash = false;
      if (this.deniedTimer !== undefined) {
        window.clearTimeout(this.deniedTimer);
      }
      void this.$nextTick(() => {
        this.deniedFlash = true;
        this.deniedTimer = window.setTimeout(() => {
          this.deniedFlash = false;
        }, motionMs(260));
      });
    },
  },
  beforeUnmount() {
    if (this.deniedTimer !== undefined) {
      window.clearTimeout(this.deniedTimer);
    }
  },
});
</script>
