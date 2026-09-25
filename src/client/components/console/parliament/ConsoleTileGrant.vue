<template>
  <!--
    A TILE GRANTED BY THRESHOLD (Turmoil Redux — Skyscrapers): ONE graphic
    block for the grant, wherever a surface names it — the vote surface's
    own-effect block, the fullscreen inspector's footer, the sitting's band,
    the playground. The twin of `ConsoleWinnerReward` for a part that is not
    the winner's alone: the winner AND every seat at or above the influence
    line receive it, so the head names both, and the CAPTION says which of
    the two the viewer is («yours at influence 2 — win or not» / «only if you
    win»), what is fixed while the phase resolves («you place it — influence
    2»), and the record once it is in («you placed it», or the named skip).

    THE BODY is the tile and where it lands — the city tile, an arrow, the
    city it stacks on — then the viewer's DESTINATIONS (their cities on Mars,
    the server's count; a zero is the honest «nothing to build on») and, once
    placed, the stack it became («×2»). The cell's greeneries are never
    promised here: that is the placement dossier's reading.

    Nothing here computes: the reading arrives from `tileGrantModel.ts`.
  -->
  <div class="con-tgrant"
       :class="['con-tgrant--' + size, 'con-tgrant--' + variant, 'con-tgrant--' + reading.context, {
         'con-tgrant--yours': yours,
         'con-tgrant--passed': passed,
         'con-tgrant--skipped': reading.skipped !== undefined,
         'con-tgrant--nowhere': nowhere,
       }]"
       data-tile-grant
       :data-grant-context="reading.context"
       :data-grant-eligibility="reading.eligibility"
       :data-grant-influence="reading.influence"
       :data-grant-cities="reading.cities"
       :data-grant-stack="reading.placed?.stackHeight"
       :data-grant-skipped="reading.skipped">
    <span v-if="variant !== 'inline'" class="con-tgrant__head">
      <i class="con-tgrant__star" aria-hidden="true"></i>
      <span class="con-tgrant__label">{{ label }}</span>
      <span v-if="caption !== ''" class="con-tgrant__caption" data-grant-caption>{{ caption }}</span>
    </span>
    <span class="con-tgrant__body">
      <i class="con-tgrant__tile con-tgrant__tile--city" aria-hidden="true"></i>
      <b class="con-tgrant__name">{{ $t(tileLabel) }}</b>
      <!-- WHERE it lands: the arrow onto the base city is the phrase; the words ride only where there is
           room for them (a block, a chip) — an inline row beside the card's own «STACK» graphic has said it. -->
      <span class="con-tgrant__where" data-grant-where>
        <span class="con-tgrant__arrow" aria-hidden="true">→</span>
        <i class="con-tgrant__tile con-tgrant__tile--base" aria-hidden="true"></i>
        <span v-if="variant !== 'inline'" class="con-tgrant__where-text">{{ $t(whereLabel) }}</span>
      </span>
      <!-- THE STACK it became (a record), or THE DESTINATIONS it may still land on (the vote, the phase). -->
      <span v-if="reading.placed?.stackHeight !== undefined" class="con-tgrant__stack" data-grant-stack-line>
        <b>×{{ reading.placed.stackHeight }}</b>
      </span>
      <span v-else-if="detail !== ''" class="con-tgrant__cities" :class="{'con-tgrant__cities--none': nowhere}" data-grant-detail>{{ detail }}</span>
      <!-- INLINE (a host label's own row): the caption rides the same line. -->
      <span v-if="variant === 'inline' && caption !== ''" class="con-tgrant__caption con-tgrant__caption--inline" data-grant-caption>{{ caption }}</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {
  TileGrantReading, tileGrantCaptionOf, tileGrantDetailOf, tileGrantLabelKey, tileGrantRecipientsKey, tileGrantWhereKey,
} from '@/client/console/parliament/tileGrantModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleTileGrant',
  props: {
    reading: {type: Object as PropType<TileGrantReading>, required: true},
    /** `compact` in a footer / a vote block, `normal` in a panel, `hero` on a stage. */
    size: {type: String as PropType<'compact' | 'normal' | 'hero'>, default: 'normal'},
    /**
     * `block` — the head and the body (a panel, the playground); `chip` — the head over the body, two
     * lines (the fullscreen footer's plate); `inline` — the body and the caption on ONE line, for a host
     * whose own label already addresses the viewer (the vote block's part row, the band).
     */
    variant: {type: String as PropType<'block' | 'chip' | 'inline'>, default: 'block'},
    /**
     * The host carries a skip's REASON elsewhere (the sitting's skip plate): the caption then says
     * «ПРОПУЩЕНО» alone (registry R-12 — the same sentence stood twice).
     */
    reasonElsewhere: {type: Boolean, default: false},
  },
  computed: {
    /** The viewer receives it (by the rule) — or did. */
    yours(): boolean {
      const e = this.reading.eligibility;
      return this.reading.context !== 'reference' && this.reading.skipped === undefined && (e === 'winner' || e === 'influence');
    },
    /** The rule passes the viewer over (below the line, not the winner). */
    passed(): boolean {
      return this.reading.context !== 'reference' && this.reading.eligibility === 'none';
    },
    /** Nothing to build on: the viewer has no city on Mars. */
    nowhere(): boolean {
      return this.reading.context !== 'applied' && this.reading.cities === 0;
    },
    label(): string {
      const head = tileGrantRecipientsKey(this.reading.grant);
      return translateTextWithParams(head.key, [...head.params]);
    },
    tileLabel(): string {
      return tileGrantLabelKey(this.reading.grant);
    },
    whereLabel(): string {
      return tileGrantWhereKey(this.reading.grant);
    },
    caption(): string {
      const caption = this.reading.skipped !== undefined && this.reasonElsewhere ? {key: 'Skipped'} : tileGrantCaptionOf(this.reading);
      if (caption === undefined) {
        return '';
      }
      const text = caption.params === undefined ? translateText(caption.key) : translateTextWithParams(caption.key, [...caption.params]);
      return this.reading.generation === undefined ? text : `${translateTextWithParams('Generation ${0}', [String(this.reading.generation)])} · ${text}`;
    },
    detail(): string {
      const detail = tileGrantDetailOf(this.reading);
      if (detail === undefined) {
        return '';
      }
      return detail.params === undefined ? translateText(detail.key) : translateTextWithParams(detail.key, [...detail.params]);
    },
  },
});
</script>
