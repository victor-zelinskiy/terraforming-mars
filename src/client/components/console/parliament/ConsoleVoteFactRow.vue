<template>
  <div class="con-parl__fact"
       :class="{
         'con-parl__fact--gain': fact.tone === 'gain',
         'con-parl__fact--dim': fact.tone === 'none',
         'con-parl__fact--tile': variant === 'tile',
       }"
       :data-parl-fact="fact.id"
       :data-parl-fact-tone="fact.tone">
    <span class="con-parl__fact-key">{{ $t(fact.label) }}</span>
    <!-- ── THE TILE: objects ── -->
    <span v-if="variant === 'tile' && drawn" class="con-parl__fact-val con-parl__fact-val--objects" aria-hidden="true">
      <template v-if="!fact.unchanged">
        <span class="con-parl__fact-obj" :class="'con-parl__fact-obj--' + fact.id">
          <template v-if="fact.id === 'lead'">
            <PlayerDelegate v-if="fact.before.cube !== undefined" :color="fact.before.cube" :steel="fact.before.cube === 'neutral'" :size="figurePx" :glow="false" />
            <i v-else class="con-parl__fact-socket" data-fact-socket></i>
          </template>
          <i v-else-if="fact.id === 'win'" class="con-parl__fact-crown" :class="{'con-parl__fact-crown--off': fact.before.key !== 'yes'}"></i>
          <span v-else-if="fact.id === 'access'" class="con-parl__fact-places">
            <i v-for="n in places.threshold" :key="n" class="con-parl__fact-place" :class="{'con-parl__fact-place--on': n <= places.before}"></i>
          </span>
        </span>
        <span class="con-parl__fact-arrow">→</span>
      </template>
      <span class="con-parl__fact-obj con-parl__fact-obj--after" :class="'con-parl__fact-obj--' + fact.id">
        <template v-if="fact.id === 'lead'">
          <PlayerDelegate v-if="fact.after.cube !== undefined" :color="fact.after.cube" :steel="fact.after.cube === 'neutral'" :size="figurePx" :glow="false" />
          <i v-else class="con-parl__fact-socket" data-fact-socket></i>
        </template>
        <i v-else-if="fact.id === 'win'" class="con-parl__fact-crown" :class="{'con-parl__fact-crown--off': fact.after.key !== 'yes'}"></i>
        <span v-else-if="fact.id === 'access'" class="con-parl__fact-places">
          <i v-for="n in places.threshold" :key="n" class="con-parl__fact-place" :class="{'con-parl__fact-place--on': n <= places.after}"></i>
        </span>
      </span>
    </span>
    <!-- The party effect crossed — its word on a line of its own under the places (a third object on the row ran the
         tile past its column at 1080). -->
    <b v-if="variant === 'tile' && fact.id === 'access' && places.after >= places.threshold" class="con-parl__fact-after con-parl__fact-yours" aria-hidden="true">{{ text(fact.after) }}</b>
    <!-- ── THE ROW (and a tile whose fact has no object of its own — the alliance): words ── -->
    <span :class="variant === 'tile' && drawn ? 'con-parl__fact-words' : 'con-parl__fact-val'">
      <template v-if="!fact.unchanged">
        <template v-if="fact.id === 'lead' && variant === 'row'">
          <PlayerDelegate v-if="fact.before.cube !== undefined && fact.before.cube !== 'neutral'" :color="fact.before.cube" :size="figurePx" :glow="false" />
          <PlayerDelegate v-else-if="fact.before.cube === 'neutral'" color="neutral" steel :size="figurePx" :glow="false" />
          <span v-else class="con-parl__fact-none">—</span>
        </template>
        <b v-else>{{ text(fact.before) }}</b>
        <span class="con-parl__fact-arrow" aria-hidden="true">→</span>
      </template>
      <template v-if="fact.after.cube !== undefined && variant === 'row'">
        <PlayerDelegate v-if="fact.after.cube !== 'neutral'" :color="fact.after.cube" :size="figurePx" :glow="false" />
        <PlayerDelegate v-else color="neutral" steel :size="figurePx" :glow="false" />
      </template>
      <b :class="{'con-parl__fact-after': !fact.unchanged}">{{ text(fact.after) }}</b>
    </span>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * ONE FACT OF A VOTE (Turmoil Redux) — the key, then the current value → the
 * projected one. A fact that does not change is ONE value: an arrow to the
 * same reading is noise on a decision line.
 *
 * Two variants of ONE markup:
 * · `row` — «ЛИДЕР [cube] → вы» on one line (the delegate mode's facts);
 * · `tile` — the vote panel's (P77 · DH «ФАКТЫ — ОБЪЕКТЫ»): the key as the
 *   tile's kicker and the value drawn as the Parliament's own OBJECTS — the
 *   leader's CUBE (an empty socket where nobody leads yet), the vote's CROWN
 *   (filled — this resolution leads the vote; a hollow ring — it does not),
 *   the party's two SOCKETS (n of the threshold filled; «эффект ваш» once
 *   crossed). The words stay in the tile for assistive tech and the
 *   inspector's sentences (`con-parl__fact-words`) — never painted twice.
 * Host attributes (`data-parl-vote-late`) fall through to the root.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import {FactValue, factValueText, VoteFactVm} from '@/client/console/parliament/voteInfoModel';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';

/** The facts a tile draws as an OBJECT; every other fact keeps its words. */
const OBJECT_FACTS: ReadonlySet<VoteFactVm['id']> = new Set(['lead', 'win', 'access']);

defineOptions({name: 'ConsoleVoteFactRow'});
const props = defineProps({
  fact: {type: Object as PropType<VoteFactVm>, required: true},
  /** The cube's size in device px (the host's profile scale). */
  figurePx: {type: Number, required: true},
  /** `row` — one line of words (the delegate mode); `tile` — the vote panel's object tile. */
  variant: {type: String as PropType<'row' | 'tile'>, default: 'row'},
});

/** The tile draws this fact as an object. */
const drawn = computed((): boolean => {
  return OBJECT_FACTS.has(props.fact.id);
});
/**
 * The party effect's places before and after, out of the threshold — read off the model's own params
 * («${0} of ${1}»); a side that is already «yours» is the whole threshold.
 */
const places = computed((): {before: number, after: number, threshold: number} => {
  const read = (value: FactValue): {n: number, of: number} | undefined =>
    value.params !== undefined && value.params.length === 2 ? {n: Number(value.params[0]), of: Number(value.params[1])} : undefined;
  const before = read(props.fact.before);
  const after = read(props.fact.after);
  const threshold = before?.of ?? after?.of ?? 2;
  return {before: before?.n ?? threshold, after: after?.n ?? threshold, threshold};
});
/** One side of the fact as words (a seat's NAME is a display string, never a key). */
function text(value: FactValue): string {
  return factValueText(value, (key, params) => params === undefined ? translateText(key) : translateTextWithParams(key, [...params]));
}
</script>
