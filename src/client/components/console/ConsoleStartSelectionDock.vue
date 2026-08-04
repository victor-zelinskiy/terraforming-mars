<template>
  <div v-if="piles.length > 0" class="con-startdock" aria-hidden="true">
    <!--
      THE SELECTION DOCK — the Game Start Workspace's preparation shelf: the
      decisions ALREADY MADE on earlier steps lie here as compact face-down
      piles (corporation / preludes / projects), physically collected on RT
      and physically returned to their grid slots on LT (startDockMotion).

      EVERY step's pile is PRE-MOUNTED from the first frame: a pile is a
      physical destination, and a flight cannot target an element that mounts
      only after the flight. An un-collected pile is an empty waiting slot
      (ghost back, count 0) — the shelf itself never pops into existence.

      NOT the Hand Dock (real bought cards) and NOT the Played Tableau (real
      played cards): everything here is still reversible — a prepared stack
      on the table's edge, waiting for the summary to open it.
    -->
    <span class="con-startdock__title">{{ $t('Prepared') }}</span>
    <div v-for="pile in piles"
         :key="pile.id"
         class="con-startdock__pile"
         :class="{'con-startdock__pile--empty': pile.count === 0, 'con-startdock__pile--waiting': !pile.collected}"
         :data-start-pile="pile.id">
      <div class="con-startdock__stack">
        <div v-for="i in Math.min(3, Math.max(1, pile.count))"
             :key="i"
             class="con-startdock__back"
             :class="{'con-startdock__back--ghost': pile.count === 0}"
             :style="{transform: `translate(${(i - 1) * 2}px, ${(1 - i) * 2}px)`}">
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
  count: number,
  /** The step whose picks these are has been collected past (styles the
   *  un-collected piles as waiting shelf slots). */
  collected?: boolean,
  /** A flight is landing here right now (a brief receiving accent). */
  hot?: boolean,
};

export default defineComponent({
  name: 'ConsoleStartSelectionDock',
  props: {
    piles: {type: Array as PropType<ReadonlyArray<StartDockPile>>, required: true},
  },
});
</script>
