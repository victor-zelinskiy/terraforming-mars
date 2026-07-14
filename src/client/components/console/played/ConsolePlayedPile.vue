<template>
  <!--
    ONE physical peek pile: every card shows its title band (cost + tags +
    name), the newest card lies fully open at the bottom — the classic
    tabletop tableau column. Overlap is done by FIXED slot heights (px from
    the plan) with the card overflowing its slot and the NEXT slot painting
    above it (in-flow, position:relative + rising z-index), so:
     - the layout is static — focusing a card only toggles a class
       (transform/z-index, no reflow of neighbours);
     - keys are the card names (stable), a new card APPENDS.
  -->
  <div class="con-played__pile" :style="{width: slotW + 'px'}">
    <div v-for="(card, i) in cards"
         :key="card.name"
         class="con-played__slot"
         :class="{'con-played__slot--focused': card.name === focusKey}"
         :style="{height: (i === cards.length - 1 ? cardH : peekH) + 'px', zIndex: card.name === focusKey ? 90 : i + 1}"
         :data-played-key="card.name"
         :data-zoom-slot="card.name"
         @click="$emit('press', card.name)">
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

export default defineComponent({
  name: 'ConsolePlayedPile',
  components: {ConsolePlayedCardLite},
  props: {
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    focusKey: {type: String, required: true},
    /** Plan metrics (screen px / css zoom) — see consolePlayedModel. */
    zoom: {type: Number, required: true},
    slotW: {type: Number, required: true},
    cardH: {type: Number, required: true},
    peekH: {type: Number, required: true},
  },
  emits: {
    /** Mouse support: click focuses, a second click inspects (host decides). */
    press: (_name: string) => true,
  },
});
</script>
