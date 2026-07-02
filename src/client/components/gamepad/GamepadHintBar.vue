<template>
  <div v-if="gamepadActive" class="gp-hintbar" aria-hidden="true">
    <span v-for="(hint, i) in hints" :key="i" class="gp-hintbar__item">
      <GamepadGlyph :control="hint.control" />
      <span class="gp-hintbar__label">{{ $t(hint.label) }}</span>
    </span>
  </div>
</template>

<script lang="ts">
/**
 * The contextual hint bar (GAMEPAD_SUPPORT_DESIGN.md §6): bottom-center,
 * pointer-events:none, lists what the buttons do in the ACTIVE scope +
 * focus kind. Hints derive from hintModel.ts — the same scope id the focus
 * engine routes by, so the bar can't disagree with actual behavior.
 */
import {defineComponent} from 'vue';
import {focusState} from '@/client/gamepad/focusEngine';
import {inputModeState} from '@/client/gamepad/inputModeState';
import {HintAction, hintsFor} from '@/client/gamepad/hintModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'GamepadHintBar',
  components: {GamepadGlyph},
  data() {
    return {focusState, inputModeState};
  },
  computed: {
    gamepadActive(): boolean {
      return this.inputModeState.mode === 'gamepad';
    },
    hints(): ReadonlyArray<HintAction> {
      return hintsFor(this.focusState.scopeId, this.focusState.focusKind);
    },
  },
});
</script>
