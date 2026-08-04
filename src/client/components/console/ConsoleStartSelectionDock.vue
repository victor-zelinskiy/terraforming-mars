<template>
  <div v-if="piles.length > 0" class="con-startdock" aria-hidden="true">
    <!--
      THE SELECTION DOCK — the Game Start Workspace's preparation shelf: the
      decisions ALREADY MADE on earlier steps lie here as compact face-down
      piles (corporation / preludes / projects), physically collected on RT
      and physically returned to their grid slots on LT (startDockMotion).

      OWNERSHIP IS PHYSICAL: the backs render from `pile.backs`, which follows
      the FLYING CARDS (dockDrift) — a back appears only when its card lands,
      and disappears the moment its card departs. On the SUMMARY the cards
      themselves lie open in the tiles, so the piles are physically EMPTY and
      each slot collapses to the informational trace («КОРПОРАЦИЯ · 1») —
      never a duplicate card back under an open card.

      NOT the Hand Dock (real bought cards) and NOT the Played Tableau (real
      played cards): everything here is still reversible — a prepared stack
      on the table's edge, waiting for the summary to open it.
    -->
    <span class="con-startdock__title">{{ $t('Prepared') }}</span>
    <div v-for="pile in piles"
         :key="pile.id"
         class="con-startdock__pile"
         :class="{
           'con-startdock__pile--empty': pile.backs === 0,
           'con-startdock__pile--waiting': !pile.collected,
           'con-startdock__pile--trace': traceOnly(pile),
         }"
         :data-start-pile="pile.id">
      <!-- The stack CONTAINER always stands (it is the flights' measured
           destination — geometry must exist before any card flies); only the
           BACKS inside follow the physical cards. Trace mode empties and
           visually mutes it, never unmounts it. -->
      <div class="con-startdock__stack">
        <template v-if="pile.backs > 0">
          <div v-for="i in Math.min(3, pile.backs)"
               :key="i"
               class="con-startdock__back"
               :style="{transform: `translate(${(i - 1) * 2}px, ${(1 - i) * 2}px)`}">
            <div class="con-card-back con-card-back--flyer"></div>
          </div>
        </template>
        <div v-else-if="!pile.collected" class="con-startdock__back con-startdock__back--ghost">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
      <div class="con-startdock__meta">
        <span class="con-startdock__label">{{ $t(pile.label) }}</span>
        <b class="con-startdock__count" :key="pile.count">{{ pile.count }}</b>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

export type StartDockPile = {
  id: string,
  /** i18n key. */
  label: string,
  /** Informational count (the trace number). */
  count: number,
  /** Backs physically lying here right now. */
  backs: number,
  /** The step whose picks these are has been collected past. */
  collected?: boolean,
  /** A flight is landing here right now (a brief receiving accent). */
  hot?: boolean,
};

export default defineComponent({
  name: 'ConsoleStartSelectionDock',
  props: {
    piles: {type: Array as PropType<ReadonlyArray<StartDockPile>>, required: true},
  },
  methods: {
    /** The pile's cards are laid out elsewhere (the summary tiles) — only
     *  the informational label · count trace remains, no physical backs. */
    traceOnly(pile: StartDockPile): boolean {
      return pile.backs === 0 && pile.collected === true && pile.count > 0;
    },
  },
});
</script>
