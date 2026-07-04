<template>
  <div class="briefing-actions">
    <transition name="briefing-warn">
      <div v-if="warning !== ''" class="briefing__warning">
        <span class="briefing__warning-icon" aria-hidden="true">!</span>
        <span v-i18n>{{ warning }}</span>
      </div>
    </transition>

    <div class="briefing__cta-wrap" :data-hint="ctaHint">
      <button
        type="button"
        class="briefing__cta"
        data-gp-verb="Create game"
        :class="{'briefing__cta--busy': creating}"
        :disabled="!canCreate || creating"
        @click="$emit('create')"
      >
        <span v-if="creating" class="briefing__spinner" aria-hidden="true"></span>
        <!-- P19: the inline pad glyph (gp-mode / console only via CSS) -
             the button itself says A = Create game. -->
        <span v-if="!creating" class="gp-btn-glyph" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
        <span v-i18n>{{ creating ? 'Creating' : 'Create game' }}</span>
      </button>
    </div>

    <div class="briefing__secondary">
      <button type="button" class="briefing__ghost" @click="$emit('back')"><span v-i18n>Back</span></button>
      <button type="button" class="briefing__ghost" @click="$emit('reset')"><span v-i18n>Reset</span></button>
    </div>
  </div>
</template>

<script lang="ts">
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {defineComponent} from 'vue';
import {$t} from '@/client/directives/i18n';
import {createGameState, canCreateGame, firstBlocker} from './createGameState';

export default defineComponent({
  name: 'BriefingActions',
  components: {GamepadGlyph},
  emits: ['create', 'back', 'reset'],
  computed: {
    creating(): boolean {
      return createGameState.creating;
    },
    canCreate(): boolean {
      return canCreateGame() && createGameState.error === '';
    },
    warning(): string {
      return createGameState.error !== '' ? createGameState.error : firstBlocker();
    },
    ctaHint(): string {
      return this.canCreate ? '' : $t(firstBlocker());
    },
  },
});
</script>
