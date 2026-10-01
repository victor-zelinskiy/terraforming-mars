<template>
  <!--
    CONSOLE COLONY TILE (iteration 2 — Steam-Deck-first). A compact, couch-
    readable strategy card: name + planet medallion, the PARKED TRADE FLEET
    badge (whose ship is here), the three build slots with owner cubes, the
    7-cell live track strip, what a trade READS right now (offset applied) +
    the fixed owner bonus, and an honest availability status line. The tile
    is the decision surface — no button hints (the bottom bar owns controls),
    no side panel needed for the common questions.
  -->
  <div class="con-coltile"
       :class="{
         'con-coltile--focused': focused,
         'con-coltile--inactive': status.kind === 'inactive',
         'con-coltile--blocked': status.kind === 'blocked',
         'con-coltile--ok': status.kind === 'ok',
         'con-coltile--just-docked': justDocked,
         'con-coltile--marker-gliding': markerGliding,
       }"
       :data-test="'con-colony-' + colony.name">
    <header class="con-coltile__head">
      <span class="con-coltile__name">{{ $t(colony.name) }}</span>
      <!-- Planet medallion + the parked trade fleet DOCKED at its corner:
           an owner-hue ring on the planet + a crisp ship token in the berth
           (replaces the old crude oversized sprite that crowded the planet;
           the owner is the ring/ship colour, named in the status line). -->
      <span class="con-coltile__planet-berth"
            :class="[
              colony.visitor !== undefined ? ['con-coltile__planet-berth--occupied', 'fleet-hue--' + colony.visitor] : [],
              {'con-coltile__planet-berth--docking': justDocked},
            ]">
        <!-- THE ONE planet grammar (ConsolePlanetDisc): the art as a cover disc,
             the light painted by the disc itself. The tile keeps the quiet
             dress (no rim) — the medallion is a thumbnail, not a hero. -->
        <ConsolePlanetDisc class="con-coltile__planet" :colony="colony.name" />
        <!-- The DOCK SLOT is the STABLE, PIXEL-PERFECT landing anchor of the
             trade-launch cinematic (`data-fleet-berth`, ALWAYS rendered, even
             empty): the flying fleet proxy docks EXACTLY here at this slot's
             size + position + angle — the identical rect the real docked ship
             occupies — so the proxy fades directly into the real ship with no
             centre-of-planet detour. The ship itself renders inside only when
             a fleet is present; an empty dock is an invisible measurement slot. -->
        <span class="con-coltile__dock"
              :data-fleet-berth="colony.name"
              :class="colony.visitor !== undefined ? ['con-coltile__dock--occupied', 'fleet-hue--' + colony.visitor] : []"
              aria-hidden="true">
          <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" :state="justDocked ? 'docked' : 'idle'" />
        </span>
      </span>
    </header>

    <!-- Build slots (owner cubes) + the live 7-cell track in ONE band. -->
    <div class="con-coltile__mid">
      <div class="con-coltile__build">
        <div v-for="idx in [0, 1, 2]" :key="idx"
             class="con-coltile__build-slot"
             :class="{'con-coltile__build-slot--occupied': colony.colonies[idx] !== undefined}"
             :data-colony-build-slot="colony.name + '#' + idx">
          <!-- Each build bonus is ONE-TIME: once a settlement is built here the
               bonus is consumed and the owner's PREMIUM 3D PlayerCube — the
               same physical token the main board uses for tile ownership —
               sits centred in the vacated cell with clear air around it (the
               reward glyph is gone; never a flat colour fill). An empty slot
               shows what building here would grant.

               The CUBE SEAT is the landing geometry of the console
               colony-build hero (`data-colony-build-seat`): a box exactly the
               size of the seated token, so the flying proxy is born at the
               size it lands at on EVERY profile — the old contract measured
               the whole cell and multiplied by a fraction calibrated for one
               cell size, which the handheld profile's smaller cell broke. -->
          <span class="con-coltile__build-seat" data-colony-build-seat>
            <PlayerCube v-if="colony.colonies[idx] !== undefined"
                        :color="colony.colonies[idx]"
                        :size="cubeSize" />
            <BenefitGlyph v-else :benefit="buildBenefit" :idx="idx" :cardResources="cardResourceKinds" />
          </span>
        </div>
      </div>
      <div class="con-coltile__track" aria-hidden="true">
        <!-- Per-cell anchors carry the trade-reset glide geometry (the white
             marker proxy steps LEFT across these exact rects). The displayed
             marker rides the PRESENTED position: while a trade's rewards are
             still being granted the committed reset is frozen behind
             `presentedColonyModel`, so the marker never teleports early. -->
        <span v-for="pos in trackCells" :key="pos.index"
              class="con-coltile__track-cell"
              :data-colony-track-cell="colony.name + '#' + pos.index"
              :class="{
                'con-coltile__track-cell--marker': pos.marker,
                'con-coltile__track-cell--effective': pos.effective,
                'con-coltile__track-cell--passed': pos.passed,
                'con-coltile__track-cell--settled': settledCell === pos.index,
              }"></span>
        <!-- The «4/7» readout plays the premium flip exactly when the marker
             LANDS (the presented position releases) — nested INSIDE the cell
             per the ConsoleFlipValue layering contract. -->
        <span class="con-coltile__track-pos">
          <ConsoleFlipValue :value="displayedTrackPosition" :text="trackPositionDisplay" accent="cyan" :flipOnDecrease="true" />
        </span>
      </div>
    </div>

    <!-- Trade reward (at the position a trade READS) · owner bonus.
         The two value cells are the trade cinematic's LAUNCH ANCHORS:
         the trade income physically leaves `data-colony-trade-source`, a
         colony bonus leaves `data-colony-bonus-source` — so every reward's
         origin is readable. The trade value itself morphs (keyed out-in
         crossfade) when the presented position changes, i.e. exactly when
         the white marker lands after a trade. -->
    <div class="con-coltile__rows">
      <div class="con-coltile__cell con-coltile__cell--trade"
           :class="{'con-coltile__cell--reward-settled': rewardSettled}">
        <span class="con-coltile__cell-label">{{ $t('Trade') }}</span>
        <span class="con-coltile__cell-value" :data-colony-trade-source="colony.name">
          <!-- The FIXED part of the income (the Redux Venus: «[Venus] + X») stands
               BEFORE the marker's bonus, exactly as the tile prints it; it never
               changes with the marker, so it is outside the crossfade. -->
          <span v-if="tradeFixedBenefit !== undefined" class="con-coltile__cell-fixed" data-colony-trade-fixed>
            <BenefitGlyph :benefit="tradeFixedBenefit" :idx="0" :cardResources="cardResourceKinds" />
            <span class="con-coltile__cell-plus" aria-hidden="true">+</span>
          </span>
          <transition name="con-coltrade-reward" mode="out-in">
            <span class="con-coltile__cell-reward" :key="effectivePosition">
              <!-- A LEVY prints its sign — «−4», never a bare 4 in the gain's mint. -->
              <span v-if="reward.quantity > 1 || (rewardIsLevy && reward.quantity > 0)" class="con-coltile__cell-num"
                    :class="{'con-coltile__cell-num--levy': rewardIsLevy}">{{ rewardIsLevy ? '−' : '' }}{{ reward.quantity }}</span>
              <BenefitGlyph :benefit="tradeBenefit" :idx="effectivePosition" :cardResources="cardResourceKinds" compact />
            </span>
          </transition>
          <span v-if="offsetSteps > 0" class="con-coltile__cell-offset">+{{ offsetSteps }}</span>
        </span>
      </div>
      <div class="con-coltile__cell">
        <span class="con-coltile__cell-label">{{ $t('Bonus') }}</span>
        <span class="con-coltile__cell-value" :data-colony-bonus-source="colony.name">
          <span v-if="bonusQuantity > 1" class="con-coltile__cell-num">{{ bonusQuantity }}</span>
          <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResources="cardResourceKinds" compact />
        </span>
      </div>
    </div>

    <!-- Honest availability status — information, never a button hint. -->
    <footer class="con-coltile__status" :class="'con-coltile__status--' + status.kind">
      <template v-if="status.kind === 'ok'">
        <span class="con-coltile__status-dot" aria-hidden="true"></span>
        <span class="con-coltile__status-text">{{ status.text }}</span>
      </template>
      <template v-else-if="status.kind === 'blocked' || status.kind === 'inactive'">
        <span class="con-coltile__status-mark" aria-hidden="true">✕</span>
        <span class="con-coltile__status-text">{{ status.text }}</span>
      </template>
      <span v-else class="con-coltile__status-idle" aria-hidden="true"></span>
    </footer>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata, colonyCardResources, tradeBenefitAt, tradeFixedIncome} from '@/common/colonies/ColonyMetadata';
