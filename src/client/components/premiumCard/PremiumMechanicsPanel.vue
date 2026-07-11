<template>
  <div class="pcard__mech">
    <template v-for="(group, gi) in mechanics.groups" :key="gi">
      <!-- the CHOICE divider: «— ИЛИ —» between alternative groups -->
      <div v-if="group.orJoin" class="pcard-mech-or">
        <span>{{ orLabel }}</span>
      </div>
      <!-- data-graphic-id / data-graphic-node: the SHARED content-derived
           addresses (cardGraphicIds.ts) — the fullscreen annotation layer
           anchors its rule blocks to the ROW and tethers its lines to the
           EXACT node inside it (undefined → attribute omitted, no anchor). -->
      <div class="pcard-mech-group"
           :class="['pcard-mech-group--' + group.kind, {'pcard-mech-group--after-or': group.orJoin}]"
           :data-graphic-id="group.graphicId">
        <PremiumMechNode v-for="(node, ni) in group.nodes"
                         :key="ni"
                         :node="node"
                         :data-graphic-node="nodeToken(node)" />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ItemType} from '@/common/cards/render/Types';
import {nodeGraphicToken} from '@/common/cards/render/cardGraphicIds';
import {MechanicsVM} from './mechanicsModel';
import {translateText} from '@/client/directives/i18n';
import PremiumMechNode from './PremiumMechNode.vue';

/**
 * The inset mechanics plate — one engraved row (group) per DSL root row.
 * Alternative groups (`orJoin`) are joined by the premium «ИЛИ» divider
 * instead of the plain hairline, so a choice can never read as "do both".
 */
export default defineComponent({
  name: 'PremiumMechanicsPanel',
  components: {PremiumMechNode},
  props: {
    mechanics: {
      type: Object as () => MechanicsVM,
      required: true,
    },
  },
  computed: {
    orLabel(): string {
      return translateText('OR');
    },
  },
  methods: {
    /** The node's exact-anchor address (shared derivation — see cardGraphicIds). */
    nodeToken(node: ItemType): string | undefined {
      return nodeGraphicToken(node);
    },
  },
});
</script>
