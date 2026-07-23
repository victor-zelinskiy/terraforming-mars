<template>
  <div class="con-task-host con-hydroconfirm" role="dialog" :aria-label="$t('Reinforce the hydronetwork')">
    <!-- An INNER layer of the hydro section (child mount — outside the
         surface-motion hooks): carries its OWN dim + entry. -->
    <div class="con-hydroconfirm__backdrop" aria-hidden="true"></div>
    <div class="con-task con-hydroconfirm__frame">
      <!-- ── Header ────────────────────────────────────────────────── -->
      <header class="con-task__head">
        <div class="con-task__kicker">
          <span class="con-task__kicker-mark" aria-hidden="true">≈</span>
          <span>{{ $t('Confirmation') }}</span>
        </div>
        <div class="con-task__title">{{ $t('Reinforce the hydronetwork') }}</div>
      </header>

      <div class="con-task__body con-hydroconfirm__body">
        <!-- ── The route: which stage, from where ─────────────────── -->
        <div class="con-hydroconfirm__route">
          <span class="con-hydroconfirm__stage-id">
            <span v-if="stage !== undefined && stage.tag !== undefined" class="con-hydroconfirm__tag resource-tag" :class="'tag-' + stage.tag" aria-hidden="true"></span>
            <span v-else-if="stage !== undefined && stage.vp !== undefined" class="con-hydroconfirm__vp-pill">{{ stage.vp }} {{ $t('VP') }}</span>
            <b class="con-hydroconfirm__stage-name">{{ $t(stageName) }}</b>
          </span>
          <span class="con-hydroconfirm__route-path">
            {{ model.currentPosition }} <span aria-hidden="true">→</span> <b>{{ model.selectedPosition }}</b>
            <span class="con-hydroconfirm__route-of">· {{ stageOfText }}</span>
          </span>
        </div>

        <!-- ── Bonus: the CHOICE lives here (pos 1/2) — LB/RB switch, A
             confirms the highlighted one; the result below updates live. ── -->
        <template v-if="isChoice">
          <div class="con-start__section-title con-hydroconfirm__bonus-head">
            <span>{{ $t('Choose a bonus') }}</span>
            <span class="con-hydroconfirm__bonus-keys" aria-hidden="true">
              <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
              <span>{{ $t('Switch bonus') }}</span>
            </span>
          </div>
          <div class="con-hydroconfirm__bonuses">
            <button v-for="(opt, idx) in bonusOptions" :key="idx" type="button"
                    class="con-hydroconfirm__bonus"
                    :class="{'con-hydroconfirm__bonus--selected': rewardChoice === idx}"
                    @click="choose(idx)">
              <span class="con-hydroconfirm__bonus-badge" aria-hidden="true">{{ idx + 1 }}</span>
              <HydroReward :chips="opt" />
              <span class="con-hydroconfirm__bonus-tick" aria-hidden="true">✓</span>
            </button>
          </div>
        </template>

        <!-- ── Cost ──────────────────────────────────────────────────── -->
        <div class="con-start__section-title">{{ $t('You will spend') }}</div>
        <div class="con-hydroconfirm__spend">
          <i class="con-task__opt-icon resource_icon resource_icon--energy" aria-hidden="true"></i>
          <b class="con-hydroconfirm__spend-num">−{{ model.selectedSpend }}</b>
          <span class="con-hydroconfirm__beforeafter">{{ model.availableEnergy }} <span aria-hidden="true">→</span> <b>{{ model.availableEnergy - model.selectedSpend }}</b></span>
        </div>

        <!-- ── Result: what the player actually gets ────────────────── -->
        <div class="con-start__section-title">{{ $t('You will gain') }}</div>
        <div class="con-hydroconfirm__gains">
          <div v-for="(l, i) in rewardView.lines" :key="i" class="con-hydroconfirm__delta" :class="{'con-hydroconfirm__delta--zero': l.delta === 0}">
            <span class="con-hydroconfirm__delta-ico" :class="{'con-hydroconfirm__delta-ico--prod': l.production}">
              <span class="con-hydroconfirm__delta-img" :class="deltaIconClass(l)" aria-hidden="true"></span>
            </span>
            <span v-if="l.labelKey" class="con-hydroconfirm__delta-label">{{ $t(l.labelKey) }}:</span>
            <span class="con-hydroconfirm__beforeafter"><b>{{ l.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydroconfirm__after">{{ l.after }}</b></span>
            <span v-if="l.delta !== 0" class="con-hydroconfirm__plus">+{{ l.delta }}</span>
            <span v-else class="con-hydroconfirm__zero">{{ $t('No change') }}</span>
            <span v-if="l.cardName" class="con-hydroconfirm__delta-card">{{ $t(l.cardName) }}</span>
            <span v-if="l.noteKey" class="con-hydroconfirm__delta-note">{{ $t(l.noteKey) }}: {{ l.noteValue }}</span>
          </div>
          <div v-if="rewardView.lines.length === 0 && rewardView.rawChips.length > 0" class="con-hydroconfirm__rawchips">
            <HydroReward :chips="rewardView.rawChips" />
          </div>
          <div v-if="rewardView.vp !== undefined" class="con-hydroconfirm__vpline">
            <span class="con-hydroconfirm__vp-pill con-hydroconfirm__vp-pill--big">{{ rewardView.vp }} {{ $t('VP') }}</span>
            <span>{{ $t('VP at game end') }}</span>
          </div>
        </div>

        <!-- The pre-picked card (pos 7 reuse-action / pos 9 animals). -->
        <div v-if="model.mustSelectCard && model.selectedCard !== undefined" class="con-hydroconfirm__card">
          <span class="con-hydroconfirm__card-label">{{ cardLabel }}:</span>
          <b>{{ $t(model.selectedCard) }}</b>
          <span class="con-hydroconfirm__tick" aria-hidden="true">✓</span>
        </div>

        <!-- Follow-up flow, honestly announced. -->
        <div v-if="rewardView.followUpKey" class="con-hydroconfirm__note">
          <span aria-hidden="true">↳</span> {{ $t(rewardView.followUpKey) }}
        </div>

        <!-- ── Warnings ─────────────────────────────────────────────── -->
        <div v-if="model.skippedStages.length > 0" class="con-task__warnings">
          <div class="con-task__warning con-hydroconfirm__skips">
            <div class="con-hydroconfirm__skips-head">⚠ {{ $t('Skipped rewards') }} — {{ $t('Intermediate rewards are not granted.') }}</div>
            <div v-for="s in model.skippedStages" :key="s.position" class="con-hydroconfirm__skip">
              <span class="con-hydroconfirm__skip-name">{{ s.position }} · {{ $t(s.nameKey) }}</span>
              <HydroReward v-if="s.rewardOptions.length === 1" :chips="s.rewardOptions[0]" :compact="true" />
              <template v-else-if="s.rewardOptions.length > 1">
                <HydroReward :chips="s.rewardOptions[0]" :compact="true" />
                <span class="con-hydroconfirm__skip-or">{{ $t('or') }}</span>
                <HydroReward :chips="s.rewardOptions[1]" :compact="true" />
              </template>
            </div>
          </div>
        </div>
        <div v-if="model.destination !== undefined && model.destination.jumpedOverVp2" class="con-task__warnings">
          <div class="con-task__warning">⤴ {{ $t('The occupied 2 VP position is leapt over to reach the 5 VP slot.') }}</div>
        </div>
        <div v-if="rewardFizzles" class="con-task__warnings">
          <div class="con-task__warning">⚑ {{ $t('This reward will be skipped') }} — {{ $t(fizzleReason) }}</div>
        </div>
      </div>

      <!-- Command contract (A Confirm · B Back) lives in the global
           command bar (CONSOLE_TV_PREMIUM_PLAN §3.2). -->
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE HYDRO CONFIRM — the console-native confirmation modal for
 * «Укрепить гидросеть» (Hydronet full rework). Opened by the hydro screen's
 * CTA ONLY when the move is confirmable; shows the COMPLETE consequence
 * before anything is submitted:
 *
 *  - the route (stage identity, position, steps);
 *  - the exact energy cost as a before → after readout;
 *  - the computed "you will gain" deltas from the SAME pure buildRewardView
 *    the desktop overlay uses (the bonus for pos 1/2 is chosen on the plan
 *    screen — here it is FIXED, already baked into these deltas; B goes back
 *    to change it);
 *  - the pre-picked card (pos 7/9), follow-up flows, skipped-reward and
 *    jump-over warnings.
 *
 * The modal appears even when the reward is fixed / single — it IS the
 * premium "what exactly happens" beat, with no way to alter the choice. A =
 * confirm (emits up; the shell submits the byte-identical batch), B = back
 * (nothing committed).
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import {HydroModel} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HydroStage, HydroRewardChip} from '@/client/components/hydronetwork/hydroStages';
import {HydroDeltaLine, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleActionOverrides} from '@/client/console/composables/consoleActionModel';
import {hydroNetworkState} from '@/client/components/hydronetwork/hydroNetworkState';

/** Confirm-dialog semantics: A = confirm, B = cancel (the advertised verbs). */
const CONFIRM_DIALOG_OVERRIDES: ConsoleActionOverrides = {confirm: 'confirm', back: 'cancel'};

export default defineComponent({
  name: 'ConsoleHydroConfirm',
  components: {GamepadGlyph, HydroReward},
  props: {
    model: {type: Object as PropType<HydroModel>, required: true},
    rewardView: {type: Object as PropType<HydroRewardView>, required: true},
  },
  emits: ['confirm', 'cancel'],
  computed: {
    stage(): HydroStage | undefined {
      return this.model.targetStage;
    },
    /** This stage offers a bonus choice (pos 1/2) — the picker is shown. */
    isChoice(): boolean {
      return this.model.targetNeedsChoice && this.model.targetStage !== undefined;
    },
    bonusOptions(): ReadonlyArray<ReadonlyArray<HydroRewardChip>> {
      return this.model.targetStage?.rewardOptions ?? [];
    },
    /** The highlighted option (shared plan state — the section rebuilds the
     *  reward view + payload from it, so the result below tracks the pick). */
    rewardChoice(): number | undefined {
      return hydroNetworkState.rewardChoice;
    },
    stageName(): string {
      return this.stage?.nameKey ?? '';
    },
    stageOfText(): string {
      return translateTextWithParams('Stage ${0} of ${1}', [String(this.model.selectedPosition), '11']);
    },
    cardLabel(): string {
      return this.model.needsCardSelect === 'reuse-action' ? $t('Action') : $t('Card');
    },
    /** Pos 7/9 with an EMPTY candidate pool: the reward honestly fizzles. */
    rewardFizzles(): boolean {
      return this.model.needsCardSelect !== undefined && this.model.eligibleCardNames.length === 0;
    },
    fizzleReason(): string {
      return this.model.needsCardSelect === 'reuse-action' ?
        'No used actions to repeat' : 'No card can receive the animals';
    },
  },
  methods: {
    $t,
    /** Pick a bonus option (click / A on the card). */
    choose(idx: number): void {
      hydroNetworkState.rewardChoice = idx;
    },
    /** LB/RB / ↑↓ cycle through the options. */
    cycleChoice(step: 1 | -1): void {
      const options = this.bonusOptions.length;
      if (options <= 1) {
        return;
      }
      const cur = hydroNetworkState.rewardChoice ?? 0;
      this.choose(((cur + step) % options + options) % options);
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
    /** The shell/section routes every intent here while the modal is open.
     *  Foundation: the advertised A/B verbs route through the SEMANTIC action
     *  layer (a confirm dialog maps primary→confirm, back→cancel) so the
     *  handler can never drift from what the command bar shows. */
    handleIntent(intent: GamepadIntent): void {
      // ↑/↓ mirror LB/RB — switch the highlighted bonus on a choice stage.
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.cycleChoice(intent.dir === 'down' ? 1 : -1);
        return;
      }
      switch (consoleActionOf(intent, CONFIRM_DIALOG_OVERRIDES)) {
      case 'confirm':
        if (this.model.canConfirm) {
          this.$emit('confirm');
        }
        return;
      case 'cancel':
        this.$emit('cancel');
        return;
      case 'prevSection':
        this.cycleChoice(-1);
        return;
      case 'nextSection':
        this.cycleChoice(1);
        return;
      default:
        return;
      }
    },
  },
});
</script>
