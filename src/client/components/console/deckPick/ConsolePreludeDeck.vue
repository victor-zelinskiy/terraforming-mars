<template>
  <!-- THE PRELUDE DECK — an OBJECT inside the mid-game prelude pick (P91 WG Project), never a HUD stack: the prelude
       deck has no place on the table outside this decision, so the decision stands it up where the player looks.
       Three stations, each a real flight end: the PILE the three cards are dealt off, the DISCARD the two the player
       did not play land on, and the «РАЗЫГРАНО» seat the played prelude lands on (it pays from there). Every count is
       the server's (`GameModel.preludeDeckSize` / `preludeDiscardSize`) as PRESENTED — the surface holds the numbers
       until the bodies have moved. A standing object: no glow, no loop (invariant 15). -->
  <div class="con-predeck" data-prelude-deck>
    <div class="con-predeck__station">
        <div class="con-predeck__pile" data-prelude-pile>
          <span v-for="i in pileLayers" :key="'p' + i" class="con-predeck__back" :style="{'--layer': i - 1}"></span>
        </div>
        <span class="con-predeck__cap">{{ $t('Preludes') }} · <b data-prelude-deck-count>{{ deckCount }}</b></span>
    </div>
    <!-- THE SEAT the played prelude lands on. `data-embed-source-slot` is the contract every play scene already reads
         for «where does the card that just landed pay from» (the hero's reward place, the source reserve of the
         row's fit) — this seat IS that place for a prelude played out of the pick. -->
    <div class="con-predeck__seatcol">
      <div class="con-predeck__seat" data-embed-source-slot data-prelude-played-seat
           :class="{'con-predeck__seat--empty': played === undefined}">
        <ConsolePlayedCardLite v-if="played !== undefined" :name="played" />
      </div>
      <span class="con-predeck__cap">{{ $t('Played') }}</span>
    </div>
    <div class="con-predeck__station">
      <div class="con-predeck__discard" data-prelude-discard :class="{'con-predeck__discard--empty': discardCount === 0}">
        <span v-if="discardCount > 0" class="con-predeck__back con-predeck__back--face"></span>
      </div>
      <span class="con-predeck__cap">{{ $t('Discard pile') }} · <b data-prelude-discard-count>{{ discardCount }}</b></span>
    </div>
  </div>
</template>

<script lang="ts">
/*
 * @console-shared LIVE — console native stands on this file.
 */
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';

export default defineComponent({
  name: 'ConsolePreludeDeck',
  components: {ConsolePlayedCardLite},
  props: {
    /** The pile as PRESENTED (the deal ticks it card by card). */
    deckCount: {type: Number, required: true},
    /** The discard pile as PRESENTED (ticks on each touchdown). */
    discardCount: {type: Number, required: true},
    /** The prelude standing on the «РАЗЫГРАНО» seat (its face shows once the hero hands it over). */
    played: {type: String as PropType<CardName | undefined>, default: undefined},
  },
  computed: {
    /** A few backs for a pile that still has cards — a stack reads as a stack; an empty pile is a socket. */
    pileLayers(): number {
      return Math.min(3, Math.max(0, this.deckCount));
    },
  },
});
</script>
