<template>
  <div class="con-cwhy" :class="{'con-cwhy--zero': why.zero}"
       data-count-why :data-count-why-total="why.terms.length > 0 ? undefined : why.term.count">
    <span class="con-cwhy__kicker">{{ kicker }}</span>
    <!-- A DISCOUNTED PRICE (P89 · SP1a): the printed price first, «−» the counted term (below), «→» what is paid. -->
    <template v-if="why.printed !== undefined">
      <span class="con-cwhy__part" data-count-printed :data-count-printed-n="why.printed">
        <b class="con-cwhy__num">{{ why.printed }}</b>
        <span class="con-cwhy__ico" :class="resultIcon" aria-hidden="true"></span>
      </span>
      <span class="con-cwhy__op" aria-hidden="true">−</span>
    </template>
    <!-- A SET count (P69 — «per pair of Earth and Venus tags»): every side its printed tag and its OWN number, what it
         includes named on it (the wild tags the card dealt there, the card's own tag), then «→ N пар» — the number of
         complete sets, the server's. Never a sum, never one number for a row of tags. -->
    <template v-if="why.sides.length > 0">
      <template v-for="(s, si) in why.sides" :key="s.tag">
        <span v-if="si > 0" class="con-cwhy__op" aria-hidden="true">·</span>
        <span class="con-cwhy__part" :data-count-set-side="s.tag" :data-count-set-side-n="s.count">
          <span class="con-cwhy__glyph" data-count-glyph><PremiumMechNode :node="s.glyph" /></span>
          <b class="con-cwhy__num">{{ s.count }}</b>
          <span v-if="s.wild !== undefined || s.self !== undefined" class="con-cwhy__wild">
            {{ $t('incl.') }}<template v-if="s.wild !== undefined"><span class="con-cwhy__glyph con-cwhy__glyph--part" :data-count-wild="s.wild"><PremiumMechNode :node="wildGlyph" /></span><b>{{ s.wild }}</b></template>
            <span v-if="s.wild !== undefined && s.self !== undefined" class="con-cwhy__op" aria-hidden="true">·</span>
            <span v-if="s.self !== undefined" :data-count-self="s.self">{{ $t('this card') }} <b>{{ s.self }}</b></span>
          </span>
        </span>
      </template>
      <template v-if="!why.zero">
        <span class="con-cwhy__arrow" aria-hidden="true">→</span>
        <span class="con-cwhy__label" data-count-sets :data-count-sets-n="why.term.count">{{ sets }}</span>
      </template>
    </template>
    <!-- A PARLIAMENT count (TRP0 — «per resolution you have at least 2 delegates on»): every resolution of the voting
         area in its order, its party's emblem and «own / all» delegates; one short of the threshold stays NAMED, receded
         and marked «не считается» for the eye and the reader — so the number adds up against the Parliament. -->
    <template v-else-if="why.resolutions.length > 0">
      <template v-for="(r, ri) in why.resolutions" :key="r.resolution">
        <span v-if="ri > 0" class="con-cwhy__op" aria-hidden="true">·</span>
        <span class="con-cwhy__part con-cwhy__res" :class="{'con-cwhy__res--out': !r.counted}"
              :data-count-resolution="r.party" :data-count-resolution-own="r.own" :data-count-resolution-counted="r.counted ? 'yes' : 'no'"
              :aria-label="resolutionLabel(r)">
          <img class="con-cwhy__emblem" :src="r.emblem" alt="" aria-hidden="true">
          <b class="con-cwhy__num">{{ r.own }}</b><span class="con-cwhy__of">/{{ r.total }}</span>
        </span>
      </template>
    </template>
    <template v-else-if="why.terms.length > 0">
      <template v-for="(t, ti) in why.terms" :key="ti">
        <span v-if="ti > 0" class="con-cwhy__op" aria-hidden="true">+</span>
        <span class="con-cwhy__part" :data-count-term="t.term.label" :data-count-term-n="t.term.count">
          <span v-if="t.glyphs.length > 0" class="con-cwhy__glyph con-cwhy__glyph--row" data-count-glyph>
            <PremiumMechNode v-for="(g, gi) in t.glyphs" :key="gi" :node="g" />
          </span>
          <span v-else class="con-cwhy__label">{{ $t(t.term.label) }}</span>
          <b class="con-cwhy__num">{{ t.term.count }}</b>
          <span v-if="t.term.wild !== undefined || t.term.self !== undefined" class="con-cwhy__wild">
            {{ $t('incl.') }}<template v-if="t.term.wild !== undefined"><span class="con-cwhy__glyph con-cwhy__glyph--part" :data-count-wild="t.term.wild"><PremiumMechNode :node="wildGlyph" /></span><b>{{ t.term.wild }}</b></template>
            <span v-if="t.term.wild !== undefined && t.term.self !== undefined" class="con-cwhy__op" aria-hidden="true">·</span>
            <span v-if="t.term.self !== undefined" :data-count-self="t.term.self">{{ $t('this card') }} <b>{{ t.term.self }}</b></span>
          </span>
        </span>
      </template>
    </template>
    <template v-else>
      <span v-if="why.glyphs.length > 0" class="con-cwhy__glyph" :class="{'con-cwhy__glyph--row': why.glyphs.length > 1}" data-count-glyph>
        <PremiumMechNode v-for="(g, gi) in why.glyphs" :key="gi" :node="g" />
      </span>
      <span v-else class="con-cwhy__label">{{ $t(why.term.label) }}</span>
      <b class="con-cwhy__num">{{ why.term.count }}</b>
      <span v-if="why.term.wild !== undefined || why.term.self !== undefined" class="con-cwhy__wild">
        {{ $t('incl.') }}<template v-if="why.term.wild !== undefined"><span class="con-cwhy__glyph con-cwhy__glyph--part" :data-count-wild="why.term.wild"><PremiumMechNode :node="wildGlyph" /></span><b>{{ why.term.wild }}</b></template>
        <span v-if="why.term.wild !== undefined && why.term.self !== undefined" class="con-cwhy__op" aria-hidden="true">·</span>
        <span v-if="why.term.self !== undefined" :data-count-self="why.term.self">{{ $t('this card') }} <b>{{ why.term.self }}</b></span>
      </span>
    </template>
    <template v-if="why.composed && !why.zero">
      <span class="con-cwhy__op" aria-hidden="true">=</span>
      <template v-for="(part, pi) in why.parts" :key="part.kind">
        <span v-if="pi > 0" class="con-cwhy__op" aria-hidden="true">+</span>
        <span class="con-cwhy__part" :class="{'con-cwhy__part--lit': lit === part.kind, 'con-cwhy__part--dim': lit !== undefined && lit !== part.kind}"
              :data-count-part="part.kind" :data-count-part-n="part.count" :aria-label="partLabel(part.kind, part.count)">
          <span v-if="part.glyph !== undefined" class="con-cwhy__glyph con-cwhy__glyph--part"><PremiumMechNode :node="part.glyph" /></span>
          <b class="con-cwhy__num">{{ part.count }}</b>
        </span>
      </template>
    </template>
    <span v-else-if="why.composed" class="con-cwhy__zero">{{ $t('No tiles on Mars yet') }}</span>
    <!-- A single term's zero in the server's words (T12 — «Рядом с вашими тайлами нет пустых клеток»), never a bare «0 → 0». -->
    <span v-else-if="why.zero && why.zeroLabel !== undefined" class="con-cwhy__zero" data-count-zero>{{ $t(why.zeroLabel) }}</span>
    <span class="con-cwhy__arrow" aria-hidden="true">→</span>
    <span class="con-cwhy__result" data-count-result>
      <b class="con-cwhy__num">{{ result }}</b>
      <span class="con-cwhy__ico" :class="resultIcon" aria-hidden="true"></span>
    </span>
    <span v-if="excluded !== undefined" class="con-cwhy__excluded" :class="{'con-cwhy__excluded--lit': lit === 'excluded'}" data-count-excluded>{{ excluded }}</span>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * «РАСЧЁТ» OF A COUNTED PLAY (TR45, the owner's accent 2026-10-12: «how many microbes, and why, before the play»;
 * named «Почему N» until 2026-10-30 — the owner: the number repeated the result, the word read oddly)
 * — ONE strip, two hosts: the play composer's RESULT (under the chips — PL-156's block, its second reader) and the
 * board peek's HUD (L3 «Показать на поле» — the same reading standing over the counted tiles). It begins with the
 * card's own printed «per X» glyph (the SAME face item, `PremiumMechNode`), the count, «=», the census's shares by
 * kind with their board pictograms and numbers, «→» the result; what stands on the board uncounted is NAMED at
 * the strip's right edge; a zero is named. A single-term count (PL-196 — TR23's colonies, TR43's oceans) is the
 * glyph and its number alone, no «=». A count of the player's own tags names its WILD share («в т.ч. [wild] 1» —
 * the Scientists' extra wild tag under Redux) and the played card's OWN tag («в т.ч. эта карта 1» — P81, the word a set side
 * already speaks), so the number adds up against the tags on the table. A SUMMED basis (P85 — «per planet tag AND per colony») is its terms in
 * turn, each its glyphs (an OR of tags is a row of its tag icons) and its number, joined by «+». Every number is the server's basis (`countedPlay.countedWhyOf`). A
 * share the peek is reading right now is `lit` (its cells pulse on the board in the same beat).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {CountedResolution, CountedWhy, excludedTail, PART_LABEL, setsReading, signedAmount, WILD_GLYPH} from '@/client/console/countedPlay';
