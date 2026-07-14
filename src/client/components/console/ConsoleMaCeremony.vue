<template>
  <!--
    CONSOLE MA CEREMONY — the announcement channel for milestone claims /
    award fundings, for EVERY player at the table (it replaces the
    milestone/award notification card; the journal record is untouched).

    Two presentations off ONE queue (maCeremonyState):
    - OWN (the viewer just confirmed): the full cinematic — centre stage,
      coronation gold "+5 VP" / medal seal.
    - REMOTE (another player acted): an unobtrusive top-centre beat — no
      veil, compact art, the ACTOR named by colour chip — it never covers
      open overlays or interrupts an action, but WHO took WHAT is explicit.

    Like ConsoleTerraformingCeremony: pointer-events none (the game stays
    fully playable underneath — intents are NOT trapped), bounded lifetime
    through motionMs, one-shot animations, reduced-motion honest. When a
    beat finishes the shell advances the queue (a poll can bring two).
  -->
  <transition name="con-macere" @after-leave="onGone">
    <div v-if="visible && event !== undefined"
         class="con-macere"
         :class="['con-macere--' + event.kind, {'con-macere--remote': !event.own}]"
         aria-hidden="true">
      <template v-if="event.own">
        <div class="con-macere__veil"></div>
        <div class="con-macere__scene">
          <div class="con-macere__halo"></div>
          <div ref="stage" class="con-macere__stage">
            <span class="con-macere__ring"></span>
            <MaHeroArt :name="event.name" :kind="event.kind" class="con-macere__hero" />
          </div>
          <div class="con-macere__kicker">{{ $t(kickerKey) }}</div>
          <div class="con-macere__name" v-i18n>{{ displayName }}</div>
          <div class="con-macere__actor">
            <span class="con-macere__actor-dot" :class="'player_bg_color_' + event.color"></span>
            <span>{{ event.actorName }}</span>
          </div>
          <div v-if="event.kind === 'milestone'" class="con-macere__vp">
            <span class="con-macere__vp-num">+5</span>
            <span class="con-macere__vp-unit">{{ $t('VP') }}</span>
          </div>
          <div v-else-if="event.free" class="con-macere__cost">{{ $t('Free sponsorship') }}</div>
          <div v-else-if="event.cost !== undefined" class="con-macere__cost">
            <span>{{ $t('Cost') }}: <b>{{ event.cost }}</b></span>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </div>
        </div>
      </template>
      <!-- REMOTE: the unobtrusive top-centre beat — no veil, never blocking. -->
      <div v-else class="con-macere__strip">
        <div ref="stripStage" class="con-macere__strip-stage">
          <MaHeroArt :name="event.name" :kind="event.kind" class="con-macere__strip-hero" />
        </div>
        <div class="con-macere__strip-body">
          <div class="con-macere__kicker con-macere__strip-kicker">{{ $t(kickerKey) }}</div>
          <div class="con-macere__strip-name" v-i18n>{{ displayName }}</div>
          <div class="con-macere__actor">
            <span class="con-macere__actor-dot" :class="'player_bg_color_' + event.color"></span>
            <span>{{ event.actorName }}</span>
            <span v-if="event.kind === 'milestone'" class="con-macere__strip-vp">+5 {{ $t('VP') }}</span>
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
import {playCeremonyBurst, CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';
import {$t} from '@/client/directives/i18n';

/** The own coronation lingers a beat longer than the seal / a rival's beat. */
const MILESTONE_LIFETIME_MS = 3600;
const AWARD_LIFETIME_MS = 3000;
const REMOTE_LIFETIME_MS = 2800;
const REDUCED_LIFETIME_MS = 1600;

export default defineComponent({
  name: 'ConsoleMaCeremony',
  components: {MaHeroArt},
  data() {
    return {
      visible: false,
      hideTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      fx: undefined as CeremonyBurstHandle | undefined,
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
    this.stopFx();
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
      // The gsap burst layer (rings/sparks/flash) plays over the stage once
      // it exists — timed so the CSS hero entrance lands first.
      void this.$nextTick(() => this.playFx());
      const base = prefersReducedMotion() ? REDUCED_LIFETIME_MS :
        !this.event.own ? REMOTE_LIFETIME_MS :
          this.event.kind === 'milestone' ? MILESTONE_LIFETIME_MS : AWARD_LIFETIME_MS;
      this.hideTimer = setTimeout(() => {
        this.visible = false;
        this.hideTimer = undefined;
        this.stopFx();
      }, motionMs(base));
    },
    /** The coronation gets the full burst; a rival's remote beat only a calm
     *  ring ping — it must stay unobtrusive by contract. */
    playFx(): void {
      this.stopFx();
      const event = this.event;
      if (event === undefined || !this.visible) {
        return;
      }
      const host = (event.own ? this.$refs.stage : this.$refs.stripStage) as HTMLElement | undefined;
      if (host === undefined || host === null) {
        return;
      }
      this.fx = playCeremonyBurst({
        host,
        accent: event.kind === 'milestone' ? 'gold' : 'medal',
        reduced: prefersReducedMotion(),
        intensity: event.own ? 'full' : 'ping',
        delayMs: event.own ? 260 : 140,
      });
    },
    stopFx(): void {
      this.fx?.stop();
      this.fx = undefined;
    },
    /** The leave transition finished — hand the stage to the next queued beat. */
    onGone(): void {
      advanceMaCeremony();
    },
  },
});
</script>
