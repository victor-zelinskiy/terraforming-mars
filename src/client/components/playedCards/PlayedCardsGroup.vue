<template>
  <section class="played-group"
           :class="['played-group--' + group.accent, 'played-group--' + variant, layoutClass, {'played-group--identity': group.identity}]">
    <header class="played-group__header">
      <span class="played-group__accent" aria-hidden="true"></span>
      <span class="played-group__label" v-i18n>{{ group.label }}</span>
      <span class="played-group__count">{{ group.cards.length }}</span>
      <span class="played-group__rule" aria-hidden="true"></span>
    </header>

    <!-- Identity (corporation / preludes / CEO): compact wrapping row of full
         cards. `lightweight` keeps them at the canonical fixed render (no
         hover-expand jump / logo shift) — corps look exactly as they do in the
         hand / fullscreen, just scaled. -->
    <div v-if="variant === 'identity'" class="played-group__idgrid">
      <PlayedCardItem
        v-for="card in group.cards"
        :key="card.name"
        :card="card"
        :player="player"
        :lightweight="true"
        @open="$emit('open', $event)" />
    </div>

    <!-- Project section, FEW cards: roomy full-card wrapping grid. -->
    <div v-else-if="effectivePlan.layout === 'grid'" class="played-group__grid">
      <PlayedCardItem
        v-for="card in group.cards"
        :key="card.name"
        :card="card"
        :player="player"
        :lightweight="true"
        @open="$emit('open', $event)" />
    </div>

    <!-- Project section, MANY cards: vertical peek-stack columns. -->
    <div v-else class="played-group__columns">
      <PlayedCardsStack
        v-for="(column, i) in columnSlices"
        :key="i"
        :cards="column"
        :peek="effectivePlan.peek"
        :player="player"
        @open="$emit('open', $event)" />
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayedGroup} from '@/client/components/playedCards/playedCardGroups';
import {planTableauSection, TableauSectionPlan} from '@/client/components/playedCards/playedTableauFit';
import PlayedCardItem from '@/client/components/playedCards/PlayedCardItem.vue';
import PlayedCardsStack from '@/client/components/playedCards/PlayedCardsStack.vue';

/**
 * One card group on the tableau board.
 *  - `identity` variant (corp / preludes / CEO): a compact wrapping row of
 *    full cards.
 *  - `project` variant (active / automated / events): laid out per the
 *    overlay's `plan` — a full-card grid (few cards) or vertical peek-stack
 *    columns (many cards). The cards are split into the plan's balanced,
 *    contiguous chunks (oldest-first; each column reads top→bottom with the
 *    newest card at the bottom, shown full).
 *
 * A fallback plan is derived locally so the first paint (before the overlay's
 * fit engine measures) is already sensible.
 */
export default defineComponent({
  name: 'PlayedCardsGroup',
  components: {PlayedCardItem, PlayedCardsStack},
  props: {
    group: {
      type: Object as PropType<PlayedGroup>,
      required: true,
    },
    variant: {
      type: String as () => 'identity' | 'project',
      required: true,
    },
    // Project sections only — the overlay's column/grid plan for this section.
    plan: {
      type: Object as PropType<TableauSectionPlan | undefined>,
      default: undefined,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
  },
  emits: ['open'],
  computed: {
    // A layout modifier so the stylesheet can flex grid/identity sections
    // (shrink + wrap their cards) but keep peek-column sections rigid (wrap the
    // whole section to a new line rather than squashing the nowrap columns).
    layoutClass(): string {
      return this.variant === 'project' ? 'played-group--' + this.effectivePlan.layout : '';
    },
    effectivePlan(): TableauSectionPlan {
      if (this.plan !== undefined) {
        return this.plan;
      }
      // Pre-measure fallback: a generous reference width so the first paint
      // looks right; the overlay re-plans against the real width on mount.
      return planTableauSection({key: this.group.key, count: this.group.cards.length}, 1400, 300 * 0.6, 14);
    },
    // Split the (oldest-first) cards into the plan's contiguous balanced
    // chunks — one chunk per peek-stack column.
    columnSlices(): ReadonlyArray<ReadonlyArray<CardModel>> {
      const chunks = this.effectivePlan.chunks;
      if (chunks.length === 0) {
        return [this.group.cards];
      }
      const out: Array<ReadonlyArray<CardModel>> = [];
      let i = 0;
      for (const len of chunks) {
        out.push(this.group.cards.slice(i, i + len));
        i += len;
      }
      if (i < this.group.cards.length) {
        out.push(this.group.cards.slice(i));
      }
      return out;
    },
  },
});
</script>
