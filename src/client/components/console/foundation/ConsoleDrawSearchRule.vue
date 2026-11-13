<template>
  <span class="con-dsearch" :class="'con-dsearch--' + size" :data-draw-search="signature">
    <span v-for="({term, labelled}, i) in items" :key="i" class="con-dsearch__term" :data-draw-search-term="term.kind">
      <span v-if="labelled" class="con-dsearch__label">{{ $t(labelOf(term)) }}</span>
      <span v-if="term.kind === 'with'" class="con-dsearch__tag" :data-tag="term.tag" :style="tagStyle(term.tag)" aria-hidden="true"></span>
      <span v-else-if="term.kind === 'resource'" class="con-dsearch__res" :style="resourceStyle(term.resource)" aria-hidden="true"></span>
      <span v-else-if="term.kind === 'floaterIcon'" class="con-dsearch__res" :style="resourceStyle(floater)" aria-hidden="true"></span>
      <PremiumPartyRequirementGlyph v-else-if="term.kind === 'partyRequirement'" class="con-dsearch__pprq" />
      <span v-else-if="term.kind === 'requirement'" class="con-dsearch__res con-dsearch__req" :style="{backgroundImage: `url(${requirementCard})`}" aria-hidden="true"></span>
      <span v-else-if="term.kind === 'noTags'" class="con-dsearch__tag" data-tag="none" :style="{backgroundImage: `url(${noTagsMark})`}" aria-hidden="true"></span>
      <template v-else-if="term.kind === 'without'">
        <span v-for="tag in term.tags" :key="tag" class="con-dsearch__tag con-dsearch__tag--struck" :data-tag="tag" :style="tagStyle(tag)" aria-hidden="true"></span>
      </template>
    </span>
  </span>
</template>

<script setup vapor lang="ts">
/*
 * THE SEARCH'S RULE as one inline phrase: each clause's word, then its
 * object as the tag's own medallion art — an excluded tag struck through
 * exactly as the card face prints it. Language-neutral where it can be
 * (the tag never needs a declension), worded where it must be.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {CardResource} from '@/common/CardResource';
import {DrawSearchModel} from '@/common/models/CardDrawRevealModel';
import {DrawSearchClause, DrawSearchTerm, drawSearchClauses, drawSearchTermLabel} from '@/client/console/deckDraw/drawSearchReading';
import {CARD_REQUIREMENT_ICON, NO_TAGS_ICON, cardResourceIconUrl, tagIconStyle} from '@/client/components/premiumCard/premiumCardIcons';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';

/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SEARCH'S RULE — ONE rendering of the server's search descriptor
 * (`DrawSearchModel` → `drawSearchTerms`), mounted by every surface that names
 * a filtered draw: the composer's draw chip, its «Далее» row, the reveal's
 * summary badge and the discard viewer's verdict. A second rendering is how
 * the chip and the tray would start describing two rules.
 *
 * Either the whole descriptor (`search`), SEVERAL descriptors in order
 * (`searches` — one batch's every rule, P56: «с меткой [J] · [V]»), or a ready
 * list of clauses (`terms` — the verdict of a card a positive filter refused)
 * is passed.
 */
defineOptions({name: 'ConsoleDrawSearchRule'});
const props = defineProps({
  search: {type: Object as PropType<DrawSearchModel>, default: undefined},
  /** Several rules of one batch, in segment order (`drawSearchRules`) — read as ONE phrase. */
  searches: {type: Array as PropType<ReadonlyArray<DrawSearchModel>>, default: undefined},
  clauses: {type: Array as PropType<ReadonlyArray<DrawSearchTerm>>, default: undefined},
  /** `chip` — inside an effect chip / a badge; `line` — a sentence-sized row. */
  size: {type: String as PropType<'chip' | 'line'>, default: 'chip'},
});

const floater = computed((): CardResource => {
  return CardResource.FLOATER;
});
/** «A card with a requirement» — the ONE mark the face, the TR68 chip and the quest footnote print (PL-1691). */
const requirementCard = CARD_REQUIREMENT_ICON;
/** «A card with no tags» — the crossed blank tag the face prints (`NO_TAGS`, the Sagitta corner mark). */
const noTagsMark = NO_TAGS_ICON;
const items = computed((): ReadonlyArray<DrawSearchClause> => {
  if (props.clauses !== undefined) {
    return props.clauses.map((term) => ({term, labelled: true}));
  }
  return drawSearchClauses(props.searches ?? (props.search === undefined ? [] : [props.search]));
});
const terms = computed((): ReadonlyArray<DrawSearchTerm> => {
  return items.value.map((item) => item.term);
});
/** A stable, language-free reading of the rule (`without:plant,microbe,animal`) — the e2e witness. */
const signature = computed((): string => {
  return terms.value.map((t) => {
    switch (t.kind) {
    case 'type': return `type:${t.type}`;
    case 'with': return `with:${t.tag}`;
    case 'resource': return `resource:${t.resource}`;
    case 'without': return `without:${t.tags.join(',')}`;
    case 'floaterIcon': return 'floaterIcon';
    case 'partyRequirement': return 'partyRequirement';
    case 'requirement': return 'requirement';
    case 'noTags': return 'noTags';
    }
  }).join(' ');
});
const labelOf = drawSearchTermLabel;
const tagStyle = tagIconStyle;
function resourceStyle(resource: CardResource): Record<string, string> {
  return {backgroundImage: `url(${cardResourceIconUrl(resource)})`};
}
</script>
