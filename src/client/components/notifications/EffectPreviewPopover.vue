<template>
  <Teleport to="body">
    <Transition name="effect-preview">
      <div v-if="visible && group !== undefined"
           class="effect-preview-popover"
           :style="style">
        <EffectBlock :group="group" />
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import EffectBlock from '@/client/components/effects/EffectBlock.vue';
import {playerEffectGroups, EffectGroup} from '@/client/components/effects/effectExtraction';

/**
 * A floating popover that renders the passive-effect BLOCK of one card — the
 * SAME graphic the «Эффекты» overlay shows (reuses `EffectBlock`). Shown on hover
 * of a «сработал эффект» notification's effect chip. Teleported + fixed-positioned
 * to the LEFT of the anchor (notifications live top-right), clamped to the viewport.
 */
export default defineComponent({
  name: 'EffectPreviewPopover',
  components: {EffectBlock},
  props: {
    name: {
      type: String as () => CardName | undefined,
      default: undefined,
    },
    anchor: {
      type: Object as PropType<DOMRect | undefined>,
      default: undefined,
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    group(): EffectGroup | undefined {
      if (this.name === undefined) {
        return undefined;
      }
      const card = {name: this.name} as CardModel;
      return playerEffectGroups([card])[0];
    },
    style(): Record<string, string> {
      const a = this.anchor;
      if (a === undefined) {
        return {};
      }
      const width = 320;
      // Prefer to the LEFT of the anchor; if no room, go right.
      let left = a.left - width - 12;
      if (left < 12) {
        left = Math.min(a.right + 12, window.innerWidth - width - 12);
      }
      const top = Math.min(Math.max(a.top - 6, 12), window.innerHeight - 80);
      return {left: `${left}px`, top: `${top}px`, width: `${width}px`};
    },
  },
});
</script>
