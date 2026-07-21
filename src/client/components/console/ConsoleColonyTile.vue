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
        <span class="con-coltile__planet" :class="planetClass" aria-hidden="true"></span>
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
               bonus is consumed, so the owner cube FILLS the whole cell (the
               reward glyph is gone). An empty slot shows what building here
               would grant. The `data-colony-build-slot` anchor is the landing
               geometry of the console colony-build hero (consoleColonyBuild). -->
          <span v-if="colony.colonies[idx] !== undefined"
                class="con-coltile__cube con-coltile__cube--filled"
                :class="'player_bg_color_' + colony.colonies[idx]"></span>
          <BenefitGlyph v-else :benefit="buildBenefit" :idx="idx" :cardResource="metadata.cardResource" />
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
          <transition name="con-coltrade-reward" mode="out-in">
            <span class="con-coltile__cell-reward" :key="effectivePosition">
              <span v-if="reward.quantity > 1" class="con-coltile__cell-num">{{ reward.quantity }}</span>
              <BenefitGlyph :benefit="tradeBenefit" :idx="effectivePosition" :cardResource="metadata.cardResource" />
            </span>
          </transition>
          <span v-if="offsetSteps > 0" class="con-coltile__cell-offset">+{{ offsetSteps }}</span>
        </span>
      </div>
      <div class="con-coltile__cell">
        <span class="con-coltile__cell-label">{{ $t('Bonus') }}</span>
        <span class="con-coltile__cell-value" :data-colony-bonus-source="colony.name">
          <span v-if="bonusQuantity > 1" class="con-coltile__cell-num">{{ bonusQuantity }}</span>
          <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
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
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {effectiveTradePosition, rewardAtPosition, TradeRewardAt} from '@/client/components/colonies/colonyTradePlan';
import {colonyTradeState, presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';

export type ConsoleColonyTileStatus = {
  kind: 'ok' | 'blocked' | 'inactive' | 'none',
  text: string,
};

type TrackCell = {index: number, marker: boolean, effective: boolean, passed: boolean};

export default defineComponent({
  name: 'ConsoleColonyTile',
  components: {BenefitGlyph, ColonyFleetIcon, ConsoleFlipValue},
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    /** The viewer's standing trade offset (Trading Colony etc.). */
    tradeOffset: {type: Number, default: 0},
    focused: {type: Boolean, default: false},
    /** Brief post-launch settle: the fleet just docked here (owner-hue seat). */
    justDocked: {type: Boolean, default: false},
    status: {
      type: Object as PropType<ConsoleColonyTileStatus>,
      default: (): ConsoleColonyTileStatus => ({kind: 'none', text: ''}),
    },
  },
  computed: {
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
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
    /** The traded colony's marker proxy is mid-glide (the static dot yields). */
    markerGliding(): boolean {
      return colonyTradeState.phase === 'glide' && colonyTradeState.colonyName === this.colony.name;
    },
    /** One-shot: the cell the reset marker just landed on (settle glow). */
    settledCell(): number {
      return colonyTradeState.colonyName === this.colony.name ? colonyTradeState.settledCell : -1;
    },
    /** One-shot: the «ТОРГОВАТЬ» readout settles WITH the landed marker. */
    rewardSettled(): boolean {
      return this.settledCell >= 0;
    },
    planetClass(): string {
      return this.colony.name.replace(' ', '-') + '-background';
    },
    // BenefitGlyph expects a quantity ARRAY; the colony bonus is a scalar.
    buildBenefit(): {type: ColonyMetadata['build']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    tradeBenefit(): {type: ColonyMetadata['trade']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = this.metadata.trade;
      const resource = Array.isArray(t.resource) ? t.resource[this.effectivePosition] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    colonyBenefit(): {type: ColonyMetadata['colony']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    bonusQuantity(): number {
      return this.metadata.colony.quantity ?? 1;
    },
    effectivePosition(): number {
      // Only an ACTIVE colony can be traded with — the offset ghost is noise otherwise.
      const offset = this.colony.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(this.presented, this.metadata, offset);
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
          passed: i < marker,
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
