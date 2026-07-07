<template>
  <div v-if="state.active" class="mb-theater" :key="state.nonce" role="status" :aria-label="$t('MarsBot is taking its turn')">
    <div class="mb-theater__card">
      <header class="mb-theater__head">
        <span class="mb-theater__glyph" :class="{'mb-theater__glyph--thinking': onThinking}" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
        <span class="mb-theater__title">
          <span :class="'con-status__dot player_bg_color_' + state.botColor" aria-hidden="true"></span>
          {{ state.botName }}
          <span class="mb-theater__title-sub" v-i18n>{{ onThinking ? 'is thinking' : 'is taking its turn' }}</span>
        </span>
        <button type="button" class="mb-theater__skip" @click="skip"><span v-i18n>Skip</span></button>
      </header>

      <transition-group tag="div" class="mb-theater__steps" name="mb-step">
        <div
          v-for="(entry, i) in visibleSteps"
          :key="i"
          class="mb-theater__step"
          :class="['mb-theater__step--' + entry.kind, {'mb-theater__step--live': i === visibleSteps.length - 1 && !state.finished}]"
        >
          <MarsBotTheaterStep :step="entry" :players="players" />
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Desktop MarsBot turn theater — a top-centre narration card that replays the
 * bot's turn while the held view stays on screen (the commit gate). Pure
 * presentation over `marsBotTheaterState`; the controller owns the pacing.
 * Suppressed in console mode — `ConsoleMarsBotTheater` is the console-native
 * presentation of the SAME state.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {marsBotTheaterState, skipMarsBotTheater} from './marsBotTheaterState';
import {TheaterStep} from './marsBotTheaterModel';
import MarsBotTheaterStep from './MarsBotTheaterStep.vue';

export default defineComponent({
  name: 'MarsBotTheaterOverlay',
  components: {MarsBotTheaterStep},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  data() {
    return {state: marsBotTheaterState};
  },
  computed: {
    visibleSteps(): Array<TheaterStep> {
      return this.state.steps.slice(0, this.state.currentIndex + 1);
    },
    onThinking(): boolean {
      const current = this.state.steps[this.state.currentIndex];
      return current !== undefined && current.kind === 'thinking';
    },
  },
  methods: {
    skip(): void {
      skipMarsBotTheater();
    },
  },
});
</script>
