<template>
  <!--
    THE VALUE OF A TRADE'S «КУДА» ROW — one reading for every stage a trade
    composes on (the colony focus stage, the fleet-dock stage): the resource,
    the card it goes to (or the honest «Выберите карту…» while none is chosen),
    the card's own `n → n + k`, and — on the focused, answered row — that the
    choice can be changed («Изменить», never «потерять»). A FRAGMENT: the row
    around it is the stage's own (its focus, its «missing» paint), so the DOM
    reads exactly as it did inside the colony stage.
  -->
  <i v-if="iconClass !== ''" class="con-colfocus__steprow-icon" :class="iconClass" aria-hidden="true"></i>
  <span v-if="card !== undefined">{{ $t(card) }}</span>
  <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose a card') }}…</span>
  <em v-if="card !== undefined">{{ impact }}</em>
  <!-- The answered pick stays re-enterable: A on this row re-opens the target
       step with the choice pre-locked (B there keeps it). -->
  <span v-if="card !== undefined && changeable" class="con-colfocus__steprow-change">{{ $t('Change selection') }}</span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'ConsoleTradeTargetValue',
  props: {
    /** The resource's sprite class ('' = none). */
    iconClass: {type: String, default: ''},
    /** The chosen card (an English card-name key), or undefined while none is chosen. */
    card: {type: String, default: undefined},
    /** The chosen card's own reading, «n → n + k». */
    impact: {type: String, default: ''},
    /** The row is focused and the choice can be re-opened. */
    changeable: {type: Boolean, default: false},
  },
});
</script>
