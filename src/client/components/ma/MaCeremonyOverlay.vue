<template>
  <!--
    DESKTOP MA CEREMONY — the premium post-confirm beat for the viewer's own
    milestone claim (gold, "+5 VP") / award funding (medal seal). The calmer
    desktop sibling of ConsoleMaCeremony: a centred glass card with the hero
    icon, one-shot glow, bounded lifetime. pointer-events: none — the game
    stays fully interactive underneath. Fired by maCeremonyState's nonce
    (only when the fresh playerView proves the viewer's own action resolved);
    the viewer's own prestige notification is suppressed while this plays.
  -->
  <transition name="ma-cere">
    <div v-if="visible && event !== undefined"
         class="ma-cere"
         :class="'ma-cere--' + event.kind"
         aria-hidden="true">
      <div class="ma-cere__card">
        <div class="ma-cere__stage">
          <span class="ma-cere__ring"></span>
          <MaHeroArt :name="event.name" :kind="event.kind" class="ma-cere__hero" />
        </div>
        <div class="ma-cere__text">
          <div class="ma-cere__kicker">{{ $t(kickerKey) }}</div>
          <div class="ma-cere__name" v-i18n>{{ displayName }}</div>
          <div v-if="event.kind === 'milestone'" class="ma-cere__vp">+5 {{ $t('VP') }}</div>
          <div v-else class="ma-cere__cost">
            <template v-if="event.free">{{ $t('Free sponsorship') }}</template>
            <template v-else>
              {{ $t('Cost') }}: <b>{{ event.cost }}</b>
              <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
            </template>
          </div>
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

const LIFETIME_MS = 2600;
const REDUCED_LIFETIME_MS = 1400;

export default defineComponent({
  name: 'MaCeremonyOverlay',
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
      const base = prefersReducedMotion() ? REDUCED_LIFETIME_MS : LIFETIME_MS;
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
