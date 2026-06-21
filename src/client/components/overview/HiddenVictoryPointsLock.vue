<template>
  <!--
    Premium "victory points are sealed until final scoring" lock — shown inside
    the VP overlay (in place of the score report) when the game is played in
    hidden-VP mode and is still running. Not an error: a deliberate, polished
    part of the hidden-score mode. Sci-fi glass + secure glyph + a one-shot
    "access denied" deny/scan on mount, then a stable locked state.
  -->
  <div class="vp-lock" :class="{'vp-lock--deny': deny}" role="status">
    <div class="vp-lock__halo" aria-hidden="true"></div>

    <div class="vp-lock__shield">
      <div class="vp-lock__scan" aria-hidden="true"></div>
      <svg class="vp-lock__icon" viewBox="0 0 48 48" aria-hidden="true">
        <rect class="vp-lock__icon-body" x="10" y="21" width="28" height="20" rx="4" />
        <path class="vp-lock__icon-shackle" d="M16 21v-5a8 8 0 0 1 16 0v5" fill="none" />
        <circle class="vp-lock__icon-keyhole" cx="24" cy="29" r="2.6" />
        <rect class="vp-lock__icon-keyslot" x="22.8" y="30.5" width="2.4" height="6" rx="1.2" />
      </svg>
    </div>

    <div class="vp-lock__kicker" aria-hidden="true">
      <span class="vp-lock__kicker-tick"></span>
      <span class="vp-lock__kicker-text" v-i18n>Access restricted</span>
      <span class="vp-lock__kicker-tick"></span>
    </div>

    <h3 class="vp-lock__title" v-i18n>Victory points are hidden until final scoring</h3>
    <p class="vp-lock__text" v-i18n>The final score is revealed after the game ends.</p>

    <div class="vp-lock__mode">
      <span class="vp-lock__mode-dot" aria-hidden="true"></span>
      <span v-i18n>Hidden score mode is on</span>
    </div>

    <button type="button" class="vp-lock__cta" @click="$emit('close')">
      <span v-i18n>Got it</span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';

export default defineComponent({
  name: 'HiddenVictoryPointsLock',
  emits: ['close'],
  data() {
    return {
      // One-shot "deny" shake/pulse on open (suppressed under reduced motion).
      deny: false,
      denyTimer: undefined as number | undefined,
    };
  },
  mounted(): void {
    if (prefersReducedMotion() || typeof window === 'undefined') {
      return;
    }
    this.deny = true;
    this.denyTimer = window.setTimeout(() => {
      this.deny = false;
    }, 640);
  },
  beforeUnmount(): void {
    if (this.denyTimer !== undefined) {
      window.clearTimeout(this.denyTimer);
    }
  },
});
</script>
