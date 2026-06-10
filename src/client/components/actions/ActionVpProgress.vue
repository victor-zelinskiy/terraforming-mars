<template>
  <!--
    "ПРОГРЕСС ПО" — the action-relevant VP context for a card resource that scores
    by a threshold (e.g. Tardigrades: 1 VP per 4 microbes). Shows the threshold
    progress before → after, the shared progress bar, and the card's VP before →
    after (highlighted when the action earns a VP). NOT a full resource summary —
    only what helps decide THIS action. Rendered only when applicable (`per > 1`).
    All values are derived CLIENT-SIDE from the static manifest (no server call).
  -->
  <div v-if="applicable" class="action-vp">
    <span class="action-vp__label" v-i18n>VP progress</span>
    <!-- Threshold scorers (1 VP per N>1 resources) show progress toward the next
         VP; per-resource multipliers (e.g. 2 VP each) skip the bar — every
         resource is already a VP, so the VP delta line below carries it. -->
    <template v-if="threshold">
      <div class="action-vp__head">
        <span class="action-vp__icon" :class="iconClass" aria-hidden="true"></span>
        <span class="action-vp__threshold">
          <span class="action-vp__cur">{{ filledBefore }}/{{ per }}</span>
          <span class="action-vp__arrow" aria-hidden="true">→</span>
          <span class="action-vp__res">{{ filledAfter }}/{{ per }}</span>
        </span>
      </div>
      <VpProgressBar :filled="filledAfter" :per="per" :reached="crossed" />
    </template>
    <div class="action-vp__vp" :class="{'action-vp__vp--up': crossed}">
      <span class="action-vp__vp-label" v-i18n>VP from card</span>
      <span class="action-vp__vp-cur">{{ beforeVp }}</span>
      <span class="action-vp__arrow" aria-hidden="true">→</span>
      <span class="action-vp__vp-res">{{ afterVp }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {vpProgressView, VpProgressView} from '@/client/components/actions/actionVpProgress';
import VpProgressBar from '@/client/components/common/VpProgressBar.vue';

export default defineComponent({
  name: 'ActionVpProgress',
  components: {VpProgressBar},
  props: {
    cardName: {
      type: String as PropType<CardName>,
      required: true,
    },
    // Icon key for the scoring resource (e.g. 'microbe'), via iconClassFor.
    resourceIcon: {
      type: String,
      required: true,
    },
    before: {
      type: Number,
      required: true,
    },
    after: {
      type: Number,
      required: true,
    },
  },
  computed: {
    view(): VpProgressView {
      return vpProgressView(this.cardName, this.before, this.after);
    },
    applicable(): boolean {
      return this.view.applicable;
    },
    threshold(): boolean {
      return this.view.threshold;
    },
    per(): number {
      return this.view.per;
    },
    iconClass(): string {
      return iconClassFor(this.resourceIcon);
    },
    beforeVp(): number {
      return this.view.beforeVp;
    },
    afterVp(): number {
      return this.view.afterVp;
    },
    crossed(): boolean {
      return this.view.crossed;
    },
    filledBefore(): number {
      return this.view.filledBefore;
    },
    filledAfter(): number {
      return this.view.filledAfter;
    },
  },
});
</script>

<style scoped lang="less">
.action-vp {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.action-vp__label {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(244, 220, 160, 0.75);
}
.action-vp__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.action-vp__icon {
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.action-vp__threshold {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 14px;
}
.action-vp__cur { color: rgba(244, 220, 160, 0.62); }
.action-vp__res { color: #ffe08a; }
.action-vp__arrow { color: rgba(244, 220, 160, 0.7); font-weight: 700; }

.action-vp__vp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.action-vp__vp-label {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 10.5px;
  color: rgba(210, 224, 236, 0.6);
  margin-right: 2px;
}
.action-vp__vp-cur { color: rgba(220, 236, 247, 0.6); font-weight: 600; }
.action-vp__vp-res { color: rgba(220, 236, 247, 0.85); font-weight: 700; }
.action-vp__vp--up {
  .action-vp__vp-res { color: #8ff0c4; }
  .action-vp__arrow { color: #8ff0c4; }
}
</style>
