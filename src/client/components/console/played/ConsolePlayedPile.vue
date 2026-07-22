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
    two places at once while its proxy is airborne.
  -->
  <div class="con-played__pile" :style="{width: slotW + 'px'}">
    <div v-for="(card, i) in cards"
         :key="card.name"
         class="con-played__slot"
         :class="{'con-played__slot--incoming': card.name === hiddenKey, 'con-played__slot--held-out': outNames.has(card.name)}"
         :style="{height: (i === cards.length - 1 ? cardH : peekH) + 'px', zIndex: i + 1}"
         :data-played-key="card.name"
         :data-zoom-slot="card.name">
      <div class="con-played__lift">
        <div class="con-played__face con-played__focusbox" :style="{zoom: String(zoom)}">
          <ConsolePlayedCardLite :name="card.name" />
        </div>
        <!-- Live stored-resource counter (microbes / animals / floaters …) —
             a SLOT chip so a count change never patches the card face. -->
        <span v-if="(card.resources ?? 0) > 0" class="con-played__res" aria-hidden="true">{{ card.resources }}</span>
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
    /** Plan metrics (screen px / css zoom) — see consolePlayedModel. */
    zoom: {type: Number, required: true},
    slotW: {type: Number, required: true},
    cardH: {type: Number, required: true},
    peekH: {type: Number, required: true},
  },
});
</script>
