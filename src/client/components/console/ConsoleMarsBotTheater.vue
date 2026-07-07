<template>
  <!-- Teleported: a `position: fixed` band inside a transformed/filtered
       ancestor is positioned against THAT ancestor (the first-frame
       "bottom-left jump"); the body is the only safe containing block. -->
  <Teleport to="body">
  <div v-if="state.active || state.lingering" class="con-bot-theater" :key="state.nonce" role="status" :aria-label="$t('MarsBot is taking its turn')">
    <div class="con-bot-theater__band">
      <header class="con-bot-theater__head">
        <span class="con-bot-theater__glyph" :class="{'con-bot-theater__glyph--thinking': onThinking}" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
        <span class="con-bot-theater__name">
          <span :class="'con-status__dot player_bg_color_' + state.botColor" aria-hidden="true"></span>
          {{ botDisplayName }}
        </span>
        <span class="con-bot-theater__sub" v-i18n>{{ headerSub }}</span>
        <span class="con-bot-theater__progress">{{ progressText }}</span>
      </header>
      <div ref="feed" class="con-bot-theater__steps">
        <div
          v-for="(entry, i) in visibleSteps"
          :key="entry.key"
          class="con-bot-theater__step"
          :class="['mb-theater__step--' + entry.step.kind, {'con-bot-theater__step--live': i === visibleSteps.length - 1 && !state.finished}]"
        >
          <MarsBotTheaterStep :step="entry.step" :players="players" :ctx="state.ctx" large />
        </div>
        <div v-if="state.finished" key="done" class="con-bot-theater__step con-bot-theater__step--done">
          <div class="mb-step__row mb-step__row--done">
            <span class="mb-step__icon mb-step__icon--done" aria-hidden="true">✓</span>
            <span v-i18n>MarsBot finished its turn</span>
          </div>
        </div>
      </div>
      <!-- The control hint lives ON the band too (the command bar echoes it):
           the player must see how to dismiss without hunting the screen edge. -->
      <footer class="con-bot-theater__foot">
        <span v-if="state.lingering" class="con-bot-theater__foot-note" v-i18n>The board is updated — close when you are done reading</span>
        <span class="con-bot-theater__hint" :class="{'con-bot-theater__hint--close': state.lingering}">
          <GamepadGlyph :control="state.lingering ? 'back' : 'confirm'" />
          <span v-i18n>{{ state.lingering ? 'Close' : 'Skip' }}</span>
        </span>
      </footer>
    </div>
  </div>
  </Teleport>
</template>

<script lang="ts">
/**
 * Console-native MarsBot turn theater — a TV-readable narration band above
 * the command bar, replaying the SAME `marsBotTheaterState` as the desktop
 * overlay (which is suppressed in console mode). Input routing stays in
 * ConsoleShell (A skips, B closes the lingering band); the band's own footer
 * ECHOES the live hint so the player never has to hunt the command bar to
 * learn how to dismiss it.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {marsBotTheaterState} from '@/client/components/marsbot/marsBotTheaterState';
import {TheaterStep} from '@/client/components/marsbot/marsBotTheaterModel';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import MarsBotTheaterStep from '@/client/components/marsbot/MarsBotTheaterStep.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleMarsBotTheater',
  components: {MarsBotTheaterStep, GamepadGlyph},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  data() {
    return {state: marsBotTheaterState};
  },
  computed: {
    // The thinking beat is a transient intro, not history — it shows only
    // while it IS the live step (a finished turn must not keep "drawing a
    // card…" pulsing in the record). Keys are index-stable so filtering the
    // intro out never re-mounts the later steps.
    visibleSteps(): Array<{key: number, step: TheaterStep}> {
      const out: Array<{key: number, step: TheaterStep}> = [];
      this.state.steps.forEach((step, i) => {
        if (i > this.state.currentIndex) {
          return;
        }
        if (step.kind === 'thinking' && (i < this.state.currentIndex || this.state.finished)) {
          return;
        }
        out.push({key: i, step});
      });
      return out;
    },
    onThinking(): boolean {
      if (this.state.lingering) {
        return false;
      }
      const current = this.state.steps[this.state.currentIndex];
      return current !== undefined && current.kind === 'thinking';
    },
    headerSub(): string {
      if (this.state.lingering) {
        return 'turn complete';
      }
      return this.onThinking ? 'is thinking' : 'is taking its turn';
    },
    botDisplayName(): string {
      return participantDisplayName({name: this.state.botName, isMarsBot: true});
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
