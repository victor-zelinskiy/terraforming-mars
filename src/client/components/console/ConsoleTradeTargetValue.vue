<template>
  <i v-if="iconClass !== ''" class="con-colfocus__steprow-icon" :class="iconClass" aria-hidden="true"></i>
  <span v-if="card !== undefined">{{ $t(card) }}</span>
  <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose the receiving card') }}…</span>
  <em v-if="card !== undefined">{{ impact }}</em>
  <span v-if="card !== undefined && changeable" class="con-colfocus__steprow-change">{{ $t('Change selection') }}</span>
</template>

<script setup lang="ts">
/*
 * THE VALUE OF A TRADE'S «КУДА» ROW — one reading for every stage a trade
 * composes on (the colony focus stage, the fleet-dock stage): the resource,
 * the card it goes to (or the honest «Выберите карту…» while none is chosen),
 * the card's own `n → n + k`, and — on the focused, answered row — that the
 * choice can be changed («Изменить», never «потерять»). A FRAGMENT: the row
 * around it is the stage's own (its focus, its «missing» paint), so the DOM
 * reads exactly as it did inside the colony stage.
 *
 * (This comment opened the template; the template starts with its root now.)
 *
 * — before the root `<span v-else class="con-colfocus__steprow-empty">`:
 * A TARGET: the card the reward lands ON — never «choose yourself a card» (PL-056).
 *
 * — before the root `<span … class="con-colfocus__steprow-change">`:
 * The answered pick stays re-enterable: A on this row re-opens the target
 * step with the choice pre-locked (B there keeps it).
 *
 * (These comments stood between the template's roots; each names the root it stood before.)
 */
import {$t} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleTradeTargetValue'});
defineProps({
  /** The resource's sprite class ('' = none). */
  iconClass: {type: String, default: ''},
  /** The chosen card (an English card-name key), or undefined while none is chosen. */
  card: {type: String, default: undefined},
  /** The chosen card's own reading, «n → n + k». */
  impact: {type: String, default: ''},
  /** The row is focused and the choice can be re-opened. */
  changeable: {type: Boolean, default: false},
});
</script>
