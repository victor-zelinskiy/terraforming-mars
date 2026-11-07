<template>
  <div class="con-tender"
       :class="[`con-tender--${size}`, `con-tender--${state}`, `con-tender--tier-${tier}`, {'con-tender--focused': focused}]"
       :data-tender="id" :data-tender-state="state">
    <!--
      A TENDER — the Committee's LOT, a document, never a playing card (the owner, 2026-11-07: «свой узнаваемый визуал,
      а не рескин проектов»). Cool paper with ruled hairlines, an oxide-red Committee band with the lot number, a notched
      corner, the tier as chevrons, the family glyph as the emblem, the rule in prose, a perforated coupon printing the
      compensation floor, and a diagonal STAMP for its state (taken by a seat / withdrawn / executed / bought back).
      Three sizes: `table` (the bidding's row), `reader` (X — the full text and the lore), `plaque` (a seat's crest on
      the podium / the campaign rail: the band and the name only). Every state is drawn by MATERIAL — a kant, a stamp,
      a word — never a glow.
    -->
    <div class="con-tender__band">
      <span class="con-tender__committee">{{ $t(committeeKey) }}</span>
      <span class="con-tender__lot">{{ lotText }}</span>
    </div>
    <template v-if="size !== 'plaque'">
      <div class="con-tender__rank" :data-tier="tier">
        <span v-for="k in chevrons" :key="k" class="con-tender__chev" aria-hidden="true"></span>
        <span v-if="chevrons === 0" class="con-tender__die" aria-hidden="true"></span>
        <span class="con-tender__tier">{{ $t(tierKey) }}</span>
      </div>
    </template>
    <div class="con-tender__name">{{ $t(meta.nameKey) }}</div>
    <template v-if="size !== 'plaque'">
      <div class="con-tender__emblem" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="con-tender__glyph"><path :d="glyphPath" /></svg>
      </div>
      <div class="con-tender__window">{{ $t(windowKey) }}</div>
      <div class="con-tender__rule">{{ $t(meta.ruleKey) }}</div>
      <div v-if="size === 'reader'" class="con-tender__lore">{{ $t(meta.loreKey) }}</div>
      <div class="con-tender__coupon">
        <span class="con-tender__coupon-label">{{ $t('Not executed') }}</span>
        <b class="con-tender__coupon-value">→ {{ compensation }} M€</b>
      </div>
    </template>
    <div v-if="owner !== undefined" class="con-tender__stamp con-tender__stamp--owner" :data-owner-color="owner.color">
      <i class="con-tender__stamp-cube" :class="`player_bg_color_${owner.color}`" aria-hidden="true"></i>
      <span class="con-tender__stamp-text">{{ owner.name }}</span>
    </div>
    <div v-else-if="state === 'withdrawn'" class="con-tender__stamp con-tender__stamp--withdrawn">{{ $t('Withdrawn') }}</div>
    <div v-else-if="state === 'executed'" class="con-tender__stamp con-tender__stamp--executed">{{ $t('Executed') }}</div>
    <div v-else-if="state === 'cashed'" class="con-tender__stamp con-tender__stamp--cashed">{{ $t('Bought back') }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {TENDER_COMPENSATION_MC, TenderId, tenderDef} from '@/common/campaign/tenders';
import {TENDER_GLYPH_PATH, tenderChevrons, tenderMeta, tenderTierKey, tenderWindowKey} from '@/client/console/campaign/tenderMeta';
import {translateTextWithParams} from '@/client/directives/i18n';

export type TenderCardState = 'open' | 'taken' | 'withdrawn' | 'held' | 'executed' | 'cashed';

export default defineComponent({
  name: 'ConsoleTenderCard',
  props: {
    id: {type: String as PropType<TenderId>, required: true},
    size: {type: String as PropType<'table' | 'reader' | 'plaque'>, default: 'table'},
    state: {type: String as PropType<TenderCardState>, default: 'open'},
    /** The seat that holds it (the stamp). */
    owner: {type: Object as PropType<{name: string, color: Color} | undefined>, default: undefined},
    focused: {type: Boolean, default: false},
  },
  computed: {
    /** The band names the Committee — the short form on the table's narrow band (the full name is cut there), the
     *  full name on the reader and the plaque. */
    committeeKey(): string {
      return this.size === 'table' ? 'Committee' : 'Terraforming Committee';
    },
    meta() {
      return tenderMeta(this.id);
    },
    tier(): string {
      return tenderDef(this.id).tier;
    },
    chevrons(): number {
      return tenderChevrons(tenderDef(this.id).tier);
    },
    tierKey(): string {
      return tenderTierKey(this.id);
    },
    windowKey(): string {
      return tenderWindowKey(this.id);
    },
    glyphPath(): string {
      return TENDER_GLYPH_PATH[this.meta.glyph];
    },
    lotText(): string {
      return translateTextWithParams('Lot ${0}', [String(this.meta.lot).padStart(2, '0')]);
    },
    compensation(): number {
      return TENDER_COMPENSATION_MC;
    },
  },
});
</script>
