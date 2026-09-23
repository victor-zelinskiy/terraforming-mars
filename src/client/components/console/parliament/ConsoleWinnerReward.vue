<template>
  <!--
    THE WINNER'S PART (Turmoil Redux) — ONE graphic block for a resolution's
    winner part, wherever a surface names it: the vote surface's own-effect
    block, the fullscreen inspector's footer, the playground, the sitting's band.

    It stands APART from the influence readings on purpose: those are every
    player's numbers, this is one seat's tile — marked by the winner star and
    its own label, so nobody reads the free greenery as theirs or as something
    their plants pay for. The CAPTION says which question it answers («if you
    win» / «you place it» / «placed by X» / «neutral winner» / a skip's
    reason); the BODY says what the tile's own placement does to the table
    (oxygen 7 → 8 %, or «max» — no step) and the TR it is worth. The cell's
    bonuses are never promised here: that is the placement dossier's job.

    The winner's COLONY (Colony Contest) is the same block with no parameter
    line: before the pick the body is the colony tile and its label; once it
    is built, the tile the cube landed on takes the parameter's place.

    Nothing here computes: the reading arrives from `winnerRewardModel.ts`
    (the common `winnerReward.ts` rules the engine pays by).
  -->
  <div class="con-wreward"
       :class="['con-wreward--' + size, 'con-wreward--' + variant, 'con-wreward--' + reading.context, 'con-wreward--' + glyph, {
         'con-wreward--neutral': neutral,
         'con-wreward--skipped': reading.skipped !== undefined,
         'con-wreward--mine': mine,
       }]"
       data-winner-reward
       :data-winner-context="reading.context"
       :data-winner-tile="glyph"
       :data-winner-recipient="reading.recipient"
       :data-winner-rises="rises === undefined ? undefined : String(rises)"
       :data-winner-before="range?.from"
       :data-winner-after="range?.to"
       :data-winner-tr="trTotal"
       :data-winner-built="reading.built"
       :data-winner-skipped="reading.skipped">
    <span v-if="variant !== 'inline'" class="con-wreward__head">
      <i class="con-wreward__star" aria-hidden="true"></i>
      <span class="con-wreward__label">{{ $t('For the winner of the vote') }}</span>
      <span v-if="caption !== ''" class="con-wreward__caption" data-winner-caption>{{ caption }}</span>
    </span>
    <span class="con-wreward__body">
      <i class="con-wreward__tile" :class="'con-wreward__tile--' + glyph" aria-hidden="true"></i>
      <b class="con-wreward__name">{{ $t(tileLabel) }}</b>
      <span v-if="reading.parameter !== undefined" class="con-wreward__param" :class="{'con-wreward__param--max': atMax}" data-winner-param>
        <i class="con-wreward__pico" :class="'con-wreward__pico--' + reading.parameter" aria-hidden="true"></i>
        <template v-if="range !== undefined && !atMax">
          <span class="con-wreward__from">{{ range.from }}{{ unit }}</span>
          <span class="con-wreward__arrow" aria-hidden="true">→</span>
          <b class="con-wreward__to">{{ range.to }}{{ unit }}</b>
        </template>
        <template v-else-if="atMax">
          <b class="con-wreward__to">{{ range?.to }}{{ unit }}</b>
          <em class="con-wreward__max">{{ $t('Max.') }}</em>
        </template>
        <b v-else class="con-wreward__to">+1</b>
      </span>
      <!-- THE COLONY, once built: the tile the cube landed on stands where a tile's parameter would. -->
      <span v-else-if="reading.built !== undefined" class="con-wreward__param con-wreward__param--built" data-winner-param>
        <b class="con-wreward__to">{{ $t(reading.built) }}</b>
      </span>
      <span v-if="trTotal > 0" class="con-wreward__tr" data-winner-tr-total><b>+{{ trTotal }}</b><i class="con-wreward__tr-ico" aria-hidden="true"></i></span>
      <!-- INLINE (the vote block — its own label stands beside it): the caption rides the same line. -->
      <span v-if="variant === 'inline' && caption !== ''" class="con-wreward__caption con-wreward__caption--inline" data-winner-caption>{{ caption }}</span>
    </span>
    <span v-if="variant === 'block' && note !== ''" class="con-wreward__note" data-winner-note>{{ note }}</span>
    <!-- The breakdown stays READABLE to assistive tech and probes where a tight host has no line for it. -->
    <span v-if="variant !== 'block' && note !== ''" class="con-wreward__note con-wreward__note--hidden" data-winner-note>{{ note }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {winnerRewardTrTotal} from '@/common/parliament/winnerReward';
import {
  WinnerRewardReading, winnerRewardCaptionOf, winnerParameterLabelKey, winnerRewardGlyph, winnerTileLabelKey,
} from '@/client/console/parliament/winnerRewardModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleWinnerReward',
  props: {
    reading: {type: Object as PropType<WinnerRewardReading>, required: true},
    /** The viewer — «you place it» vs «placed by X». */
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** A seat's display name. */
    nameOf: {type: Function as PropType<(color: Color) => string>, default: (color: Color) => translateText(color)},
    /** `compact` in a footer / a vote block, `normal` in a panel, `hero` on a stage. */
    size: {type: String as PropType<'compact' | 'normal' | 'hero'>, default: 'normal'},
    /**
     * `block` — the head, the body and the TR breakdown (a panel, the playground);
     * `chip` — the head over the body, two lines (the fullscreen footer's plate);
     * `inline` — the body and the caption on ONE line, for a host whose own label
     * already says «for the winner of the vote» (the vote block's part row).
     */
    variant: {type: String as PropType<'block' | 'chip' | 'inline'>, default: 'block'},
    /**
     * The host carries a skip's REASON elsewhere (the sitting's skip plate): the caption then
     * says «ПРОПУЩЕНО» alone (registry R-12 — the same sentence stood twice). A host without a
     * plate (the playground, the fullscreen footer) keeps the reason in the caption — a skip
     * never goes unexplained.
     */
    reasonElsewhere: {type: Boolean, default: false},
  },
  computed: {
    neutral(): boolean {
      return (this.reading.context === 'pending' || this.reading.context === 'applied') && this.reading.recipient === 'neutral';
    },
    mine(): boolean {
      return this.viewerColor !== undefined && this.reading.recipient === this.viewerColor;
    },
    /** The graphic the part draws: the tile kind, or `colony`. */
    glyph(): 'greenery' | 'ocean' | 'colony' {
      return winnerRewardGlyph(this.reading.reward);
    },
    tileLabel(): string {
      return winnerTileLabelKey(this.reading.reward);
    },
    unit(): string {
      return this.reading.parameter === 'oxygen' ? '%' : '';
    },
    /** from → to: the live room, or the recorded step. */
    range(): {from: number, to: number} | undefined {
      const r = this.reading;
      if (r.placed !== undefined && (r.placed.before !== 0 || r.placed.after !== 0)) {
        return {from: r.placed.before, to: r.placed.after};
      }
      if (r.room !== undefined) {
        return {from: r.room.current, to: r.room.resulting};
      }
      return undefined;
    },
    rises(): boolean | undefined {
      const range = this.range;
      return range === undefined ? undefined : range.to > range.from;
    },
    /** The parameter stands at its maximum: the tile lands, the parameter does not move. */
    atMax(): boolean {
      const r = this.reading;
      if (r.room !== undefined) {
        return !r.room.rises;
      }
      const range = this.range;
      return r.placed !== undefined && range !== undefined && range.to === range.from;
    },
    trTotal(): number {
      return this.reading.tr === undefined ? 0 : winnerRewardTrTotal(this.reading.tr);
    },
    caption(): string {
      // Beside a skip PLATE the caption says «ПРОПУЩЕНО» and the plate says why (R-12); elsewhere the caption is the reason.
      const caption = this.reading.skipped !== undefined && this.reasonElsewhere ? {key: 'Skipped'} : winnerRewardCaptionOf(this.reading, this.viewerColor, this.nameOf);
      if (caption === undefined) {
        return '';
      }
      const text = caption.params === undefined ? translateText(caption.key) : translateTextWithParams(caption.key, [...caption.params]);
      return this.reading.generation === undefined ? text : `${translateTextWithParams('Generation ${0}', [String(this.reading.generation)])} · ${text}`;
    },
    /** What the TR is made of — or why the parameter does not move. */
    note(): string {
      const r = this.reading;
      if (this.neutral || r.skipped !== undefined) {
        return '';
      }
      if (r.room !== undefined && !r.room.tileAvailable) {
        return translateText('No ocean tile is left');
      }
      const terms: Array<string> = [];
      const tr = r.tr;
      if (tr !== undefined) {
        if (tr.tile > 0) {
          terms.push(`${translateText('Greenery tile')} +${tr.tile}`);
        }
        if (tr.parameter > 0 && r.parameter !== undefined) {
          terms.push(`${translateText(winnerParameterLabelKey(r.parameter))} +${tr.parameter}`);
        }
        if (tr.temperature > 0) {
          terms.push(`${translateText('Temperature')} +${tr.temperature}`);
        }
      }
      const breakdown = terms.length > 1 || (terms.length === 1 && tr?.tile !== undefined && tr.tile > 0) ?
        translateTextWithParams('TR: ${0}', [terms.join(' · ')]) : '';
      if (this.atMax && r.parameter === 'oxygen') {
        const max = translateText('Oxygen is at its maximum — no step');
        return breakdown === '' ? max : `${max} · ${breakdown}`;
      }
      return breakdown;
    },
  },
});
</script>
