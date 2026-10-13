<template>
  <!-- THE DECLINE PLATE — the refusal of an optional choice, standing in the surface's QUESTION LINE (the owner's
       decisions 2026-10-13). The decline is a BUTTON (RT — «finish this choice with nothing»), never a row among the
       answers and never B; this plate repeats that button where the eye already is, LOUDER than the command bar, and
       names what is forgone (the offer's own result, struck). Not a focus stop: nothing here takes the cursor. -->
  <div class="con-decline" data-decline-plate role="note" :aria-label="ariaLabel">
    <GamepadGlyph class="con-decline__glyph" control="triggerR" />
    <span class="con-decline__label">{{ labelText }}</span>
    <span v-if="forgone.length > 0" class="con-decline__forgone" data-decline-forgone>
      <span class="con-decline__sep" aria-hidden="true">·</span>
      <span class="con-decline__without">{{ $t('without') }}</span>
      <span v-for="(e, k) in forgone" :key="k" class="con-decline__chip">
        <ActionEffectChip :effect="e" />
      </span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {Message} from '@/common/logs/Message';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {translateMessage, translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleDeclinePlate',
  components: {GamepadGlyph, ActionEffectChip},
  props: {
    /** The refusal's words (`optionalChoice.DeclineModel.label`). */
    label: {type: [String, Object] as PropType<string | Message>, required: true},
    /** What the refusal forgoes (`DeclineModel.forgone`), drawn struck. */
    forgone: {type: Array as PropType<ReadonlyArray<ActionEffect>>, default: () => []},
  },
  computed: {
    labelText(): string {
      return typeof this.label === 'string' ? translateText(this.label) : translateMessage(this.label);
    },
    ariaLabel(): string {
      return this.labelText;
    },
  },
});
</script>
