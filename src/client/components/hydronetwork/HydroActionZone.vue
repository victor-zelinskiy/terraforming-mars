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

      <!-- Who has ALREADY been through this stage + what they took — so a cell that
           other players stopped at OR leapt over is never opaque. Reward-takers
           (stood here / stopped & moved on) show their reward; pass-throughs (leapt
           over without stopping) show "passed — no reward". -->
      <div v-if="model.targetVisitors.length > 0" class="hydro-action__visitors">
        <span class="hydro-action__visitors-label" v-i18n>Stage history</span>
        <span v-for="v in model.targetVisitors" :key="v.color"
              class="hydro-action__visitor" :class="{'hydro-action__visitor--passed': v.status === 'passed'}">
          <span class="hydro-action__visitor-dot" :class="'player_bg_color_' + v.color" aria-hidden="true"></span>
          <span class="hydro-action__visitor-name">{{ displayName(v) }}</span>
          <span class="hydro-action__visitor-took">
            <span v-if="v.status === 'passed'" class="hydro-action__visitor-none" v-i18n>{{ v.isMarsBot ? 'Advanced through' : 'Passed through — no reward' }}</span>
            <HydroReward v-else-if="historyReward(v.choice).length > 0" :chips="historyReward(v.choice)" :compact="true" />
            <span v-else-if="targetStage && targetStage.vp !== undefined" class="hydro-action__visitor-vp">{{ targetStage.vp }} <span v-i18n>VP</span></span>
            <span v-else class="hydro-action__visitor-none" v-i18n>No reward</span>
          </span>
        </span>
      </div>

      <!-- Preselection BEFORE confirm (pos 7 / 9): always via the dedicated premium
           pick-mode overlay — ДЕЙСТВИЯ for the reuse-action, РАЗЫГРАНО for the
           animal target. No inline tile grid (the >3 threshold is not used here). -->
      <div v-if="model.needsCardSelect" class="hydro-action__preselect">
        <span class="hydro-action__preselect-label" v-i18n>{{ preselectLabel }}</span>
        <template v-if="model.eligibleCardNames.length > 0">
          <span v-if="model.selectedCard !== undefined" class="hydro-action__picked">
            <!-- The chosen action / card name is an interactive chip: hover → a
                 card preview popover, click → fullscreen (the fork's universal
                 JournalCardChip, reused outside the journal). -->
            <JournalCardChip :name="model.selectedCard" />
            <span v-if="selectedAnimalCurrent !== undefined" class="hydro-action__pick-cur">
              <span class="card-resource card-resource-animal" aria-hidden="true"></span>{{ selectedAnimalCurrent }}
            </span>
            <span class="hydro-action__picked-tick" aria-hidden="true">✓</span>
          </span>
          <button type="button" class="hydro-action__pick-btn" @click="openPick">
            <span v-i18n>{{ model.selectedCard !== undefined ? 'Change selection' : pickButtonLabel }}</span>
          </button>
        </template>
        <span v-else class="hydro-action__pick-disabled" :data-hint="noCandidatesHint">
          <button type="button" class="hydro-action__pick-btn" disabled>
            <span v-i18n>{{ pickButtonLabel }}</span>
          </button>
        </span>
      </div>
      <!-- Nothing to pick → the bonus simply fizzles; the player may still advance. -->
      <div v-if="model.needsCardSelect && model.eligibleCardNames.length === 0" class="hydro-action__hintline">
        <span aria-hidden="true">⚑</span>
        <span v-i18n>This reward will be skipped</span>
      </div>

      <!-- Row 3: reward summary (deltas / choice / vp) + confirm. -->
      <div class="hydro-action__row3">
        <div class="hydro-action__reward-line">
          <span class="hydro-action__reward-label" v-i18n>You will gain</span>
          <!-- A reward choice (pos 1/2) not yet made → show the two options. -->
          <span v-if="rewardView.needsChoiceFirst && targetStage !== undefined" class="hydro-action__choices">
            <button v-for="(opt, idx) in targetStage.rewardOptions" :key="idx"
                    type="button" class="hydro-action__choice"
                    :class="{'hydro-action__choice--selected': rewardChoice === idx}"
                    @click="$emit('choice', idx)">
              <HydroReward :chips="opt" />
              <span class="hydro-action__choice-tick" aria-hidden="true">✓</span>
            </button>
          </span>
          <!-- Computed "before → after" delta lines. -->
          <span v-for="(l, i) in rewardView.lines" :key="i" class="hydro-action__delta">
            <span class="hydro-action__delta-ico" :class="{'hydro-action__delta-ico--prod': l.production}">
              <span class="hydro-action__delta-img" :class="deltaIconClass(l)" aria-hidden="true"></span>
            </span>
            <span v-if="l.labelKey" class="hydro-action__delta-label"><span v-i18n>{{ l.labelKey }}</span>:</span>
            <span class="hydro-action__delta-vals"><b>{{ l.before }}</b> <span class="hydro-action__delta-arrow" aria-hidden="true">→</span> <b class="hydro-action__delta-after">{{ l.after }}</b></span>
            <span class="hydro-action__delta-plus">+{{ l.delta }}</span>
            <span v-if="l.cardName" class="hydro-action__delta-card" v-i18n>{{ l.cardName }}</span>
            <span v-if="l.noteKey" class="hydro-action__delta-note"><span v-i18n>{{ l.noteKey }}</span>: {{ l.noteValue }}</span>
          </span>
          <!-- Flow-resolved rewards (draw / reuse / animals-before-pick): raw chip. -->
          <HydroReward v-if="rewardView.lines.length === 0 && rewardView.rawChips.length > 0" :chips="rewardView.rawChips" />
          <span v-if="rewardView.vp !== undefined" class="hydro-action__reward-vp">
            <span class="hydro-action__reward-vp-num">{{ rewardView.vp }}</span>
            <span v-i18n>VP at game end</span>
          </span>
        </div>
        <div class="hydro-action__cta-row" :data-hint="ctaDisabledReason">
          <button type="button" class="hydro-action__cta" :disabled="!model.canConfirm" @click="$emit('confirm')">
            <span v-i18n>Reinforce the hydronetwork</span>
          </button>
        </div>
      </div>

      <!-- Secondary follow-up hint (muted, separate line — never shifts confirm). -->
      <div v-if="rewardView.followUpKey" class="hydro-action__hintline hydro-action__hintline--muted">
        <span aria-hidden="true">↳</span> <span v-i18n>{{ rewardView.followUpKey }}</span>
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

        <!-- The start has no reward and no per-stage history — show only a note. -->
        <div v-if="detailsStage.position === 0" class="hydro-action__note hydro-action__note--info">
          <span aria-hidden="true">⚑</span>
          <span v-i18n>The starting point of the Hydronetwork track.</span>
        </div>

        <div v-if="detailsStage.position > 0" class="hydro-action__reward-block">
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

        <!-- Per-player history (not applicable to the start). -->
        <div v-if="detailsStage.position > 0" class="hydro-action__history">
          <div class="hydro-action__history-label" v-i18n>Stage history</div>
          <div v-for="h in model.detailsHistory" :key="h.color" class="hydro-action__history-row" :class="{'hydro-action__history-row--viewer': h.isViewer}">
            <span class="hydro-action__history-player" :class="'player_translucent_bg_color_' + h.color">
              <span class="hydro-action__history-dot" :class="'player_bg_color_' + h.color" aria-hidden="true"></span>
              {{ displayName(h) }}
            </span>
            <span class="hydro-action__history-status" :class="'hydro-action__history-status--' + h.status">
              <template v-if="h.status === 'rewarded' || h.status === 'current'">
                <span v-i18n>{{ h.status === 'current' ? 'Here now' : 'Took the reward' }}</span>
                <span class="hydro-action__history-reward">
                  <HydroReward v-if="historyReward(h.choice).length > 0" :chips="historyReward(h.choice)" :compact="true" />
                  <span v-else-if="detailsStage.vp !== undefined" class="hydro-action__history-vp">{{ detailsStage.vp }} <span v-i18n>VP</span></span>
                </span>
              </template>
              <span v-else-if="h.status === 'passed'" v-i18n>{{ h.isMarsBot ? 'Advanced through' : 'Passed through — no reward' }}</span>
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
import {CardName} from '@/common/cards/CardName';
import {$t} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {HydroModel, HydroStageHistoryEntry} from './hydroNetworkModel';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {HydroStage, HydroRewardChip} from './hydroStages';
import {buildRewardView, HydroPlayerSnapshot, HydroDeltaLine, HydroRewardView} from './hydroReward';
import HydroReward from './HydroReward.vue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';

