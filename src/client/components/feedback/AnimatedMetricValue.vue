<template>
  <!--
    Headless-style host: rendered as a sibling next to the actual
    number element (caller is expected to give the parent
    position: relative so the absolutely-positioned chip anchors
    correctly). When no delta is active the component renders an
    empty <span> placeholder — zero layout footprint.

    The chip is keyed on `chipNonce`, and that key is bumped ONLY for
    a genuinely new event (nothing on screen, or the polarity flipped):
    Vue tears down + remounts the inner DOM, restarting the CSS
    animation. A COALESCED change keeps the same key and only updates
    `displayedDelta` — the chip stays mounted and counts up in place.

    That distinction is load-bearing, not a nicety. Bumping on every
    change made each update spawn a chip while the previous one was
    still running its 540ms leave — and leaving chips are siblings in
    this inline-block host, so they laid themselves out in a ROW. Seven
    cards landing in the hand dock printed «+3 +4 +5 +6» across the
    screen instead of one chip reaching +7.
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
import {perfMark} from '@/client/utils/perfMarks';
import {motionMs} from '@/client/components/motion/motionTokens';

/*
 * Per-variant chip lifecycle timings (ms) at the `standard` motion preset.
 * Mirror the LESS animation timings in resource_change_feedback.less so the
 * chip JS-side teardown matches the CSS fade-out end — BOTH sides scale by
 * the same motion preset (JS via motionMs(), CSS via `--motion-scale`), so
 * tweak the base numbers in lockstep and the presets follow automatically.
 */
