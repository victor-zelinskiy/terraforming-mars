<template>
  <section class="hydro-action" :class="{'hydro-action--readonly': !interactive, 'hydro-action--details': model.mode === 'details'}">
    <!-- ══ PLAN MODE (compact 3-row console) ══ -->
    <template v-if="model.mode === 'plan'">
      <header class="hydro-action__head">
        <h3 class="hydro-action__title" v-i18n>Engineering work plan</h3>
        <span class="hydro-action__status" :class="'hydro-action__status--' + statusKind">
          <span class="hydro-action__status-dot" aria-hidden="true"></span>
          <span v-i18n>{{ statusLabel }}</span>
        </span>
      </header>

      <!-- Row 1: energy + stepper + max + route summary (one line). -->
      <div class="hydro-action__row1">
        <div class="hydro-action__energy">
          <span class="hydro-action__energy-icon resource_icon resource_icon--energy" aria-hidden="true"></span>
          <span class="hydro-action__energy-have">{{ model.availableEnergy }}</span>
          <span class="hydro-action__energy-label" v-i18n>available</span>
        </div>
        <div class="hydro-action__stepper">
          <button type="button" class="hydro-action__step" :disabled="model.selectedSpend <= model.minSpend"
                  :aria-label="$t('Spend less energy')" @click="setSpend(model.selectedSpend - 1)">−</button>
          <div class="hydro-action__spend" :class="{'hydro-action__spend--over': !affordable}">
            <span class="hydro-action__spend-num">{{ model.selectedSpend }}</span>
            <span class="hydro-action__spend-unit resource_icon resource_icon--energy" aria-hidden="true"></span>
          </div>
          <button type="button" class="hydro-action__step" :disabled="model.selectedSpend >= model.stepperMax"
                  :aria-label="$t('Spend more energy')" @click="setSpend(model.selectedSpend + 1)">+</button>
          <button v-if="model.stepperMax >= 1" type="button" class="hydro-action__max" @click="setSpend(model.stepperMax)">
            <span v-i18n>MAX</span> <span class="hydro-action__max-val">{{ model.stepperMax }}</span>
          </button>
        </div>
        <div class="hydro-action__route">
          <span class="hydro-action__dest-pos">{{ model.currentPosition }}</span>
          <span class="hydro-action__dest-arrow" aria-hidden="true">→</span>
          <span class="hydro-action__dest-pos hydro-action__dest-pos--target">{{ model.selectedPosition }}</span>
          <span class="hydro-action__dest-name" v-i18n>{{ targetName }}</span>
        </div>
      </div>

      <!-- Row 2: a SINGLE compact status line (legal ✓ or a slim warn strip). -->
      <div v-if="legal && affordable" class="hydro-action__statusline hydro-action__statusline--ok">
        <span class="hydro-action__ok-glyph" aria-hidden="true">✓</span>
        <span v-i18n>All requirements met</span>
        <span class="hydro-action__statusline-tags">
          <span v-for="(t, i) in requiredTags" :key="i"
                class="hydro-action__tag hydro-action__tag--inline resource-tag" :class="'tag-' + t" aria-hidden="true"></span>
        </span>
      </div>
      <div v-else class="hydro-action__statusline hydro-action__statusline--warn">
        <span class="hydro-action__warn-glyph" aria-hidden="true">⚠</span>
        <span class="hydro-action__warn-head" v-i18n>Cannot advance here</span>:
        <span v-if="energyDeficit > 0" class="hydro-action__warn-part">
          <span class="hydro-action__warn-num">{{ energyDeficit }}</span>
          <span class="hydro-action__energy-icon resource_icon resource_icon--energy" aria-hidden="true"></span>
        </span>
        <span v-for="(t, i) in missingTags" :key="i"
              class="hydro-action__tag hydro-action__tag--inline resource-tag" :class="'tag-' + t" aria-hidden="true"></span>
        <span v-if="model.destination && model.destination.occupied" class="hydro-action__warn-occ" v-i18n>VP position occupied</span>
      </div>

      <!-- Thin one-line hints (skipped rewards / jump-over). -->
      <div v-if="model.skippedStages.length > 0" class="hydro-action__hintline">
        <span aria-hidden="true">⚑</span>
        <span v-i18n>Intermediate rewards are not granted — the skipped stages are marked on the track.</span>
      </div>
      <div v-if="model.destination && model.destination.jumpedOverVp2" class="hydro-action__hintline hydro-action__hintline--info">
        <span aria-hidden="true">⤴</span>
        <span v-i18n>The occupied 2 VP position is leapt over to reach the 5 VP slot.</span>
      </div>

      <!-- Row 3: reward (+ follow-up) on the left, confirm on the right. -->
      <div class="hydro-action__row3">
        <div class="hydro-action__reward-line">
          <span class="hydro-action__reward-label" v-i18n>You will gain</span>:
          <span v-if="model.targetNeedsChoice && targetStage !== undefined" class="hydro-action__choices">
            <button v-for="(opt, idx) in targetStage.rewardOptions" :key="idx"
                    type="button" class="hydro-action__choice"
                    :class="{'hydro-action__choice--selected': rewardChoice === idx}"
                    @click="$emit('choice', idx)">
              <HydroReward :chips="opt" />
              <span class="hydro-action__choice-tick" aria-hidden="true">✓</span>
            </button>
          </span>
          <HydroReward v-else-if="targetStage !== undefined && targetStage.rewardOptions.length === 1" :chips="targetStage.rewardOptions[0]" />
          <span v-else-if="targetStage && targetStage.vp !== undefined" class="hydro-action__reward-vp">
            <span class="hydro-action__reward-vp-num">{{ targetStage.vp }}</span>
            <span v-i18n>VP at game end</span>
          </span>
          <span v-else class="hydro-action__reward-none" v-i18n>No reward</span>
          <span v-if="model.targetFollowUp !== undefined" class="hydro-action__next-inline">
            · <span v-i18n>After confirming</span>: <span v-i18n>{{ followUpText }}</span>
          </span>
        </div>
        <div class="hydro-action__cta-row" :data-hint="ctaDisabledReason">
          <button type="button" class="hydro-action__cta" :disabled="!model.canConfirm" @click="$emit('confirm')">
            <span v-i18n>Reinforce the hydronetwork</span>
          </button>
        </div>
      </div>
    </template>

    <!-- ══ DETAILS / HISTORY MODE ══ -->
    <template v-else>
      <header class="hydro-action__head">
        <h3 class="hydro-action__title" v-i18n>Stage details</h3>
        <button type="button" class="hydro-action__back" @click="$emit('plan')">
          <span aria-hidden="true">↩</span> <span v-i18n>Back to plan</span>
        </button>
      </header>

      <div v-if="detailsStage !== undefined" class="hydro-action__details">
        <div class="hydro-action__details-id">
          <span v-if="detailsStage.tag !== undefined" class="hydro-action__tag resource-tag" :class="'tag-' + detailsStage.tag" aria-hidden="true"></span>
          <span class="hydro-action__details-name" v-i18n>{{ detailsStage.nameKey }}</span>
          <span class="hydro-action__details-pos">{{ model.selectedPosition }}</span>
        </div>

        <div class="hydro-action__reward-block">
          <div class="hydro-action__reward-label" v-i18n>Reward</div>
          <div class="hydro-action__reward">
            <template v-if="detailsStage.rewardOptions.length > 1">
              <HydroReward :chips="detailsStage.rewardOptions[0]" />
              <span class="hydro-action__skipped-or" v-i18n>or</span>
              <HydroReward :chips="detailsStage.rewardOptions[1]" />
            </template>
            <HydroReward v-else-if="detailsStage.rewardOptions.length === 1" :chips="detailsStage.rewardOptions[0]" />
            <span v-else-if="detailsStage.vp !== undefined" class="hydro-action__reward-vp">
              <span class="hydro-action__reward-vp-num">{{ detailsStage.vp }}</span>
              <span v-i18n>VP at game end</span>
            </span>
            <span v-else v-i18n>No reward</span>
          </div>
        </div>

        <!-- Per-player history. -->
        <div class="hydro-action__history">
          <div class="hydro-action__history-label" v-i18n>Stage history</div>
          <div v-for="h in model.detailsHistory" :key="h.color" class="hydro-action__history-row" :class="{'hydro-action__history-row--viewer': h.isViewer}">
            <span class="hydro-action__history-player" :class="'player_translucent_bg_color_' + h.color">
              <span class="hydro-action__history-dot" :class="'player_bg_color_' + h.color" aria-hidden="true"></span>
              {{ h.name }}
            </span>
            <span class="hydro-action__history-status" :class="'hydro-action__history-status--' + h.status">
              <template v-if="h.status === 'rewarded' || h.status === 'current'">
                <span v-i18n>{{ h.status === 'current' ? 'Here now' : 'Took the reward' }}</span>
                <span class="hydro-action__history-reward">
                  <HydroReward v-if="historyReward(h.choice).length > 0" :chips="historyReward(h.choice)" :compact="true" />
                  <span v-else-if="detailsStage.vp !== undefined" class="hydro-action__history-vp">{{ detailsStage.vp }} <span v-i18n>VP</span></span>
                </span>
              </template>
              <span v-else-if="h.status === 'passed'" v-i18n>Passed through — no reward</span>
              <span v-else v-i18n>Not reached yet</span>
            </span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {$t} from '@/client/directives/i18n';
