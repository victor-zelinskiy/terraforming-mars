<template>
  <!--
    ONE physical peek pile: every card shows its title band (cost + tags +
    name), the newest card lies fully open at the bottom — the classic
    tabletop tableau column. Overlap is done by FIXED slot heights (px from
    the plan) with the card overflowing its slot and the NEXT slot painting
    above it (in-flow, position:relative + rising z-index).

    READ-ONLY by design: individual cards are NOT focusable (the tableau
    navigates by CATEGORY — the parent zone block owns focus + clicks). The
    slots keep their [data-played-key] identity — the hero landing, the
    reward-transfer sources and the category flights all measure them.

    `outNames` — cards currently LIFTED into the category view: their slots
    render held geometry (invisible, layout kept) so a card never exists in
    two places at once.

    `grounded` — cards whose category episode flies a BOUNDED proxy set:
    these dissolve IN PLACE (opacity transition on the lift) instead of
    flying, and fade back in place when the episode closes.

    `hydrated` — the staged-mount gate of the big-table open: slot GEOMETRY
    always renders (layout, captions and scroll size are exact from the
    plan), the faces inside mount when the overlay's hydration wave reaches
    this pile. Under the overlay's 180 ms entrance fade the wave is
    invisible; it exists so a 200-card open never runs one 300 ms+ flush.
  -->
  <div class="con-played__pile" :style="{width: slotW + 'px'}">
    <div v-for="(card, i) in cards"
         :key="card.name"
         class="con-played__slot"
         :class="{
           'con-played__slot--incoming': card.name === hiddenKey,
           'con-played__slot--held-out': outNames.has(card.name),
           'con-played__slot--grounded': grounded.has(card.name),
         }"
         :style="{height: (i === cards.length - 1 ? cardH : peekH) + 'px', zIndex: i + 1}"
         :data-played-key="card.name"
         :data-zoom-slot="card.name">
      <!-- No live overlays ride the table: stored card resources are read in
           the dedicated «Информация» screen (its «Доп. ресурсы» block) and on
           the card's own face in the fullscreen inspector. The tableau stays
           the printed table — cards, nothing pinned on top of them. -->
      <div class="con-played__lift">
        <div class="con-played__face con-played__focusbox" :style="{zoom: String(zoom)}">
          <!-- Pile faces are ≤ ~370 CSS px wide on every profile (zoom ≤0.58
               × uiScale ≤2) — always the thumb art tier. -->
          <ConsolePlayedCardLite v-if="hydrated" :name="card.name" :peek="coveredAt(i)" art-tier="thumb" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';

const EMPTY_SET: ReadonlySet<string> = new Set();

export default defineComponent({
  name: 'ConsolePlayedPile',
  components: {ConsolePlayedCardLite},
  props: {
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /** The hero scene's RESERVED slot: rendered with full layout but kept
     *  invisible until the landing commit (the arc flies into it). */
    hiddenKey: {type: String as PropType<string | undefined>, default: undefined},
    /** Cards lifted into the category view — their slots hold (see header). */
    outNames: {type: Object as PropType<ReadonlySet<string>>, default: () => EMPTY_SET},
    /** Cards dissolving in place for a bounded category episode (see header). */
    grounded: {type: Object as PropType<ReadonlySet<string>>, default: () => EMPTY_SET},
    /** The staged-mount gate — faces render only once the wave arrives. */
    hydrated: {type: Boolean, default: true},
    /** Plan metrics (screen px / css zoom) — see consolePlayedModel. */
    zoom: {type: Number, required: true},
    slotW: {type: Number, required: true},
    cardH: {type: Number, required: true},
    peekH: {type: Number, required: true},
  },
  methods: {
    /**
     * The card is COVERED by the pile (only its peek band can ever show) —
     * its face renders the cheap peek crop. Everything but the topmost card
     * is covered; the one exception is the hero scene's reserved LAST slot
     * (invisible until the commit), which leaves the previous top card fully
     * exposed for the whole flight. A slot lifted into the category view
     * still counts as covering: its card is only ever away TOGETHER with the
     * hold that keeps this pile's geometry, and keeping the modes stable is
     * what makes the close handoff pixel-true.
     */
    coveredAt(i: number): boolean {
      const last = this.cards.length - 1;
      if (i >= last) {
        return false;
      }
      return !(i === last - 1 && this.cards[last].name === this.hiddenKey);
    },
  },
});
</script>
