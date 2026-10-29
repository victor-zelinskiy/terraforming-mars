<template>
  <!-- «ПОЧЕМУ» OF A COUNTED PLAY (TR45, the owner's accent 2026-10-12: «how many microbes, and why, before the play»)
       — ONE strip, two hosts: the play composer's RESULT (under the chips — PL-156's block, its second reader) and the
       board peek's HUD (L3 «Показать на поле» — the same reading standing over the counted tiles). It begins with the
       card's own printed «per X» glyph (the SAME face item, `PremiumMechNode`), the count, «=», the census's shares by
       kind with their board pictograms and numbers, «→» the result; what stands on the board uncounted is NAMED at
       the strip's right edge; a zero is named. A single-term count (PL-196 — TR23's colonies, TR43's oceans) is the
       glyph and its number alone, no «=». A count of the player's own tags names its WILD share («в т.ч. [wild] 1» —
       the Scientists' extra wild tag under Redux), so the number adds up against the tags on the table. A SUMMED basis (P85 — «per planet tag AND per colony») is its terms in
       turn, each its glyphs (an OR of tags is a row of its tag icons) and its number, joined by «+». Every number is the server's basis (`countedPlay.countedWhyOf`). A
       share the peek is reading right now is `lit` (its cells pulse on the board in the same beat). -->
  <div class="con-cwhy" :class="{'con-cwhy--zero': why.zero}"
       data-count-why :data-count-why-total="why.terms.length > 0 ? undefined : why.term.count">
    <span class="con-cwhy__kicker">{{ kicker }}</span>
    <template v-if="why.terms.length > 0">
      <template v-for="(t, ti) in why.terms" :key="ti">
        <span v-if="ti > 0" class="con-cwhy__op" aria-hidden="true">+</span>
        <span class="con-cwhy__part" :data-count-term="t.term.label" :data-count-term-n="t.term.count">
          <span v-if="t.glyphs.length > 0" class="con-cwhy__glyph con-cwhy__glyph--row" data-count-glyph>
            <PremiumMechNode v-for="(g, gi) in t.glyphs" :key="gi" :node="g" />
          </span>
          <span v-else class="con-cwhy__label">{{ $t(t.term.label) }}</span>
          <b class="con-cwhy__num">{{ t.term.count }}</b>
          <span v-if="t.term.wild !== undefined" class="con-cwhy__wild" :data-count-wild="t.term.wild">
            {{ $t('incl.') }}<span class="con-cwhy__glyph con-cwhy__glyph--part"><PremiumMechNode :node="wildGlyph" /></span><b>{{ t.term.wild }}</b>
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
      <span v-if="why.term.wild !== undefined" class="con-cwhy__wild" :data-count-wild="why.term.wild">
        {{ $t('incl.') }}<span class="con-cwhy__glyph con-cwhy__glyph--part"><PremiumMechNode :node="wildGlyph" /></span><b>{{ why.term.wild }}</b>
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

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {CountedWhy, excludedTail, PART_LABEL, signedAmount, WILD_GLYPH} from '@/client/console/countedPlay';
import {ActionEffectBasisPartKind} from '@/common/models/ActionPreviewModel';
import {BoardPeekBeat} from '@/client/console/boardPeek';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleCountedWhy',
  components: {PremiumMechNode},
  props: {
    why: {type: Object as PropType<CountedWhy>, required: true},
    /** The share the board peek is reading right now (its cells pulse in the same beat), or 'excluded'. */
    lit: {type: String as PropType<BoardPeekBeat | undefined>, default: undefined},
  },
  data() {
    return {wildGlyph: WILD_GLYPH};
  },
  computed: {
    kicker(): string {
      return translateTextWithParams('Why ${0}', [String(this.why.chip.amount)]);
    },
    result(): string {
      return signedAmount(this.why.chip.amount);
    },
    resultIcon(): string {
      return iconClassFor(this.why.chip.icon);
    },
    excluded(): string | undefined {
      return excludedTail(this.why, {text: translateText, params: translateTextWithParams});
    },
  },
  methods: {
    /** A share's word for the screen reader — «4 города» (the pictogram carries it for the eye). */
    partLabel(kind: ActionEffectBasisPartKind, count: number): string {
      return translateTextWithParams(PART_LABEL[kind], [String(count)]);
    },
  },
});
</script>
