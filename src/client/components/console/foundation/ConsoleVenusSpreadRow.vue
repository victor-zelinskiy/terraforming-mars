<template>
  <!-- THE VENUS BONUS, PRE-SELECTED — the SPREAD row (P89 · ledger EL): ONE row for both composers (the play sheet, the
       blue action's setup) on the LAYOUT row's chassis (TR78 — `con-composer__lanes`): a lane per standard resource
       (its icon, its name, the stock «current → resulting», the units placed on it), the focused lane marked by the
       cursor's kant, ←→ between the lanes, LB/RB one unit, RT the rest; what is still to place on the row's edge. The
       row holds the commit until the sum is exact; it opens EMPTY (a filled default would be an auto-select). The head
       reads the raise that earned the bonus — the same words the hosted surface says. Box-stable: the status slot is
       always mounted, so a change of «left / laid out» never moves the row. -->
  <div class="con-venusspread" data-venus-spread :data-venus-spread-amount="amount" :data-venus-spread-left="left">
    <div class="con-composer__row-label">
      <span>{{ $t('Venus bonus') }}</span>
      <span v-if="stepReading !== ''" class="con-venusspread__step" data-venus-step>{{ stepReading }}</span>
    </div>
    <div class="con-composer__lanes" data-composer-lanes :data-lanes-amount="placed" :data-lanes-left="left">
      <div v-for="(key, li) in lanes" :key="key" class="con-composer__lane con-venusspread__lane"
           :class="{'con-composer__lane--focused': focused && laneIndex === li, 'con-composer__lane--filled': on(key) > 0}"
           :data-lane-resource="key" :data-lane-amount="on(key)">
        <i class="con-venusspread__icon" :class="iconClass(key)" aria-hidden="true"></i>
        <span class="con-composer__lane-body">
          <span class="con-composer__lane-name">{{ $t(label(key)) }}</span>
          <span class="con-composer__lane-count">
            <span>{{ stockOf(key) }}</span>
            <span class="con-composer__lane-arrow" aria-hidden="true">→</span>
            <b>{{ stockOf(key) + on(key) }}</b>
          </span>
        </span>
        <span class="con-composer__lane-amount" :class="{'con-composer__lane-amount--zero': on(key) === 0}">+{{ on(key) }}</span>
      </div>
      <span class="con-composer__lane-left" :class="{'con-composer__lane-left--done': left === 0}" data-lanes-status>
        <template v-if="left > 0">{{ $t('Left') }}: <b>{{ left }}</b></template>
        <template v-else>{{ $t('Laid out') }}: <b>{{ amount }}</b></template>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {LANE_LABELS} from '@/client/console/compositePrompts';
import {spreadOn, spreadRemaining, spreadTotal} from '@/client/console/cardResourceDistribution';
import {
  VENUS_SPREAD_LANES, VenusBonusParts, venusBonusMetaOf, venusSpreadAmount, venusStepReading,
} from '@/client/console/venusBonus/venusBonusPreselect';

export default defineComponent({
  name: 'ConsoleVenusSpreadRow',
  props: {
    /** The step's own prompt model (`ActionPreviewStep` `venusBonus`). */
    input: {type: Object as PropType<PlayerInputModel>, required: true},
    parts: {type: Object as PropType<VenusBonusParts>, required: true},
    /** The focused lane (the composer's own lane cursor). */
    laneIndex: {type: Number, default: 0},
    /** The row holds the composer's cursor. */
    focused: {type: Boolean, default: false},
    /** The player's stock per standard resource — «current → resulting». */
    stock: {type: Object as PropType<Partial<Record<string, number>>>, default: () => ({})},
  },
  computed: {
    lanes(): ReadonlyArray<string> {
      return VENUS_SPREAD_LANES;
    },
    amount(): number {
      const meta = venusBonusMetaOf(this.input);
      return meta === undefined ? 0 : venusSpreadAmount(meta, this.parts);
    },
    placed(): number {
      return spreadTotal(this.parts.spread ?? {});
    },
    left(): number {
      return spreadRemaining(this.amount, this.parts.spread ?? {});
    },
    stepReading(): string {
      return venusStepReading(venusBonusMetaOf(this.input));
    },
  },
  methods: {
    on(key: string): number {
      return spreadOn(this.parts.spread ?? {}, key);
    },
    stockOf(key: string): number {
      return this.stock[key] ?? 0;
    },
    label(key: string): string {
      return LANE_LABELS[key] ?? key;
    },
    iconClass(key: string): string {
      return iconClassFor(key);
    },
  },
});
</script>
