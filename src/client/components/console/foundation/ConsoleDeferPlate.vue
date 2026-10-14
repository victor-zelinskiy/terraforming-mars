<template>
  <!-- THE DEFER PLATE — «decide after the draw» of a table question that may wait for a draw (the owner's decision
       2026-10-15, «Конференция на Олимпе» × «Марсианский университет»). The decline plate's twin, standing beside it in
       the album's QUESTION LINE: the button (R3) repeated where the eye already is, and WHY waiting is worth it — who
       draws first and how many (the chip). A cool accent where the decline is neutral: waiting is no refusal, the
       question will come back with the new card in the hand. Not a focus stop. -->
  <div class="con-defer" data-defer-plate role="note" :aria-label="ariaLabel">
    <GamepadGlyph class="con-defer__glyph" control="stickR" />
    <span class="con-defer__label">{{ labelText }}</span>
    <span v-if="drawerText !== ''" class="con-defer__why">
      <span class="con-defer__sep" aria-hidden="true">·</span>
      <span class="con-defer__drawers">{{ drawerText }}</span>
      <span v-if="drawnChip !== undefined" class="con-defer__chip"><ActionEffectChip :effect="drawnChip" /></span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {DeferPlateModel} from '@/client/console/tableQuestionRow';
import {translateCardName, translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleDeferPlate',
  components: {GamepadGlyph, ActionEffectChip},
  props: {
    /** The plate's model (`tableQuestionRow.deferPlateOf`). */
    defer: {type: Object as PropType<DeferPlateModel>, required: true},
  },
  computed: {
    labelText(): string {
      return translateText(this.defer.label);
    },
    /** Who draws first — the cards' own names, « · »-joined. */
    drawerText(): string {
      return this.defer.drawers.map((d) => translateCardName(d.card)).join(' · ');
    },
    /** The cards drawn first — «+N» when every drawer states its count (none when one does not: no invented number). */
    drawnChip(): ActionEffect | undefined {
      return this.defer.drawn !== undefined ? {direction: 'gain', icon: 'cards', amount: this.defer.drawn} : undefined;
    },
    ariaLabel(): string {
      return this.drawerText !== '' ? `${this.labelText} · ${this.drawerText}` : this.labelText;
    },
  },
});
</script>
