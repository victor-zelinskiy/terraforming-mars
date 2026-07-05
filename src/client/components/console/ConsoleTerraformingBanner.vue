<template>
  <transition name="con-terra-event">
    <div v-if="visible" class="con-terra-event" role="status" :aria-label="$t('Terraforming complete')">
      <span class="con-terra-event__tick con-terra-event__tick--tl" aria-hidden="true"></span>
      <span class="con-terra-event__tick con-terra-event__tick--br" aria-hidden="true"></span>
      <span class="con-terra-event__glyph" aria-hidden="true">❂</span>
      <span class="con-terra-event__text">
        <span class="con-terra-event__title">{{ $t('Terraforming complete') }}</span>
        <span class="con-terra-event__subtitle">{{ $t(subtitleKey) }}</span>
      </span>
      <span class="con-terra-event__sweep" aria-hidden="true"></span>
    </div>
  </transition>
</template>

<script lang="ts">
/**
 * ConsoleTerraformingBanner — the console-native CINEMATIC game-state event
 * for "Terraforming complete / this is the final generation".
 *
 * NOT a re-host of the desktop notification card (the desktop card is
 * suppressed in console mode — NotificationLayer.handleTerraformingComplete):
 * a centred banner just under the top HUD, visually tied to the
 * Temperature/O₂/Oceans progress rail, which pulses at the same moment
 * (ConsoleStatusStrip watches the SAME celebration nonce). `pointer-events:
 * none` + a bounded lifetime: it can never block a mandatory prompt, a task
 * frame or placement — it announces, then leaves; the persistent state
 * (gold rail at 100% + the «ФИНАЛЬНОЕ ПКЛ.» generation marker) stays in the
 * HUD. Fires ONLY on the live completion transition (the shared nonce is
 * seeded silently on load/reconnect), so a reload never replays it.
 */
import {defineComponent} from 'vue';
import {terraformingCelebrationState} from '@/client/components/gameProgress/terraformingCelebration';
import {motionMs} from '@/client/components/motion/motionTokens';

const BANNER_LIFETIME_MS = 7600;

export default defineComponent({
  name: 'ConsoleTerraformingBanner',
  data() {
    return {
      visible: false,
      hideTimer: undefined as number | undefined,
    };
  },
  computed: {
    celebrationNonce(): number {
      return terraformingCelebrationState.celebrationNonce;
    },
    subtitleKey(): string {
      return terraformingCelebrationState.celebrationFinal ?
        'This is the final generation' :
        'Temperature, oxygen and oceans are complete';
    },
  },
  watch: {
    celebrationNonce(): void {
      this.visible = true;
      if (this.hideTimer !== undefined) {
        window.clearTimeout(this.hideTimer);
      }
      this.hideTimer = window.setTimeout(() => {
        this.visible = false;
      }, motionMs(BANNER_LIFETIME_MS));
    },
  },
  beforeUnmount(): void {
    if (this.hideTimer !== undefined) {
      window.clearTimeout(this.hideTimer);
    }
  },
});
</script>
