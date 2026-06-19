<template>
  <section class="hydro-action" :class="{'hydro-action--readonly': !interactive}">
    <header class="hydro-action__head">
      <h3 class="hydro-action__title" v-i18n>Engineering work plan</h3>
      <span class="hydro-action__status" :class="'hydro-action__status--' + statusKind">
        <span class="hydro-action__status-dot" aria-hidden="true"></span>
        <span v-i18n>{{ statusLabel }}</span>
      </span>
    </header>

    <!-- Nothing reachable at all. -->
    <div v-if="model.maxSpend === 0" class="hydro-action__empty">
      <span class="hydro-action__empty-glyph" aria-hidden="true">≈</span>
      <span v-i18n>{{ emptyReason }}</span>
    </div>

    <template v-else>
      <!-- Energy selector. -->
      <div class="hydro-action__selector">
        <div class="hydro-action__energy">
          <span class="hydro-action__energy-icon resource_icon resource_icon--energy" aria-hidden="true"></span>
          <span class="hydro-action__energy-have">{{ model.availableEnergy }}</span>
          <span class="hydro-action__energy-label" v-i18n>available</span>
        </div>
        <div class="hydro-action__stepper">
          <button type="button" class="hydro-action__step" :disabled="model.selectedSpend <= model.minSpend"
                  :aria-label="$t('Spend less energy')" @click="setSpend(model.selectedSpend - 1)">−</button>
          <div class="hydro-action__spend">
            <span class="hydro-action__spend-num">{{ model.selectedSpend }}</span>
            <span class="hydro-action__spend-unit resource_icon resource_icon--energy" aria-hidden="true"></span>
          </div>
          <button type="button" class="hydro-action__step" :disabled="model.selectedSpend >= model.maxSpend"
                  :aria-label="$t('Spend more energy')" @click="setSpend(model.selectedSpend + 1)">+</button>
          <button type="button" class="hydro-action__max" @click="setSpend(model.maxSpend)">
            <span v-i18n>MAX</span> <span class="hydro-action__max-val">{{ model.maxSpend }}</span>
          </button>
        </div>
      </div>

      <!-- Destination summary. -->
      <div class="hydro-action__dest">
        <span class="hydro-action__dest-pos">{{ model.currentPosition }}</span>
        <span class="hydro-action__dest-arrow" aria-hidden="true">→</span>
        <span class="hydro-action__dest-pos hydro-action__dest-pos--target">{{ model.destinationPosition }}</span>
        <span class="hydro-action__dest-name" v-i18n>{{ targetName }}</span>
      </div>

      <!-- Tag path breakdown. -->
      <div v-if="hasTags" class="hydro-action__tags">
        <span class="hydro-action__tags-label" v-i18n>Required tags</span>
        <span class="hydro-action__tags-row">
          <span v-for="(t, i) in model.destination?.requiredTags ?? []" :key="i"
                class="hydro-action__tag resource-tag" :class="['tag-' + t, 'hydro-action__tag--' + tagStatus(t)]"
                aria-hidden="true"></span>
        </span>
      </div>

      <!-- Missing-tags alert (illegal destination). -->
      <div v-if="missingTags.length > 0" class="hydro-action__alert hydro-action__alert--rules">
        <span class="hydro-action__alert-glyph" aria-hidden="true">✕</span>
        <div class="hydro-action__alert-body">
          <div class="hydro-action__alert-head" v-i18n>Not enough tags</div>
          <div class="hydro-action__alert-text">
            <span v-i18n>Missing</span>:
            <span v-for="(t, i) in missingTags" :key="i" class="hydro-action__tag resource-tag" :class="'tag-' + t" aria-hidden="true"></span>
          </div>
        </div>
      </div>

      <!-- Occupied 2 VP that the move jumps over. -->
      <div v-if="model.destination?.jumpedOverVp2" class="hydro-action__note hydro-action__note--info">
        <span aria-hidden="true">⤴</span>
        <span v-i18n>The occupied 2 VP position is leapt over to reach the 5 VP slot.</span>
      </div>

      <!-- Reward (always shown). -->
      <div class="hydro-action__reward-block">
        <div class="hydro-action__reward-label" v-i18n>Reward</div>

        <!-- Reward choice (positions 1 / 2). -->
        <div v-if="model.targetNeedsChoice && targetStage !== undefined" class="hydro-action__choices">
          <button v-for="(opt, idx) in targetStage.rewardOptions" :key="idx"
                  type="button" class="hydro-action__choice"
                  :class="{'hydro-action__choice--selected': rewardChoice === idx}"
                  @click="$emit('choice', idx)">
            <HydroReward :chips="opt" />
            <span class="hydro-action__choice-tick" aria-hidden="true">✓</span>
          </button>
        </div>

        <!-- Fixed / special reward. -->
        <div v-else-if="targetStage !== undefined && targetStage.rewardOptions.length === 1" class="hydro-action__reward">
          <HydroReward :chips="targetStage.rewardOptions[0]" />
        </div>
        <div v-else class="hydro-action__reward hydro-action__reward--none">
          <span v-if="targetStage?.vp !== undefined" class="hydro-action__reward-vp">
            <span class="hydro-action__reward-vp-num">{{ targetStage.vp }}</span>
            <span v-i18n>VP at game end</span>
          </span>
          <span v-else v-i18n>No reward</span>
        </div>

        <!-- Follow-up notice (positions 5 / 7 / 9). -->
        <div v-if="model.targetFollowUp !== undefined" class="hydro-action__next">
          <span class="hydro-action__next-label" v-i18n>After confirming</span>
          <span class="hydro-action__next-text" v-i18n>{{ followUpText }}</span>
        </div>
      </div>

      <!-- Skipped intermediate rewards. -->
      <div v-if="model.skippedStages.length > 0" class="hydro-action__skipped">
        <span class="hydro-action__skipped-note" v-i18n>Intermediate rewards are not granted.</span>
        <span class="hydro-action__skipped-list">
          <span v-for="s in model.skippedStages" :key="s.position" class="hydro-action__skipped-item">
            <HydroReward :chips="s.rewardOptions[0]" :compact="true" />
          </span>
        </span>
      </div>

      <!-- Confirm. -->
      <div class="hydro-action__cta-row" :data-hint="ctaDisabledReason">
        <button type="button" class="hydro-action__cta"
                :disabled="!model.canConfirm"
                @click="$emit('confirm')">
          <span v-i18n>Reinforce the hydronetwork</span>
        </button>
      </div>
    </template>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {$t} from '@/client/directives/i18n';
import {HydroModel} from './hydroNetworkModel';
import {HYDRO_FOLLOWUP_KEY, HydroStage} from './hydroStages';
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
    // The advance action is in waitingFor — it is the viewer's window to act.
    actionAvailable: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['spend', 'choice', 'confirm'],
  computed: {
    interactive(): boolean {
      return this.actionAvailable && !this.model.usedThisGeneration;
    },
    targetStage(): HydroStage | undefined {
      return this.model.targetStage;
    },
    targetName(): string {
      return this.targetStage?.nameKey ?? '';
    },
    hasTags(): boolean {
      return (this.model.destination?.requiredTags.length ?? 0) > 0;
    },
    missingTags(): ReadonlyArray<Tag> {
      return (this.model.destination?.missingTags ?? []) as ReadonlyArray<Tag>;
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
    emptyReason(): string {
      if (this.model.atEndOfTrack) {
        return 'You have reached the end of the Delta Project track.';
      }
      if (this.model.availableEnergy === 0) {
        return 'You have no energy to advance the track.';
      }
      return 'You cannot advance the track right now.';
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
  },
});
</script>
