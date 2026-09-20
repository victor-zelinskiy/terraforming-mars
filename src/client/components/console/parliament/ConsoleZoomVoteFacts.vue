<template>
  <!--
    THE VIEWER'S VOTE in the fullscreen inspector's footer (Turmoil Redux):
    what sending a delegate to the card on the stage would change — the
    leader and the winning state — in the vote panel's OWN fact rows
    (ConsoleVoteFactRow), never a sentence. The third fact of the panel, the
    party effect's edge, is the status chip's own projection («→ эффект ваш»)
    beside it, and the delegate's source and price ride the verb: nothing the
    footer says is said twice (registry R-10 — the same facts once stood as
    four sentences in the party column).

    Each row is ONE grid cell: the live row over the same row of every other
    card the viewer pages through (`reserve`) — the chip takes the widest
    REAL variant of this context, so a page turn never resizes it and never
    moves a control beside it (the footer's stability law).
  -->
  <span class="con-rvote" data-zoom-vote-facts :data-zoom-vote-rows="facts.length">
    <span v-for="i in rowCount" :key="i" class="con-rvote__cell">
      <template v-for="(entry, e) in entries" :key="e">
        <ConsoleVoteFactRow v-if="entry[i - 1] !== undefined"
                            class="con-rvote__row"
                            :class="{'con-rvote__sizer': e > 0}"
                            :fact="entry[i - 1]"
                            :cubePx="cubePx"
                            :aria-hidden="e > 0 ? 'true' : undefined"
                            :data-zoom-vote-fact="e === 0 ? entry[i - 1].id : undefined" />
      </template>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsoleVoteFactRow from '@/client/components/console/parliament/ConsoleVoteFactRow.vue';
import {VoteFactVm} from '@/client/console/parliament/voteInfoModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';

export default defineComponent({
  name: 'ConsoleZoomVoteFacts',
  components: {ConsoleVoteFactRow},
  props: {
    /** The live card's facts, in the panel's order (`footerFactsOf`). */
    facts: {type: Array as PropType<ReadonlyArray<VoteFactVm>>, required: true},
    /** The facts of every OTHER card the viewer pages through — laid out invisibly under the live rows. */
    reserve: {type: Array as PropType<ReadonlyArray<ReadonlyArray<VoteFactVm>>>, default: () => []},
  },
  computed: {
    entries(): ReadonlyArray<ReadonlyArray<VoteFactVm>> {
      return [this.facts, ...this.reserve];
    },
    rowCount(): number {
      return Math.max(0, ...this.entries.map((e) => e.length));
    },
    cubePx(): number {
      return Math.round(11 * conUiScale());
    },
  },
});
</script>
