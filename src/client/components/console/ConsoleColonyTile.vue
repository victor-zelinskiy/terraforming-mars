<template>
  <!--
    CONSOLE COLONY TILE — the premium couch-readable colony tile (the tile IS
    the information: name, planet art, build slots + owner cubes, the 7-cell
    trade track with the live marker, the trade reward at the position the
    trade would actually read (offset applied), the fixed colony bonus, the
    parked trade fleet, and an honest availability status). No button hints
    here — the bottom command bar owns the controls (console rule).
  -->
  <div class="con-coltile"
       :class="{
         'con-coltile--focused': focused,
         'con-coltile--inactive': status.kind === 'inactive',
         'con-coltile--blocked': status.kind === 'blocked',
         'con-coltile--ok': status.kind === 'ok',
       }"
       :data-test="'con-colony-' + colony.name">
    <div class="con-coltile__planet" :class="planetClass" aria-hidden="true"></div>

    <header class="con-coltile__head">
      <span class="con-coltile__name">{{ $t(colony.name) }}</span>
      <span v-if="fleet !== undefined" class="con-coltile__fleet" :class="'con-coltile__fleet--' + fleet.color">
        <span class="con-coltile__fleet-ship colonies-fleet" :class="'colonies-fleet-' + fleet.color" aria-hidden="true"></span>
        <span class="con-coltile__fleet-name">{{ fleet.label }}</span>
      </span>
    </header>

    <!-- Build slots: what building here grants + the owner cubes. -->
    <div class="con-coltile__build">
      <div v-for="idx in [0, 1, 2]" :key="idx"
           class="con-coltile__build-slot"
           :class="{'con-coltile__build-slot--occupied': colony.colonies[idx] !== undefined}">
        <BenefitGlyph :benefit="buildBenefit" :idx="idx" :cardResource="metadata.cardResource" />
        <span v-if="colony.colonies[idx] !== undefined"
              class="con-coltile__cube"
              :class="'player_bg_color_' + colony.colonies[idx]"></span>
      </div>
    </div>

    <!-- The 7-cell trade track: filled up to the marker; the reward cell the
         trade would READ (trade offset applied) glows when it differs. -->
    <div class="con-coltile__track" aria-hidden="true">
      <span v-for="pos in trackCells" :key="pos.index"
            class="con-coltile__track-cell"
            :class="{
              'con-coltile__track-cell--marker': pos.marker,
              'con-coltile__track-cell--effective': pos.effective,
              'con-coltile__track-cell--passed': pos.passed,
            }"></span>
      <span class="con-coltile__track-pos">{{ trackPositionDisplay }}</span>
    </div>

    <div class="con-coltile__rows">
      <div class="con-coltile__row">
        <span class="con-coltile__row-label">{{ $t('Trade') }}</span>
        <span class="con-coltile__row-value">
          <span v-if="reward.quantity > 1" class="con-coltile__row-num">{{ reward.quantity }}</span>
          <BenefitGlyph :benefit="tradeBenefit" :idx="effectivePosition" :cardResource="metadata.cardResource" />
          <span v-if="offsetSteps > 0" class="con-coltile__row-offset">+{{ offsetSteps }}</span>
        </span>
      </div>
      <div class="con-coltile__row">
        <span class="con-coltile__row-label">{{ $t('Bonus') }}</span>
        <span class="con-coltile__row-value">
          <span v-if="bonusQuantity > 1" class="con-coltile__row-num">{{ bonusQuantity }}</span>
          <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
        </span>
      </div>
    </div>

    <!-- Honest availability status — information, never a button hint. -->
    <footer class="con-coltile__status" :class="'con-coltile__status--' + status.kind">
      <template v-if="status.kind === 'ok'">
        <span class="con-coltile__status-dot" aria-hidden="true"></span>
        <span>{{ status.text }}</span>
      </template>
      <template v-else-if="status.kind === 'blocked' || status.kind === 'inactive'">
        <span class="con-coltile__status-mark" aria-hidden="true">✕</span>
        <span>{{ status.text }}</span>
      </template>
      <span v-else class="con-coltile__status-idle">{{ status.text }}</span>
    </footer>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {effectiveTradePosition, rewardAtPosition, TradeRewardAt} from '@/client/components/colonies/colonyTradePlan';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateText} from '@/client/directives/i18n';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';

export type ConsoleColonyTileStatus = {
  kind: 'ok' | 'blocked' | 'inactive' | 'none',
  text: string,
};

type TrackCell = {index: number, marker: boolean, effective: boolean, passed: boolean};

export default defineComponent({
  name: 'ConsoleColonyTile',
  components: {BenefitGlyph},
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The viewer's standing trade offset (Trading Colony etc.). */
    tradeOffset: {type: Number, default: 0},
    focused: {type: Boolean, default: false},
    status: {
      type: Object as PropType<ConsoleColonyTileStatus>,
      default: (): ConsoleColonyTileStatus => ({kind: 'none', text: ''}),
    },
  },
  computed: {
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
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
      return effectiveTradePosition(this.colony, this.metadata, offset);
    },
    offsetSteps(): number {
      return Math.max(0, this.effectivePosition - Math.min(this.colony.trackPosition, this.trackMax));
    },
    reward(): TradeRewardAt {
      return rewardAtPosition(this.metadata, this.effectivePosition);
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    trackCells(): Array<TrackCell> {
      const marker = Math.min(this.colony.trackPosition, this.trackMax);
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
      return `${Math.min(this.colony.trackPosition, this.trackMax) + 1}/${this.trackMax + 1}`;
    },
    fleet(): {color: Color, label: string} | undefined {
      const visitor = this.colony.visitor;
      if (visitor === undefined) {
        return undefined;
      }
      if (visitor === this.viewerColor) {
        return {color: visitor, label: translateText('Your fleet')};
      }
      const player = this.players.find((p) => p.color === visitor);
      return {color: visitor, label: player !== undefined ? participantDisplayName(player) : translateText('Fleet')};
    },
  },
});
</script>
