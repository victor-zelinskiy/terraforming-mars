<template>
  <div class="con-colonies" :class="'con-colonies--' + layout">
    <div class="con-colonies__main">
      <!-- Header strip: what this screen is + the viewer's free trade fleets. -->
      <header class="con-colonies__head">
        <div class="con-colonies__head-title">
          <span class="con-colonies__kicker">{{ $t(pick !== undefined ? 'Colony selection' : 'Colonies') }}</span>
          <span v-if="pick !== undefined" class="con-colonies__mode-chip">{{ $t(pick.buttonLabel) }}</span>
        </div>
        <div class="con-colonies__fleets" :class="{'con-colonies__fleets--none': freeFleets === 0}">
          <span class="con-colonies__fleets-ship colonies-fleet" :class="viewerColor !== undefined ? 'colonies-fleet-' + viewerColor : ''" aria-hidden="true"></span>
          <span class="con-colonies__fleets-label">{{ $t('Free trade fleets') }}</span>
          <b class="con-colonies__fleets-count">{{ freeFleets }}/{{ fleetSize }}</b>
        </div>
      </header>

      <!-- The premium tile grid: 1–4 = one centred row, 5 = 3+2, 6 = 3×2,
           the rare >6 add-a-tile catalog = a compact wrap grid. -->
      <div class="con-colonies__grid" ref="grid">
        <div v-for="(colony, i) in colonies"
             :key="colony.name"
             class="con-colonies__slot"
             :ref="i === index ? 'selectedSlot' : undefined">
          <ConsoleColonyTile :colony="colony"
                             :players="players"
                             :viewerColor="viewerColor"
                             :tradeOffset="tradeOffset"
                             :focused="i === index"
                             :status="tileStatus(colony)" />
        </div>
      </div>
    </div>

    <!-- Detail panel: the selected colony's console dossier. -->
    <aside class="con-inspector con-colonies__detail" :aria-label="$t('Trading')">
      <template v-if="selected !== undefined">
        <div class="con-inspector__kicker">{{ $t('Colony') }}</div>
        <div class="con-inspector__name">{{ $t(selected.name) }}</div>
        <div v-if="description !== ''" class="con-inspector__desc" v-i18n>{{ description }}</div>

        <!-- What trading here RIGHT NOW yields (offset applied). -->
        <div v-if="selectedMetadata !== undefined" class="con-colonies__now">
          <span class="con-colonies__now-label">{{ $t('Trade now yields') }}</span>
          <span class="con-colonies__now-value">
            <span v-if="selectedRewardQuantity > 1" class="con-colonies__now-num">{{ selectedRewardQuantity }}</span>
            <BenefitGlyph :benefit="selectedTradeBenefit" :idx="selectedEffectivePosition" :cardResource="selectedMetadata.cardResource" />
          </span>
          <span v-if="selectedOffsetSteps > 0" class="con-colonies__now-offset">{{ $t('track advances first') }} +{{ selectedOffsetSteps }}</span>
        </div>

        <div class="con-info__stat-lines">
          <div class="con-info__stat-line"><span>{{ $t('Track position') }}</span><b>{{ trackPositionDisplay }}</b></div>
          <div class="con-info__stat-line">
            <span>{{ $t('Colonies built') }}</span>
            <span class="con-colonies__markers">
              <span v-for="(c, j) in selected.colonies" :key="j" :class="'con-status__dot player_bg_color_' + c"></span>
              <b v-if="selected.colonies.length === 0">0</b>
            </span>
          </div>
          <div v-for="owner in selectedOwners" :key="owner.color" class="con-info__stat-line con-colonies__owner-line">
            <span class="con-colonies__owner-name">
              <span :class="'con-status__dot player_bg_color_' + owner.color"></span>
              {{ owner.name }}<template v-if="owner.count > 1"> ×{{ owner.count }}</template>
            </span>
            <span v-if="selectedMetadata !== undefined" class="con-colonies__owner-bonus">
              <BenefitGlyph :benefit="selectedColonyBenefit" :idx="0" :cardResource="selectedMetadata.cardResource" />
              {{ $t('per trade') }}
            </span>
          </div>
          <div v-if="selected.visitor !== undefined" class="con-info__stat-line">
            <span>{{ $t('Trade fleet') }}</span>
            <span class="con-colonies__markers">
              <span :class="'con-status__dot player_bg_color_' + selected.visitor"></span>
              <b>{{ visitorName }}</b>
            </span>
          </div>
        </div>

        <!-- Payment paths at a glance (details live in the trade composer). -->
        <div v-if="pick === undefined && paymentChips.length > 0" class="con-colonies__pay">
          <span class="con-colonies__pay-label">{{ $t('Payment') }}</span>
          <span v-for="(chip, i) in paymentChips" :key="i"
                class="con-colonies__pay-chip"
                :class="{'con-colonies__pay-chip--off': !chip.available}">
            <i v-if="chip.iconClass !== ''" :class="chip.iconClass" aria-hidden="true"></i>
            <b>{{ chip.amount }}</b>
          </span>
        </div>

        <!-- PICK MODE (T4 — a server SelectColony): the verdict mirrors the
             placement panel; the reason is the SERVER's, never a guess.
             Status only — the button hints live in the bottom command bar. -->
        <template v-if="pick !== undefined">
          <div class="con-inspector__placement" :class="isPickable(selected.name) ? 'con-inspector__placement--legal' : 'con-inspector__placement--illegal'">
            <template v-if="isPickable(selected.name)">
              <span class="con-coltile__status-dot" aria-hidden="true"></span>
              <span>{{ $t('Can select') }}</span>
            </template>
            <template v-else>
              <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
              <span>{{ $t('Unavailable right now') }}</span>
            </template>
          </div>
          <div v-if="!isPickable(selected.name) && pickReasonFor(selected.name) !== ''" class="con-context__reason">{{ pickReasonFor(selected.name) }}</div>
        </template>
        <template v-else>
          <div class="con-inspector__placement" :class="tradeableHere ? 'con-inspector__placement--legal' : 'con-inspector__placement--illegal'">
            <template v-if="tradeableHere">
              <span class="con-coltile__status-dot" aria-hidden="true"></span>
              <span>{{ $t('Trade available') }}</span>
            </template>
            <template v-else>
              <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
              <span>{{ $t('Trade unavailable') }}</span>
            </template>
          </div>
          <div v-if="!tradeableHere && blockReasonFor(selected) !== ''" class="con-context__reason">{{ blockReasonFor(selected) }}</div>
        </template>
      </template>
      <div v-else class="con-inspector__empty">{{ $t('No colonies in this game') }}</div>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * Console-native COLONIES screen — the premium tile-grid rework. LEFT = the
 * console-native ConsoleColonyTile grid in a count-aware layout (1–4 = one
 * centred row of LARGE tiles, 5 = a deliberate 3+2, 6 = 3×2; the rare
 * add-a-tile catalog with >6 candidates = a compact wrap grid, visually its
 * own mode). Every tile carries the parked trade fleet, owner cubes, the
 * live track marker + the reward the trade would READ (offset applied) and
 * an honest availability status. RIGHT = the selected colony's dossier:
 * what trading now yields, owners (with the per-trade bonus they'd receive),
 * fleet, payment paths at a glance, and the server-honest verdict.
 *
 * Tradeability is SERVER truth (the trade AndOptions' SelectColony set);
 * PICK MODE (a server SelectColony) reuses the same grid with per-colony
 * server reasons. X = «Осмотреть» opens ConsoleColonyInspect (shell-owned);
 * button hints live ONLY in the shell's bottom command bar.
 */
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {DisabledOptionModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {colonyGridLayout, ColonyGridLayout} from '@/client/console/consoleColoniesModel';
import {
  colonyOwnerCounts,
  effectiveTradePosition,
  rewardAtPosition,
} from '@/client/components/colonies/colonyTradePlan';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleColonyTile, {ConsoleColonyTileStatus} from '@/client/components/console/ConsoleColonyTile.vue';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import {translateText} from '@/client/directives/i18n';

/** PICK MODE (T4 — a server SelectColony drives the grid): the shell owns it. */
export type ConsoleColonyPick = {
  /** Names the server accepts (its `coloniesModel`). */
  selectable: ReadonlyArray<string>,
  /** Per-colony SERVER reason for the unpickable ones (translated). */
  reasons: Readonly<Record<string, string>>,
  /** The server verb ('Build' / 'Select' …) shown on the A chip. */
  buttonLabel: string,
};

export default defineComponent({
  name: 'ConsoleColoniesSection',
  components: {ConsoleColonyTile, BenefitGlyph},
  props: {
    colonies: {type: Array as PropType<ReadonlyArray<ColonyModel>>, required: true},
    index: {type: Number, required: true},
    /** Server-tradeable colony names (empty when it's not the trade window). */
    tradeable: {type: Array as PropType<ReadonlyArray<string>>, required: true},
    /** Honest reason when trade is impossible right now ('' when tradeable). */
    tradeBlockReason: {type: String, default: ''},
    /** Set = SelectColony pick mode (shell submits; this only renders states). */
    pick: {type: Object as PropType<ConsoleColonyPick | undefined>, default: undefined},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    tradeOffset: {type: Number, default: 0},
    fleetSize: {type: Number, default: 1},
    freeFleets: {type: Number, default: 0},
    /** The live "Pay trade fee" options (for the at-a-glance payment chips). */
    paymentOptions: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    disabledPayments: {type: Array as PropType<ReadonlyArray<DisabledOptionModel>>, default: () => []},
  },
  computed: {
    layout(): ColonyGridLayout {
      return colonyGridLayout(this.colonies.length, this.pick !== undefined);
    },
    trackPositionDisplay(): string {
      if (this.selected === undefined) {
        return '';
      }
      return `${Math.min(this.selected.trackPosition, 6) + 1}/7`;
    },
    selected(): ColonyModel | undefined {
      return this.colonies[this.index];
    },
    selectedMetadata(): ColonyMetadata | undefined {
      const name = this.selected?.name;
      if (name === undefined) {
        return undefined;
      }
      try {
        return getColony(name);
      } catch (err) {
        return undefined;
      }
    },
    tradeableHere(): boolean {
      return this.selected !== undefined && this.tradeable.includes(this.selected.name);
    },
    description(): string {
      return this.selectedMetadata?.trade.description ?? '';
    },
    selectedEffectivePosition(): number {
      if (this.selected === undefined || this.selectedMetadata === undefined) {
        return 0;
      }
      const offset = this.selected.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(this.selected, this.selectedMetadata, offset);
    },
    selectedOffsetSteps(): number {
      if (this.selected === undefined) {
        return 0;
      }
      return Math.max(0, this.selectedEffectivePosition - Math.min(this.selected.trackPosition, 6));
    },
    selectedRewardQuantity(): number {
      if (this.selectedMetadata === undefined) {
        return 0;
      }
      return rewardAtPosition(this.selectedMetadata, this.selectedEffectivePosition).quantity;
    },
    selectedTradeBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = this.selectedMetadata?.trade;
      if (t === undefined) {
        return {type: ColonyBenefit.GAIN_RESOURCES, quantity: [0]};
      }
      const resource = Array.isArray(t.resource) ? t.resource[this.selectedEffectivePosition] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    selectedColonyBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.selectedMetadata?.colony;
      if (c === undefined) {
        return {type: ColonyBenefit.GAIN_RESOURCES, quantity: [1]};
      }
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    selectedOwners(): Array<{color: Color, count: number, name: string}> {
      if (this.selected === undefined) {
        return [];
      }
      return colonyOwnerCounts(this.selected).map((owner) => {
        const player = this.players.find((p) => p.color === owner.color);
        return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
      });
    },
    visitorName(): string {
      const visitor = this.selected?.visitor;
      if (visitor === undefined) {
        return '';
      }
      if (visitor === this.viewerColor) {
        return translateText('Your fleet');
      }
      const player = this.players.find((p) => p.color === visitor);
      return player !== undefined ? participantDisplayName(player) : '';
    },
    paymentChips(): Array<{iconClass: string, amount: string, available: boolean}> {
      const chips: Array<{iconClass: string, amount: string, available: boolean}> = [];
      for (const option of this.paymentOptions) {
        const meta = option.metadata;
        if (meta?.icon !== undefined) {
          chips.push({iconClass: iconClassFor(meta.icon) + ' con-colonies__pay-icon', amount: String(meta.amount ?? ''), available: true});
        }
      }
      for (const disabled of this.disabledPayments) {
        const meta = disabled.metadata;
        if (meta?.icon !== undefined) {
          chips.push({iconClass: iconClassFor(meta.icon) + ' con-colonies__pay-icon', amount: String(meta.amount ?? ''), available: false});
        }
      }
      return chips;
    },
  },
  watch: {
    index() {
      void this.$nextTick(() => this.scrollSelectedIntoView());
    },
  },
  methods: {
    isPickable(name: string): boolean {
      return this.pick !== undefined && this.pick.selectable.includes(name);
    },
    pickReasonFor(name: string): string {
      const reason = this.pick?.reasons[name];
      return reason !== undefined && reason !== '' ? reason : translateText('Unavailable right now');
    },
    /** Per-colony honest reason when the shared trade window is open but THIS
     *  tile can't be traded with (fleet parked / not active). */
    blockReasonFor(colony: ColonyModel): string {
      if (!colony.isActive) {
        return translateText('This colony is not active yet');
      }
      if (colony.visitor !== undefined) {
        return translateText('Another trade fleet is already here');
      }
      return translateText(this.tradeBlockReason);
    },
    tileStatus(colony: ColonyModel): ConsoleColonyTileStatus {
      if (this.pick !== undefined) {
        if (this.isPickable(colony.name)) {
          return {kind: 'ok', text: translateText('Can select')};
        }
        return {kind: 'blocked', text: this.pickReasonFor(colony.name)};
      }
      if (!colony.isActive) {
        return {kind: 'inactive', text: translateText('Not active yet')};
      }
      if (this.tradeable.includes(colony.name)) {
        return {kind: 'ok', text: translateText('Trade available')};
      }
      if (colony.visitor !== undefined) {
        return {kind: 'blocked', text: translateText('Fleet already here')};
      }
      // No open trade window (not my turn / no fleets): keep the tiles calm —
      // the shared reason lives in the detail panel + the fleet indicator.
      if (this.tradeable.length === 0) {
        return {kind: 'none', text: ''};
      }
      return {kind: 'blocked', text: translateText('Trade unavailable')};
    },
    scrollSelectedIntoView(): void {
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      el?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'smooth'});
    },
  },
  mounted() {
    this.scrollSelectedIntoView();
  },
});
</script>
