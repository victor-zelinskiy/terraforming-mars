<template>
  <Teleport to="body">
    <Transition name="aux-res-tooltip">
      <div
        v-if="visible && group !== undefined"
        class="additional-resources-tooltip"
        :style="positionStyle"
        role="tooltip"
        data-test="additional-resource-tooltip">
        <div class="additional-resources-tooltip__head">
          <i class="card-resource additional-resources-tooltip__icon" :class="iconClass" aria-hidden="true"></i>
          <span class="additional-resources-tooltip__name">{{ resourceName }}</span>
          <span class="additional-resources-tooltip__total">
            <span class="additional-resources-tooltip__total-label" v-i18n>Total</span>
            <span class="additional-resources-tooltip__total-value">{{ group.total }}</span>
          </span>
        </div>
        <div class="additional-resources-tooltip__list">
          <div
            v-for="entry in group.cards"
            :key="entry.name"
            class="additional-resources-tooltip__item"
            :class="{'additional-resources-tooltip__item--zero': entry.amount === 0}">
            <span class="additional-resources-tooltip__item-name" v-i18n>{{ entry.name }}</span>
            <span class="additional-resources-tooltip__item-amount">{{ entry.amount }}</span>
          </div>
        </div>
        <div class="additional-resources-tooltip__hint" v-i18n>Click to open detailed summary</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {AdditionalResourceGroup} from '@/client/components/additionalResources/additionalResources';

// Approximate tooltip box used for positioning math only; the real element
// sizes itself (with an internal max-height + scroll for very long lists).
const TOOLTIP_WIDTH = 236;
const GAP = 12;
const VIEWPORT_MARGIN = 8;
const EST_HEIGHT = 320;

export default defineComponent({
  name: 'AdditionalResourceTooltip',
  props: {
    group: {
      type: Object as PropType<AdditionalResourceGroup | undefined>,
      default: undefined,
    },
    visible: {
      type: Boolean,
      default: false,
    },
    anchor: {
      type: Object as () => DOMRect | undefined,
      default: undefined,
    },
  },
  computed: {
    iconClass(): string {
      return this.group === undefined ? '' : cardResourceCSS[this.group.resource];
    },
    resourceName(): string {
      return this.group === undefined ? '' : this.$t(this.group.resource);
    },
    positionStyle(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {display: 'none'};
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // The panel hugs the left sidebar, so prefer placing the tooltip to the
      // RIGHT of the row (out over the board where there's room). Flip left
      // only if it would clip the right viewport edge.
      let left = a.right + GAP;
      if (left + TOOLTIP_WIDTH + VIEWPORT_MARGIN > vw) {
        left = a.left - GAP - TOOLTIP_WIDTH;
      }
      left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - VIEWPORT_MARGIN));

      // Vertically align the tooltip's top near the row, then clamp so a long
      // list near the bottom of the screen stays fully on-screen.
      let top = a.top - 4;
      top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - EST_HEIGHT - VIEWPORT_MARGIN));
      top = Math.max(VIEWPORT_MARGIN, top);

      return {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
      };
    },
  },
});
</script>
