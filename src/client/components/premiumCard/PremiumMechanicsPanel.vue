<template>
  <div class="pcard__mech">
    <div v-for="(group, gi) in mechanics.groups"
         :key="gi"
         class="pcard-mech-group"
         :class="'pcard-mech-group--' + group.kind">
      <PremiumMechNode v-for="(node, ni) in group.nodes" :key="ni" :node="node" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {MechanicsVM} from './mechanicsModel';
import PremiumMechNode from './PremiumMechNode.vue';

/** The inset mechanics plate — one engraved row (group) per DSL root row. */
export default defineComponent({
  name: 'PremiumMechanicsPanel',
  components: {PremiumMechNode},
  props: {
    mechanics: {
      type: Object as () => MechanicsVM,
      required: true,
    },
  },
});
</script>
