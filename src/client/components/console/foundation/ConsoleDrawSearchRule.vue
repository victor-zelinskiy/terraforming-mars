<template>
  <!-- THE SEARCH'S RULE as one inline phrase: each clause's word, then its
       object as the tag's own medallion art — an excluded tag struck through
       exactly as the card face prints it. Language-neutral where it can be
       (the tag never needs a declension), worded where it must be. -->
  <span class="con-dsearch" :class="'con-dsearch--' + size" :data-draw-search="signature">
    <span v-for="(term, i) in terms" :key="i" class="con-dsearch__term" :data-draw-search-term="term.kind">
      <span class="con-dsearch__label">{{ $t(labelOf(term)) }}</span>
      <span v-if="term.kind === 'with'" class="con-dsearch__tag" :data-tag="term.tag" :style="tagStyle(term.tag)" aria-hidden="true"></span>
      <span v-else-if="term.kind === 'resource'" class="con-dsearch__res" :style="resourceStyle(term.resource)" aria-hidden="true"></span>
      <template v-else-if="term.kind === 'without'">
        <span v-for="tag in term.tags" :key="tag" class="con-dsearch__tag con-dsearch__tag--struck" :data-tag="tag" :style="tagStyle(tag)" aria-hidden="true"></span>
      </template>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import {DrawSearchModel} from '@/common/models/CardDrawRevealModel';
import {DrawSearchTerm, drawSearchTermLabel, drawSearchTerms} from '@/client/console/deckDraw/drawSearchReading';
import {cardResourceIconUrl, tagIconStyle} from '@/client/components/premiumCard/premiumCardIcons';

/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SEARCH'S RULE — ONE rendering of the server's search descriptor
 * (`DrawSearchModel` → `drawSearchTerms`), mounted by every surface that names
 * a filtered draw: the composer's draw chip, its «Далее» row, the reveal's
 * summary badge and the discard viewer's verdict. A second rendering is how
 * the chip and the tray would start describing two rules.
 *
 * Either the whole descriptor (`search`) or a ready list of clauses (`terms` —
 * the verdict of a card a positive filter refused) is passed.
 */
export default defineComponent({
  name: 'ConsoleDrawSearchRule',
  props: {
    search: {type: Object as PropType<DrawSearchModel>, default: undefined},
    clauses: {type: Array as PropType<ReadonlyArray<DrawSearchTerm>>, default: undefined},
    /** `chip` — inside an effect chip / a badge; `line` — a sentence-sized row. */
    size: {type: String as PropType<'chip' | 'line'>, default: 'chip'},
  },
  computed: {
    terms(): ReadonlyArray<DrawSearchTerm> {
      return this.clauses ?? drawSearchTerms(this.search);
    },
    /** A stable, language-free reading of the rule (`without:plant,microbe,animal`) — the e2e witness. */
    signature(): string {
      return this.terms.map((t) => {
        switch (t.kind) {
        case 'type': return `type:${t.type}`;
        case 'with': return `with:${t.tag}`;
        case 'resource': return `resource:${t.resource}`;
        case 'without': return `without:${t.tags.join(',')}`;
        }
      }).join(' ');
    },
  },
  methods: {
    labelOf(term: DrawSearchTerm): string {
      return drawSearchTermLabel(term);
    },
    tagStyle(tag: Tag): Record<string, string> {
      return tagIconStyle(tag);
    },
    resourceStyle(resource: CardResource): Record<string, string> {
      return {backgroundImage: `url(${cardResourceIconUrl(resource)})`};
    },
  },
});
</script>
