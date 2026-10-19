<template>
  <!--
    ONE TABLE STACK of the «Разыграно» table: a zone's cards as the printed
    game lays them — a CASCADE per lane, each covered card showing its title
    band (`peek` — the planner's compactness), the newest lying whole in
    front; a long zone continues in the next lane (lanes hold contiguous runs
    of the play order, so the newest card is always the FRONT of the last
    lane). The slots keep their [data-played-key] identity — the hero landing,
    the reward-transfer sources and the category flights all measure them;
    `data-zoom-slot` is the fullscreen inspect's physical origin.

    READ-ONLY by design: individual cards are NOT focusable (the table
    navigates by STACK — the parent block owns focus + clicks).

    `outNames` — cards currently LIFTED into the category view: their slots
    render held geometry (invisible, layout kept) so a card never exists in
    two places at once. `grounded` — cards whose category episode flies a
    BOUNDED proxy set: these dissolve IN PLACE (opacity) instead of flying.
    `hiddenKey` — the hero scene's RESERVED slot: full layout, no paint, until
    the landing commit.
  -->
  <div class="con-played__lanes" :style="{columnGap: laneGap + 'px'}">
    <div v-for="(lane, li) in lanes"
         :key="li"
         class="con-played__lane"
         :style="{width: slotW + 'px', height: laneHeight(lane) + 'px'}">
      <div v-for="(card, ci) in laneCards(lane)"
           :key="card.name"
           class="con-played__slot"
           :class="{
             'con-played__slot--front': ci === lane.count - 1,
             'con-played__slot--incoming': card.name === hiddenKey,
             'con-played__slot--held-out': outNames.has(card.name),
             'con-played__slot--grounded': grounded.has(card.name),
           }"
           :style="{top: ci * peek + 'px', width: slotW + 'px', height: slotH + 'px', zIndex: String(ci + 1)}"
           :data-played-key="card.name"
           :data-zoom-slot="card.name">
        <!-- Nothing live rides the table: stored resources are read in «Информация» and on the card's own face in the
             fullscreen inspector. What a card PUBLICLY CARRIES on its face is not an overlay: the trade fleet standing
             on a dock is part of the card until the generation ends (`publicFaceModel` — that card alone gets it). -->
        <div class="con-played__lift">
          <div class="con-played__face con-played__focusbox" :style="{zoom: String(zoom)}">
            <!-- A covered card shows its title band only — the art row (from 75 natural px down) never shows under a
                 band ≤ the natural peek, so it takes the cheapest tier; the front card the width's. -->
            <ConsolePlayedCardLite :name="card.name" :card="live ? card : publicFaceModel(card)" :art-tier="ci === lane.count - 1 ? artTier : 'thumb'" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {artTierForWidth, CardArtTier} from '@/client/cards/cardArt';
import {PlayedStackLane} from '@/client/components/console/consolePlayedModel';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import {publicFaceModel} from '@/client/components/premiumCard/premiumFleetDock';

const EMPTY_SET: ReadonlySet<string> = new Set();

export default defineComponent({
  name: 'ConsolePlayedStack',
  components: {ConsolePlayedCardLite},
  props: {
    /** The zone's cards in play order (the lanes index into it). */
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /** The planner's lanes (contiguous runs of `cards`). */
    lanes: {type: Array as PropType<ReadonlyArray<PlayedStackLane>>, required: true},
    /** The hero scene's RESERVED slot: rendered with full layout but kept
     *  invisible until the landing commit (the arc flies into it). */
    hiddenKey: {type: String as PropType<string | undefined>, default: undefined},
    /** Cards lifted into the category view — their slots hold (see header). */
    outNames: {type: Object as PropType<ReadonlySet<string>>, default: () => EMPTY_SET},
    /** Cards dissolving in place for a bounded category episode (see header). */
    grounded: {type: Object as PropType<ReadonlySet<string>>, default: () => EMPTY_SET},
    /** Plan metrics (screen px / css zoom) — see consolePlayedModel.planPlayedStacks. */
    zoom: {type: Number, required: true},
    slotW: {type: Number, required: true},
    slotH: {type: Number, required: true},
    /** The title band a covered card shows (screen px). */
    peek: {type: Number, required: true},
    laneGap: {type: Number, default: 0},
    /** The CORPORATION's face carries its LIVE model (its stored resources on its own capsule); a project face stays public. */
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
    laneCards(lane: PlayedStackLane): ReadonlyArray<CardModel> {
      return this.cards.slice(lane.start, lane.start + lane.count);
    },
    /** A lane's box: its front face and the bands above it. */
    laneHeight(lane: PlayedStackLane): number {
      return this.slotH + Math.max(0, lane.count - 1) * this.peek;
    },
  },
});
</script>