const CHIP_VISIBLE_MS: Record<DeltaChipVariant, number> = {
  // resource-stock / resource-production / misc bumped +40% so the cell-row /
  // production-cell / bottom-bar highlight pulses (extended to match in
  // resource_change_feedback.less + player_home.less) play out fully before the
  // host's --active class is cleared, instead of being cut short.
  'resource-stock': 2240,
  'resource-production': 1890,
  'tag': 1300,
  'misc': 1820,
  'score': 1700,
  'global-parameter': 1600,
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
     * All three prop watchers funnel into a single `reconcile()`
     * method. Reasons:
     *
     *   1) Race-proof scope detection. Vue 3's watcher order on
     *      simultaneous prop changes can flip — if `value` fired
     *      before `scopeKey`, the old watch.value would `report()`
     *      with the stale `fullScopeKey` and chip-fire a spurious
     *      delta on every player switch. `reconcile()` always
     *      compares `computeFullScopeKey()` (fresh from current
     *      props) against the cached `fullScopeKey`, so the first
     *      watcher to fire on a scope flip correctly detects it,
     *      no matter which prop's watcher won the race.
     *
     *   2) Symmetric PoV-switch handling. Both the watcher path
     *      ("user clicked another player's card while the component
     *      is mounted") and the mount path ("playerkey++ remount
     *      after an action snapped the panel back to the viewer's
     *      own scope") route through `recordScopeObservation()` —
     *      the manager-level history of "what scope is this metric
     *      currently being displayed under". If THIS observation is
     *      under a different scope than the previous one, the chip
     *      is suppressed regardless of any delta the manager
     *      reports, since the perceived "change" is just a point-of-
     *      view flip, not a real game-state change.
     */
    scopeKey() {
      this.reconcile();
    },
    epoch() {
      this.reconcile();
    },
    value() {
      this.reconcile();
    },
  },
  mounted() {
    // Perf instrumentation (A3, docs/PERFORMANCE_AUDIT.md): counts metric-host
    // mounts. With the no-remount update model this fires once per genuinely
    // new host (overlay open, etc.), not once per server response.
    perfMark('metricValue:mount');
    this.fullScopeKey = this.computeFullScopeKey();
    /*
     * HONEST old→new transitions (docs/REMOUNT_ANIMATION_REWORK_DESIGN.md §3.3):
     * with the no-remount update model this component persists across server
     * responses, so every REAL value change arrives through the `value`
     * watcher (`reconcile()`), which owns the chip firing + the seat-switch
     * suppression. A genuine mount (overlay opening, F5) is therefore a
     * SILENT baseline: record the scope + report the value so the manager
     * knows the starting point, and never chip-fire — a mount is a fresh
     * look at the state, not a change of it.
     */
    changeFeedbackManager.recordScopeObservation(this.fullScopeKey, this.metricKey);
    changeFeedbackManager.report(
      this.fullScopeKey, this.metricKey, this.value, CHIP_VISIBLE_MS[this.variant]);
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
    /**
     * Central prop-change handler. Routes between two paths:
     *
     *   - SCOPE SWITCH (computeFullScopeKey() differs from cached
     *     fullScopeKey): silently re-baseline the new scope, drop
     *     any visible chip, no animation. Covers both the user-
     *     facing PoV switch ("click another player's card") and the
     *     epoch-changes-mid-session case.
     *
     *   - SAME-SCOPE VALUE CHANGE (scope unchanged): report the new
     *     value to the manager; if it returns a delta AND the
     *     manager confirms the scope was the same one most-recently
     *     observed for this metric, fire the chip.
     *
     * Resolving everything via fresh `computeFullScopeKey()` (not
     * the cached `fullScopeKey`) is what makes this race-proof
     * against Vue 3's watcher ordering — even if the `value` watcher
     * fires before the `scopeKey` watcher updates the cache, this
     * method routes to the correct branch.
     */
    reconcile(): void {
      const freshScope = this.computeFullScopeKey();
      if (freshScope !== this.fullScopeKey) {
        this.handleScopeRefresh();
        return;
      }
      if (typeof this.value !== 'number' || Number.isNaN(this.value)) {
        return;
      }
      const sameScope = changeFeedbackManager.recordScopeObservation(freshScope, this.metricKey);
      // The merge window IS this chip's own visible lifetime — while the player
      // can still see the number, the next change belongs to it.
      const event = changeFeedbackManager.report(
        freshScope, this.metricKey, this.value, CHIP_VISIBLE_MS[this.variant]);
      if (event === null) {
        return;
      }
      if (!sameScope) {
        // PoV switch detected at manager level (e.g. some other
        // component reported a different scope for this metric since
        // we last touched it). Suppress the chip; the new value is
        // already baselined by `report()` above.
        return;
      }
      this.applyEvent(event.netDelta, event.merged);
    },
    handleScopeRefresh(): void {
      // Tear down any visible chip — it represented the previous
      // scope's delta and would be misleading under the new scope.
      this.clearTimers();
      this.displayedDelta = 0;
      this.polarity = 'neutral';
      this.fullScopeKey = this.computeFullScopeKey();
      // Re-baseline against the now-current value AND record the scope
      // observation so a subsequent remount-to-different-scope (e.g.
      // playerkey++ snapping back to viewer's own colour) recognises
      // the PoV switch and suppresses its chip.
      changeFeedbackManager.recordScopeObservation(this.fullScopeKey, this.metricKey);
      changeFeedbackManager.report(this.fullScopeKey, this.metricKey, this.value);
    },
    applyEvent(netDelta: number, merged: boolean): void {
      const polarity = netDelta > 0 ? 'positive' : (netDelta < 0 ? 'negative' : 'neutral');
      /*
       * CONTINUE the chip on screen, or start a new one — the whole
       * anti-spam rule in one expression.
       *
       * A continuation needs all three: the manager coalesced this change
       * into the running total, a chip is actually still mounted, and the
       * polarity is unchanged. Anything else (nothing on screen, a gain
       * after a loss) is a genuinely new event and gets its OWN chip — a
       * gain and a loss are never one number, so the nonce bump is what
       * puts two chips on screen instead of silently netting them out.
       */
      const continues = merged && this.displayedDelta !== 0 && polarity === this.polarity;

      this.clearTimers();
      this.displayedDelta = netDelta;
      this.polarity = polarity;
      if (!continues) {
        this.chipNonce++;
      }

      const lifetime = motionMs(CHIP_VISIBLE_MS[this.variant]);
      this.hideTimerId = (window.setTimeout(() => {
        this.displayedDelta = 0;
        this.hideTimerId = 0;
      }, lifetime) as unknown as number);

      // Clear the manager's active-delta window slightly after the
      // chip starts fading. Any further change will then start a
      // fresh chip with the raw delta rather than merging into the
      // already-faded chip. The tail scales with the preset too — a raw
      // constant would outlive the chip at the `swift` setting.
      this.clearActiveTimerId = (window.setTimeout(() => {
        changeFeedbackManager.clearActive(this.fullScopeKey, this.metricKey);
        this.clearActiveTimerId = 0;
      }, lifetime + motionMs(150)) as unknown as number);
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
