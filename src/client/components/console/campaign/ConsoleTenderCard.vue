<template>
  <div class="con-tender"
       :class="[`con-tender--${size}`, `con-tender--${state}`, `con-tender--tier-${tier}`, {'con-tender--focused': focused, 'con-tender--art': artUrl !== undefined}]"
       :data-tender="id" :data-tender-state="state" :data-name-tier="nameTier">
    <!--
      A TENDER — the Committee's CONTRACT (the face's third pass, 2026-11-08 — the owner: «оформление и цветовую гамму
      переработать на более премиальный стиль, подходящий направлению игры; место для арта»). A CARD of the game's own
      family, never a sheet of old paper: an enamel PLATE in the Committee's petrol, rimmed by the TIER's metal (gold ·
      steel · bronze · oxide — the rank read by material, the chevrons give it form), carrying
        · the HEAD — the family seal, the word «ТЕНДЕР», the printed lot number;
        · the ART window — ONE compact, recognisable subject per kind (`tenderArt.ts`); until a kind has its art the
          window engraves the family glyph (a placeholder by construction, never an empty box);
        · the PLATE of ceramic below — the name in the display face (its size by the LENGTH-TIER ladder,
          `data-name-tier`), the rank and the window on one meta line, the compensation floor on a perforated stub.
      NO RULE PROSE ON THE FACE at any size: X opens the ONE viewer, whose RIGHT column reads the rule
      (`tenderAnnotations.ts`) and whose LEFT gutter the lore — the project card's grammar. Three sizes share ONE
      layout scaled by `--tender-w` (every inner length is in `em`): `table` (the bidding's row, the portfolio),
      `reader` (the viewer's stage), and `plaque` (a seat's crest: the head and the name on the enamel alone). Every
      state is MATERIAL — a kant, a stamp, a word — never a glow.
    -->
    <i class="con-tender__frame" aria-hidden="true"></i>
    <div class="con-tender__head">
      <span class="con-tender__seal" aria-hidden="true">
        <svg viewBox="0 0 24 24" class="con-tender__seal-glyph"><path :d="glyphPath" /></svg>
      </span>
      <span class="con-tender__kicker">{{ $t('Tender') }}</span>
      <span class="con-tender__lot">{{ lotText }}</span>
    </div>
    <div v-if="size !== 'plaque'" class="con-tender__art" :data-tender-art="artUrl !== undefined ? 'image' : 'emblem'">
      <img v-if="artUrl !== undefined" class="con-tender__art-img" :src="artUrl" alt="" decoding="async" draggable="false" />
      <svg v-else class="con-tender__emblem" viewBox="0 0 24 24" aria-hidden="true"><path :d="glyphPath" /></svg>
    </div>
    <div v-if="size === 'plaque'" class="con-tender__name">{{ $t(meta.nameKey) }}</div>
    <div v-else class="con-tender__plate">
      <div class="con-tender__name">{{ $t(meta.nameKey) }}</div>
      <div class="con-tender__meta">
        <span class="con-tender__rank" :data-tier="tier">
          <span v-for="k in chevrons" :key="k" class="con-tender__chev" aria-hidden="true"></span>
          <span v-if="chevrons === 0" class="con-tender__die" aria-hidden="true"></span>
          <span class="con-tender__tier">{{ $t(tierKey) }}</span>
        </span>
        <span class="con-tender__window">{{ $t(windowKey) }}</span>
      </div>
      <div class="con-tender__coupon">
        <span class="con-tender__coupon-label">{{ $t('Not executed') }}</span>
        <!-- the floor in the game's own money language: the value INSIDE the megacredit tile (the premium face's cost badge) -->
        <b class="con-tender__coupon-value">
          <span class="con-tender__coupon-arrow" aria-hidden="true">→</span>
          <span class="con-tender__mc" :aria-label="`${compensation} M€`">{{ compensation }}</span>
        </b>
      </div>
    </div>
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
import {TENDER_GLYPH_PATH, TenderCardState, tenderChevrons, tenderMeta, tenderTierKey, tenderWindowKey} from '@/client/console/campaign/tenderMeta';
import {tenderArtUrl} from '@/client/console/campaign/tenderArt';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export type {TenderCardState};

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
    /**
     * THE NAME'S TIER — a calibrated ladder, never an eyeballed shrink: the LONGEST WORD decides first (it can never
     * wrap), the whole name second (three lines at most on the table). 1 = the base size, 2 = tighter, 3 = tightest.
     */
    nameTier(): 1 | 2 | 3 {
      const name = translateText(this.meta.nameKey);
      const longest = name.split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
      if (longest <= 9 && name.length <= 18) {
        return 1;
      }
      return longest <= 12 && name.length <= 24 ? 2 : 3;
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
    /** The kind's art, once it has one — undefined keeps the engraved family glyph in the window. */
    artUrl(): string | undefined {
      return tenderArtUrl(this.id);
    },
    /** The lot tag — «№ 04» on the table and the plaque (the Register's context names the lot), «Лот № 04» in the reader. */
    lotText(): string {
      const num = String(this.meta.lot).padStart(2, '0');
      return this.size === 'reader' ? translateTextWithParams('Lot ${0}', [num]) : translateTextWithParams('No. ${0}', [num]);
    },
    compensation(): number {
      return TENDER_COMPENSATION_MC;
    },
  },
});
</script>
