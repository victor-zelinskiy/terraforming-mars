<template>
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
    <header class="con-coltile__head">
      <span class="con-coltile__name">{{ $t(dock.card) }}</span>
      <span class="con-coltile__kicker" data-fleet-dock-kicker>{{ $t('Dock') }}</span>
      <!-- THE MEDALLION — the planet's place and diameter, a round crop of the card's art (the planet disc's own
           light: key sheen + terminator). -->
      <span class="con-coltile__planet-berth con-coltile__dockmedal"
            :class="dock.dockedColor !== undefined ? ['con-coltile__planet-berth--occupied', 'fleet-hue--' + dock.dockedColor] : []"
            data-fleet-dock-face :data-zoom-slot="dock.card">
        <span class="con-planet con-coltile__planet con-coltile__dockart" :style="{backgroundImage: artBackground}" aria-hidden="true">
          <span class="con-planet__light"></span>
          <span class="con-planet__terminator"></span>
        </span>
        <span class="con-coltile__dock"
              :class="dock.dockedColor !== undefined ? ['con-coltile__dock--occupied', 'fleet-hue--' + dock.dockedColor] : []"
              :data-fleet-berth="berthKey"
              aria-hidden="true">
          <ColonyFleetIcon v-if="dock.dockedColor !== undefined" :color="dock.dockedColor" state="idle" />
        </span>
      </span>
    </header>

    <!-- THE BAND — the track's place holds the dock's STATUS strip (a word on a kant, never a dot). -->
    <div class="con-coltile__mid">
      <div class="con-coltile__state con-fleetdock-tile__status"
           :class="['con-coltile__state--' + status.kind, 'con-fleetdock-tile__status--' + status.kind]"
           data-fleet-dock-state>
        <ColonyFleetIcon v-if="status.kind === 'docked' && dock.dockedColor !== undefined"
                         class="con-fleetdock-tile__status-ship" :color="dock.dockedColor" />
        <span class="con-coltile__state-text con-fleetdock-tile__status-text">{{ $t(label) }}</span>
      </div>
    </div>

    <!-- THE CELLS — «ТОРГОВАТЬ» prints what the trade gives; the «БОНУС» place stays an empty dim «—». -->
    <div class="con-coltile__rows">
      <div class="con-coltile__cell con-coltile__cell--trade" data-fleet-dock-reward>
        <span class="con-coltile__cell-label">{{ $t('Trade') }}</span>
        <span v-if="rewardPrint.length > 0" class="con-coltile__cell-value con-coltile__dockprint" aria-hidden="true">
          <span class="con-coltile__dockink">
            <PremiumMechNode v-for="(node, n) in rewardPrint" :key="n" :node="node" />
          </span>
        </span>
      </div>
      <div class="con-coltile__cell con-coltile__cell--bonus con-coltile__cell--empty" aria-hidden="true">
        <span class="con-coltile__cell-none">—</span>
      </div>
    </div>

    <footer class="con-coltile__status con-coltile__status--none">
      <span class="con-coltile__status-idle" aria-hidden="true"></span>
    </footer>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE TEMPLATE (the comment that opened it — it starts with its root now):
 *
 * A FLEET DOCK — ONE MORE TRADE DESTINATION, drawn as a CELL of the colony
 * grid in the colony tile's own language (Turmoil Redux TR06 Water Hauling and
 * its sisters — a card that is a destination of its owner's trade action).
 * The owner's 2026-10-25 brief («ещё одно направление торговли», never a
 * foreign mechanism) and ledger EZ (2026-11-03: «причал должен быть в том же
 * размере, что плитка колонии, и говорить на том же языке»): the SAME chassis
 * (`.con-coltile` — plate, size, zoom, cursor), the SAME rows, row by row:
 *
 *   1 · HEAD — the card's name on ONE line (an ellipsis in its own box), the
 *       «ПРИЧАЛ» mark where a colony has none, and a ROUND medallion of the
 *       card's art in the planet's own diameter and dress — the card itself
 *       lives in the stage and in the X viewer (`data-zoom-slot` lifts it out
 *       of this medallion; `data-fleet-dock-face` is the descend's FLIP twin).
 *       The fleet that stands on the card berths at the medallion's corner,
 *       exactly where a colony's visitor berths (`data-fleet-berth="card:…"`
 *       — the overview's landing anchor of the trade flight);
 *   2 · BAND — where a colony shows its berths and its track, the dock has
 *       neither: its STATUS strip stands there, a WORD on a kant («Причал
 *       свободен» · «Флот у причала» · the server's reason — through the SAME
 *       ladder as a colony tile, `fleetDockTileStatus`);
 *   3 · CELLS — «ТОРГОВАТЬ» in the colony's own cell and width, printing WHAT
 *       THE TRADE GIVES in the card's own print (the ocean, the rating, the
 *       floaters — read off the printed effect row, never a client guess);
 *       the «БОНУС» cell has no counterpart and stays an empty dim «—», so
 *       the rows of the grid align;
 *   4 · FOOT — the colony tile's status line, idle: the band said it.
 */
import {computed, PropType} from 'vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardArtUrlAtTier, premiumCardArt} from '@/client/cards/cardArt';
import {ItemType} from '@/common/cards/render/Types';
import {FleetDockTileStatus, FleetDockView, fleetDockPrintedReward, fleetDockTileLabel} from '@/client/console/colonyTrade/fleetDockModel';
import {fleetDockBerthKey} from '@/client/components/premiumCard/premiumFleetDock';
import {$t} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleFleetDockTile'});
const props = defineProps({
  dock: {type: Object as PropType<FleetDockView>, required: true},
  status: {type: Object as PropType<FleetDockTileStatus>, required: true},
  focused: {type: Boolean, default: false},
});

const label = computed((): string => {
  return fleetDockTileLabel(props.status);
});
/** The medallion's picture — the card's own art, the THUMB build (a 3rem disc never needs the full file). */
const artBackground = computed((): string => {
  return `url("${cardArtUrlAtTier(premiumCardArt(props.dock.card).url, 'thumb')}")`;
});
/** The fleet's landing anchor on the overview — the same key the card face's ▲ carries on the stage. */
const berthKey = computed((): string => {
  return fleetDockBerthKey(props.dock.card);
});
/** The RESULT half of the card's printed «▲* : [reward]» — the face's own nodes (never a restatement). */
const rewardPrint = computed((): ReadonlyArray<ItemType> => {
  return fleetDockPrintedReward(getCard(props.dock.card)?.metadata.renderData);
});
</script>