import {ActionEffectBasisPartKind} from '@/common/models/ActionPreviewModel';
import {BoardPeekBeat} from '@/client/console/boardPeek';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {partyNameKey} from '@/client/console/parliament/partyNames';

defineOptions({name: 'ConsoleCountedWhy'});
const props = defineProps({
  why: {type: Object as PropType<CountedWhy>, required: true},
  /** The share the board peek is reading right now (its cells pulse in the same beat), or 'excluded'. */
  lit: {type: String as PropType<BoardPeekBeat | undefined>, default: undefined},
});

const wildGlyph = WILD_GLYPH;
/**
 * «РАСЧЁТ» — the strip's NAME, never a number (the owner, 2026-10-30: «ПОЧЕМУ 5 · [аэростат] 5 → +5» printed the
 * result twice, and «почему» read oddly in Russian). The result stands at the strip's end, and once.
 */
const kicker = computed((): string => {
  return translateText('Calculation');
});
const result = computed((): string => {
  // A price reads what is PAID, unsigned (the discount's own reading); a counted gain its signed amount.
  return props.why.printed !== undefined ? String(props.why.chip.amount) : signedAmount(props.why.chip.amount);
});
const resultIcon = computed((): string => {
  return iconClassFor(props.why.chip.icon);
});
/** «2 пары» — the number of complete sets of a SET count (P69), the server's. */
const sets = computed((): string => {
  return setsReading(props.why.term.count, {text: translateText, params: translateTextWithParams});
});
const excluded = computed((): string | undefined => {
  return excludedTail(props.why, {text: translateText, params: translateTextWithParams});
});
/** A share's word for the screen reader — «4 города» (the pictogram carries it for the eye). */
function partLabel(kind: ActionEffectBasisPartKind, count: number): string {
  return translateTextWithParams(PART_LABEL[kind], [String(count)]);
}
/** A resolution's words for the screen reader — «Наука: ваших делегатов 2 из 3» (+ «не считается»). */
function resolutionLabel(r: CountedResolution): string {
  const head = translateTextWithParams('${0}: your delegates ${1} of ${2}', [translateText(partyNameKey(r.party)), String(r.own), String(r.total)]);
  return r.counted ? head : `${head} · ${translateText('not counted')}`;
}
</script>
