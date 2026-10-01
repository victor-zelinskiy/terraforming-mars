<template>
  <!-- THE FLEET DOCK'S MARK SLOT (premiumFleetDock.ts): mounted ONLY on the ▲ of
       a printed trade effect, and only renders on a dock card's face —
       absolutely positioned (the face never moves for a fleet) and ALWAYS laid
       out on a dock: it is the trade flight's measured landing anchor, and the
       fleet standing on the card sits in it, in its owner's livery. A
       component of its own so the face pays for it on ONE node, never on every
       node of every plate. -->
  <span v-if="face !== undefined"
        class="pcard-fleet"
        :class="{'pcard-fleet--docked': face.color !== undefined}"
        :data-fleet-berth="berthKey"
        aria-hidden="true">
    <ColonyFleetIcon v-if="face.color !== undefined" :color="face.color" :state="settling ? 'docked' : 'idle'" />
  </span>
</template>

<script lang="ts">
import {defineComponent, Ref, unref} from 'vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {fleetDockBerthKey, PCARD_FLEET_DOCK_KEY, PremiumFleetDockFace} from './premiumFleetDock';

export default defineComponent({
  name: 'PremiumFleetMark',
  components: {ColonyFleetIcon},
  inject: {
    /** The card's fleet-dock state (PremiumCard provides it; absent outside a card face). */
    fleetDockFace: {from: PCARD_FLEET_DOCK_KEY, default: undefined},
  },
  computed: {
    face(): PremiumFleetDockFace | undefined {
      // Vue unwraps an injected ref for the Options API; `unref` keeps either shape honest.
      return unref(this.fleetDockFace as PremiumFleetDockFace | Ref<PremiumFleetDockFace | undefined> | undefined);
    },
    berthKey(): string {
      return this.face === undefined ? '' : fleetDockBerthKey(this.face.card);
    },
    /** The one-shot settle of a fleet that has JUST landed here (the flight's proxy faded onto this mark). */
    settling(): boolean {
      return this.face !== undefined && tradeFleetState.dockedCard === this.face.card;
    },
  },
});
</script>
