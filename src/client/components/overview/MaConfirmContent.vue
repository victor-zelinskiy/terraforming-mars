<template>
  <!--
    Client-side premium confirmation for claiming a milestone / funding an
    award. Hosted inside MandatoryInputModal (like PassConfirmContent) —
    NOTHING has been submitted when this renders, so Cancel is a pure
    client-side close. The view-model (maConfirmModel) is rebuilt from the
    live playerView on every commit, so a slot raced away while the modal is
    open re-renders as an honest blocked state (never a dead submit).
  -->
  <div class="ma-confirm" :class="'ma-confirm--' + view.kind">
    <h3 class="ma-confirm__title" v-i18n>{{ title }}</h3>

    <div class="ma-confirm__main">
      <!-- Hero stage: the 512×512 premium icon on a pedestal (never cropped). -->
      <div class="ma-confirm__side">
        <div class="ma-confirm__stage" aria-hidden="true">
          <MaHeroArt :name="view.name" :kind="view.kind" />
        </div>
        <div class="ma-confirm__name" v-i18n>{{ view.displayName }}</div>
      </div>

      <div class="ma-confirm__info">
        <p class="ma-confirm__desc" v-i18n>{{ view.description }}</p>

        <!-- MILESTONE: progress vs threshold + the immediate-5-VP truth. -->
        <template v-if="view.kind === 'milestone'">
          <div class="ma-confirm__progress">
            <span class="ma-confirm__progress-label" v-i18n>Your progress</span>
            <span class="ma-confirm__progress-value">
              <b>{{ view.myScore }}</b><span v-if="view.threshold !== undefined" class="ma-confirm__progress-req">/{{ view.threshold }}</span>
            </span>
            <span v-if="view.threshold !== undefined" class="ma-confirm__meter" aria-hidden="true"><i :style="{width: meterWidth}"></i></span>
          </div>
          <div class="ma-confirm__vp" data-test="ma-confirm-vp">
            <span class="ma-confirm__vp-badge">+5 {{ $t('VP') }}</span>
            <span class="ma-confirm__vp-note" v-i18n>Milestones grant 5 victory points immediately when claimed.</span>
          </div>
        </template>

        <!-- AWARD: the endgame-scoring truth + the live race. -->
        <template v-else>
          <div class="ma-confirm__endgame" data-test="ma-confirm-endgame">
            <b v-i18n>The award grants no victory points now.</b>
            <span v-i18n>{{ endgameRuleKey }}</span>
          </div>
          <div class="ma-confirm__race">
            <div class="ma-confirm__race-head" v-i18n>Current race</div>
            <div v-for="r in view.race" :key="r.color"
                 class="ma-confirm__racer"
                 :class="{'ma-confirm__racer--viewer': r.viewer, 'ma-confirm__racer--leader': r.leader}">
              <span class="ma-confirm__racer-dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
              <span class="ma-confirm__racer-name">{{ r.viewer ? $t('You') : r.name }}</span>
              <span v-if="r.leader" class="ma-confirm__racer-crown" aria-hidden="true">◆</span>
              <span class="ma-confirm__racer-score">{{ r.score }}</span>
            </div>
            <div class="ma-confirm__race-tone" :class="'ma-confirm__race-tone--' + view.raceTone">
              <template v-if="view.raceTone === 'lead'">{{ $t('You lead') }}</template>
              <template v-else-if="view.raceTone === 'tie'">{{ $t('Tied for the lead') }}</template>
              <template v-else-if="view.raceTone === 'behind'">{{ $t('Leader') }}: {{ view.leaderScore }}</template>
              <template v-else>{{ $t('No one has scored in this race yet') }}</template>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Economy + slot economics strip. -->
    <div class="ma-confirm__strip">
      <span v-if="view.free" class="ma-confirm__free-chip" v-i18n>Free sponsorship</span>
      <span v-else class="ma-confirm__spend" data-test="ma-confirm-spend">
        <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
        <b class="ma-confirm__spend-num">−{{ view.cost }}</b>
        <span class="ma-confirm__beforeafter">{{ view.mcBefore }} <span aria-hidden="true">→</span> <b>{{ view.mcAfter }}</b></span>
      </span>
      <span class="ma-confirm__slots">
        {{ $t(view.kind === 'milestone' ? 'Claimed' : 'Funded') }} <b>{{ view.takenCount }}/{{ view.maxSlots }}</b>
        · {{ $t('Slots left after') }}: <b>{{ view.openAfter }}</b>
      </span>
    </div>

    <!-- Honest stale state (someone took the slot while this was open). -->
    <div v-if="blockReason !== ''" class="ma-confirm__blocked" data-test="ma-confirm-blocked">
      <span aria-hidden="true">✕</span>
      <span v-i18n>{{ blockReason }}</span>
    </div>

    <div class="ma-confirm__actions">
      <button class="ma-confirm__cancel-btn" @click="$emit('cancel')" data-test="ma-confirm-cancel">
        <span class="ma-confirm__btn-label" v-i18n>Cancel</span>
      </button>
      <!-- Disabled-with-reason: the tooltip rides the NON-disabled wrapper
           (a disabled button never fires :hover — project rule). -->
      <span class="ma-confirm__confirm-wrap" :data-hint="blockReason !== '' ? $t(blockReason) : ''">
        <button class="ma-confirm__confirm-btn"
                :disabled="!canConfirm"
                @click="onConfirm"
                data-test="ma-confirm-confirm">
          <span class="ma-confirm__btn-label" v-i18n>{{ ctaLabel }}</span>
        </button>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {$t} from '@/client/directives/i18n';

export default defineComponent({
  name: 'MaConfirmContent',
  components: {MaHeroArt},
  props: {
    view: {type: Object as PropType<MaConfirmView>, required: true},
    /** '' = confirmable right now; else the CONCRETE blocker (i18n key). */
    blockReason: {type: String, default: ''},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {submitted: false};
  },
  computed: {
    title(): string {
      if (this.view.kind === 'milestone') {
        return 'Claim the milestone';
      }
      return this.view.free ? 'Sponsor the award for free' : 'Fund the award';
    },
    ctaLabel(): string {
      return this.view.kind === 'milestone' ? 'Claim' : 'Fund';
    },
    endgameRuleKey(): string {
      return this.view.race.length > 2 ?
        'At game end: 5 VP for 1st place, 2 VP for 2nd.' :
        'At game end: 5 VP for 1st place.';
    },
    meterWidth(): string {
      const t = this.view.threshold ?? 0;
      if (t <= 0) {
        return '0%';
      }
      return `${Math.min(100, Math.round((this.view.myScore / t) * 100))}%`;
    },
    canConfirm(): boolean {
      return this.blockReason === '' && !this.submitted;
    },
  },
  watch: {
    'view.name'() {
      this.submitted = false;
    },
  },
  methods: {
    $t,
    onConfirm(): void {
      if (!this.canConfirm) {
        return;
      }
      this.submitted = true; // one-shot: a double-click can never double-submit
      this.$emit('confirm');
    },
  },
});
</script>