import {CardResource} from '@/common/CardResource';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {effectiveTradePosition, rewardAtPosition, TradeRewardAt} from '@/client/components/colonies/colonyTradePlan';
import {colonyTrackWaveState, colonyTradeState, presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import {CUBE_STATIC_SIZE} from '@/client/console/colonyBuild/colonyBuildModel';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsolePlanetDisc from '@/client/components/console/ConsolePlanetDisc.vue';

export type ConsoleColonyTileStatus = {
  kind: 'ok' | 'blocked' | 'inactive' | 'none',
  text: string,
};

type TrackCell = {index: number, marker: boolean, effective: boolean, passed: boolean};

export default defineComponent({
  name: 'ConsoleColonyTile',
  components: {BenefitGlyph, ColonyFleetIcon, ConsoleFlipValue, PlayerCube, ConsolePlanetDisc},
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    /** The viewer's standing trade offset (Trading Colony etc.). */
    tradeOffset: {type: Number, default: 0},
    /**
     * THE PROJECTED POSITION — where a pick would put this tile's marker, by
     * the SERVER's projection (TR07: `SelectColonyModel.trackMoves`, the top).
     * When set it IS the cell the tile reads (the ghost marker, «+N», the
     * reward at that cell); absent (−1), the tile projects the trade exactly
     * as before (the standing offset through `effectiveTradePosition`).
     */
    projectedPosition: {type: Number, default: -1},
    focused: {type: Boolean, default: false},
    /** Brief post-launch settle: the fleet just docked here (owner-hue seat). */
    justDocked: {type: Boolean, default: false},
    status: {
      type: Object as PropType<ConsoleColonyTileStatus>,
      default: (): ConsoleColonyTileStatus => ({kind: 'none', text: ''}),
    },
  },
  computed: {
    /** The card resource(s) the tile's card benefits add — the ONE list every glyph on this surface draws (several for the Redux Vesta). */
    cardResourceKinds(): ReadonlyArray<CardResource> {
      return colonyCardResources(this.metadata);
    },
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    /** The seated owner cube's footprint (logical px vs the 2.3rem cell; the
     *  `--con-ui-scale` zoom channel in console.less carries the TV scale). */
    cubeSize(): number {
      return CUBE_STATIC_SIZE;
    },
    /**
     * The colony as PRESENTED: while this colony's trade transaction is still
     * granting rewards, the committed track reset stays frozen at the
     * pre-trade position (the ONE shared helper — the tile, the focused
     * summary and the inspect can never disagree). Everything below reads
     * the track through this, so the reset only ever shows via the glide.
     */
    presented(): ColonyModel {
      return presentedColonyModel(this.colony);
    },
    /** The traded colony's marker proxy is mid-glide (the static dot yields) — or this tile's, in a law's WAVE over the whole table. */
    markerGliding(): boolean {
      return (colonyTradeState.phase === 'glide' && colonyTradeState.colonyName === this.colony.name) ||
        colonyTrackWaveState.gliding[this.colony.name] === true;
    },
    /** One-shot: the cell the reset marker just landed on (settle glow) — the trade's, or the wave's for this tile. */
    settledCell(): number {
      if (colonyTradeState.colonyName === this.colony.name) {
        return colonyTradeState.settledCell;
      }
      return colonyTrackWaveState.settled[this.colony.name] ?? -1;
    },
    /** One-shot: the «ТОРГОВАТЬ» readout settles WITH the landed marker. */
    rewardSettled(): boolean {
      return this.settledCell >= 0;
    },
    // BenefitGlyph expects a quantity ARRAY; the colony bonus is a scalar.
    buildBenefit(): {type: ColonyMetadata['build']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    /** The income at the position a trade READS — kind and resource resolved there (the Redux Pluto: data low, cards high). */
    tradeBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const income = tradeBenefitAt(this.metadata, this.effectivePosition);
      return {type: income.type, quantity: this.metadata.trade.quantity, resource: income.resource};
    },
    /** The FIXED part every trade here pays before the marker's bonus (the Redux Venus's step) — undefined for a tile without one. */
    /** The marker's income is a LEVY (the Redux Venus's 1st cell): the number is a cost. */
    rewardIsLevy(): boolean {
      return this.reward.type === ColonyBenefit.LOSE_RESOURCES;
    },
    tradeFixedBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} | undefined {
      const fixed = tradeFixedIncome(this.metadata);
      return fixed === undefined ? undefined : {type: fixed.type, quantity: [fixed.quantity], resource: fixed.resource};
    },
    colonyBenefit(): {type: ColonyMetadata['colony']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    bonusQuantity(): number {
      return this.metadata.colony.quantity ?? 1;
    },
    effectivePosition(): number {
      if (this.projectedPosition >= 0) {
        return Math.min(this.projectedPosition, this.trackMax);
      }
      // Only an ACTIVE colony can be traded with — the offset ghost is noise otherwise.
      const offset = this.colony.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(this.presented, this.metadata, offset);
    },
    /** The furthest cell a moving marker has TOUCHED (a track move in flight) — −1 when none. */
    touchedCell(): number {
      return colonyTrackWaveState.active ? (colonyTrackWaveState.touched[this.colony.name] ?? -1) : -1;
    },
    offsetSteps(): number {
      return Math.max(0, this.effectivePosition - this.displayedTrackPosition);
    },
    reward(): TradeRewardAt {
      return rewardAtPosition(this.metadata, this.effectivePosition);
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    /** The marker position actually SHOWN (presented — frozen mid-trade). */
    displayedTrackPosition(): number {
      return Math.min(this.presented.trackPosition, this.trackMax);
    },
    trackCells(): Array<TrackCell> {
      const marker = this.displayedTrackPosition;
      const effective = this.effectivePosition;
      const cells: Array<TrackCell> = [];
      for (let i = 0; i <= this.trackMax; i++) {
        cells.push({
          index: i,
          marker: i === marker,
          effective: i === effective && effective !== marker,
          // …and the cells a moving marker has already crossed light up on the touch, before the hold releases.
          passed: i < marker || (i > marker && i <= this.touchedCell),
        });
      }
      return cells;
    },
    trackPositionDisplay(): string {
      return `${this.displayedTrackPosition + 1}/${this.trackMax + 1}`;
    },
  },
});
</script>
