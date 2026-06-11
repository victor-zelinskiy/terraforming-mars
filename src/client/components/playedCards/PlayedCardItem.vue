<template>
  <div
    class="played-card-item"
    :class="{
      'played-card-item--pickable': pickMode && isCandidate,
      'played-card-item--pick-disabled': pickMode && !isCandidate,
    }"
    tabindex="0"
    role="button"
    :aria-label="$t(label)"
    @click.capture.stop="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick">
    <Card :card="card" :autoTall="autoTall" :lightweight="lightweight" />
    <!-- PICK MODE — a calm cyan "ВЫБРАТЬ" affordance on a candidate; the whole
         card is clickable, this just makes the action legible on the board. -->
    <div v-if="pickMode && isCandidate" class="played-card-item__pick" aria-hidden="true">
      <span class="played-card-item__pick-tick">✓</span>
      <span class="played-card-item__pick-label" v-i18n>Choose</span>
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
 * `--played-card-zoom` CSS variable set on the body), and on single click
 * opens the modern fullscreen viewer — `@click.capture.stop` suppresses
 * Card.vue's own (preference-gated) click so a single tap always zooms. The
 * overlay owns the shared `CardZoomModal`; we just emit `open`.
 *
 * PICK MODE (`pickMode`): the board is hosting a card-target choice for the
 * play / action-confirm modal (a >3-candidate "add a resource to a card" pick).
 * A candidate (`isCandidate`) gets a cyan ring + "ВЫБРАТЬ" tag and a click emits
 * `pick` (NOT `open` — picking is the point); a non-candidate is dimmed and
 * inert. So the player chooses the REAL card on their tableau instead of from a
 * cramped in-modal grid.
 *
 * This is otherwise a VIEW surface: it deliberately does NOT pass `actionUsed`,
 * so an active card whose action was already used this generation is NOT dimmed
 * here. The dedicated Actions overlay is where action availability / used state
 * lives; the played board is for reading the tableau.
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
    // The selectable card names in pick mode (only these accept a click).
    selectable: {
      type: Object as PropType<ReadonlySet<CardName>>,
      default: () => new Set<CardName>(),
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
  },
  methods: {
    onClick(): void {
      if (this.pickMode) {
        // A dimmed non-candidate is inert; a candidate resolves the pick.
        if (this.isCandidate) {
          this.$emit('pick', this.card);
        }
        return;
      }
      this.$emit('open', this.card);
    },
  },
});
</script>
