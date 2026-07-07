<template>
  <!-- Teleported: a `position: fixed` card inside a transformed/filtered
       ancestor is positioned against THAT ancestor (a first-frame jump);
       the body is the only safe containing block. -->
  <Teleport to="body">
  <div v-if="state.active || state.lingering" class="mb-theater" :key="state.nonce" role="status" :aria-label="$t('MarsBot is taking its turn')">
    <div class="mb-theater__card">
      <header class="mb-theater__head">
        <span class="mb-theater__glyph" :class="{'mb-theater__glyph--thinking': onThinking}" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </span>
        <span class="mb-theater__title">
          <span :class="'con-status__dot player_bg_color_' + state.botColor" aria-hidden="true"></span>
          {{ state.botName }}
          <span class="mb-theater__title-sub" v-i18n>{{ headerSub }}</span>
        </span>
        <button v-if="state.lingering" type="button" class="mb-theater__skip mb-theater__skip--close" @click="dismiss"><span v-i18n>Close</span></button>
        <button v-else type="button" class="mb-theater__skip" @click="skip"><span v-i18n>Skip</span></button>
      </header>

      <transition-group tag="div" class="mb-theater__steps" name="mb-step">
        <div
          v-for="(entry, i) in visibleSteps"
          :key="entry.key"
          class="mb-theater__step"
          :class="['mb-theater__step--' + entry.step.kind, {'mb-theater__step--live': i === visibleSteps.length - 1 && !state.finished}]"
        >
          <MarsBotTheaterStep :step="entry.step" :players="players" :ctx="state.ctx" />
        </div>
        <div v-if="state.finished" key="done" class="mb-theater__step mb-theater__step--done">
          <div class="mb-step__row mb-step__row--done">
            <span class="mb-step__icon mb-step__icon--done" aria-hidden="true">✓</span>
            <span v-i18n>MarsBot finished its turn</span>
          </div>
        </div>
      </transition-group>

      <footer v-if="state.lingering" class="mb-theater__foot">
        <span class="mb-theater__foot-note" v-i18n>The board is updated — close when you are done reading</span>
      </footer>
    </div>
  </div>
  </Teleport>
</template>

<script lang="ts">
/**
 * Desktop MarsBot turn theater — a top-centre narration card that replays the
 * bot's turn while the held view stays on screen (the commit gate), then
 * LINGERS after the commit until the player explicitly closes it (the Close
 * button or Esc) — a narration that vanishes on its own is unreadable.
 * Pure presentation over `marsBotTheaterState`; the controller owns the
 * pacing. Suppressed in console mode — `ConsoleMarsBotTheater` renders the
 * SAME state there (close = B, hinted in the command bar).
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {dismissMarsBotTheater, marsBotTheaterState, skipMarsBotTheater} from './marsBotTheaterState';
import {TheaterStep} from './marsBotTheaterModel';
import MarsBotTheaterStep from './MarsBotTheaterStep.vue';

export default defineComponent({
  name: 'MarsBotTheaterOverlay',
  components: {MarsBotTheaterStep},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  data() {
    return {
      state: marsBotTheaterState,
      onKey: (e: KeyboardEvent) => {
        if (e.code !== 'Escape') {
          return;
        }
        if (marsBotTheaterState.lingering) {
          dismissMarsBotTheater();
        } else if (marsBotTheaterState.active) {
          skipMarsBotTheater();
        }
      },
    };
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
  },
  methods: {
    skip(): void {
      skipMarsBotTheater();
    },
    dismiss(): void {
      dismissMarsBotTheater();
    },
  },
  mounted() {
    document.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey);
  },
});
</script>
