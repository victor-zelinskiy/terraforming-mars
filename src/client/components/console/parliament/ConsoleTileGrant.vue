<template>
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
       :data-grant-skipped="reading.skipped"
       :data-grant-placement="reading.grant.placement">
    <span v-if="variant !== 'inline'" class="con-tgrant__head">
      <!-- The star is the WINNER's mark — a grant to everyone has no winner's part, and no star. -->
      <i v-if="reading.grant.recipients.kind === 'threshold'" class="con-tgrant__star" aria-hidden="true"></i>
      <span class="con-tgrant__label">{{ label }}</span>
      <span v-if="caption !== ''" class="con-tgrant__caption" data-grant-caption>{{ caption }}</span>
    </span>
    <span class="con-tgrant__body">
      <i class="con-tgrant__tile con-tgrant__tile--city" aria-hidden="true"></i>
      <b class="con-tgrant__name">{{ $t(tileLabel) }}</b>
      <!-- WHERE it lands: the arrow onto the base city is the phrase; the words ride only where there is
           room for them (a block, a chip) — an inline row beside the card's own «STACK» graphic has said it. -->
      <span v-if="reading.grant.placement === 'own-city'" class="con-tgrant__where" data-grant-where>
        <span class="con-tgrant__arrow" aria-hidden="true">→</span>
        <i class="con-tgrant__tile con-tgrant__tile--base" aria-hidden="true"></i>
        <span v-if="variant !== 'inline'" class="con-tgrant__where-text">{{ $t(whereLabel) }}</span>
      </span>
      <span v-else-if="variant !== 'inline'" class="con-tgrant__where" data-grant-where>
        <span class="con-tgrant__where-text">{{ $t(whereLabel) }}</span>
      </span>
      <!-- THE STACK it became (a record), or THE DESTINATIONS it may still land on (the vote, the phase). -->
      <span v-if="reading.placed?.stackHeight !== undefined" class="con-tgrant__stack" data-grant-stack-line>
        <b>×{{ reading.placed.stackHeight }}</b>
      </span>
      <span v-else-if="detail !== ''" class="con-tgrant__cities" :class="{'con-tgrant__cities--none': nowhere}" data-grant-detail>{{ detail }}</span>
      <!-- INLINE (a host label's own row): the caption rides the same line. -->
      <span v-if="variant === 'inline' && withCaption && caption !== ''" class="con-tgrant__caption con-tgrant__caption--inline" data-grant-caption>{{ caption }}</span>
      <!-- THE RULING PARTY'S ANSWER (Р3): the law's own party rules when the tile lands, so its declared answer to a
           tile on Mars is the seat's too — «+1 [steel] +1 [card] · [emblem] «Марс вперёд»». A fact of the law of access,
           read off the party's declaration (`PartyTileAnswer`), never a promise about a cell. -->
      <span v-if="withAnswer && reading.answer !== undefined" class="con-tgrant__answer" data-grant-answer :data-grant-answer-party="reading.answer.party">
        <b class="con-tgrant__answer-amount">+{{ reading.answer.perTile.amount }}</b>
        <i class="con-tgrant__answer-unit" :class="answerUnitClass" aria-hidden="true"></i>
        <template v-if="reading.answer.cards > 0">
          <b class="con-tgrant__answer-amount">+{{ reading.answer.cards }}</b>
          <i class="con-tgrant__answer-unit" :class="answerCardClass" aria-hidden="true"></i>
        </template>
        <img class="con-tgrant__answer-emblem" :src="answerEmblem" alt="" />
        <span class="con-tgrant__answer-party">{{ $t(answerPartyKey) }}</span>
      </span>
    </span>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * A TILE A LAW GRANTS THE SEATS (Turmoil Redux — Skyscrapers' tier by
 * threshold, Mars First Budget's city for everyone): ONE graphic block for
 * the grant, wherever a surface names it — the vote surface's own-effect
 * block, the fullscreen inspector's footer, the sitting's band, the
 * playground. The twin of `ConsoleWinnerReward` for a part that is not
 * the winner's alone: the winner AND every seat at or above the influence
 * line receive it, so the head names both, and the CAPTION says which of
 * the two the viewer is («yours at influence 2 — win or not» / «only if you
 * win»), what is fixed while the phase resolves («you place it — influence
 * 2»), and the record once it is in («you placed it», or the named skip).
 *
 * THE BODY is the tile and where it lands — a TIER: the city tile, an arrow,
 * the city it stacks on, then the viewer's DESTINATIONS (their cities on
 * Mars, the server's count; a zero is the honest «nothing to build on») and,
 * once placed, the stack it became («×2»); a CITY BY THE USUAL RULES: the
 * tile alone and «any legal space» (the legal cells explain nothing — a
 * grant to everyone has no line either, the caption says «you place one»).
 * The cell's greeneries and bonus are never promised here: that is the
 * placement dossier's reading.
 *
 * Nothing here computes: the reading arrives from `tileGrantModel.ts`.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {
  TileGrantReading, tileGrantCaptionOf, tileGrantDetailOf, tileGrantLabelKey, tileGrantRecipientsKey, tileGrantWhereKey,
} from '@/client/console/parliament/tileGrantModel';
import {ReadingPerson} from '@/client/console/parliament/influenceYieldModel';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleTileGrant'});
const props = defineProps({
  reading: {type: Object as PropType<TileGrantReading>, required: true},
  /** `compact` in a footer / a vote block, `normal` in a panel, `hero` on a stage. */
  size: {type: String as PropType<'compact' | 'normal' | 'hero'>, default: 'normal'},
  /** WHOSE standing this is — the viewer's own, or another seat's (the caption follows). */
  person: {type: String as PropType<ReadingPerson>, default: 'you'},
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
  /**
   * Print the ruling party's ANSWER beside the tile (Р3). Off in a ONE-LINE rail (the sitting's band): the band
   * reads the seat's own reading, and the answer is the vote panel's, the inspector's and the results' to state.
   */
  withAnswer: {type: Boolean, default: true},
  /** Print the inline caption (a host whose own line already names the moment may leave it out). */
  withCaption: {type: Boolean, default: true},
});

/** The viewer receives it (by the rule) — or did. */
const yours = computed((): boolean => {
  const e = props.reading.eligibility;
  return props.reading.context !== 'reference' && props.reading.skipped === undefined && (e === 'winner' || e === 'influence' || e === 'everyone');
});
/** The rule passes the viewer over (below the line, not the winner). */
const passed = computed((): boolean => {
  return props.reading.context !== 'reference' && props.reading.eligibility === 'none';
});
/** Nothing to build on: the viewer has no city on Mars. */
const nowhere = computed((): boolean => {
  return props.reading.context !== 'applied' && props.reading.cities === 0;
});
const label = computed((): string => {
  const head = tileGrantRecipientsKey(props.reading.grant);
  return translateTextWithParams(head.key, [...head.params]);
});
const tileLabel = computed((): string => {
  return tileGrantLabelKey(props.reading.grant);
});
const whereLabel = computed((): string => {
  return tileGrantWhereKey(props.reading.grant);
});
const answerUnitClass = computed((): string => {
  const answer = props.reading.answer;
  return answer === undefined ? '' : iconClassFor(answer.perTile.resource);
});
const answerCardClass = computed((): string => {
  return iconClassFor('cards');
});
const answerEmblem = computed((): string => {
  const answer = props.reading.answer;
  return answer === undefined ? '' : partyEmblemUrl(answer.party);
});
const answerPartyKey = computed((): string => {
  const answer = props.reading.answer;
  return answer === undefined ? '' : partyNameKey(answer.party);
});
const caption = computed((): string => {
  const caption = props.reading.skipped !== undefined && props.reasonElsewhere ? {key: 'Skipped'} : tileGrantCaptionOf(props.reading, props.person);
  if (caption === undefined) {
    return '';
  }
  const text = caption.params === undefined ? translateText(caption.key) : translateTextWithParams(caption.key, [...caption.params]);
  return props.reading.generation === undefined ? text : `${translateTextWithParams('Generation ${0}', [String(props.reading.generation)])} · ${text}`;
});
const detail = computed((): string => {
  const detail = tileGrantDetailOf(props.reading, props.person);
  if (detail === undefined) {
    return '';
  }
  return detail.params === undefined ? translateText(detail.key) : translateTextWithParams(detail.key, [...detail.params]);
});
</script>