import {HydroModel} from './hydroNetworkModel';
import {HYDRO_FOLLOWUP_KEY, HydroStage, HydroRewardChip} from './hydroStages';
import HydroReward from './HydroReward.vue';

export default defineComponent({
  name: 'HydroActionZone',
  components: {HydroReward},
  props: {
    model: {
      type: Object as () => HydroModel,
      required: true,
    },
    rewardChoice: {
      type: Number as () => number | undefined,
      default: undefined,
    },
    actionAvailable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['spend', 'choice', 'confirm', 'plan'],
  computed: {
    interactive(): boolean {
      return this.actionAvailable && !this.model.usedThisGeneration;
    },
    targetStage(): HydroStage | undefined {
      return this.model.targetStage;
    },
    detailsStage(): HydroStage | undefined {
      return this.model.detailsStage;
    },
    targetName(): string {
      return this.targetStage?.nameKey ?? '';
    },
    requiredTags(): ReadonlyArray<Tag> {
      return (this.model.destination?.requiredTags ?? []) as ReadonlyArray<Tag>;
    },
    missingTags(): ReadonlyArray<Tag> {
      return (this.model.destination?.missingTags ?? []) as ReadonlyArray<Tag>;
    },
    legal(): boolean {
      return this.model.destination?.legal ?? false;
    },
    affordable(): boolean {
      return this.model.destination?.affordable ?? false;
    },
    energyDeficit(): number {
      return this.model.destination?.energyDeficit ?? 0;
    },
    followUpText(): string {
      const f = this.model.targetFollowUp;
      return f !== undefined ? HYDRO_FOLLOWUP_KEY[f] : '';
    },
    statusKind(): 'ready' | 'used' | 'waiting' | 'end' {
      if (this.model.usedThisGeneration) {
        return 'used';
      }
      if (this.model.atEndOfTrack) {
        return 'end';
      }
      if (!this.actionAvailable) {
        return 'waiting';
      }
      return 'ready';
    },
    statusLabel(): string {
      switch (this.statusKind) {
      case 'used': return 'Already used this generation';
      case 'end': return 'End of the track reached';
      case 'waiting': return 'Not your turn';
      default: return 'Available: once per generation';
      }
    },
    ctaDisabledReason(): string {
      if (this.model.canConfirm) {
        return '';
      }
      if (this.model.usedThisGeneration) {
        return $t('Already used this generation');
      }
      if (!this.actionAvailable) {
        return $t('Not your turn');
      }
      if (this.energyDeficit > 0) {
        return $t('Not enough energy');
      }
      if (this.missingTags.length > 0) {
        return $t('Not enough tags');
      }
      if (this.model.targetNeedsChoice && this.rewardChoice === undefined) {
        return $t('Choose a reward');
      }
      return $t('You cannot advance the track right now.');
    },
  },
  methods: {
    $t,
    setSpend(value: number): void {
      const clamped = Math.max(this.model.minSpend, Math.min(this.model.maxSpend, value));
      this.$emit('spend', clamped);
    },
    tagStatus(tag: Tag): 'have' | 'wild' | 'missing' {
      const dest = this.model.destination;
      if (dest === undefined) {
        return 'have';
      }
      if ((dest.missingTags as ReadonlyArray<Tag>).includes(tag)) {
        return 'missing';
      }
      if ((dest.wildCoveredTags as ReadonlyArray<Tag>).includes(tag)) {
        return 'wild';
      }
      return 'have';
    },
    // The reward a history entry actually received (the chosen alternative for a
    // choice stage, else the single reward). Empty for VP-only stages.
    historyReward(choice: number | undefined): ReadonlyArray<HydroRewardChip> {
      const stage = this.detailsStage;
      if (stage === undefined || stage.rewardOptions.length === 0) {
        return [];
      }
      if (stage.rewardOptions.length > 1) {
        return stage.rewardOptions[choice ?? 0];
      }
      return stage.rewardOptions[0];
    },
  },
});
</script>