type EligibleCard = {name: CardName; current?: number};

export default defineComponent({
  name: 'HydroActionZone',
  components: {HydroReward, JournalCardChip},
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
    // The viewer's current resources / production / tags — drives the
    // "сейчас → станет" reward deltas.
    snapshot: {
      type: Object as () => HydroPlayerSnapshot,
      required: true,
    },
    // Candidate cards for a pos 7 / pos 9 pre-selection (name + current animals).
    eligibleCards: {
      type: Array as () => ReadonlyArray<EligibleCard>,
      default: () => [],
    },
  },
  emits: ['spend', 'choice', 'confirm', 'plan', 'pick-action', 'pick-played-card'],
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
    rewardView(): HydroRewardView {
      const sel = this.eligibleCards.find((c) => c.name === this.model.selectedCard);
      return buildRewardView({
        stage: this.model.targetStage,
        snapshot: this.snapshot,
        rewardChoice: this.rewardChoice,
        animalTargetCurrent: sel?.current,
        animalTargetCardName: this.model.selectedCard,
      });
    },
    preselectLabel(): string {
      return this.model.needsCardSelect === 'reuse-action' ?
        'Choose a used blue card action' : 'Choose a card for the animals';
    },
    pickButtonLabel(): string {
      return this.model.needsCardSelect === 'reuse-action' ? 'Choose an action' : 'Choose a card';
    },
    noCandidatesHint(): string {
      return this.model.needsCardSelect === 'reuse-action' ?
        $t('No used actions to repeat') : $t('No card can receive the animals');
    },
    // The animal count on the chosen pos-9 card (for the picked-chip preview).
    selectedAnimalCurrent(): number | undefined {
      if (this.model.needsCardSelect !== 'animal-target' || this.model.selectedCard === undefined) {
        return undefined;
      }
      return this.eligibleCards.find((c) => c.name === this.model.selectedCard)?.current;
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
      // A pos 7/9 card pick is MANDATORY — name what to choose first (the reward
      // can't be skipped per the rules, so the CTA stays blocked until picked).
      if (this.model.mustSelectCard && this.model.selectedCard === undefined) {
        return this.model.needsCardSelect === 'reuse-action' ?
          $t('First choose which action to repeat') : $t('First choose a card for the animals');
      }
      return $t('You cannot advance the track right now.');
    },
  },
  methods: {
    $t,
    /** The Automa seat's visible label localizes («Бот»); humans keep their name. */
    displayName(h: HydroStageHistoryEntry): string {
      return participantDisplayName(h);
    },
    deltaIconClass(l: HydroDeltaLine): string {
      if (l.special === 'jovian-tag') {
        return 'resource-tag tag-jovian';
      }
      if (l.special === 'animals') {
        return 'card-resource card-resource-animal';
      }
      return l.resource !== undefined ? iconClassFor(l.resource) : '';
    },
    setSpend(value: number): void {
      const clamped = Math.max(this.model.minSpend, Math.min(this.model.maxSpend, value));
      this.$emit('spend', clamped);
    },
    // Open the dedicated premium pick-mode overlay: ДЕЙСТВИЯ for the reuse-action
    // (pos 7, mirrors Viron/ProjectInspection), РАЗЫГРАНО for the animal target
    // (pos 9). The chosen card returns into hydroNetworkState.selectedCard.
    openPick(): void {
      const req = {title: this.preselectLabel, selectable: this.model.eligibleCardNames};
      if (this.model.needsCardSelect === 'reuse-action') {
        this.$emit('pick-action', req);
      } else if (this.model.needsCardSelect === 'animal-target') {
        this.$emit('pick-played-card', req);
      }
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
    // choice stage, else the single reward). Empty for VP-only stages. Works in
    // BOTH modes — the selected stage is detailsStage (details) or targetStage (plan).
    historyReward(choice: number | undefined): ReadonlyArray<HydroRewardChip> {
      const stage = this.detailsStage ?? this.targetStage;
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
