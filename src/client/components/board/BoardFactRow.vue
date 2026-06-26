<template>
  <div class="board-fact" :class="'board-fact--' + fact.severity">
    <div class="board-fact__body">
      <div v-if="fact.title" class="board-fact__title" v-i18n="fact.params">{{ fact.title }}</div>
      <div v-if="fact.description !== undefined" class="board-fact__desc" v-i18n="fact.params">{{ fact.description }}</div>
    </div>
    <div class="board-fact__value">
      <action-effect-chip v-if="deltaEffect !== undefined" :effect="deltaEffect" />
      <span v-if="vpAmount !== undefined && vpAmount !== 0" class="board-fact__vp" :class="{'board-fact__vp--neg': vpAmount < 0}">
        <span class="board-fact__vp-amount">{{ vpSign }}{{ Math.abs(vpAmount) }}</span>
        <span class="board-fact__vp-label" v-i18n>VP</span>
      </span>
      <span v-if="timingTag !== undefined" class="board-fact__tag" v-i18n>{{ timingTag }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardFact} from '@/common/boards/BoardInformationFacts';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';

export default defineComponent({
  name: 'BoardFactRow',
  components: {ActionEffectChip},
  props: {
    fact: {
      type: Object as PropType<BoardFact>,
      required: true,
    },
  },
  computed: {
    Math() {
      return Math;
    },
    // BoardFactDelta is shape-compatible with ActionEffect, so the existing
    // premium chip renders it (icon + current → resulting / signed amount).
    deltaEffect(): ActionEffect | undefined {
      const d = this.fact.delta;
      if (d === undefined) {
        return undefined;
      }
      return {
        direction: d.direction,
        icon: d.icon,
        amount: d.amount,
        current: d.current,
        resulting: d.resulting,
        unit: d.unit,
      };
    },
    vpAmount(): number | undefined {
      if (this.fact.vp === undefined) {
        return undefined;
      }
      return this.fact.vp.to - this.fact.vp.from;
    },
    vpSign(): string {
      return (this.vpAmount ?? 0) < 0 ? '−' : '+';
    },
    // A small contextual tag for non-immediate timings (the chip colour already
    // conveys cost vs gain for immediate facts).
    timingTag(): string | undefined {
      switch (this.fact.timing) {
      case 'endgame': return 'At game end';
      case 'future': return 'Later';
      case 'warning': return 'Warning';
      default: return undefined;
      }
    },
  },
});
</script>

<style scoped lang="less">
.board-fact {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;

  &--danger .board-fact__title { color: #ff9f96; }
  &--warning .board-fact__title { color: #ffce92; }
}
.board-fact__body {
  min-width: 0;
}
.board-fact__title {
  font-size: 12px;
  color: #e7f2fb;
  line-height: 1.25;
}
.board-fact__desc {
  font-size: 10.5px;
  color: rgba(190, 214, 232, 0.62);
  line-height: 1.3;
  margin-top: 1px;
}
.board-fact__value {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.board-fact__vp {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 214, 120, 0.5);
  background: rgba(60, 48, 20, 0.5);
  color: #ffdc8a;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &--neg {
    border-color: rgba(255, 120, 110, 0.55);
    background: rgba(60, 26, 24, 0.5);
    color: #ff9f96;
  }
}
.board-fact__vp-label {
  font-size: 9.5px;
  font-weight: 600;
  opacity: 0.85;
}
.board-fact__tag {
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid rgba(120, 200, 255, 0.28);
  background: rgba(22, 44, 64, 0.5);
  color: rgba(190, 224, 245, 0.8);
  font-size: 9.5px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}
</style>
