<template>
  <!--
    MANDATORY PROMPT CARD — the ONE calm "you have a pending decision" surface
    the console shows INSTEAD of popping the mandatory surface open. It serves
    BOTH states of the decision (unified — no legacy amber chip): a fresh,
    not-yet-opened decision (CTA «Открыть») and one the player opened then
    deferred (CTA «Вернуться к решению»). It names the decision (kind + concrete
    ask + who asks) and advertises the ONE affordance on A (free on the board
    home). Inert like the other banner-band surfaces (the pad drives it; a couch
    player can't hover/click) — the shell handles A in handleIntent. Driven by
    the mandatory-announcement gate (consoleMandatoryGate.ts).
  -->
  <div class="con-mandatory"
       role="status"
       :aria-label="kicker + ': ' + ask"
       data-test="con-mandatory-announce">
    <span class="con-mandatory__pulse" aria-hidden="true"></span>
    <span class="con-mandatory__glyph" aria-hidden="true">⚑</span>
    <div class="con-mandatory__body">
      <div class="con-mandatory__kicker">{{ kicker }}</div>
      <div class="con-mandatory__ask">{{ ask }}</div>
      <div v-if="sourceCard !== undefined" class="con-mandatory__src">{{ $t(sourceCard) }}</div>
    </div>
    <span class="con-mandatory__open">
      <GamepadGlyph control="confirm" />
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
    /** The decision TYPE, pre-translated by the shell (consoleTaskSummary). */
    kicker: {type: String, required: true},
    /** The concrete ask, pre-translated by the shell. */
    ask: {type: String, required: true},
    /** WHO asks — a source card name (localised here), when the server named one. */
    sourceCard: {type: String as PropType<CardName>, default: undefined},
    /** The A-verb i18n key — 'Open' (held) or the return key (deferred). */
    openLabel: {type: String, default: 'Open'},
  },
});
</script>
