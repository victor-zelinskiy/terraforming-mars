<template>
  <!--
    Premium-first router for inputs hosted inside MandatoryInputModal during a
    card-play (or other mandatory) sub-prompt. For every input type that has a
    modern component it renders that; for the rest it falls back to the legacy
    PlayerInputFactory so a prompt is NEVER invisible (the inline factory lives
    inside the hidden .legacy-ui-overlay, so without this fallback a not-yet-
    migrated type would leave the player staring at a frozen board).

    The fallback passes showsave / showtitle = true so the legacy component
    behaves exactly as it did inline. Premium components render their own
    header + actions and ignore those props.

    Add a type → premium component mapping in PREMIUM_COMPONENTS as each modern
    input lands. See CLAUDE.md "UI Philosophy: dedicated buttons vs. mandatory-
    input modals".
  -->
  <component v-if="premiumComponent !== undefined"
             :is="premiumComponent"
             :playerView="playerView"
             :playerinput="playerinput"
             :onsave="onsave" />
  <player-input-factory v-else
             :playerView="playerView"
             :playerinput="playerinput"
             :onsave="onsave"
             :showsave="true"
             :showtitle="true" />
</template>

<script lang="ts">
import {Component, defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import PlayerInputFactory from '@/client/components/PlayerInputFactory.vue';
import ModernOptionPicker from '@/client/components/modalInputs/ModernOptionPicker.vue';
import ModernConfirm from '@/client/components/modalInputs/ModernConfirm.vue';
import ModernPlayerPicker from '@/client/components/modalInputs/ModernPlayerPicker.vue';
import ModernAmountSelector from '@/client/components/modalInputs/ModernAmountSelector.vue';
import ModernResourcePicker from '@/client/components/modalInputs/ModernResourcePicker.vue';
import ModernResourcesPicker from '@/client/components/modalInputs/ModernResourcesPicker.vue';
import ModernProductionToLose from '@/client/components/modalInputs/ModernProductionToLose.vue';

// Modern, premium-styled components for modal-hosted sub-prompts. Types absent
// here fall back to the legacy PlayerInputFactory (still visible, inside the
// modal). Extend this map as each premium input is built.
const PREMIUM_COMPONENTS: Partial<Record<PlayerInputModel['type'], Component>> = {
  'or': ModernOptionPicker,
  'option': ModernConfirm,
  'player': ModernPlayerPicker,
  'amount': ModernAmountSelector,
  'resource': ModernResourcePicker,
  'resources': ModernResourcesPicker,
  'productionToLose': ModernProductionToLose,
};

export default defineComponent({
  name: 'ModalInputHost',
  components: {
    PlayerInputFactory,
    ModernOptionPicker,
    ModernConfirm,
    ModernPlayerPicker,
    ModernAmountSelector,
    ModernResourcePicker,
    ModernResourcesPicker,
    ModernProductionToLose,
  },
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => PlayerInputModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: InputResponse) => void,
      required: true,
    },
  },
  computed: {
    premiumComponent(): Component | undefined {
      return PREMIUM_COMPONENTS[this.playerinput.type];
    },
  },
});
</script>
