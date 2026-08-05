<template>
  <div class="con-jrail" :class="'con-jrail--' + mode" role="tablist" :aria-label="$t('Stages')">
    <!--
      THE WORKSPACE JOURNEY RAIL — the reusable stage line of a long
      multi-stage workspace process (the Game Start Workspace is its first
      host). Two modes, one geometry:

       - `tabs`     (a reversible PREPARATION): completed stages are
         revisitable, the current one is lit, future ones read available or
         locked — it answers «where am I and where may I go», while the
         workspace header answers «what context am I in» and the footer
         answers «what can I press»;
       - `progress` (an irreversible DEPLOYMENT): the same chips become a
         linear progress readout — no tab affordances, arrows join the
         stages, the current one carries the live accent.

      THE DIRECTIONAL PULSE (`pendingIndex` + `pulseKey`): while a stage
      change is physically running, the rail must NOT move its active marker
      — the stage has not changed yet, and a chip that lights up before its
      cards exist tells the same lie an early stage commit does. It shows
      DIRECTION instead: a short one-shot light sweep across the stage the
      player asked for, entering from the side the move is coming from. No
      label anywhere changes for the duration of a transition — a word that
      lives for 300 ms cannot be read, it can only flicker.

      Pure presentation: the HOST owns navigation (LT/RT) and states.
    -->
    <template v-for="(item, i) in items" :key="item.id + (i === pendingIndex ? '#' + pulseKey : '')">
      <span v-if="i > 0 && mode === 'progress'" class="con-jrail__arrow" aria-hidden="true">→</span>
      <span class="con-jrail__item"
            :class="{
              'con-jrail__item--current': item.state === 'current',
              'con-jrail__item--done': item.state === 'completed',
              'con-jrail__item--locked': item.state === 'locked',
              'con-jrail__item--anticipate': i === pendingIndex,
              'con-jrail__item--from-left': i === pendingIndex && pulseDir >= 0,
              'con-jrail__item--from-right': i === pendingIndex && pulseDir < 0,
            }"
            role="tab"
            :aria-selected="item.state === 'current' ? 'true' : 'false'">
        <span class="con-jrail__num">{{ markOf(item, i) }}</span>
        <span class="con-jrail__label">{{ $t(item.label) }}</span>
      </span>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

export type JourneyItemState = 'completed' | 'current' | 'available' | 'locked';

export type JourneyItem = {
  id: string,
  /** i18n key. */
  label: string,
  state: JourneyItemState,
};

export default defineComponent({
  name: 'ConsoleJourneyRail',
  props: {
    items: {type: Array as PropType<ReadonlyArray<JourneyItem>>, required: true},
    /** `tabs` — the reversible preparation; `progress` — linear deployment. */
    mode: {type: String as PropType<'tabs' | 'progress'>, default: 'tabs'},
    /** The stage the player has ASKED for while its cards are still moving —
     *  anticipation only, never a state change. `-1` = nothing pending. */
    pendingIndex: {type: Number, default: -1},
    /** Bumped per request; re-keys the chip so its one-shot sweep replays. */
    pulseKey: {type: Number, default: 0},
    /** Which way the move travels (drives the sweep's entry side). */
    pulseDir: {type: Number, default: 0},
  },
  methods: {
    markOf(item: JourneyItem, i: number): string {
      if (item.state === 'completed') {
        return '✓';
      }
      return this.mode === 'progress' ? '●' : String(i + 1).padStart(2, '0');
    },
  },
});
</script>
