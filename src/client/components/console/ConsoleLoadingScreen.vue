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
      </svg>
      <!-- The rotating layer is an HTML div (compositor-driven while the main
           thread is busy); its phase is wall-clock (`orbitPhaseDelayMs`), so
           it lines up with the static boot curtain, the departing page and
           the Electron overlay by construction. -->
      <div class="con-load__sweep" :style="{animationDelay: orbitDelay}">
        <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle class="con-load__satellite" cx="120" cy="16" r="5" />
        </svg>
      </div>
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
          <span class="con-load__pulse-bar" :style="{animationDelay: pulseDelay}"></span>
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
import {PULSE_MS, clearFullscreenLost, curtainKickerKey, curtainStatusKey, curtainTitleParts, dismissStaticBootCurtain, loadingScreenState, orbitPhaseDelayMs} from '@/client/console/loadingScreenState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {probeTick} from '@/client/console/probeTick';
import {requestConsoleFullscreen} from '@/client/console/consoleModeState';
import {setNativeFullscreen, supportsNativeFullscreen} from '@/client/console/runtimeMode';
import {inputModeState} from '@/client/gamepad/inputModeState';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleLoadingScreen',
  components: {GamepadGlyph},
  data() {
    // The phase delays are computed ONCE, at this surface's birth — a negative
    // delay against the wall clock; every other curtain surface computes the
    // same formula, so they all agree on the angle at any instant.
    return {
      state: loadingScreenState,
      orbitDelay: `${orbitPhaseDelayMs()}ms`,
      pulseDelay: `${-(Date.now() % motionMs(PULSE_MS))}ms`,
    };
  },
  computed: {
    footShown(): boolean {
      return this.state.textShown || this.state.error !== '';
    },
    // Copy comes from the director's shared helpers (ONE source with the
    // Electron overlay — a fork here breaks the pixel-identical handoff).
    kickerText(): string {
      return translateText(curtainKickerKey(this.state.context));
    },
    /** The one context line that carries REAL data (mission identity). */
    titleText(): string {
      const parts = curtainTitleParts(this.state.context);
      return parts === undefined ? '' : translateTextWithParams(parts.key, parts.params);
    },
    statusText(): string {
      return curtainStatusKey(this.state.context, this.state.longWait);
    },
    padVisible(): boolean {
      return inputModeState.mode === 'gamepad';
    },
  },
  mounted() {
    // Take over from the STATIC pre-Vue curtain only after THIS surface has
    // painted (two settled ticks) — the two are pixel-identical, so the
    // handoff is invisible; removing earlier would re-open the dark gap the
    // static node exists to close.
    probeTick(() => probeTick(() => dismissStaticBootCurtain()));
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
