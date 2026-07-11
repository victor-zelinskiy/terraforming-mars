<template>
  <!--
    COST CLUSTER OVERLAY — the recognisable megacredit tile pinned over the
    LEFT end of the title plate (own layer, above plate + frame). Shows the
    PRINTED cost (the card's physical identity); a live discount/surcharge
    appears as the compact «−N» chip docked to the badge's lower-right —
    it extends the cluster RIGHTWARD, widening only the title text's left
    safe-area (pcard--cost-mod), never the plate silhouette.
  -->
  <div class="pcard__cost" :class="{'pcard__cost--three': cost.printed >= 100}" aria-hidden="true">
    <div class="pcard__cost-badge">
      <span class="pcard__cost-value">{{ cost.printed }}</span>
    </div>
    <span v-if="cost.delta !== 0"
          class="pcard__cost-delta"
          :class="{'pcard__cost-delta--surcharge': cost.delta > 0}">{{ deltaText }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PremiumCostVM} from './premiumCardViewModel';

export default defineComponent({
  name: 'PremiumCostBadge',
  props: {
    cost: {
      type: Object as () => PremiumCostVM,
      required: true,
    },
  },
  computed: {
    deltaText(): string {
      const d = this.cost.delta;
      return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
    },
  },
});
</script>
