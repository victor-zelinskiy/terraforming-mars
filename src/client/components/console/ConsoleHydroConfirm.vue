<template>
  <div class="con-task-host con-hydroconfirm" role="dialog" :aria-label="$t('Reinforce the hydronetwork')">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>
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

        <!-- ── Cost ──────────────────────────────────────────────────── -->
        <div class="con-start__section-title">{{ $t('You will spend') }}</div>
        <div class="con-hydroconfirm__spend">
          <i class="con-task__opt-icon resource_icon resource_icon--energy" aria-hidden="true"></i>
          <b class="con-hydroconfirm__spend-num">−{{ model.selectedSpend }}</b>
          <span class="con-hydroconfirm__beforeafter">{{ model.availableEnergy }} <span aria-hidden="true">→</span> <b>{{ model.availableEnergy - model.selectedSpend }}</b></span>
        </div>

        <!-- ── Bonus choice (pos 1/2) — still switchable HERE ───────── -->
        <template v-if="model.targetNeedsChoice && stage !== undefined">
          <div class="con-start__section-title con-hydroconfirm__bonus-head">
            <span>{{ $t('Bonus') }}</span>
            <span class="con-hydroconfirm__bonus-keys" aria-hidden="true">
              <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
              <span>{{ $t('Switch bonus') }}</span>
            </span>
          </div>
          <div v-for="(opt, idx) in stage.rewardOptions" :key="idx"
               class="con-task__option con-hydroconfirm__bonus"
               :class="{'con-task__option--focused': idx === rewardChoice}"
               @click="$emit('choice', idx)">
            <div class="con-task__option-main">
              <HydroReward :chips="opt" />
              <span v-if="idx === rewardChoice" class="con-hydroconfirm__tick" aria-hidden="true">✓</span>
            </div>
          </div>
        </template>

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

      <!-- ── Footer: the command contract ──────────────────────────── -->
      <footer class="con-task__foot" aria-hidden="true">
        <span class="con-task__foot-item"><GamepadGlyph control="confirm" /><span>{{ $t('Confirm') }}</span></span>
        <span v-if="model.targetNeedsChoice" class="con-task__foot-item"><GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" /><span>{{ $t('Bonus') }}</span></span>
        <span class="con-task__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Back') }}</span></span>
      </footer>
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
 *  - the chosen bonus (pos 1/2 — LB/RB still switch it here) and the
 *    computed "you will gain" deltas from the SAME pure buildRewardView
 *    the desktop overlay uses;
 *  - the pre-picked card (pos 7/9), follow-up flows, skipped-reward and
 *    jump-over warnings.
 *
 * The modal appears even when the reward is fixed / single — it IS the
 * premium "what exactly happens" beat. A = confirm (emits up; the shell
 * submits the byte-identical batch), B = back (nothing committed).
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import {HydroModel} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HydroStage} from '@/client/components/hydronetwork/hydroStages';
import {HydroDeltaLine, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';

export default defineComponent({
  name: 'ConsoleHydroConfirm',
  components: {GamepadGlyph, HydroReward},
  props: {
    model: {type: Object as PropType<HydroModel>, required: true},
    rewardChoice: {type: Number as PropType<number | undefined>, default: undefined},
    rewardView: {type: Object as PropType<HydroRewardView>, required: true},
  },
  emits: ['confirm', 'cancel', 'choice'],
  computed: {
    stage(): HydroStage | undefined {
      return this.model.targetStage;
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
    deltaIconClass(l: HydroDeltaLine): string {
      if (l.special === 'jovian-tag') {
        return 'resource-tag tag-jovian';
      }
      if (l.special === 'animals') {
        return 'card-resource card-resource-animal';
      }
      return l.resource !== undefined ? iconClassFor(l.resource) : '';
    },
    cycleChoice(step: 1 | -1): void {
      const options = this.stage?.rewardOptions.length ?? 0;
      if (options <= 1) {
        return;
      }
      const cur = this.rewardChoice ?? -1;
      this.$emit('choice', ((cur + step) % options + options) % options);
    },
    /** The shell/section routes every intent here while the modal is open. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.cycleChoice(intent.dir === 'down' ? 1 : -1);
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      this.onPress(intent.button);
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'bumperL':
        this.cycleChoice(-1);
        return;
      case 'bumperR':
        this.cycleChoice(1);
        return;
      case 'confirm':
        if (this.model.canConfirm) {
          this.$emit('confirm');
        }
        return;
      case 'back':
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
  },
});
</script>
