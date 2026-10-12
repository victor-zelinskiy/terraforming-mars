<template>
  <!-- «ПОЧЕМУ» OF A COUNTED PLAY (TR45, the owner's accent 2026-10-12: «how many microbes, and why, before the play»)
       — ONE strip, two hosts: the play composer's RESULT (under the chips — PL-156's block, its second reader) and the
       board peek's HUD (L3 «Показать на поле» — the same reading standing over the counted tiles). It begins with the
       card's own printed «per X» glyph (the SAME face item, `PremiumMechNode`), the count, «=», the census's shares by
       kind with their board pictograms and numbers, «→» the result; what stands on the board uncounted is NAMED at
       the strip's right edge; a zero is named. A single-term count (PL-196 — TR23's colonies, TR43's oceans) is the
       glyph and its number alone, no «=». Every number is the server's basis (`countedPlay.countedWhyOf`). A
       share the peek is reading right now is `lit` (its cells pulse on the board in the same beat). -->
  <div class="con-cwhy" :class="{'con-cwhy--zero': why.zero}"
       data-count-why :data-count-why-total="why.term.count">
    <span class="con-cwhy__kicker">{{ kicker }}</span>
    <span v-if="why.glyph !== undefined" class="con-cwhy__glyph" data-count-glyph><PremiumMechNode :node="why.glyph" /></span>
    <span v-else class="con-cwhy__label">{{ $t(why.term.label) }}</span>
    <b class="con-cwhy__num">{{ why.term.count }}</b>
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
import {CountedWhy, excludedTail, PART_LABEL, signedAmount} from '@/client/console/countedPlay';
import {ActionEffectBasisPartKind} from '@/common/models/ActionPreviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleCountedWhy',
  components: {PremiumMechNode},
  props: {
    why: {type: Object as PropType<CountedWhy>, required: true},
    /** The share the board peek is reading right now (its cells pulse in the same beat), or 'excluded'. */
    lit: {type: String as PropType<ActionEffectBasisPartKind | 'excluded' | undefined>, default: undefined},
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
