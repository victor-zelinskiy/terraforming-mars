<template>
  <div
    class="played-card-item"
    :class="{
      'played-card-item--pickable': pickMode && isCandidate,
      'played-card-item--pick-disabled': pickMode && !isCandidate,
    }">
    <!-- The CARD silhouette. A single click ALWAYS opens the fullscreen viewer
         (the fork's universal "click a card → fullscreen" rule — including in pick
         mode, where selecting is the dedicated button below). `@click.capture.stop`
         suppresses Card.vue's own (preference-gated) click so a tap always zooms. -->
    <div class="played-card-item__card"
         tabindex="0"
         role="button"
         :aria-label="$t(label)"
         @click.capture.stop="$emit('open', card)"
         @keydown.enter.prevent="$emit('open', card)"
         @keydown.space.prevent="$emit('open', card)">
      <Card :card="card" :autoTall="autoTall" :lightweight="lightweight" />
    </div>

    <!-- PICK MODE — a dedicated SELECT button UNDER the card (no extra confirm:
         a click resolves the pick and returns to the modal). Mirrors the КАРТЫ В
         РУКЕ overlay's button-under-card pattern. A non-candidate shows a clear
         "why not" reason chip instead. -->
    <div v-if="pickMode" class="played-card-item__action">
      <button v-if="isCandidate"
              type="button"
              class="played-card-pick-btn cab-played-pick"
              @click.stop="$emit('pick', card)">
        <span class="cab-played-pick__glow" aria-hidden="true"></span>
        <span class="cab-played-pick__label" v-i18n>Select</span>
      </button>
      <div v-else-if="reason !== ''" class="played-card-item__reason" :data-hint="$t(reason)">
        <span class="played-card-item__reason-glyph" aria-hidden="true">✕</span>
        <span class="played-card-item__reason-text" v-i18n>{{ reason }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import Card from '@/client/components/card/Card.vue';

/**
 * One played card on the board. Renders the shared `<Card>` (scaled by the
 * `--played-card-zoom` CSS variable set on the body). A single click ALWAYS opens
 * the modern fullscreen viewer — `@click.capture.stop` suppresses Card.vue's own
 * (preference-gated) click so a single tap always zooms; the overlay owns the
 * shared `CardZoomModal` and we just emit `open`.
 *
 * PICK MODE (`pickMode`): the board is hosting a card-target choice for the
 * play / action-confirm modal. The card itself STILL opens fullscreen on click
 * (fork rule); a DEDICATED button UNDER the card (`Select`) resolves the pick
 * with no extra confirmation step (emits `pick`). A non-candidate is dimmed +
 * inert and shows a "why not" reason chip in place of the button. So the player
 * can inspect any card fullscreen and select via the explicit button (or from the
 * fullscreen viewer's own Select action).
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
    // PICK MODE — the overlay is hosting a card-target choice for a modal.
    pickMode: {
      type: Boolean,
      default: false,
    },
    // The selectable card names in pick mode (only these get a Select button).
    selectable: {
      type: Object as PropType<ReadonlySet<CardName>>,
      default: () => new Set<CardName>(),
    },
    // Per-card unavailability reason (English i18n key) for non-candidates.
    reasons: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
  },
  emits: ['open', 'pick'],
  computed: {
    label(): string {
      return this.card.name.split(':')[0];
    },
    isCandidate(): boolean {
      return this.selectable.has(this.card.name);
    },
    reason(): string {
      return this.reasons[this.card.name] ?? '';
    },
  },
});
</script>
