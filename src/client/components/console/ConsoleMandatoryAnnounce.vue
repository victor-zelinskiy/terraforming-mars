<template>
  <!--
    MANDATORY ANNOUNCEMENT — the calm "you have a pending decision" card the
    console shows INSTEAD of popping the mandatory surface open. It names the
    decision (kind + concrete ask + who asks) and advertises the ONE affordance
    that opens it: B. Inert like the other banner-band surfaces (the pad drives
    it; a couch player can't hover/click) — the shell handles B in handleIntent.
    Driven by the mandatory-announcement gate (consoleMandatoryGate.ts).
  -->
  <div class="con-mandatory"
       :class="'con-mandatory--' + variant"
       role="status"
       :aria-label="kicker + ': ' + ask"
       data-test="con-mandatory-announce">
    <span class="con-mandatory__pulse" aria-hidden="true"></span>
    <span class="con-mandatory__glyph" aria-hidden="true">{{ glyph }}</span>
    <div class="con-mandatory__body">
      <div class="con-mandatory__kicker">{{ kicker }}</div>
      <div class="con-mandatory__ask">{{ ask }}</div>
      <div v-if="sourceCard !== undefined" class="con-mandatory__src">{{ $t(sourceCard) }}</div>
    </div>
    <span class="con-mandatory__open">
      <GamepadGlyph control="back" />
      <span v-i18n>{{ openLabel }}</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleMandatoryAnnounce',
  components: {GamepadGlyph},
  props: {
    /** 'action' = a decision to make (cyan) · 'reveal' = new cards to review (blue). */
    variant: {type: String as PropType<'action' | 'reveal'>, default: 'action'},
    /** The decision TYPE, pre-translated by the shell (consoleTaskSummary). */
    kicker: {type: String, required: true},
    /** The concrete ask, pre-translated by the shell. */
    ask: {type: String, required: true},
    /** WHO asks — a source card name (localised here), when the server named one. */
    sourceCard: {type: String as PropType<CardName>, default: undefined},
    /** The B-verb i18n key ('Open' / 'Review'). */
    openLabel: {type: String, default: 'Open'},
  },
  computed: {
    glyph(): string {
      return this.variant === 'reveal' ? '❖' : '⚑';
    },
  },
});
</script>
