<template>
  <div v-if="state.active" class="con-bot-theater" :key="state.nonce" role="status" :aria-label="$t('MarsBot is taking its turn')">
    <div class="con-bot-theater__band">
      <header class="con-bot-theater__head">
        <span class="con-bot-theater__glyph" :class="{'con-bot-theater__glyph--thinking': onThinking}" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
        <span class="con-bot-theater__name">
          <span :class="'con-status__dot player_bg_color_' + state.botColor" aria-hidden="true"></span>
          {{ state.botName }}
        </span>
        <span class="con-bot-theater__sub" v-i18n>{{ onThinking ? 'is thinking' : 'is taking its turn' }}</span>
        <span class="con-bot-theater__progress">{{ progressText }}</span>
      </header>
      <div ref="feed" class="con-bot-theater__steps">
        <div
          v-for="(entry, i) in visibleSteps"
          :key="i"
          class="con-bot-theater__step"
          :class="['mb-theater__step--' + entry.kind, {'con-bot-theater__step--live': i === visibleSteps.length - 1 && !state.finished}]"
        >
          <MarsBotTheaterStep :step="entry" :players="players" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console-native MarsBot turn theater — a TV-readable narration band above
 * the command bar, replaying the SAME `marsBotTheaterState` as the desktop
 * overlay (which is suppressed in console mode). Skip = A, hinted ONLY in the
 * bottom command bar (ConsoleShell claims the intent while this is active).
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {marsBotTheaterState} from '@/client/components/marsbot/marsBotTheaterState';
import {TheaterStep} from '@/client/components/marsbot/marsBotTheaterModel';
import MarsBotTheaterStep from '@/client/components/marsbot/MarsBotTheaterStep.vue';

export default defineComponent({
  name: 'ConsoleMarsBotTheater',
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
    progressText(): string {
      // The thinking beat is presentation, not a game step — exclude it.
      const total = Math.max(0, this.state.steps.length - 1);
      const at = Math.max(0, this.state.currentIndex);
      return total > 0 ? `${Math.min(at, total)}/${total}` : '';
    },
  },
  watch: {
    'state.currentIndex': function() {
      // Keep the newest step in view on TV distances.
      this.$nextTick(() => {
        const feed = this.$refs.feed as HTMLElement | undefined;
        feed?.scrollTo({top: feed.scrollHeight});
      });
    },
  },
});
</script>
