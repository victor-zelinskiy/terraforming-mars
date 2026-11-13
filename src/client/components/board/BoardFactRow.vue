<template>
  <div class="board-fact" :class="'board-fact--' + fact.severity">
    <div class="board-fact__body">
      <div v-if="fact.title" class="board-fact__title" v-i18n="fact.params">{{ fact.title }}</div>
      <div v-if="fact.description !== undefined" class="board-fact__desc" v-i18n="fact.params">{{ fact.description }}</div>
      <!-- WHERE the fact comes from. A card-driven gain must never read as an
           anonymous board bonus: "+2 energy production" means something different
           once you can see it is Solar Farm's doing. -->
      <div v-if="sourceLabel !== undefined" class="board-fact__source" v-i18n>{{ sourceLabel }}</div>
    </div>
    <div class="board-fact__value">
      <action-effect-chip v-if="deltaEffect !== undefined" :effect="deltaEffect" :danger="fact.severity === 'danger'" />
      <span v-if="vpAmount !== undefined && vpAmount !== 0" class="board-fact__vp" :class="{'board-fact__vp--neg': vpAmount < 0}">
        <span class="board-fact__vp-amount">{{ vpSign }}{{ Math.abs(vpAmount) }}</span>
        <span class="board-fact__vp-label" v-i18n>VP</span>
      </span>
      <span v-if="fact.progress !== undefined" class="board-fact__progress" :class="{'board-fact__progress--reached': progressReached}">
        <span class="board-fact__progress-from">{{ fact.progress.from }}</span>
        <span class="board-fact__progress-arrow" aria-hidden="true">→</span>
        <span class="board-fact__progress-to">{{ fact.progress.to }}</span>
        <span v-if="fact.progress.target !== undefined" class="board-fact__progress-target">/ {{ fact.progress.target }}</span>
      </span>
      <span v-if="timingTag !== undefined" class="board-fact__tag" v-i18n>{{ timingTag }}</span>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
import {computed, PropType} from 'vue';
import {BoardFact} from '@/common/boards/BoardInformationFacts';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {vI18n} from '@/client/directives/vDirectives';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';

defineOptions({name: 'BoardFactRow'});
const props = defineProps({
  fact: {
    type: Object as PropType<BoardFact>,
    required: true,
  },
  /**
   * The timing the HOSTING section already states in its heading ("At game
   * end" / "Risk"). A tag repeating its own heading is a wasted line on a
   * finite panel, so the row drops it — while a DIFFERENT timing inside the
   * same block (a `future` fact under "At game end") still earns its tag.
   * Unset on the hover popover, which groups by recipient and states no timing.
   */
  sectionTiming: {
    type: String as PropType<BoardFact['timing'] | undefined>,
    default: undefined,
  },
});

// BoardFactDelta is shape-compatible with ActionEffect, so the existing
// premium chip renders it (icon + current → resulting / signed amount).
const deltaEffect = computed((): ActionEffect | undefined => {
  const d = props.fact.delta;
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
    // A PRODUCTION change must read as production, not as a one-off gain —
    // same `note` the action-preview chips use (`actionPreviews.productionChange`).
    note: d.production === true ? 'production' : undefined,
  };
});
/**
 * The card / rule that produces this fact. Only shown when it ADDS
 * information: a `board-cell` or `map-rule` source repeats what the section
 * heading already says, so it stays hidden.
 */
const sourceLabel = computed((): string | undefined => {
  const source = props.fact.source;
  if (source === undefined || source.label === undefined) {
    return undefined;
  }
  if (source.type === 'board-cell' || source.type === 'map-rule') {
    return undefined;
  }
  return typeof source.label === 'string' ? source.label : undefined;
});
const vpAmount = computed((): number | undefined => {
  if (props.fact.vp === undefined) {
    return undefined;
  }
  return props.fact.vp.to - props.fact.vp.from;
});
const vpSign = computed((): string => {
  return (vpAmount.value ?? 0) < 0 ? '−' : '+';
});
/** The placement reaches the claim threshold — the badge lights up. */
const progressReached = computed((): boolean => {
  const p = props.fact.progress;
  return p !== undefined && p.target !== undefined && p.to >= p.target;
});
// A small contextual tag for non-immediate timings (the chip colour already
// conveys cost vs gain for immediate facts).
const timingTag = computed((): string | undefined => {
  // A progress row lives in its own "Milestones and awards" block and shows a
  // `from → to` badge; a "Later" tag beside it says nothing new.
  if (props.fact.progress !== undefined) {
    return undefined;
  }
  // The section heading already said it.
  if (props.sectionTiming !== undefined && props.fact.timing === props.sectionTiming) {
    return undefined;
  }
  switch (props.fact.timing) {
  case 'endgame': return 'At game end';
  case 'future': return 'Later';
  case 'warning': return 'Warning';
  default: return undefined;
  }
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
.board-fact__source {
  display: inline-block;
  margin-top: 3px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid rgba(150, 192, 224, 0.22);
  background: rgba(24, 40, 58, 0.55);
  color: rgba(180, 210, 234, 0.78);
  font-size: 9.5px;
  letter-spacing: 0.02em;
  line-height: 1.35;
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
.board-fact__progress {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(150, 192, 224, 0.34);
  background: rgba(24, 40, 58, 0.6);
  color: rgba(206, 226, 244, 0.92);
  font-size: 11.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;

  &--reached {
    border-color: rgba(186, 178, 255, 0.62);
    background: rgba(48, 42, 86, 0.6);
    color: #d8d2ff;
  }
}
.board-fact__progress-arrow { opacity: 0.6; }
.board-fact__progress-target {
  font-size: 9.5px;
  font-weight: 600;
  opacity: 0.7;
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
