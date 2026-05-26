<template>
  <div class="milestone-claimed-badge"
       :class="{'milestone-claimed-badge--filled': milestone !== undefined}"
       :style="badgeStyle"
       v-on:mouseenter="onEnter"
       v-on:mouseleave="onLeave">
    <!-- Tiny color marker showing which player claimed this milestone. -->
    <div v-if="milestone"
         class="milestone-claimed-badge-cube"
         :class="`player_bg_color_${milestone.color}`"></div>

    <!--
      Teleport the tooltip to <body> so it isn't clipped by the badge's
      circular silhouette (or by any other ancestor with overflow / clip
      constraints). Position is computed in JS from getBoundingClientRect.
    -->
    <Teleport to="body">
      <div v-if="showTooltip" class="milestone-floating-tooltip" :style="tooltipStyle">
        <template v-if="milestone">
          <div class="milestone-floating-tooltip-name" v-i18n>{{ shortName }}</div>
          <div class="milestone-floating-tooltip-desc" v-i18n>{{ description }}</div>
          <div class="milestone-floating-tooltip-claimedby">
            <span v-i18n>claimed by</span>
            <i class="board-cube" :class="`board-cube--${milestone.color}`"></i>
            <span>{{ milestone.playerName }}</span>
          </div>
        </template>
        <div v-else class="milestone-floating-tooltip-status">{{ emptyStatusText }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {MAX_MILESTONES} from '@/common/constants';
import {getMilestone} from '@/client/MilestoneAwardManifest';
import {translateTextWithParams} from '@/client/directives/i18n';

type TooltipPos = {top: number; left: number};

export default defineComponent({
  name: 'MilestoneClaimedBadge',
  props: {
    // Undefined means the slot is empty (the milestone hasn't been claimed
    // yet). The badge is still rendered — just as an empty outlined slot
    // with a tooltip that explains the indicator ("N of 3 milestones claimed").
    milestone: {
      type: Object as PropType<ClaimedMilestoneModel | undefined>,
      default: undefined,
    },
    // Total claimed milestones across the game — used in the empty-slot
    // tooltip so the player knows what the indicator represents.
    claimedCount: {
      type: Number,
      required: true,
    },
  },
  data(): {showTooltip: boolean; tooltipPos: TooltipPos} {
    return {
      showTooltip: false,
      tooltipPos: {top: 0, left: 0},
    };
  },
  computed: {
    assetName(): string {
      if (!this.milestone) return '';
      return this.milestone.name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
    },
    badgeStyle(): Record<string, string> {
      if (!this.milestone) return {};
      return {backgroundImage: `url(assets/ma/${this.assetName}.png)`};
    },
    shortName(): string {
      return this.milestone?.name.replace(/[0-9]+$/, '') ?? '';
    },
    description(): string {
      if (!this.milestone) return '';
      return this.milestone.description ?? getMilestone(this.milestone.name).description;
    },
    tooltipStyle(): Record<string, string> {
      return {
        top: `${this.tooltipPos.top}px`,
        left: `${this.tooltipPos.left}px`,
      };
    },
    emptyStatusText(): string {
      return translateTextWithParams(
        'Claimed ${0} of ${1} milestones',
        [String(this.claimedCount), String(MAX_MILESTONES)],
      );
    },
  },
  methods: {
    onEnter(e: MouseEvent): void {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const tooltipWidth = 280;
      const margin = 12;
      let left = rect.right + margin;
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = rect.left - margin - tooltipWidth;
      }
      // Anchor the tooltip just below the badge so it doesn't cover the
      // milestones button strip above.
      this.tooltipPos = {top: rect.bottom + 8, left};
      this.showTooltip = true;
    },
    onLeave(): void {
      this.showTooltip = false;
    },
  },
});
</script>
