<template>
  <div class="con-load" role="status" :aria-label="$t(stageText)">
    <!-- Layered scene: deep space → mars glow → terraforming grid → vignette. -->
    <div class="con-load__bg" aria-hidden="true"></div>
    <div class="con-load__glow" aria-hidden="true"></div>
    <div class="con-load__grid" aria-hidden="true"></div>
    <div class="con-load__vignette" aria-hidden="true"></div>

    <div class="con-load__panel">
      <!-- Orbital scanner — a calm sweep, never an aggressive spinner. -->
      <div class="con-load__scanner" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle class="con-load__orbit con-load__orbit--outer" cx="60" cy="60" r="52" />
          <circle class="con-load__orbit con-load__orbit--mid" cx="60" cy="60" r="38" />
          <circle class="con-load__planet" cx="60" cy="60" r="18" />
          <g class="con-load__sweep-group">
            <circle class="con-load__satellite" cx="60" cy="8" r="4" />
          </g>
        </svg>
      </div>

      <div class="con-load__title">TERRAFORMING MARS</div>

      <!-- ── ERROR / RETRY ─────────────────────────────────────────── -->
      <template v-if="state.error !== ''">
        <div class="con-load__error">✕ {{ $t(state.error) }}</div>
        <button type="button" class="con-load__btn" @click="retry">
          <GamepadGlyph v-if="padVisible" control="confirm" />
          <span>{{ $t('Retry') }}</span>
        </button>
      </template>

      <!-- ── STAGED PROGRESS ───────────────────────────────────────── -->
      <template v-else>
        <transition name="con-task-swap" mode="out-in">
          <div class="con-load__stage" :key="displayStage">{{ $t(stageText) }}</div>
        </transition>
        <div class="con-load__pulse" aria-hidden="true">
          <span class="con-load__pulse-bar"></span>
        </div>
      </template>

      <!-- ── FULLSCREEN RESTORE (browser only: a navigation drops
           fullscreen BY SPEC; a trusted gesture brings it back — on the
           Xbox browser the controller sends real key events, so A works;
           in Electron the window fullscreen survives natively). ──────── -->
      <button v-if="state.fullscreenLost && state.error === ''"
              type="button"
              class="con-load__btn con-load__btn--fs"
              @click="restoreFullscreen">
        <GamepadGlyph v-if="padVisible" control="confirm" />
        <span>{{ $t('Restore fullscreen') }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * PREMIUM LOADING SCREEN — the console-native pre-game shell (P10).
 * Covers the deliberate GAME-BOUNDARY reload (join / create / back to the
 * menu), the player-view boot fetch and the route-transition gaps so the
 * player NEVER sees a raw texture / empty DOM between the menu and the
 * board. Indeterminate by design (there is no real progress signal): the
 * staged messages auto-advance calmly and hold on the last stage. The
 * fullscreen-restore prompt and the error/retry state live INSIDE this
 * screen; both buttons are ordinary focusables — the pre-game focus
 * engine drives them from the pad (scope `loadingScreen`).
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {
  LOADING_STAGE_ORDER, LOADING_STAGE_TEXT, LoadingStage, clearFullscreenLost, loadingScreenState,
} from '@/client/console/loadingScreenState';
import {requestConsoleFullscreen} from '@/client/console/consoleModeState';
import {setNativeFullscreen, supportsNativeFullscreen} from '@/client/console/runtimeMode';
import {inputModeState} from '@/client/gamepad/inputModeState';
import {motionMs} from '@/client/components/motion/motionTokens';

export default defineComponent({
  name: 'ConsoleLoadingScreen',
  components: {GamepadGlyph},
  data() {
    return {
      state: loadingScreenState,
      /** The auto-advanced display stage (never before the state stage). */
      displayStage: loadingScreenState.stage as LoadingStage,
      timer: undefined as number | undefined,
    };
  },
  computed: {
    stageText(): string {
      return LOADING_STAGE_TEXT[this.displayStage];
    },
    padVisible(): boolean {
      return inputModeState.mode === 'gamepad';
    },
  },
  watch: {
    'state.stage'(now: LoadingStage) {
      this.displayStage = now;
    },
  },
  methods: {
    /** Walk the stage order calmly; hold on the last one (indeterminate). */
    advance(): void {
      const at = LOADING_STAGE_ORDER.indexOf(this.displayStage);
      if (at !== -1 && at < LOADING_STAGE_ORDER.length - 1) {
        this.displayStage = LOADING_STAGE_ORDER[at + 1];
      }
    },
    retry(): void {
      window.location.reload();
    },
    restoreFullscreen(): void {
      if (supportsNativeFullscreen()) {
        setNativeFullscreen(true);
        clearFullscreenLost();
        return;
      }
      // Browser: needs a trusted activation; the shared helper retries on
      // the next real gesture when this synthetic attempt is rejected.
      requestConsoleFullscreen();
      clearFullscreenLost();
    },
  },
  mounted() {
    this.timer = window.setInterval(() => this.advance(), motionMs(1700));
  },
  beforeUnmount() {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
    }
  },
});
</script>
