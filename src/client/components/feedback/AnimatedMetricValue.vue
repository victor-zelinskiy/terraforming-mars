<template>
  <!--
    Headless-style host: rendered as a sibling next to the actual
    number element (caller is expected to give the parent
    position: relative so the absolutely-positioned chip anchors
    correctly). When no delta is active the component renders an
    empty <span> placeholder — zero layout footprint.

    The chip is keyed on `chipNonce` so successive deltas REPLACE
    the chip (Vue tears down + remounts the inner DOM), which
    cleanly restarts the CSS animation. Merging keeps the same key
    but updates `displayedDelta` — chip stays mounted, value
    transitions in place.
  -->
  <span class="metric-feedback-host"
        :class="hostClasses"
        :data-metric-key="metricKey"
        aria-hidden="true">
    <!--
      `appear` is critical here. App.vue uses `<player-home :key="playerkey">`
      and bumps `playerkey` on every server poll, which REMOUNTS the whole
      tree (incl. this component) on every value-bearing update. Without
      `appear`, Vue skips the enter-animation on initial mount — and since
      "initial mount" happens every poll, NO enter would ever animate. With
      `appear` the chip animates in even when its parent component is fresh.
    -->
    <transition :name="transitionName" appear>
      <DeltaChip v-if="displayedDelta !== 0"
                 :key="chipNonce"
                 :amount="displayedDelta"
                 :variant="variant" />
    </transition>
  </span>
</template>

<script lang="ts">

