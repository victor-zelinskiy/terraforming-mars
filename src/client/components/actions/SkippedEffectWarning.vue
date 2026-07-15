<template>
  <!--
    ONE premium block for "this effect of the card will NOT happen" — shown by the
    play modal and by the action details / confirm notice.

    The contract (why this is a component and not two inline copies): a warning must
    name WHICH effect is lost, not just that something is. A card commonly has
    several effects, and a skipped attack has NO chip in the branch's `effects` (it
    changes an OPPONENT's pool, not the player's), so this block is the only place
    the lost effect is ever mentioned. It reads: the effect's name + the magnitude
    it would have had (a muted, struck-through chip), then the reason.
  -->
  <div class="skipped-warn">
    <span class="skipped-warn__glyph" aria-hidden="true">⚠</span>
    <span class="skipped-warn__body">
      <span class="skipped-warn__head">
        <span v-if="view.title !== ''" class="skipped-warn__title" v-i18n>{{ view.title }}</span>
        <ActionEffectChip v-if="view.effect !== undefined" :effect="view.effect" :skipped="true" />
        <!-- No chip (no single honest magnitude — an either/or attack) → at least
             the lost resource's sprite, when the producer named one. -->
        <span v-else-if="view.icon !== ''" class="skipped-warn__res" :class="iconClass" aria-hidden="true"></span>
      </span>
      <span class="skipped-warn__text" v-i18n>{{ view.reason }}</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {SkippedEffectView, skippedEffectView} from '@/client/components/actions/skippedEffectView';

export default defineComponent({
  name: 'SkippedEffectWarning',
  components: {ActionEffectChip},
  props: {
    // The `warning` note step (the host filters with `isSkippedWarning`).
    step: {
      type: Object as PropType<ActionPreviewStep>,
      required: true,
    },
  },
  computed: {
    view(): SkippedEffectView {
      return skippedEffectView(this.step);
    },
    iconClass(): string {
      return iconClassFor(this.view.icon);
    },
  },
});
</script>

<style scoped lang="less">
.skipped-warn {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 13px;
  border-radius: 9px;
  background: rgba(224, 150, 70, 0.12);
  box-shadow: inset 0 0 0 1px rgba(224, 150, 70, 0.4);
}
.skipped-warn__glyph {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1.3;
  color: #f0b86a;
}
.skipped-warn__body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
/* The name of the lost effect + its muted magnitude chip — read BEFORE the reason. */
.skipped-warn__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.skipped-warn__title {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #ffd9a0;
}
.skipped-warn__res {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.skipped-warn__text {
  font-size: 12.5px;
  line-height: 1.4;
  color: #f4d3a6;
}
</style>
