<template>
  <div class="draw-reveal__content" :style="{'--draw-card-zoom': zoom}">
    <!-- Context subtitle: source-attributed where the server knew it. -->
    <div class="draw-reveal__subtitle">
      <span class="draw-reveal__subtitle-dot" aria-hidden="true"></span>
      <span class="draw-reveal__subtitle-text">{{ subtitle }}</span>
    </div>

    <!--
      Card tray. transition-group: `appear` deals the first batch in with a
      stagger; `enter` deals subsequent batches (when the modal advances to the
      next queued event); `leave` is the collect/fly-out played when a card is
      taken. Single click on a card opens fullscreen (where the per-card ВЗЯТЬ
      lives); the grid itself has no per-card buttons.
    -->
    <div class="draw-reveal__tray">
      <transition-group appear name="draw-card-deal" tag="div" class="draw-reveal__cards">
        <div v-for="e in untakenEntries"
             :key="event.id + ':' + e.index"
             class="draw-reveal__slot"
             tabindex="0"
             role="button"
             :aria-label="cardLabel(e.card)"
             @click.capture.stop="$emit('open', e.index)"
             @keydown.enter.prevent="$emit('open', e.index)"
             @keydown.space.prevent="$emit('open', e.index)">
          <Card :card="e.card" />
          <span class="draw-reveal__slot-hint" v-i18n>Tap to view</span>
        </div>
      </transition-group>
    </div>

    <!-- Footer: status + single primary action (ВЗЯТЬ / ВЗЯТЬ ВСЁ). -->
    <div class="draw-reveal__footer">
      <span class="draw-reveal__status">
        <span v-i18n>Received</span>: {{ event.cards.length }}
      </span>
      <button v-if="untakenCount > 0"
              type="button"
              class="draw-reveal__take-all"
              @click="$emit('take-all')">
        <span class="draw-reveal__take-all-glow" aria-hidden="true"></span>
        <span class="draw-reveal__take-all-label" v-i18n>{{ primaryLabel }}</span>
        <span v-if="untakenCount > 1" class="draw-reveal__take-all-count">{{ untakenCount }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {translateText} from '@/client/directives/i18n';

/**
 * The card tray for ONE reveal batch. Renders only the cards still awaiting a
 * take (taken cards leave via the collect animation). No per-card buttons —
 * the single primary action takes every remaining card at once; individual
 * takes happen in the fullscreen viewer (DrawCardRevealFlow hosts it).
 */
export default defineComponent({
  name: 'DrawCardRevealContent',
  components: {Card},
  props: {
    event: {
      type: Object as PropType<DrawnCardEntry>,
      required: true,
    },
  },
  emits: ['open', 'take-all'],
  computed: {
    untakenEntries(): Array<{card: CardModel, index: number}> {
      const out: Array<{card: CardModel, index: number}> = [];
      this.event.cards.forEach((card, index) => {
        if (!this.event.takenIndices.has(index)) {
          out.push({card, index});
        }
      });
      return out;
    },
    untakenCount(): number {
      return this.untakenEntries.length;
    },
    primaryLabel(): string {
      // Single remaining card → "Take card"; more → "Take all cards".
      return this.untakenCount <= 1 ? 'Take card' : 'Take all cards';
    },
    subtitle(): string {
      const source = this.event.source;
      const n = this.event.cards.length;
      if (source?.type === 'card') {
        return `${translateText('Card effect')}: ${translateText(source.cardName)}`;
      }
      if (source?.type === 'tile') {
        return translateText('Tile bonus: card');
      }
      // Generic — "You received N card(s)".
      return translateText('You received ${0} card(s)').replace('${0}', String(n));
    },
    // Roomy for the common 1–3 cards; compacts as the batch grows so a large
    // (rare) draw still fits without turning into the hand overlay.
    zoom(): number {
      const n = this.untakenCount;
      if (n <= 3) {
        return 0.96;
      }
      if (n <= 4) {
        return 0.84;
      }
      if (n <= 6) {
        return 0.66;
      }
      if (n <= 8) {
        return 0.56;
      }
      return 0.46;
    },
  },
  methods: {
    cardLabel(card: CardModel): string {
      return card.name.split(':')[0];
    },
  },
});
</script>
