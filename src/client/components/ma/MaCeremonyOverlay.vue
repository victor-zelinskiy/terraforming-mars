<template>
  <!--
    DESKTOP MA CEREMONY — the announcement channel for milestone claims /
    award fundings, for EVERY player at the table (it replaces the
    milestone/award notification card; the journal record is untouched).

    Two presentations off ONE queue (maCeremonyState):
    - OWN (the viewer just confirmed): the centred premium beat — gold
      "+5 VP" coronation / medal seal.
    - REMOTE (another player acted): an unobtrusive top-right beat (the
      notification zone) — compact art + the ACTOR named by colour chip;
      it never covers the centre of the screen or an open overlay's work
      area, but WHO took WHAT is explicit.

    pointer-events: none — the game stays fully interactive underneath.
    Fired by maCeremonyState's nonce; when a beat finishes the shell
    advances the queue (a poll can bring two events at once).
  -->
  <transition name="ma-cere" @after-leave="onGone">
    <div v-if="visible && event !== undefined"
         class="ma-cere"
         :class="['ma-cere--' + event.kind, {'ma-cere--remote': !event.own}]"
         aria-hidden="true">
      <div class="ma-cere__card">
        <div class="ma-cere__stage">
          <span class="ma-cere__ring"></span>
          <MaHeroArt :name="event.name" :kind="event.kind" class="ma-cere__hero" />
        </div>
        <div class="ma-cere__text">
          <div class="ma-cere__kicker">{{ $t(kickerKey) }}</div>
          <div class="ma-cere__name" v-i18n>{{ displayName }}</div>
          <div class="ma-cere__actor">
            <span class="ma-cere__actor-dot" :class="'player_bg_color_' + event.color"></span>
            <span>{{ event.actorName }}</span>
          </div>
          <div v-if="event.kind === 'milestone'" class="ma-cere__vp">+5 {{ $t('VP') }}</div>
          <div v-else-if="event.free" class="ma-cere__cost">{{ $t('Free sponsorship') }}</div>
          <div v-else-if="event.cost !== undefined" class="ma-cere__cost">
            {{ $t('Cost') }}: <b>{{ event.cost }}</b>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {advanceMaCeremony, maCeremonyState, MaCeremonyEvent} from '@/client/components/ma/maCeremonyState';
import {maDisplayName} from '@/client/components/ma/maArt';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {$t} from '@/client/directives/i18n';

const OWN_LIFETIME_MS = 2600;
const REMOTE_LIFETIME_MS = 2400;
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
      this.showCurrent();
    },
  },
  mounted() {
    // A beat queued while no shell was mounted (screen transition) is
    // picked up here instead of stalling the queue forever.
    this.showCurrent();
  },
  beforeUnmount() {
    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
    }
  },
  methods: {
    $t,
    showCurrent(): void {
      if (this.event === undefined) {
        return;
      }
      if (this.hideTimer !== undefined) {
        clearTimeout(this.hideTimer);
      }
      this.visible = true;
      const base = prefersReducedMotion() ? REDUCED_LIFETIME_MS :
        this.event.own ? OWN_LIFETIME_MS : REMOTE_LIFETIME_MS;
      this.hideTimer = setTimeout(() => {
        this.visible = false;
        this.hideTimer = undefined;
      }, motionMs(base));
    },
    /** The leave transition finished — hand the stage to the next queued beat. */
    onGone(): void {
      advanceMaCeremony();
    },
  },
});
</script>
