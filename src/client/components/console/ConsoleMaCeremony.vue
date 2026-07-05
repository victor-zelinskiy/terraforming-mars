<template>
  <!--
    CONSOLE MA CEREMONY — the cinematic post-confirm beat for a milestone
    claim (coronation: gold, "+5 VP", the strongest moment — the player just
    EARNED points) and an award funding (official seal: the sponsorship is
    approved). Fired by maCeremonyState's nonce — which bumps ONLY when the
    fresh playerView proves the viewer's own claim/fund resolved (never on
    reload, never for a lost race, never for other players).

    Like ConsoleTerraformingBanner: pointer-events none (the game stays
    fully playable underneath — intents are NOT trapped), bounded lifetime
    through motionMs, one-shot animations, reduced-motion honest.
  -->
  <transition name="con-macere">
    <div v-if="visible && event !== undefined"
         class="con-macere"
         :class="'con-macere--' + event.kind"
         aria-hidden="true">
      <div class="con-macere__veil"></div>
      <div class="con-macere__scene">
        <div class="con-macere__halo"></div>
        <div class="con-macere__stage">
          <span class="con-macere__ring"></span>
          <MaHeroArt :name="event.name" :kind="event.kind" class="con-macere__hero" />
        </div>
        <div class="con-macere__kicker">{{ $t(kickerKey) }}</div>
        <div class="con-macere__name" v-i18n>{{ displayName }}</div>
        <div v-if="event.kind === 'milestone'" class="con-macere__vp">
          <span class="con-macere__vp-num">+5</span>
          <span class="con-macere__vp-unit">{{ $t('VP') }}</span>
        </div>
        <div v-else class="con-macere__cost">
          <template v-if="event.free">{{ $t('Free sponsorship') }}</template>
          <template v-else>
            <span>{{ $t('Cost') }}: <b>{{ event.cost }}</b></span>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {maCeremonyState, MaCeremonyEvent} from '@/client/components/ma/maCeremonyState';
import {maDisplayName} from '@/client/components/ma/maArt';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {$t} from '@/client/directives/i18n';

/** The coronation lingers a beat longer than the award seal. */
const MILESTONE_LIFETIME_MS = 3600;
const AWARD_LIFETIME_MS = 3000;
const REDUCED_LIFETIME_MS = 1600;

export default defineComponent({
  name: 'ConsoleMaCeremony',
  components: {MaHeroArt},
  data() {
    return {
      visible: false,
      hideTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    nonce(): number {
      return maCeremonyState.nonce;
    },
    event(): MaCeremonyEvent | undefined {
      return maCeremonyState.current;
    },
    displayName(): string {
      return this.event !== undefined ? maDisplayName(this.event.name) : '';
    },
    kickerKey(): string {
      if (this.event?.kind === 'milestone') {
        return 'Milestone claimed';
      }
      return this.event?.free ? 'Award sponsored' : 'Award funded';
    },
  },
  watch: {
    nonce() {
      if (this.event === undefined) {
        return;
      }
      if (this.hideTimer !== undefined) {
        clearTimeout(this.hideTimer);
      }
      this.visible = true;
      const base = prefersReducedMotion() ? REDUCED_LIFETIME_MS :
        this.event.kind === 'milestone' ? MILESTONE_LIFETIME_MS : AWARD_LIFETIME_MS;
      this.hideTimer = setTimeout(() => {
        this.visible = false;
        this.hideTimer = undefined;
      }, motionMs(base));
    },
  },
  beforeUnmount() {
    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
    }
  },
  methods: {$t},
});
</script>
