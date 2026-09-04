<template>
  <div class="con-load" role="status" :aria-label="$t(statusText)">
    <!-- Layered scene: deep space → mars glow → terraforming grid → vignette. -->
    <div class="con-load__bg" aria-hidden="true"></div>
    <div class="con-load__glow" aria-hidden="true"></div>
    <div class="con-load__grid" aria-hidden="true"></div>
    <div class="con-load__vignette" aria-hidden="true"></div>

    <!-- Brand — quiet, top-center, part of the scene's identity. -->
    <div class="con-load__brand" aria-hidden="true">TERRAFORMING MARS</div>

    <!-- The ambient emblem — a calm orbital sweep, never an aggressive
         spinner. Pure visual: it is what a sub-second load shows INSTEAD of
         a text flash (the anti-flash rule lives in the director). -->
    <div class="con-load__scene" aria-hidden="true">
      <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle class="con-load__orbit con-load__orbit--outer" cx="120" cy="120" r="104" />
        <circle class="con-load__orbit con-load__orbit--mid" cx="120" cy="120" r="76" />
        <circle class="con-load__planet" cx="120" cy="120" r="34" />
        <g class="con-load__sweep-group">
          <circle class="con-load__satellite" cx="120" cy="16" r="5" />
        </g>
      </svg>
    </div>

    <!-- The CONTEXT FOOT — lower third. The whole block obeys the director's
         text policy: it exists only once the wait is real (state.textShown),
         so a fast load never flashes unreadable copy. The error state and the
         fullscreen-restore prompt override that (they are actionable). -->
    <div class="con-load__foot" :class="{'con-load__foot--shown': footShown}">
      <div class="con-load__kicker">{{ kickerText }}</div>
      <div v-if="titleText !== ''" class="con-load__title-line">{{ titleText }}</div>

      <!-- ── ERROR / RETRY ─────────────────────────────────────────── -->
      <template v-if="state.error !== ''">
        <div class="con-load__error">✕ {{ $t(state.error) }}</div>
        <button type="button" class="con-load__btn" @click="retry">
          <GamepadGlyph v-if="padVisible" control="confirm" />
          <span>{{ $t('Retry') }}</span>
        </button>
      </template>

      <!-- ── STATUS (indeterminate by design — no fake progress) ───── -->
      <template v-else>
        <transition name="con-task-swap" mode="out-in">
          <div class="con-load__status" :key="statusText">{{ $t(statusText) }}</div>
        </transition>
        <div class="con-load__pulse" aria-hidden="true">
          <span class="con-load__pulse-bar"></span>
        </div>
      </template>
    </div>

    <!-- ── FULLSCREEN RESTORE (browser only: a navigation drops fullscreen
         BY SPEC; a trusted gesture brings it back — on the Xbox browser the
         controller sends real key events, so A works; in Electron the window
         fullscreen survives natively). Actionable → outside the text policy. -->
    <button v-if="state.fullscreenLost && state.error === ''"
            type="button"
            class="con-load__btn con-load__btn--fs"
            @click="restoreFullscreen">
      <GamepadGlyph v-if="padVisible" control="confirm" />
      <span>{{ $t('Restore fullscreen') }}</span>
    </button>
  </div>
</template>

<script lang="ts">
/**
 * SCENE TRANSITION SURFACE — the full-bleed curtain of every screen boundary
 * (menu ⇄ game ⇄ campaign). Driven entirely by the scene-transition director
 * (`loadingScreenState.ts`): the director decides WHEN text may exist
 * (anti-flash + readable-dwell policy) and when the reveal dissolve plays;
 * this component only composes the frame. Indeterminate by design — there is
 * no real progress signal, so it never fakes one. The fullscreen-restore
 * prompt and the error/retry state live INSIDE this surface; both buttons are
 * ordinary focusables — the pre-game focus engine drives them from the pad
 * (scope `loadingScreen`).
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {clearFullscreenLost, loadingScreenState} from '@/client/console/loadingScreenState';
import {requestConsoleFullscreen} from '@/client/console/consoleModeState';
import {setNativeFullscreen, supportsNativeFullscreen} from '@/client/console/runtimeMode';
import {inputModeState} from '@/client/gamepad/inputModeState';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleLoadingScreen',
  components: {GamepadGlyph},
  data() {
    return {
      state: loadingScreenState,
    };
  },
  computed: {
    footShown(): boolean {
      return this.state.textShown || this.state.error !== '';
    },
    kickerText(): string {
      switch (this.state.context?.kind) {
      case 'new-game':
        return translateText('New expedition');
      case 'campaign-mission':
        return translateText('Campaign');
      case 'campaign-map':
        return translateText('Campaign');
      case 'main-menu':
        return translateText('Main menu');
      case 'resume-game':
      default:
        return translateText('Returning to the game');
      }
    },
    /** The one context line that carries REAL data (mission identity). */
    titleText(): string {
      const ctx = this.state.context;
      if (ctx?.kind !== 'campaign-mission' || ctx.mission === undefined) {
        return '';
      }
      if (ctx.missionCount !== undefined) {
        return translateTextWithParams('Mission ${0} of ${1}', [String(ctx.mission), String(ctx.missionCount)]);
      }
      return translateTextWithParams('Mission ${0}', [String(ctx.mission)]);
    },
    statusText(): string {
      if (this.state.longWait) {
        return 'Still preparing the scene…';
      }
      switch (this.state.context?.kind) {
      case 'new-game':
        return 'Preparing the expedition…';
      case 'campaign-mission':
        return this.state.context.resume === true ?
          'Synchronizing the game state…' : 'Preparing the expedition…';
      case 'campaign-map':
        return 'Loading the campaign…';
      case 'main-menu':
        return 'Returning to the main menu…';
      case 'resume-game':
      default:
        return 'Synchronizing the game state…';
      }
    },
    padVisible(): boolean {
      return inputModeState.mode === 'gamepad';
    },
  },
  methods: {
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
});
</script>
