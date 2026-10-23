<template>
  <!-- A DRAW READ AS CARDS (CH «ЖУРНАЛ — ХРОНИКА»): the cards a search threw away, the cards a draw kept — a fan of the
       real faces, never a sheet of names. At most `max` faces, the rest one «+N»; each face carries the name as its
       accessible label and the host's hook (`hook` — an attribute the specs read), never a native `title`. -->
  <span class="journal-fan" :class="'journal-fan--' + kind" :data-fan-kind="kind" :data-fan-count="cards.length">
    <span v-for="(name, i) in shown"
          :key="i"
          class="journal-fan__card"
          :aria-label="$t(name)"
          :data-card="name"
          v-bind="hookAttrs">
      <span class="journal-fan__face">
        <ConsoleCardFaceLite :name="name" :lightweight="true" artTier="thumb" />
      </span>
    </span>
    <span v-if="hidden > 0" class="journal-fan__more">+{{ hidden }}</span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'JournalCardFan',
  components: {ConsoleCardFaceLite},
  props: {
    cards: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
    /** `kept` — into the hand (lit), `discard` — thrown away (quiet). */
    kind: {type: String as PropType<'kept' | 'discard'>, default: 'kept'},
    max: {type: Number, default: 6},
    /** The data attribute each face carries for its host (e.g. `data-journal-search-discard`). */
    hook: {type: String, default: ''},
  },
  computed: {
    shown(): ReadonlyArray<CardName> {
      return this.cards.slice(0, this.max);
    },
    hidden(): number {
      return Math.max(0, this.cards.length - this.max);
    },
    hookAttrs(): Record<string, string> {
      return this.hook === '' ? {} : {[this.hook]: ''};
    },
  },
});
</script>
