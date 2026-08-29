<template>
  <div v-if="decisions.length > 0" class="con-hydro__railstack">
    <ConsoleHydroPickRow v-for="d in ordered" :key="d.id"
                         :kind="d.kind"
                         :card="d.chosen"
                         :node="d.kind === 'reuse-action' ? repeatNode : undefined"
                         :animalCurrent="d.kind === 'animal-target' ? animalCurrent : undefined"
                         :focused="focusNode === 'rail:' + d.id"
                         :fizzled="d.state === 'unavailable'"
                         @open="$emit('open', d)" />
  </div>
</template>

<script lang="ts">
/**
 * THE DECISION RAIL — the step's pre-selects as a vertical stack of premium
 * decision cards, mounted at the TOP of the action column directly above the
 * final CTA. ONE component for every Hydronetwork entry mode (the player's
 * own plan, a card's offer, a nested card-actions step): the descriptors are
 * the whole input, so a future multi-reward movement grows the ARRAY and
 * changes nothing here.
 *
 * The rail renders in GAME RESOLUTION ORDER whatever order the array
 * arrives in — the screen's top-to-bottom and the ↑/↓ focus graph
 * (`railStep`) read the same sort, which is what makes the navigation
 * spatially self-evident.
 */
import {defineComponent, PropType} from 'vue';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import ConsoleHydroPickRow from '@/client/components/console/hydroFlow/ConsoleHydroPickRow.vue';
import {HydroRailDecision} from '@/client/console/hydroFlow/hydroDecisionRail';

type GroupNode = ActionGroup['nodes'][number];

export default defineComponent({
  name: 'ConsoleHydroDecisionRail',
  components: {ConsoleHydroPickRow},
  props: {
    decisions: {type: Array as PropType<ReadonlyArray<HydroRailDecision>>, required: true},
    /** The scene's current focus node (`rail:<id>` lights its card). */
    focusNode: {type: String, required: true},
    /** The chosen action's branch node (reuse-action summaries). */
    repeatNode: {type: Object as PropType<GroupNode>, default: undefined},
    /** The chosen target's live animal count (animal-target summaries). */
    animalCurrent: {type: Number, default: undefined},
  },
  emits: ['open'],
  computed: {
    ordered(): Array<HydroRailDecision> {
      return [...this.decisions].sort((a, b) => a.order - b.order);
    },
  },
});
</script>
