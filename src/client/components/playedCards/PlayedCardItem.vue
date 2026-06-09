<template>
  <div
    class="played-card-item"
    tabindex="0"
    role="button"
    :aria-label="$t(label)"
    @click.capture.stop="$emit('open', card)"
    @keydown.enter.prevent="$emit('open', card)"
    @keydown.space.prevent="$emit('open', card)">
    <Card :card="card" :autoTall="autoTall" :lightweight="lightweight" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import Card from '@/client/components/card/Card.vue';

/**
 * One played card on the board. Renders the shared `<Card>` (scaled by the
 * `--played-card-zoom` CSS variable set on the body), and on single click
 * opens the modern fullscreen viewer — `@click.capture.stop` suppresses
 * Card.vue's own (preference-gated) click so a single tap always zooms. The
 * overlay owns the shared `CardZoomModal`; we just emit `open`.
 *
 * This is a VIEW surface: it deliberately does NOT pass `actionUsed`, so an
 * active card whose action was already used this generation is NOT dimmed
 * here. The dedicated Actions overlay is where action availability / used
 * state lives; the played board is for reading the tableau.
 *
 * `lightweight` passes through to `<Card>` to drop the heavy hover-expand /
 * inner-zoom machinery for this dense, many-card surface (purely a cost
 * reduction — the card graphic is unchanged). Scoped to this overlay; other
 * card surfaces keep the default rich behaviour.
 */
export default defineComponent({
  name: 'PlayedCardItem',
  components: {Card},
  props: {
    card: {
      type: Object as PropType<CardModel>,
      required: true,
    },
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    // Optional pass-through to `<Card autoTall>` (auto-size regardless of
    // hover). Currently unused by the board — identity AND project cards render
    // at the canonical fixed height via `lightweight` — but kept as a clean
    // escape hatch if a future surface wants an auto-tall played card.
    autoTall: {
      type: Boolean,
      default: false,
    },
    lightweight: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['open'],
  computed: {
    label(): string {
      return this.card.name.split(':')[0];
    },
  },
});
</script>
