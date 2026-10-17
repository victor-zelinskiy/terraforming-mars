<template>
  <!--
    ONE SHELF RUN of the «Разыграно» table: a row of FULL faces at the album's
    scale (the peek piles are gone — a face reads from the couch or it is not on
    the table). The slots keep their [data-played-key] identity — the hero
    landing, the reward-transfer sources and the category flights all measure
    them; `data-zoom-slot` is the fullscreen inspect's physical origin.

    READ-ONLY by design: individual cards are NOT focusable (the tableau
    navigates by ZONE — the parent run block owns focus + clicks).

    `outNames` — cards currently LIFTED into the category view: their slots
    render held geometry (invisible, layout kept) so a card never exists in
    two places at once. `grounded` — cards whose category episode flies a
    BOUNDED proxy set: these dissolve IN PLACE (opacity) instead of flying.
    `hiddenKey` — the hero scene's RESERVED slot: full layout, no paint, until
    the landing commit.
  -->
  <div class="con-played__shelf" :class="{'con-played__shelf--column': column}" :style="{gap: gapX + 'px'}">
    <div v-for="card in cards"
         :key="card.name"
         class="con-played__slot"
         :class="{
           'con-played__slot--incoming': card.name === hiddenKey,
           'con-played__slot--held-out': outNames.has(card.name),
           'con-played__slot--grounded': grounded.has(card.name),
         }"
         :style="{width: slotW + 'px', height: slotH + 'px'}"
         :data-played-key="card.name"
         :data-zoom-slot="card.name">
      <!-- Nothing live rides the table: stored resources are read in «Информация» and on the card's own face in the
           fullscreen inspector. What a card PUBLICLY CARRIES on its face is not an overlay: the trade fleet standing
           on a dock is part of the card until the generation ends (`publicFaceModel` — that card alone gets it). -->
      <div class="con-played__lift">
        <div class="con-played__face con-played__focusbox" :style="{zoom: String(zoom)}">
          <ConsolePlayedCardLite :name="card.name" :card="live ? card : publicFaceModel(card)" :art-tier="artTier" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {artTierForWidth, CardArtTier} from '@/client/cards/cardArt';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import {publicFaceModel} from '@/client/components/premiumCard/premiumFleetDock';

const EMPTY_SET: ReadonlySet<string> = new Set();

export default defineComponent({
  name: 'ConsolePlayedShelf',
  components: {ConsolePlayedCardLite},
  props: {
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /** The hero scene's RESERVED slot: rendered with full layout but kept
     *  invisible until the landing commit (the arc flies into it). */
    hiddenKey: {type: String as PropType<string | undefined>, default: undefined},
    /** Cards lifted into the category view — their slots hold (see header). */
    outNames: {type: Object as PropType<ReadonlySet<string>>, default: () => EMPTY_SET},
    /** Cards dissolving in place for a bounded category episode (see header). */
    grounded: {type: Object as PropType<ReadonlySet<string>>, default: () => EMPTY_SET},
    /** Plan metrics (screen px / css zoom) — see consolePlayedModel. */
    zoom: {type: Number, required: true},
    slotW: {type: Number, required: true},
    slotH: {type: Number, required: true},
    gapX: {type: Number, default: 0},
    /** The slots stack VERTICALLY (the identity column's hero(es)). */
    column: {type: Boolean, default: false},
    /** The HERO's face carries its LIVE model (its stored resources on its own capsule); a shelf face stays public. */
    live: {type: Boolean, default: false},
  },
  computed: {
    /** The art tier follows the face's painted width (cardArt.ts) — a couch-size face takes the full art. */
    artTier(): CardArtTier {
      return artTierForWidth(this.slotW);
    },
  },
  methods: {
    publicFaceModel,
  },
});
</script>
