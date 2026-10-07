<template>
  <!-- THE SEARCH'S OUTCOME in one line — «ВСКРЫТО 6 · ПОЛУЧЕНО 3 · СБРОШЕНО 3 —
       без меток [P̸][M̸][A̸]» (+ «колода вскрыта до конца» when it ran out).
       Numbers off the server's own lists, the rule off its own descriptor. -->
  <span v-if="tally !== undefined" class="con-dsearch-tally" data-reveal-search
        :data-search-revealed="tally.revealed" :data-search-taken="tally.taken"
        :data-search-discarded="tally.discarded" :data-search-exhausted="tally.exhausted ? 'yes' : 'no'">
    <template v-if="tally.discarded > 0">
      <span class="con-dsearch-tally__label">{{ $t('Turned over') }}</span>
      <b class="con-dsearch-tally__num">{{ tally.revealed }}</b>
      <span class="con-dsearch-tally__sep" aria-hidden="true">·</span>
    </template>
    <span class="con-dsearch-tally__label">{{ $t('Received') }}</span>
    <b class="con-dsearch-tally__num">{{ tally.taken }}</b>
    <template v-if="tally.discarded > 0">
      <span class="con-dsearch-tally__sep" aria-hidden="true">·</span>
      <span class="con-dsearch-tally__label">{{ $t('Thrown away') }}</span>
      <b class="con-dsearch-tally__num">{{ tally.discarded }}</b>
    </template>
    <span class="con-dsearch-tally__dash" aria-hidden="true">—</span>
    <ConsoleDrawSearchRule :search="reveal.search" />
    <template v-if="tally.exhausted">
      <span class="con-dsearch-tally__sep" aria-hidden="true">·</span>
      <span class="con-dsearch-tally__end" data-search-end>{{ $t('the whole deck was turned over') }}</span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardDrawRevealModel} from '@/common/models/CardDrawRevealModel';
import {DrawSearchTally, drawSearchTally} from '@/client/console/deckDraw/drawSearchReading';
import ConsoleDrawSearchRule from './ConsoleDrawSearchRule.vue';

/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SEARCH'S SUMMARY (TR32 — K-4): what a filtered draw turned over, kept
 * and threw away, and by which rule. Rendered by the drawn reveal in BOTH
 * hosts — the embedded stage's badge and the standalone head's subtitle — so
 * the two can never state two outcomes. Nothing for a plain draw.
 */
export default defineComponent({
  name: 'ConsoleDrawSearchTally',
  components: {ConsoleDrawSearchRule},
  props: {
    reveal: {type: Object as PropType<CardDrawRevealModel>, required: true},
  },
  computed: {
    tally(): DrawSearchTally | undefined {
      return drawSearchTally(this.reveal);
    },
  },
});
</script>
