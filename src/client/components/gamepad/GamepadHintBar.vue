<template>
  <div v-if="gamepadActive" class="gp-hintbar" aria-hidden="true">
    <span v-for="(hint, i) in hints" :key="i" class="gp-hintbar__item">
      <GamepadGlyph :control="hint.control" />
      <span class="gp-hintbar__label">{{ $t(hint.label) }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * The contextual hint bar (docs/GAMEPAD_SUPPORT_DESIGN.md §6): bottom-center,
 * pointer-events:none, lists what the buttons do in the ACTIVE scope +
 * focus kind. Hints derive from hintModel.ts — the same scope id the focus
 * engine routes by, so the bar can't disagree with actual behavior.
 */
import {computed} from 'vue';
import {$t} from '@/client/directives/i18n';
import {focusState} from '@/client/gamepad/focusEngine';
import {inputModeState} from '@/client/gamepad/inputModeState';
import {HintAction, hintsFor} from '@/client/gamepad/hintModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

defineOptions({name: 'GamepadHintBar'});

const gamepadActive = computed((): boolean => inputModeState.mode === 'gamepad');
const hints = computed((): ReadonlyArray<HintAction> => {
  // P19: the focused element's exact A-verb (data-gp-verb) replaces the
  // generic «Select»; disabled/editing kinds reshape the whole row.
  return hintsFor(focusState.scopeId, focusState.focusKind, focusState.focusVerb);
});
</script>
