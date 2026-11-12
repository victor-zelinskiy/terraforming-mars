<template>
  <span v-if="face !== undefined"
        class="pcard-fleet"
        :class="{'pcard-fleet--docked': face.color !== undefined}"
        :data-fleet-berth="berthKey"
        aria-hidden="true">
    <ColonyFleetIcon v-if="face.color !== undefined" :color="face.color" :state="settling ? 'docked' : 'idle'" />
  </span>
</template>

<script setup lang="ts">
/*
 * THE FLEET DOCK'S MARK SLOT (premiumFleetDock.ts): mounted ONLY on the ▲ of
 * a printed trade effect, and only renders on a dock card's face —
 * absolutely positioned (the face never moves for a fleet) and ALWAYS laid
 * out on a dock: it is the trade flight's measured landing anchor, and the
 * fleet standing on the card sits in it, in its owner's livery. A
 * component of its own so the face pays for it on ONE node, never on every
 * node of every plate.
 */
import {computed, inject, Ref, unref} from 'vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {fleetDockBerthKey, PCARD_FLEET_DOCK_KEY, PremiumFleetDockFace} from './premiumFleetDock';

defineOptions({name: 'PremiumFleetMark'});

/** The card's fleet-dock state (PremiumCard provides it; absent outside a card face). */
const fleetDockFace = inject<PremiumFleetDockFace | Ref<PremiumFleetDockFace | undefined> | undefined>(PCARD_FLEET_DOCK_KEY, undefined);

const face = computed((): PremiumFleetDockFace | undefined => {
  // `inject()` hands over what was provided AS IT IS — PremiumCard provides a computed ref, and nothing unwraps it
  // here (the Options API did); `unref` reads through it and keeps either shape honest.
  return unref(fleetDockFace);
});
const berthKey = computed((): string => {
  return face.value === undefined ? '' : fleetDockBerthKey(face.value.card);
});
/** The one-shot settle of a fleet that has JUST landed here (the flight's proxy faded onto this mark). */
const settling = computed((): boolean => {
  return face.value !== undefined && tradeFleetState.dockedCard === face.value.card;
});
</script>
