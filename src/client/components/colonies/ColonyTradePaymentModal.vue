<template>
  <!--
    Premium trade confirmation + payment picker. Mounted by PlayerHome the
    moment the player presses ТОРГОВАТЬ on a colony — ALWAYS, even when only one
    pay path exists, so the trade is never submitted without an explicit confirm.

    Shows: a colony summary (planet + name + what you receive at the current
    track position), every payment option as a rich card (resource icon + cost +
    your stock + current→resulting), and the UNAFFORDABLE options DISABLED with a
    reason (never hidden). Select → confirm; nothing reaches the server until the
    primary CTA is pressed.
  -->
  <div class="colony-trade-pay">
    <header class="colony-trade-pay__header">
      <div class="colony-trade-pay__header-tab"></div>
      <div class="colony-trade-pay__header-text">
        <h3 class="colony-trade-pay__title" v-i18n>Trade</h3>
        <p class="colony-trade-pay__subtitle">
          <span v-i18n>Pick how to pay for trading with</span>
          <span class="colony-trade-pay__colony-name" v-i18n>{{ colonyName }}</span>
        </p>
      </div>
    </header>

    <!-- Colony summary: which colony + what you receive. -->
    <div v-if="colony !== undefined" class="colony-trade-pay__colony">
      <span class="colony-trade-pay__colony-planet" :class="planetClass" aria-hidden="true"></span>
      <div class="colony-trade-pay__colony-info">
        <span class="colony-trade-pay__colony-title">{{ translatedColonyName }}</span>
        <span v-if="tradeReward !== undefined" class="colony-trade-pay__colony-reward">
          <span class="colony-trade-pay__colony-reward-label" v-i18n>You receive</span>
          <BenefitGlyph :benefit="tradeReward" :idx="0" :cardResource="cardResource" />
        </span>
      </div>
    </div>

    <!--
      SECONDARY transparency block: who ELSE gains the (fixed) colony bonus when
      you trade here. Shown ONLY when colonies are already built on this tile, so
      it never appears for an empty colony and never steals focus from the payment
      decision. A player with several colonies here shows an explicit ×N.
    -->
    <div v-if="beneficiaries.length > 0" class="colony-trade-pay__bonus">
      <div class="colony-trade-pay__bonus-head">
        <span class="colony-trade-pay__bonus-label" v-i18n>Trade bonus to colonies here</span>
        <span v-if="colonyBonus !== undefined" class="colony-trade-pay__bonus-reward">
          <BenefitGlyph :benefit="colonyBonus" :idx="0" :cardResource="cardResource" />
        </span>
      </div>
      <div class="colony-trade-pay__bonus-list">
        <span v-for="b in beneficiaries"
              :key="'ben-' + b.color"
              class="colony-trade-pay__bonus-chip"
              :data-test="'colony-trade-bonus-' + b.color">
          <span class="colony-trade-pay__bonus-cube" :class="'player_bg_color_' + b.color" aria-hidden="true"></span>
          <span class="colony-trade-pay__bonus-name">{{ b.name }}</span>
          <span v-if="b.count > 1" class="colony-trade-pay__bonus-count">×{{ b.count }}</span>
        </span>
      </div>
    </div>

    <div class="colony-trade-pay__options">
      <button v-for="(opt, idx) in options"
              :key="'pay-' + idx"
              type="button"
              class="colony-trade-pay__option"
              :class="{'colony-trade-pay__option--selected': selectedIdx === idx}"
              @click="selectedIdx = idx"
              :data-test="'colony-trade-pay-opt-' + idx">
        <span v-if="iconClass(opt.metadata) !== ''"
              class="colony-trade-pay__option-icon modal-input__option-icon"
              :class="iconClass(opt.metadata)"
              aria-hidden="true"></span>
        <span class="colony-trade-pay__option-body">
          <span class="colony-trade-pay__option-label">{{ optionLabel(opt) }}</span>
          <span v-if="hasStock(opt.metadata)" class="colony-trade-pay__option-stock">
            <span v-i18n>In stock</span>: {{ current(opt.metadata) }} → {{ resulting(opt.metadata) }}
          </span>
        </span>
        <span v-if="selectedIdx === idx" class="colony-trade-pay__option-check" aria-hidden="true">✓</span>
      </button>

      <!-- Unaffordable payment paths — visible but disabled, with a reason. -->
      <div v-for="(opt, idx) in disabledOptions"
           :key="'pay-disabled-' + idx"
           class="colony-trade-pay__option colony-trade-pay__option--disabled"
           :data-hint="reasonText(opt)"
           :data-test="'colony-trade-pay-disabled-' + idx">
        <span v-if="iconClass(opt.metadata) !== ''"
              class="colony-trade-pay__option-icon modal-input__option-icon"
              :class="iconClass(opt.metadata)"
              aria-hidden="true"></span>
        <span class="colony-trade-pay__option-body">
          <span class="colony-trade-pay__option-label">{{ optionLabel(opt) }}</span>
          <span v-if="hasStock(opt.metadata)" class="colony-trade-pay__option-stock">
            <span v-i18n>In stock</span>: {{ current(opt.metadata) }}
          </span>
        </span>
        <span class="colony-trade-pay__option-reason">{{ reasonText(opt) }}</span>
      </div>
    </div>

    <div class="colony-trade-pay__actions">
      <button type="button"
              class="colony-trade-pay__confirm"
              :disabled="selectedIdx === -1"
              @click="confirm"
              data-test="colony-trade-pay-confirm">
        <span v-i18n>Confirm trade</span>
      </button>
      <button type="button"
              class="colony-trade-pay__cancel"
              @click="$emit('cancel')"
              data-test="colony-trade-pay-cancel">
        <span v-i18n>Cancel</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {CardResource} from '@/common/CardResource';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, DisabledOptionModel, OptionMetadata} from '@/common/models/PlayerInputModel';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import BenefitGlyph from './BenefitGlyph.vue';

