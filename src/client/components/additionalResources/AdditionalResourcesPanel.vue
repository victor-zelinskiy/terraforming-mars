<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <!--
    "ДОП. РЕСУРСЫ" — auxiliary side-module for card/additional resources.

    Mounted as an ABSOLUTE child of the РЕСУРСЫ `.left-panel-section` (which is
    position:relative), so it is anchored to the real resource block: top:-1px
    lines its frame up with the section's top edge and it tracks the section
    automatically on resize / player-card-height changes — no magic offsets.
    It reuses `.left-panel-section` + `.left-panel-section__label`, so its
    chrome + responsive padding + header inherit every breakpoint for free and
    the ДОП. РЕСУРСЫ header lands exactly level with РЕСУРСЫ.

    Renders nothing until the player has unlocked at least one card resource.
  -->
  <div
    v-if="groups.length > 0"
    class="left-panel-section additional-resources"
    data-test="additional-resources-panel">
    <div class="left-panel-section__label additional-resources__label" v-i18n>Additional resources</div>
    <transition-group tag="div" class="additional-resources__rows" name="aux-res-row">
      <div
        v-for="group in groups"
        :key="group.resource"
        class="additional-resources__row"
        :class="{'additional-resources__row--zero': group.total === 0, 'additional-resources__row--active': hoveredResource === group.resource}"
        data-test="additional-resource-row"
        tabindex="0"
        role="button"
        @mouseenter="onRowEnter(group, $event)"
        @mouseleave="onRowLeave"
        @focus="onRowEnter(group, $event)"
        @blur="onRowLeave"
        @click="onRowClick(group)"
        @keydown.enter.prevent="onRowClick(group)"
        @keydown.space.prevent="onRowClick(group)">
        <i class="card-resource additional-resources__icon" :class="iconClass(group.resource)" aria-hidden="true"></i>
        <span class="additional-resources__count" data-test="additional-resource-count">{{ group.total }}</span>
        <AnimatedMetricValue
          :value="group.total"
          :metricKey="metricKey(group.resource)"
          :scopeKey="player.color"
          :epoch="epoch"
          variant="misc" />
      </div>
    </transition-group>

    <AdditionalResourceTooltip
      :group="hoveredGroup"
      :visible="tooltipVisible"
      :anchor="hoverAnchor" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardResource} from '@/common/CardResource';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import AdditionalResourceTooltip from '@/client/components/additionalResources/AdditionalResourceTooltip.vue';
import {additionalResourceGroups, additionalResourceMetricKey, AdditionalResourceGroup} from '@/client/components/additionalResources/additionalResources';
import {openAdditionalResourceDetail} from '@/client/components/additionalResources/additionalResourcesState';

const HOVER_DELAY_MS = 140;

export default defineComponent({
  name: 'AdditionalResourcesPanel',
  components: {AnimatedMetricValue, AdditionalResourceTooltip},
  props: {
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    // Game runId — re-baselines the delta-chip system on a fresh session.
    epoch: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      hoveredResource: undefined as CardResource | undefined,
      hoverAnchor: undefined as DOMRect | undefined,
      tooltipVisible: false,
      hoverTimer: undefined as number | undefined,
    };
  },
  computed: {
    groups(): ReadonlyArray<AdditionalResourceGroup> {
      return additionalResourceGroups(this.player.tableau);
    },
    hoveredGroup(): AdditionalResourceGroup | undefined {
      if (this.hoveredResource === undefined) {
        return undefined;
      }
      return this.groups.find((g) => g.resource === this.hoveredResource);
    },
  },
  methods: {
    iconClass(resource: CardResource): string {
      return cardResourceCSS[resource];
    },
    metricKey(resource: CardResource): string {
      return additionalResourceMetricKey(resource);
    },
    onRowEnter(group: AdditionalResourceGroup, event: Event): void {
      this.clearHoverTimer();
      this.hoveredResource = group.resource;
      const target = event.currentTarget as HTMLElement | null;
      this.hoverAnchor = target?.getBoundingClientRect();
      this.hoverTimer = window.setTimeout(() => {
        this.tooltipVisible = true;
      }, HOVER_DELAY_MS);
    },
    onRowLeave(): void {
      this.clearHoverTimer();
      this.tooltipVisible = false;
      this.hoveredResource = undefined;
    },
    onRowClick(group: AdditionalResourceGroup): void {
      this.clearHoverTimer();
      this.tooltipVisible = false;
      this.hoveredResource = undefined;
      openAdditionalResourceDetail(group.resource, this.player.color);
    },
    clearHoverTimer(): void {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
    },
  },
  beforeUnmount() {
    this.clearHoverTimer();
  },
});
</script>
