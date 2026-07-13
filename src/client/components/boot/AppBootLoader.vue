<template>
  <div class="boot-loader" role="status" :aria-label="$t('Preparing the game')">
    <!--
      HIDDEN WARM-UP SCENE. Sits BEHIND the opaque loader panel (lower z, very
      low opacity) so the player never sees it, but it genuinely RENDERS on the
      GPU: each cell carries one of the heavy effects the game uses (drop-shadow,
      box-shadow, backdrop-filter, filter blur/grayscale/brightness, clip-path,
      gradients, glow) and a running transform/filter animation forces a repaint
      every frame — so Skia Graphite compiles those pipelines up front instead of
      on the first real animation. The `--phase-N` class rotates which effects are
      emphasised so more distinct pipelines get exercised across the phases.
    -->
    <div class="boot-loader__warm" :class="'boot-loader__warm--phase-' + phase" aria-hidden="true">
      <div class="boot-warm-cell boot-warm-cell--pcard"></div>
      <div class="boot-warm-cell boot-warm-cell--card"></div>
      <div class="boot-warm-cell boot-warm-cell--glow"></div>
      <div class="boot-warm-cell boot-warm-cell--blur"></div>
      <div class="boot-warm-cell boot-warm-cell--backdrop"></div>
      <div class="boot-warm-cell boot-warm-cell--grayscale"></div>
      <div class="boot-warm-cell boot-warm-cell--clip"></div>
      <div class="boot-warm-cell boot-warm-cell--gradient"></div>
      <div class="boot-warm-cell boot-warm-cell--shadow"></div>
      <div class="boot-warm-cell boot-warm-cell--bright"></div>
    </div>

    <!-- Layered premium scene: deep space → mars glow → grid → vignette. -->
    <div class="boot-loader__bg" aria-hidden="true"></div>
    <div class="boot-loader__glow" aria-hidden="true"></div>
    <div class="boot-loader__grid" aria-hidden="true"></div>
    <div class="boot-loader__vignette" aria-hidden="true"></div>

    <div class="boot-loader__panel">
      <span class="boot-loader__corner boot-loader__corner--tl" aria-hidden="true"></span>
      <span class="boot-loader__corner boot-loader__corner--tr" aria-hidden="true"></span>
      <span class="boot-loader__corner boot-loader__corner--bl" aria-hidden="true"></span>
      <span class="boot-loader__corner boot-loader__corner--br" aria-hidden="true"></span>

      <!-- Orbital scanner — a calm sweep, not an aggressive spinner. -->
      <div class="boot-loader__scanner" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle class="boot-loader__orbit boot-loader__orbit--outer" cx="60" cy="60" r="52" />
          <circle class="boot-loader__orbit boot-loader__orbit--mid" cx="60" cy="60" r="38" />
          <circle class="boot-loader__core" cx="60" cy="60" r="17" />
          <g class="boot-loader__sweep">
            <circle class="boot-loader__satellite" cx="60" cy="8" r="4" />
          </g>
        </svg>
      </div>

      <div class="boot-loader__title">TERRAFORMING MARS</div>

      <transition name="boot-stage-swap" mode="out-in">
        <div class="boot-loader__stage" :key="phase">{{ $t(stageText) }}</div>
      </transition>

      <div class="boot-loader__progress" aria-hidden="true">
        <span class="boot-loader__progress-fill" :style="{width: progress + '%'}"></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * APP BOOT LOADER — premium app-launch screen + GPU shader warm-up.
 * Shown once per session (see bootWarmupState). Walks a few "warm-up" phases
 * while the hidden scene compiles the heavy GPU pipelines, then finishes and
 * fades out. Purely presentational — it does not block route/data loading (the
 * real screen loads underneath and is revealed when the loader unmounts).
 */
import {defineComponent} from 'vue';
import {finishBootWarmup} from '@/client/components/boot/bootWarmupState';
import {motionMs} from '@/client/components/motion/motionTokens';

// English text = i18n key (fork convention). Kept short; one per warm-up phase.
const STAGES = [
  'Initializing renderer…',
  'Warming up shaders…',
  'Preparing animations…',
  'Almost ready…',
] as const;

export default defineComponent({
  name: 'AppBootLoader',
  data() {
    return {
      phase: 0,
      progress: 8,
      timer: undefined as number | undefined,
    };
  },
  computed: {
    stageText(): string {
      return STAGES[Math.min(this.phase, STAGES.length - 1)];
    },
  },
  mounted() {
    const reduced = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    // Each phase gives Graphite time to compile that phase's pipelines. Reduced
    // motion shortens the hold but still runs through the phases (the pipelines
    // still need compiling — this is not decoration).
    const perPhase = motionMs(reduced ? 320 : 880);
    this.step(perPhase);
  },
  beforeUnmount() {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
    }
  },
  methods: {
    step(perPhase: number): void {
      this.progress = Math.round(((this.phase + 1) / STAGES.length) * 100);
      if (this.phase >= STAGES.length - 1) {
        // Last phase: hold briefly at 100%, then finish + let the fade play.
        this.timer = window.setTimeout(() => finishBootWarmup(), perPhase);
        return;
      }
      this.timer = window.setTimeout(() => {
        this.phase += 1;
        this.step(perPhase);
      }, perPhase);
    },
  },
});
</script>
