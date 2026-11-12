<template>
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

<script setup lang="ts">
/*
 * THE TEMPLATE (the comment that opened it — it starts with its root now):
 *
 * A DRAW READ AS CARDS (CH «ЖУРНАЛ — ХРОНИКА»): the cards a search threw away, the cards a draw kept — a fan of the
 * real faces, never a sheet of names. At most `max` faces, the rest one «+N»; each face carries the name as its
 * accessible label and the host's hook (`hook` — an attribute the specs read), never a native `title`.
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

defineOptions({name: 'JournalCardFan'});
const props = defineProps({
  cards: {type: Array as PropType<ReadonlyArray<CardName>>, required: true},
  /** `kept` — into the hand (lit), `discard` — thrown away (quiet). */
  kind: {type: String as PropType<'kept' | 'discard'>, default: 'kept'},
  max: {type: Number, default: 6},
  /** The data attribute each face carries for its host (e.g. `data-journal-search-discard`). */
  hook: {type: String, default: ''},
});

const shown = computed((): ReadonlyArray<CardName> => props.cards.slice(0, props.max));
const hidden = computed((): number => Math.max(0, props.cards.length - props.max));
const hookAttrs = computed((): Record<string, string> => props.hook === '' ? {} : {[props.hook]: ''});
</script>
