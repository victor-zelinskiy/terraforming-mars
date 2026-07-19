<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <div class="hand-board-overlay hand-board-overlay--opponent" role="region" :aria-label="$t('Cards in hand')">
    <span class="hand-board-overlay__corner hand-board-overlay__corner--tl" aria-hidden="true"></span>
    <span class="hand-board-overlay__corner hand-board-overlay__corner--tr" aria-hidden="true"></span>
    <span class="hand-board-overlay__corner hand-board-overlay__corner--bl" aria-hidden="true"></span>
    <span class="hand-board-overlay__corner hand-board-overlay__corner--br" aria-hidden="true"></span>

    <header class="hand-board__header">
      <div class="hand-board__context">
        <span class="hand-board__glyph" aria-hidden="true"></span>
        <h2 class="hand-board__title" v-i18n>Cards in hand</h2>
        <span class="hand-board__player" :class="'player_translucent_bg_color_' + player.color">
          <span class="hand-board__player-dot" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
          {{ player.name }}
        </span>
        <span v-if="count > 0" class="hand-board__total">{{ count }}</span>
      </div>
      <button type="button" class="hand-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <div class="hand-board__body hand-board__body--opponent">
      <div v-if="count === 0" class="opp-hand opp-hand--empty">
        <span class="opp-hand__empty-glyph" aria-hidden="true"></span>
        <span class="opp-hand__empty-text" v-i18n>No cards in hand</span>
      </div>

      <div v-else class="opp-hand">
        <!-- Fan of face-down cards — "a hand held at the table". -->
        <div class="opp-hand__deck">
          <div
            v-for="i in fannedCount"
            :key="i"
            class="opp-hand__card card-back-tile"
            :style="cardStyle(i)"
            aria-hidden="true"></div>

          <!-- Prominent count badge pinned over the deck. -->
          <div class="opp-hand__badge" :class="'opp-hand__badge--' + player.color">
            <span class="opp-hand__badge-dot" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
            <span class="opp-hand__badge-num">{{ count }}</span>
            <span class="opp-hand__badge-label" v-i18n>in hand</span>
          </div>
        </div>

        <!-- "Hidden" hint — makes the inaccessibility explicit. -->
        <div class="opp-hand__hint">
          <span class="opp-hand__hint-lock" aria-hidden="true">🔒</span>
          <span class="opp-hand__hint-text" v-i18n>Cards are hidden — only the count is known</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

// How many face-down cards to render in the fan. The badge always shows
// the true count; the fan is a fixed-size "hand" silhouette so a 30-card
// hand doesn't fan off the screen.
const MAX_FAN = 7;

/**
 * Opponent-seat view of the cards overlay. The server never sends another
 * player's hand contents, so we can only show the COUNT — this presents it
 * as a fanned hand of face-down cards (the real card-back artwork) with a
 * prominent count badge, in the SAME glass/HUD frame + header as the
 * own-seat `HandCardsOverlay`, so it reads as "the same overlay, just
 * someone else's cards — hidden, count only".
 */
export default defineComponent({
  name: 'OpponentHandOverlay',
  props: {
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    count: {
      type: Number,
      required: true,
    },
  },
  emits: ['close'],
  computed: {
    fannedCount(): number {
      return Math.min(this.count, MAX_FAN);
    },
  },
  methods: {
    cardStyle(i: number): Record<string, string> {
      const n = this.fannedCount;
      const center = (n - 1) / 2;
      const offset = (i - 1) - center;
      const angle = offset * 7; // degrees — fans around a low pivot
      const x = offset * 18; // px — extra horizontal spread
      return {
        transform: `translateX(${x}px) rotate(${angle}deg)`,
        zIndex: String(10 + i),
        animationDelay: `${(i - 1) * 55}ms`,
      };
    },
  },
});
</script>
