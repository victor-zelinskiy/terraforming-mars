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

<script setup vapor lang="ts">
/**
 * THE focus ring (docs/GAMEPAD_SUPPORT_DESIGN.md §5.8) — one fixed,
 * pointer-events-none element that morphs to the focused element's rect.
 * A single ring needs no per-component CSS and survives any re-render (it
 * tracks RECTS, not elements). Motion rides the unified system: the CSS
 * transition durations are calc(…*var(--motion-scale)); reduced-motion
 * snaps instantly (gamepad.less). The corner A-badge labels the primary
 * action at the point of attention (§6).
 */
import {computed, nextTick, ref, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {focusState} from '@/client/gamepad/focusEngine';
import {inputModeState} from '@/client/gamepad/inputModeState';
import {motionMs} from '@/client/components/motion/motionTokens';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

defineOptions({name: 'GamepadFocusRing'});

// The ring's own scope (flow kernel — PLAN §10 · C1). It stands outside any console shell (its host is the
// app-level `GamepadLayer`), so it is the PAGE's: a game screen that comes and goes never ends it.
const flow = useFlowScope('gamepad-focus-ring');
const deniedFlash = ref(false);
let cancelDenied = (() => {}) as () => void;
const ring = computed(() => {
  return focusState.ring;
});
const gamepadActive = computed((): boolean => {
  return inputModeState.mode === 'gamepad';
});
const showConfirmBadge = computed((): boolean => {
  return ring.value.variant !== 'illegal';
});
const ringStyle = computed((): Record<string, string> => {
  return {
    transform: `translate3d(${ring.value.left - 4}px, ${ring.value.top - 4}px, 0)`,
    width: `${ring.value.width + 8}px`,
    height: `${ring.value.height + 8}px`,
  };
});

watch(() => focusState.ring.deniedEpoch, () => {
  // A refused action: short refusal shake, re-armable.
  deniedFlash.value = false;
  cancelDenied();
  void nextTick(() => {
    deniedFlash.value = true;
    cancelDenied = flow.after(motionMs(260), 'the ring\'s refusal shake ends', () => {
      deniedFlash.value = false;
    });
  });
});
</script>
