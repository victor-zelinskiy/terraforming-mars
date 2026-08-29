<template>
  <!--
    THE DECISION STRIP — the reward decisions a movement plan owes, as ONE
    surface however many there are.

    Today's production plan is always length 1 (the stage-1/2 reward choice),
    and this strip IS that step: the single decision renders exactly the
    physical D-pad row the step always had. A longer plan changes only the
    DATA: the progress chip appears («Решение K из M»), the other decisions
    stand as a compact rail of stage chips (made ✓ / open ○, each named after
    its own stop — a choice never loses the stage it belongs to), and the
    ACTIVE decision keeps the same one-at-a-time options row. Nothing scrolls:
    the rail is a shrinkable flex row, the options row is always exactly one
    decision's, so the strip's height is bounded by construction.
  -->
  <div class="con-hydro__plansteps">
    <!-- The progress head — ONLY when there is a plan to walk (a «1 из 1»
         over a single choice is noise, not information). -->
    <div v-if="progress.total > 1" class="con-hydro__plansteps-head" data-unfold-item>
      <span class="con-hydro__plansteps-progress">
        {{ progressText }}
      </span>
      <div class="con-hydro__plansteps-rail" role="list">
        <span v-for="(s, i) in steps" :key="s.id"
              class="con-hydro__plansteps-chip"
              role="listitem"
              :class="{
                'con-hydro__plansteps-chip--done': s.chosen !== undefined,
                'con-hydro__plansteps-chip--active': i === activeIdx,
              }">
          <span class="con-hydro__plansteps-chip-mark" aria-hidden="true">{{ s.chosen !== undefined ? '✓' : '○' }}</span>
          <span class="con-hydro__plansteps-chip-pos">{{ s.stagePosition }}</span>
          <span class="con-hydro__plansteps-chip-name">{{ $t(s.stageNameKey) }}</span>
        </span>
      </div>
    </div>

    <!-- The ASK, named after the active decision's own stage. -->
    <div class="con-hydro__choice-ask" data-unfold-item>{{ $t('Choose the stage reward') }}</div>

    <!-- The ACTIVE decision — the physical D-pad row of its options. ONE
         object per option: the reward's icon is the hero, the honest
         «сейчас → станет» reading stands beside it. -->
    <div v-if="active !== undefined" class="con-hydro__choice-row" data-unfold-item>
      <template v-for="(opt, i) in active.options" :key="i">
        <span v-if="i > 0" class="con-hydro__choice-or" aria-hidden="true">{{ $t('or') }}</span>
        <button type="button"
                class="con-hydro__choice-card"
                :class="{
                  'con-hydro__choice-card--focused': stage === 'options' && focus === i,
                  'con-hydro__choice-card--selected': active.chosen === i,
                  'con-hydro__choice-card--muted': stage === 'confirm' && active.chosen !== i,
                }"
                @click="$emit('pick', i)">
          <template v-if="opt.line !== undefined">
            <span class="con-hydro__choice-socket"
                  :class="{'con-hydro__choice-socket--prod': opt.line.production}">
              <span class="con-hydro__choice-img" :class="iconClass(opt.line)" aria-hidden="true"></span>
            </span>
            <span class="con-hydro__choice-read">
              <span v-if="opt.line.labelKey" class="con-hydro__choice-name">{{ $t(opt.line.labelKey) }}</span>
              <span class="con-hydro__choice-values">
                <b>{{ opt.line.before }}</b>
                <i class="con-hydro__choice-arrow" aria-hidden="true">→</i>
                <b class="con-hydro__choice-after">{{ opt.line.after }}</b>
                <em v-if="opt.line.delta !== 0" class="con-hydro__plus">+{{ opt.line.delta }}</em>
              </span>
            </span>
          </template>
          <!-- A reward with no concrete delta still renders honestly through
               the shared chip renderer. -->
          <HydroReward v-else :chips="opt.chips" />
          <span class="con-hydro__choice-mark" :class="{'con-hydro__choice-mark--on': active.chosen === i}" aria-hidden="true">✓</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Presentation only: which decisions a plan holds, which is active and what
 * each offers is decided by the caller (today the hydro workspace's reward
 * step; tomorrow a server-declared movement plan). The strip renders the list
 * and emits the active decision's pick — focus and confirm stay the caller's,
 * exactly as they are for the single-step flow.
 */
import {defineComponent, PropType} from 'vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {HydroDeltaLine} from '@/client/components/hydronetwork/hydroReward';
import {HydroPlanDecision, hydroPlanProgress, HydroPlanProgress} from '@/client/console/hydroFlow/hydroPlanSteps';

export default defineComponent({
  name: 'ConsoleHydroPlanSteps',
  components: {HydroReward},
  props: {
    steps: {type: Array as PropType<ReadonlyArray<HydroPlanDecision>>, required: true},
    /** The focused option INSIDE the active decision. */
    focus: {type: Number, default: 0},
    /** Where the cursor stands: on the options, or on the commit below. */
    stage: {type: String as PropType<'options' | 'confirm'>, default: 'options'},
  },
  emits: ['pick'],
  computed: {
    progress(): HydroPlanProgress {
      return hydroPlanProgress(this.steps);
    },
    /** The decision the options row shows — the first open one, else the last
     *  (a fully-made plan keeps its final decision reviewable). */
    activeIdx(): number {
      if (this.progress.activeIdx >= 0) {
        return this.progress.activeIdx;
      }
      return this.steps.length - 1;
    },
    active(): HydroPlanDecision | undefined {
      return this.steps[this.activeIdx];
    },
    progressText(): string {
      return translateTextWithParams('Decision ${0} of ${1}',
        [String(Math.min(this.activeIdx + 1, this.progress.total)), String(this.progress.total)]);
    },
  },
  methods: {
    $t,
    iconClass(l: HydroDeltaLine): string {
      if (l.special === 'jovian-tag') {
        return 'resource-tag tag-jovian';
      }
      if (l.special === 'animals') {
        return 'card-resource card-resource-animal';
      }
      return l.resource !== undefined ? iconClassFor(l.resource) : '';
    },
  },
});
</script>
