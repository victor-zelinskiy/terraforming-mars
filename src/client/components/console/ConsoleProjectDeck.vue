<template>
  <span class="con-deckstack"
        :class="[`con-deckstack--${tier}`, {'con-deckstack--low': low, 'con-deckstack--empty': empty}]"
        role="img"
        :aria-label="ariaLabel">
    <!-- A compact PHYSICAL draw pile: real card-back top (the same
         assets/resources/card.webp every console card-back uses), stacked
         side layers for honest thickness, a contact shadow, and the
         remaining-card count. Read-only / non-focusable — informational
         today, the origin anchor for the future hero draw animation. -->
    <span class="con-deckstack__pile" aria-hidden="true">
      <span v-if="layers >= 3" class="con-deckstack__layer con-deckstack__layer--3"></span>
      <span v-if="layers >= 2" class="con-deckstack__layer con-deckstack__layer--2"></span>
      <span v-if="layers >= 1" class="con-deckstack__layer con-deckstack__layer--1"></span>
      <span class="con-deckstack__top"></span>
    </span>
    <!-- The count announces its change twice over, exactly like the global
         readouts beside it: the flip-swap of the digits (flipOnDecrease —
         a draw SHRINKS the pile, that IS the ordinary event) plus the
         shared premium delta chip anchored to this cell. -->
    <span class="con-deckstack__count">
      <ConsoleFlipValue :value="shownSize" :flip-on-decrease="true" />
      <AnimatedMetricValue
        :value="shownSize"
        metricKey="globals.project-deck"
        scopeKey="global"
        :epoch="epoch"
        variant="misc" />
    </span>
  </span>
</template>

<script lang="ts">
/**
 * ConsoleProjectDeck — the top-HUD project draw pile (ConsoleStatusStrip,
 * between the global parameters and the generation block).
 *
 * The count is the SERVER's draw-pile size (`GameModel.deckSize` =
 * `projectDeck.drawPile.length` — never the discard pile, never a client
 * derivation), so undo / reconnect / a discard-pile reshuffle all flow
 * through the ordinary playerView commit. `displayedDeckSize` routes the
 * value through the hold seam in consoleDeckDisplay.ts so a future hero
 * draw animation can keep the pre-draw number on screen until the flight
 * lands; today it is the identity.
 */
import {defineComponent} from 'vue';
import {deckStackTier, DeckStackTier, DECK_TIER_LAYERS, DECK_LOW_THRESHOLD, displayedDeckSize} from '@/client/console/consoleDeckDisplay';
import {translateText} from '@/client/directives/i18n';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';

export default defineComponent({
  name: 'ConsoleProjectDeck',
  components: {AnimatedMetricValue, ConsoleFlipValue},
  props: {
    /** GameModel.deckSize — the authoritative draw-pile size. */
    deckSize: {type: Number, required: true},
    /** playerView.runId — drives the delta-chip feedback ('' disables). */
    epoch: {type: String, default: ''},
  },
  computed: {
    shownSize(): number {
      return displayedDeckSize(this.deckSize);
    },
    tier(): DeckStackTier {
      return deckStackTier(this.shownSize);
    },
    layers(): number {
      return DECK_TIER_LAYERS[this.tier];
    },
    low(): boolean {
      return this.shownSize > 0 && this.shownSize <= DECK_LOW_THRESHOLD;
    },
    empty(): boolean {
      return this.shownSize <= 0;
    },
    ariaLabel(): string {
      return `${translateText('Project deck')}: ${this.shownSize}`;
    },
  },
});
</script>
