<template>
  <!--
    A FLEET DOCK — ONE MORE TRADE DESTINATION, drawn as a TILE of the colony
    family (Turmoil Redux TR06 Water Hauling and its sisters — a card that is
    a destination of its owner's trade action). The owner's 2026-10-25 brief:
    the docks read as «ещё одно направление торговли», never as a foreign
    mechanism — so the tile wears the colony tile's chassis to the value
    (`.con-coltile`: the same plate, size, zoom, cursor, name, cell and status
    line) and differs only where the destination differs:

      · where a colony shows its PLANET, the dock shows the CARD itself — the
        real premium face (its art, its printed «▲* : [reward]»), the object
        X lifts into the fullscreen viewer (`data-zoom-slot`) and A carries
        into the trade stage (`data-fleet-dock-face` — the FLIP's twin). The
        fleet that stands on the card sits on the ▲ of that face
        (`premiumFleetDock.ts` — also the flight's measured landing anchor);
      · where a colony shows its TRACK, the dock has none — its «ТОРГОВАТЬ»
        cell shows WHAT THE TRADE GIVES, in the card's own print (the ocean,
        the rating, the floaters), read off the printed effect row, never a
        client guess;
      · the status line is the colony tile's own, through the SAME ladder
        (`fleetDockTileStatus`): free · the fleet on the card · the reason.
  -->
  <div class="con-coltile con-coltile--dock con-fleetdock-tile"
       :class="{
         'con-coltile--focused': focused,
         'con-coltile--ok': status.kind === 'free',
         'con-coltile--blocked': status.kind === 'blocked',
         'con-fleetdock-tile--focused': focused,
         'con-fleetdock-tile--docked': status.kind === 'docked',
         'con-fleetdock-tile--blocked': status.kind === 'blocked',
       }"
       :data-fleet-dock="dock.card"
       :data-fleet-dock-status="status.kind">
    <div class="con-coltile__dockbody">
      <div class="con-coltile__dockinfo">
        <header class="con-coltile__head con-coltile__head--dock">
          <span class="con-coltile__name con-coltile__name--dock">{{ $t(dock.card) }}</span>
        </header>
        <!-- WHAT THE TRADE GIVES — the colony tile's «ТОРГОВАТЬ» cell, grown to the band the track would take. -->
        <div class="con-coltile__cell con-coltile__cell--trade con-coltile__dockreward" data-fleet-dock-reward>
          <span class="con-coltile__cell-label">{{ $t('Trade') }}</span>
          <span v-if="rewardPrint.length > 0" class="con-coltile__dockprint" aria-hidden="true">
            <span class="con-coltile__dockink">
              <PremiumMechNode v-for="(node, n) in rewardPrint" :key="n" :node="node" />
            </span>
          </span>
        </div>
      </div>
      <!-- THE CARD — the medallion's place, card-shaped. -->
      <div class="con-coltile__dockcard" data-fleet-dock-face :data-zoom-slot="dock.card">
        <ConsoleCardFaceLite :name="dock.card" :card="dock.model" :lightweight="true" artTier="thumb" />
      </div>
    </div>
    <footer class="con-coltile__status con-fleetdock-tile__status"
            :class="['con-coltile__status--' + statusTone, 'con-fleetdock-tile__status--' + status.kind]">
      <ColonyFleetIcon v-if="status.kind === 'docked' && dock.dockedColor !== undefined"
                       class="con-fleetdock-tile__status-ship" :color="dock.dockedColor" />
      <span v-else-if="status.kind === 'free'" class="con-coltile__status-dot" aria-hidden="true"></span>
      <span v-else class="con-coltile__status-mark" aria-hidden="true">✕</span>
      <span class="con-coltile__status-text con-fleetdock-tile__status-text">{{ $t(label) }}</span>
    </footer>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ItemType} from '@/common/cards/render/Types';
import {FleetDockTileStatus, FleetDockView, fleetDockPrintedReward, fleetDockTileLabel} from '@/client/console/colonyTrade/fleetDockModel';

export default defineComponent({
  name: 'ConsoleFleetDockTile',
  components: {ConsoleCardFaceLite, ColonyFleetIcon, PremiumMechNode},
  props: {
    dock: {type: Object as PropType<FleetDockView>, required: true},
    status: {type: Object as PropType<FleetDockTileStatus>, required: true},
    focused: {type: Boolean, default: false},
  },
  computed: {
    label(): string {
      return fleetDockTileLabel(this.status);
    },
    /** The colony tile's status tones: a free dock is «ok», a busy one is the calm «inactive», a refusal is «blocked». */
    statusTone(): 'ok' | 'inactive' | 'blocked' {
      return this.status.kind === 'free' ? 'ok' : (this.status.kind === 'docked' ? 'inactive' : 'blocked');
    },
    /** The RESULT half of the card's printed «▲* : [reward]» — the face's own nodes (never a restatement). */
    rewardPrint(): ReadonlyArray<ItemType> {
      return fleetDockPrintedReward(getCard(this.dock.card)?.metadata.renderData);
    },
  },
});
</script>
