<template>
  <transition name="con-terracere">
    <div v-if="visible"
         class="con-terracere"
         :class="{'con-terracere--final': final}"
         role="status"
         :aria-label="$t('Terraforming complete')">
      <div class="con-terracere__veil"></div>
      <div class="con-terracere__scene">
        <div ref="stage" class="con-terracere__stage">
          <span class="con-terracere__atmo" aria-hidden="true"></span>
          <span class="con-terracere__planet" aria-hidden="true"></span>
          <span class="con-terracere__ring" aria-hidden="true"></span>
        </div>
        <div class="con-terracere__kicker">{{ $t('Terraforming complete') }}</div>
        <div class="con-terracere__name">{{ $t('Mars is terraformed') }}</div>
        <div class="con-terracere__sub">{{ $t(subtitleKey) }}</div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
/**
 * ConsoleTerraformingCeremony — the console-native announcement of
 * "Terraforming complete": the MA-ceremony-grade centre-stage cinematic
 * (it replaced the small top banner; the desktop notification card stays
 * suppressed in console mode — NotificationLayer.handleTerraformingComplete).
 *
 * The single biggest event of the game gets the coronation treatment: a
 * soft veil, a procedural terraformed-Mars hero (CSS gradients — no
 * asset), CSS staged text rises, and the shared gsap ceremony burst
 * (rings / sparks / flash / sweep — ceremonyFx.ts, accent `terra`).
 * The headline claim is honest: `celebrationFinal` → «Текущее поколение
 * станет последним»; otherwise (solo mid-run / a Venus-required game-end
 * variant) the neutral three-parameter line — never a false "last
 * generation".
 *
 * Same contracts as ConsoleMaCeremony: pointer-events none (the game
 * stays fully playable underneath — intents are NOT trapped), bounded
 * lifetime through motionMs, one-shot animations, reduced-motion honest.
 * Fires ONLY on the live completion transition (the shared nonce is
 * seeded silently on load/reconnect), so a reload never replays it; the
 * persistent state (gold rail at 100% + «ФИНАЛЬНОЕ ПКЛ.») lives in the
 * top HUD, which pulses off the SAME nonce (ConsoleStatusStrip).
 */
import {defineComponent} from 'vue';
import {terraformingCelebrationState} from '@/client/components/gameProgress/terraformingCelebration';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {playCeremonyBurst, CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';
import {$t} from '@/client/directives/i18n';

const CEREMONY_LIFETIME_MS = 6200;
const REDUCED_LIFETIME_MS = 2200;
/** The burst detonates as the planet's CSS entrance lands. */
const BURST_DELAY_MS = 420;

export default defineComponent({
  name: 'ConsoleTerraformingCeremony',
  data() {
    return {
      visible: false,
      hideTimer: undefined as number | undefined,
      fx: undefined as CeremonyBurstHandle | undefined,
      /** The game's climax cinematic holds the presentation for its bounded
       *  lifetime (notifications queue, the next prompt waits) — released on
       *  hide/unmount; the registry ceiling covers a leaked timer. */
      presentationHold: undefined as AnimationHold | undefined,
    };
  },
  computed: {
    celebrationNonce(): number {
      return terraformingCelebrationState.celebrationNonce;
    },
    /** Captured at the transition moment — may honestly claim the last generation. */
    final(): boolean {
      return terraformingCelebrationState.celebrationFinal;
    },
    subtitleKey(): string {
      return this.final ?
        'The current generation will be the last' :
        'Temperature, oxygen and oceans are complete';
    },
  },
  watch: {
    celebrationNonce(): void {
      this.visible = true;
      this.presentationHold?.release();
      this.presentationHold = beginAnimationHold('terraforming-ceremony');
      void this.$nextTick(() => this.playFx());
      if (this.hideTimer !== undefined) {
        window.clearTimeout(this.hideTimer);
      }
      this.hideTimer = window.setTimeout(() => {
        this.visible = false;
        this.hideTimer = undefined;
        this.stopFx();
        this.releaseHold();
      }, motionMs(prefersReducedMotion() ? REDUCED_LIFETIME_MS : CEREMONY_LIFETIME_MS));
    },
  },
  beforeUnmount(): void {
    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);
    }
    this.stopFx();
    this.releaseHold();
  },
  methods: {
    $t,
    playFx(): void {
      this.stopFx();
      const host = this.$refs.stage as HTMLElement | undefined;
      if (host === undefined || host === null || !this.visible) {
        return;
      }
      this.fx = playCeremonyBurst({
        host,
        accent: 'terra',
        reduced: prefersReducedMotion(),
        intensity: 'full',
        delayMs: BURST_DELAY_MS,
      });
    },
    stopFx(): void {
      this.fx?.stop();
      this.fx = undefined;
    },
    releaseHold(): void {
      this.presentationHold?.release();
      this.presentationHold = undefined;
    },
  },
});
</script>
