<template>
  <!--
    A FLEET DOCK in the colony workspace's «ПРИЧАЛЫ» column (Turmoil Redux TR06
    Water Hauling and its sisters — a card that is a destination of its owner's
    trade action). The tile IS the card: the real premium face (its art, its
    name, its printed «▲* : [reward]»), so the stage's hero is the same object
    grown — never a summary that turns into a card. The fleet that stands on the
    card sits on the ▲ of that face (`premiumFleetDock.ts` — the mark slot is the
    flight's measured landing anchor too). Under the face, ONE status line:
    free · the fleet on the card until the generation ends · the reason it is
    not a destination (the server's, through the colony ladder). The line is
    the TILE's: it prints the status's own short form where it has one, and is
    cut — if ever — by an ellipsis in its OWN box, never by the column.
  -->
  <div class="con-fleetdock-tile"
       :class="{
         'con-fleetdock-tile--focused': focused,
         'con-fleetdock-tile--docked': status.kind === 'docked',
         'con-fleetdock-tile--blocked': status.kind === 'blocked',
       }"
       :data-fleet-dock="dock.card"
       :data-fleet-dock-status="status.kind">
    <div class="con-fleetdock-tile__face" data-fleet-dock-face>
      <ConsoleCardFaceLite :name="dock.card" :card="dock.model" :lightweight="true" artTier="thumb" />
    </div>
    <footer class="con-fleetdock-tile__status" :class="'con-fleetdock-tile__status--' + status.kind">
      <ColonyFleetIcon v-if="status.kind === 'docked' && dock.dockedColor !== undefined"
                       class="con-fleetdock-tile__status-ship" :color="dock.dockedColor" />
      <span v-else class="con-fleetdock-tile__status-mark" aria-hidden="true">{{ status.kind === 'blocked' ? '✕' : '●' }}</span>
      <span class="con-fleetdock-tile__status-text">{{ $t(label) }}</span>
    </footer>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import {FleetDockTileStatus, FleetDockView, fleetDockTileLabel} from '@/client/console/colonyTrade/fleetDockModel';

export default defineComponent({
  name: 'ConsoleFleetDockTile',
  components: {ConsoleCardFaceLite, ColonyFleetIcon},
  props: {
    dock: {type: Object as PropType<FleetDockView>, required: true},
    status: {type: Object as PropType<FleetDockTileStatus>, required: true},
    focused: {type: Boolean, default: false},
  },
  computed: {
    label(): string {
      return fleetDockTileLabel(this.status);
    },
  },
});
</script>