import {defineComponent, PropType} from 'vue';
import DeltaChip, {DeltaChipVariant} from '@/client/components/feedback/DeltaChip.vue';
import {changeFeedbackManager, prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';

/*
 * Per-variant chip lifecycle timings (ms). Mirror the LESS animation
 * timings in resource_change_feedback.less so the chip JS-side
 * teardown matches the CSS fade-out end. Tweak both in lockstep.
 */
const CHIP_VISIBLE_MS: Record<DeltaChipVariant, number> = {
  'resource-stock': 1600,
  'resource-production': 1350,
  'tag': 1300,
  'misc': 1300,
};

export default defineComponent({
  name: 'AnimatedMetricValue',
  components: {DeltaChip},
  props: {
    /*
     * The metric's current numeric value. The watcher fires whenever
     * this prop changes. Initial mount does NOT fire feedback — the
     * first observation is the baseline.
     */
    value: {
      type: Number,
      required: true,
    },
    /*
     * Globally-unique identifier for the metric (e.g. 'megacredits.stock',
     * 'plants.production', 'tag.science', 'misc.cities'). Combined
     * with scopeKey to address an entry in changeFeedbackManager.
     */
    metricKey: {
      type: String,
      required: true,
    },
    /*
     * Identifier for the addressed entity (typically `player.color`).
     * Switching scopes (e.g. selecting a different player in the
     * panel) treats values for the new scope as a fresh baseline
     * rather than as a delta vs. the previously-shown scope.
     */
    scopeKey: {
      type: String,
      required: true,
    },
    /*
     * Optional epoch / runId. Concatenated into the manager key so
     * that a brand-new game session naturally re-baselines every
     * metric without manual reset.
     */
    epoch: {
      type: String,
      default: '',
    },
    variant: {
      type: String as PropType<DeltaChipVariant>,
      required: true,
    },
  },
  data() {
    return {
      displayedDelta: 0,
      chipNonce: 0,
      polarity: 'neutral' as 'positive' | 'negative' | 'neutral',
      hideTimerId: 0,
      clearActiveTimerId: 0,
      fullScopeKey: '',
    };
  },
  computed: {
    hostClasses(): Array<string> {
      const c: Array<string> = [`metric-feedback-host--${this.variant}`];
      if (this.displayedDelta !== 0) {
        c.push(`metric-feedback-host--active-${this.polarity}`);
      }
      return c;
    },
    transitionName(): string {
      return prefersReducedMotion() ? 'delta-chip-fade-reduced' : 'delta-chip-fade';
    },
  },
  watch: {
    /*
     * `scopeKey` / `epoch` change ⇒ the new context is a different
     * player or game. Stop any pending chip and re-baseline so the
     * caller's next `value` write doesn't fire a phantom delta vs.
     * the previous scope.
     */
    scopeKey: {
      handler(_newScope: string): void {
        this.handleScopeRefresh();
      },
    },
    epoch: {
      handler(_newEpoch: string): void {
        this.handleScopeRefresh();
      },
    },
    value(newValue: number): void {
      if (typeof newValue !== 'number' || Number.isNaN(newValue)) {
        return;
      }
      const event = changeFeedbackManager.report(this.fullScopeKey, this.metricKey, newValue);
      if (event === null) {
        return;
      }
      this.applyEvent(event.netDelta);
    },
  },
  mounted() {
    this.fullScopeKey = this.computeFullScopeKey();
    /*
     * IMPORTANT: App.vue forces a full <player-home> tree remount on
     * every poll via `:key="playerkey"`. That means this component's
     * `watch(value)` will NEVER fire for a real game change — the
     * component is brand new each time. We must therefore report
     * the value on mount and ACT on the result, not just seed the
     * baseline.
     *
     * The first observation for a key (e.g. game start) returns null
     * and no chip appears. Every subsequent mount whose value differs
     * from the stored baseline returns a FeedbackEvent here — that's
     * the only path that actually fires the chip in practice.
     */
    const event = changeFeedbackManager.report(this.fullScopeKey, this.metricKey, this.value);
    if (event !== null) {
      this.applyEvent(event.netDelta);
    }
  },
  beforeUnmount() {
    this.clearTimers();
  },
  methods: {
    computeFullScopeKey(): string {
      if (this.epoch === '') {
        return this.scopeKey;
      }
      return `${this.epoch}|${this.scopeKey}`;
    },
    handleScopeRefresh(): void {
      // Tear down any visible chip — it represented the previous
      // scope's delta and would be misleading under the new scope.
      this.clearTimers();
      this.displayedDelta = 0;
      this.polarity = 'neutral';
      this.fullScopeKey = this.computeFullScopeKey();
      // Re-baseline against the now-current value. Subsequent
      // `value` writes for this fresh scope key behave normally.
      changeFeedbackManager.report(this.fullScopeKey, this.metricKey, this.value);
    },
    applyEvent(netDelta: number): void {
      this.clearTimers();
      this.displayedDelta = netDelta;
      this.polarity = netDelta > 0 ? 'positive' : (netDelta < 0 ? 'negative' : 'neutral');
      // Bump the chip key so the v-if transition restarts CSS
      // animations cleanly. We bump only when polarity SWITCHES
      // or when the chip was previously hidden — sustained
      // same-polarity merges should look like a continuous
      // accumulator updating in place, not a re-mount flash.
      // Always bumping keeps things simpler and visually consistent
      // for the v1; revisit if "merging continuity" matters more.
      this.chipNonce++;

      const lifetime = CHIP_VISIBLE_MS[this.variant];
      this.hideTimerId = (window.setTimeout(() => {
        this.displayedDelta = 0;
        this.hideTimerId = 0;
      }, lifetime) as unknown as number);

      // Clear the manager's active-delta window slightly after the
      // chip starts fading. Any further change will then start a
      // fresh chip with the raw delta rather than merging into the
      // already-faded chip.
      this.clearActiveTimerId = (window.setTimeout(() => {
        changeFeedbackManager.clearActive(this.fullScopeKey, this.metricKey);
        this.clearActiveTimerId = 0;
      }, lifetime + 150) as unknown as number);
    },
    clearTimers(): void {
      if (this.hideTimerId !== 0) {
        window.clearTimeout(this.hideTimerId);
        this.hideTimerId = 0;
      }
      if (this.clearActiveTimerId !== 0) {
        window.clearTimeout(this.clearActiveTimerId);
        this.clearActiveTimerId = 0;
      }
    },
  },
});
</script>