type DataModel = {
  selectedIdx: number;
};

export default defineComponent({
  name: 'ColonyTradePaymentModal',
  components: {BenefitGlyph},
  props: {
    colony: {
      type: Object as () => ColonyModel | undefined,
      default: undefined,
    },
    colonyName: {
      type: String as () => ColonyName,
      required: true,
    },
    // Affordable payment options (the inner "Pay trade fee" OrOptions options).
    options: {
      type: Array as () => ReadonlyArray<SelectOptionModel>,
      required: true,
    },
    // Unaffordable standard-resource paths, shown disabled with a reason.
    disabledOptions: {
      type: Array as () => ReadonlyArray<DisabledOptionModel>,
      default: () => [],
    },
    // Public player models — used to name the colony-bonus beneficiaries.
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      default: () => [],
    },
  },
  emits: ['select', 'cancel'],
  data(): DataModel {
    return {selectedIdx: -1};
  },
  computed: {
    translatedColonyName(): string {
      return translateText(this.colonyName);
    },
    planetClass(): string {
      return this.colonyName.replace(' ', '-') + '-background';
    },
    cardResource(): CardResource | undefined {
      return getColony(this.colonyName)?.cardResource;
    },
    // The trade reward at this colony's CURRENT track position (what the player
    // gets) — same construction ColonyDetailView feeds to BenefitGlyph.
    tradeReward(): {type: ColonyBenefit, quantity: Array<number>, resource?: unknown} | undefined {
      const meta = getColony(this.colonyName);
      if (meta === undefined || this.colony === undefined) {
        return undefined;
      }
      const idx = Math.min(this.colony.trackPosition, 6);
      const t = meta.trade;
      const resource = Array.isArray(t.resource) ? t.resource[idx] : t.resource;
      return {type: t.type, quantity: [t.quantity[idx] ?? 0], resource};
    },
    // The FIXED colony bonus EVERY player with a colony on this tile receives
    // when a trade happens here — a SEPARATE, track-independent reward (e.g. Luna
    // 2 M€, Ceres 2 steel), not the trade reward. Built for BenefitGlyph like
    // tradeReward, from the same client metadata manifest.
    colonyBonus(): {type: ColonyBenefit, quantity: Array<number>, resource?: unknown} | undefined {
      const meta = getColony(this.colonyName);
      if (meta === undefined) {
        return undefined;
      }
      const c = meta.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    // Everyone who already has a colony built on this tile — they ALL gain the
    // colony bonus when this trade resolves (INCLUDING the trading player). Grouped
    // by colour with a count, since a player can hold multiple colonies here and
    // thus receive the bonus several times.
    beneficiaries(): Array<{color: Color, name: string, count: number}> {
      if (this.colony === undefined) {
        return [];
      }
      const counts = new Map<Color, number>();
      for (const color of this.colony.colonies) {
        counts.set(color, (counts.get(color) ?? 0) + 1);
      }
      const out: Array<{color: Color, name: string, count: number}> = [];
      counts.forEach((count, color) => {
        const p = this.players.find((pp) => pp.color === color);
        out.push({color, name: p?.name ?? String(color), count});
      });
      return out;
    },
  },
  methods: {
    optionLabel(opt: SelectOptionModel | DisabledOptionModel): string {
      return typeof opt.title === 'string' ? translateText(opt.title) : translateMessage(opt.title);
    },
    iconClass(meta: OptionMetadata | undefined): string {
      return iconClassFor(meta?.icon);
    },
    hasStock(meta: OptionMetadata | undefined): boolean {
      return meta?.resource !== undefined;
    },
    current(meta: OptionMetadata | undefined): number {
      return meta?.resource?.current ?? 0;
    },
    resulting(meta: OptionMetadata | undefined): number {
      return meta?.resource?.resulting ?? 0;
    },
    reasonText(opt: DisabledOptionModel): string {
      if (opt.reason === undefined) {
        return translateText('Unavailable');
      }
      return typeof opt.reason === 'string' ? translateText(opt.reason) : translateMessage(opt.reason);
    },
    confirm(): void {
      if (this.selectedIdx === -1) {
        return;
      }
      this.$emit('select', this.selectedIdx);
    },
  },
});
</script>
