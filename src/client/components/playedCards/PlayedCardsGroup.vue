<template>
  <section class="played-group"
           :class="['played-group--' + group.accent, 'played-group--' + variant, {'played-group--identity': group.identity, 'played-group--columns': variant === 'project'}]">
    <header class="played-group__header">
      <span class="played-group__accent" aria-hidden="true"></span>
      <span class="played-group__label" v-i18n>{{ group.label }}</span>
      <span class="played-group__count">{{ group.cards.length }}</span>
      <span class="played-group__rule" aria-hidden="true"></span>
    </header>

    <!-- Identity (corp / preludes / CEO): a wrapping row of FULL cards.
         `lightweight` keeps them at the canonical fixed render. -->
    <div v-if="variant === 'identity'" class="played-group__idgrid">
      <PlayedCardItem
        v-for="card in group.cards"
        :key="card.name"
        :card="card"
        :player="player"
        :lightweight="true"
        @open="$emit('open', $event)" />
    </div>

    <!-- Main project section: vertical columns. Column count + balanced
         contiguous chunks (oldest-first) come from the overlay's fit plan;
         `peek` (band-level) decides whether non-bottom cards clip to the peek
         strip or every card shows full. -->
    <div v-else class="played-group__columns">
      <PlayedCardsStack
        v-for="(column, i) in columnSlices"
        :key="i"
        :cards="column"
        :peek="peek"
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
import {balancedChunks, ProjectSectionPlan} from '@/client/components/playedCards/playedTableauFit';
import PlayedCardItem from '@/client/components/playedCards/PlayedCardItem.vue';
import PlayedCardsStack from '@/client/components/playedCards/PlayedCardsStack.vue';

/**
 * One card group on the tableau board.
 *  - `identity` variant (corp / preludes / CEO): a compact wrapping row of
 *    full cards.
 *  - `project` variant (active / automated / events): vertical peek-stack
 *    columns laid out per the overlay's `plan` (column count + balanced
 *    chunks). Cards read top→bottom (oldest at the top, newest at the bottom
 *    shown full). A local fallback (a single column / even split) keeps the
 *    first paint sensible before the fit engine measures.
 */
export default defineComponent({
  name: 'PlayedCardsGroup',
  components: {PlayedCardItem, PlayedCardsStack},
  props: {
    group: {
      type: Object as PropType<PlayedGroup>,
      required: true,
    },
    // 'identity' = corp/preludes/ceo rail block (full-card row); 'project' = a
    // main-band section (vertical peek/full columns per `plan`).
    variant: {
      type: String as () => 'identity' | 'project',
      required: true,
    },
    // Project sections only — the overlay's column/chunk plan for this section.
    plan: {
      type: Object as PropType<ProjectSectionPlan | undefined>,
      default: undefined,
    },
    // Band-level peek flag (project sections): true → clip non-bottom cards to
    // the peek strip; false → every card shows full.
    peek: {
      type: Boolean,
      default: true,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
  },
  emits: ['open'],
  computed: {
    chunks(): ReadonlyArray<number> {
      if (this.plan !== undefined && this.plan.chunks.length > 0) {
        return this.plan.chunks;
      }
      // Pre-measure fallback: a few balanced columns so the first paint is sane.
      const cols = Math.min(3, Math.max(1, Math.ceil(this.group.cards.length / 8)));
      return balancedChunks(this.group.cards.length, cols);
    },
    // Split the (oldest-first) cards into the plan's contiguous chunks — one
    // chunk per peek-stack column.
    columnSlices(): ReadonlyArray<ReadonlyArray<CardModel>> {
      return this.sliceInto(this.chunks);
    },
  },
  methods: {
    sliceInto(chunks: ReadonlyArray<number>): ReadonlyArray<ReadonlyArray<CardModel>> {
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
