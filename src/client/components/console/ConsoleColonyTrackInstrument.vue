<template>
  <!--
    THE TRADE-TRACK INSTRUMENT — the colony's game object, drawn ONCE for
    every console surface that shows a colony at full size: the trade stage
    (`ConsoleColonyFocusStage`, where the action RESOLVES on it) and the
    dossier (`ConsoleColonyInspect`, where it is read). A future colony
    screen renders THIS component or it is not the same object.

    THE TRACK AND THE BERTHS SHARE ONE 7-COLUMN GRID. Berth `i` sits under
    track cell `i` because that is literally the rule: an occupied berth
    PROTECTS that position — the marker can never return past it. The reset
    number is therefore never written anywhere; it is where the guard rail
    stops (docs/claude/console/colony-focus-stage.md § 2).

    The class names are the stage's (`con-colfocus__trackzone` and below —
    flat BEM, no `.con-colfocus` ancestor required) and every data anchor
    is the one the trade layers' ladders already read: the marker SEATS
    (`data-colony-track-cell`), the cube SEATS (`data-colony-build-slot` +
    `data-colony-build-seat`), the card launch cell (`data-colony-card-cell`),
    the bonus origins (`data-colony-bonus-source` / `-cell`), and the two
    CARRY targets of the descend choreography (`data-colony-focus-track` /
    `data-colony-focus-slots`). Extracting the markup changed none of them.

    The host passes the two positions it PRESENTS (the marker's, and the one
    a trade would read — pinned past a commit on the stage, live on the
    dossier) and its transient beats (`latchCell`, `settledCell`,
    `buildPreview`); everything else derives from the colony's own metadata
    through the same pure `colonyTradePlan` every colony surface reads.
  -->
  <section class="con-colfocus__trackzone"
           :style="{'--stop-col': resetPosition, '--ghost-col': resetPositionAfterBuild}">
    <header v-if="head" class="con-colfocus__zonehead" data-unfold-late>
      <span class="con-colfocus__sec-title">{{ $t('Trade track') }}</span>
      <span v-if="offsetSteps > 0" class="con-colfocus__tracknote-adv">
        {{ $t('Your trade advances the track first') }} <b>+{{ offsetSteps }}</b>
      </span>
    </header>

    <div class="con-colfocus__xtrack" data-colony-focus-track>
      <div v-for="cell in cells" :key="cell.index"
           class="con-colfocus__xcell"
           :class="{
             'con-colfocus__xcell--marker': cell.marker,
             'con-colfocus__xcell--effective': cell.effective,
             'con-colfocus__xcell--passed': cell.passed,
             'con-colfocus__xcell--protected': cell.index < resetPosition,
             'con-colfocus__xcell--latching': cell.index === latchCell,
             'con-colfocus__xcell--willprotect': buildPreview && cell.index === resetPosition,
             'con-colfocus__xcell--settled': cell.index === settledCell,
           }">
        <span class="con-colfocus__xcell-num">{{ cell.index + 1 }}</span>
        <!-- THE FIXED PART OF A COMPOSITE INCOME (the Redux Venus: «[Venus] +
             the bonus under the marker») stands in EVERY cell, above the
             bonus — the step IS the tile's main income, and a track that
             printed only the per-position bonus read as if the levy cell paid
             nothing but a fee. -->
        <span v-if="fixedBenefit !== undefined" class="con-colfocus__xcell-fixed" data-colony-track-fixed>
          <span class="con-colfocus__xcell-fixed-glyph">
            <BenefitGlyph :benefit="fixedBenefit" :idx="0" :cardResources="cardResourceKinds" />
          </span>
          <span class="con-colfocus__xcell-plus" aria-hidden="true">+</span>
        </span>
        <!-- THE CARD LAUNCH CELL: a card payout physically separates from
             the CARD BACK printed on the REWARD cell — the exact glyph whose
             number the player just read — never from «somewhere in the
             planet's area». Post-commit (when the covers actually measure)
             the EFFECTIVE flag has already collapsed with the spent offer,
             and the frozen MARKER cell (presentedColonyModel holds the
             pre-reset position) IS the cell the reward was paid at — so both
             flags anchor. -->
        <span class="con-colfocus__xcell-body"
              :data-colony-card-cell="(cell.effective || cell.marker) ? colony.name : undefined">
          <span class="con-colfocus__xcell-glyph" :class="{'con-colfocus__xcell-glyph--multi': multiKindCell(cell.index)}">
            <BenefitGlyph :benefit="tradeBenefitAt(cell.index)" :idx="cell.index" :cardResources="cardResourceKinds" compact />
          </span>
          <!-- A LEVY prints its SIGN — «−4», never a bare 4 in the gain's own
               register (the sign lives on the glyph's badge, which this box
               hides, so the cell states it itself). -->
          <b v-if="cell.quantity > 0" class="con-colfocus__xcell-qty" :class="{'con-colfocus__xcell-qty--levy': cell.levy}">{{ cell.levy ? '−' : '' }}{{ cell.quantity }}</b>
          <!-- ONE mark for one nothing: a printed EMPTY position is a levy of zero,
               and `BenefitGlyph` already draws its quiet dash in the glyph's own box
               (an icon with no number would read as a gain). A second dash under it
               made the empty 2nd Venus cell say «nothing» twice. -->
          <span v-else-if="!cell.levy" class="con-colfocus__xcell-void">—</span>
        </span>
        <!-- THE MARKER RAIL SEAT — the glide's landing geometry. -->
        <span class="con-colfocus__xcell-rail" aria-hidden="true">
          <span class="con-colfocus__xcell-seat"
                :data-colony-track-cell="colony.name + '#' + cell.index"></span>
          <!-- The GUARD: this position is held by a colony below. -->
          <span class="con-colfocus__xcell-guard"></span>
        </span>
      </div>

      <!-- THE STOP — the mechanical end of the return travel. It rides
           `--stop-col`, so building a colony SLIDES it one cell right
           (transform only) instead of re-rendering a new marker. WORDLESS on
           purpose: the bracket + the anchor under a real cell ARE the reading. -->
      <span class="con-colfocus__stop" aria-hidden="true"></span>
      <span v-if="buildPreview && resetPositionAfterBuild !== resetPosition"
            class="con-colfocus__stop con-colfocus__stop--ghost" aria-hidden="true"></span>
    </div>

    <!-- THE BERTHS — the physical foundation of the first three positions.
         There is deliberately nothing under cells 4…7: no colony can ever
         protect them, and the empty span says so. -->
    <div class="con-colfocus__berths" data-colony-focus-slots data-unfold-item>
      <div v-for="idx in [0, 1, 2]" :key="idx"
           class="con-colfocus__berth"
           :class="{
             'con-colfocus__berth--taken': colony.colonies[idx] !== undefined,
             'con-colfocus__berth--mine': colony.colonies[idx] === viewerColor,
             'con-colfocus__berth--dest': buildPreview && idx === nextBuildSlot,
             'con-colfocus__berth--latching': idx === latchCell,
           }">
        <!-- The LATCH: an occupied berth is physically bolted to the track
             cell above it. -->
        <span class="con-colfocus__berth-latch" aria-hidden="true"></span>
        <span class="con-colfocus__berth-seat"
              :data-colony-build-slot="colony.name + '#' + idx"
              data-colony-build-seat
              :data-colony-bonus-source="colony.colonies[idx] !== undefined ? colony.name : undefined">
          <PlayerCube v-if="colony.colonies[idx] !== undefined" :color="colony.colonies[idx]" :size="44" />
          <BenefitGlyph v-else :benefit="buildBenefit" :idx="idx" :cardResources="cardResourceKinds" />
        </span>
        <!-- Only an OCCUPIED berth has something to say: an empty seat
             already reads as empty, and «Свободное место» in a one-column
             box could only ever be clipped. -->
        <span v-if="colony.colonies[idx] !== undefined" class="con-colfocus__berth-name" data-unfold-late>
          {{ ownerNames[idx] ?? '' }}
        </span>
      </div>
      <!-- THE OWNER BONUS — the CONTINUATION of the ownership row: it takes
           exactly the span the berths do not, so «who stands here» and «what
           standing here pays» are one horizontal statement. It states the
           MECHANISM, and only the mechanism: the rate, and — when a holder
           has more than one seat — the arithmetic drawn from the REAL tokens.
           WHO receives how much is the host's own sentence (the stage's
           summary rail, the dossier's rules panel). -->
      <div class="con-colfocus__ownerbonus"
           :class="{'con-colfocus__ownerbonus--math': bonusMath !== undefined}"
           :data-colony-bonus-source="colony.colonies.length === 0 ? colony.name : undefined">
        <span class="con-colfocus__ob-label" data-unfold-late>{{ $t('Owner bonus') }}</span>
        <!-- The BONUS card's own launch anchor — the bonus cover separates
             from THIS zone's printed card, a beat after the income wave. -->
        <span class="con-colfocus__ob-value" :data-colony-bonus-cell="colony.name">
          <b v-if="bonusQty > 0">{{ bonusQty }}</b>
          <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
            <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResources="cardResourceKinds" />
          </span>
        </span>
        <template v-if="bonusMath !== undefined">
          <span class="con-colfocus__ob-op" aria-hidden="true">×</span>
          <!-- The multiplier is not a number the player has to trust — it is
               the very cubes seated in the berths to the left. -->
          <span class="con-colfocus__ob-tokens">
            <PlayerCube v-for="n in bonusMath.count" :key="n" :color="bonusMath.color" :size="20" />
          </span>
          <span class="con-colfocus__ob-op" aria-hidden="true">=</span>
          <span class="con-colfocus__ob-total">
            <b>{{ bonusMath.total }}</b>
            <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
              <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResources="cardResourceKinds" />
            </span>
          </span>
        </template>
        <span class="con-colfocus__ob-note" data-unfold-late>{{ $t('Each trade here') }}</span>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata, colonyCardResources, tradeBenefitAt, tradeFixedIncome} from '@/common/colonies/ColonyMetadata';
import {CardResource} from '@/common/CardResource';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {Color} from '@/common/Color';
import {trackResetAfterBuild, trackResetPosition} from '@/client/components/colonies/colonyTradePlan';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';

/** One position of the 7-cell track, as the instrument draws it. */
export type ColonyTrackCell = {
  index: number,
  quantity: number,
  /** A LOSE_RESOURCES cell — the quantity is a levy and prints its sign. */
  levy: boolean,
  /** The resting marker stands here (the PRESENTED position). */
  marker: boolean,
  /** The position a trade would READ (a standing offset moved it past the marker). */
  effective: boolean,
  passed: boolean,
};

/** The owner-bonus arithmetic worth drawing: `rate × the seated cubes`. */
export type ColonyTrackBonusMath = {color: Color, count: number, total: number};

type Benefit = {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown};

export default defineComponent({
  name: 'ConsoleColonyTrackInstrument',
  components: {BenefitGlyph, PlayerCube},
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    metadata: {type: Object as PropType<ColonyMetadata>, required: true},
    /** The marker's DISPLAYED position (the host presents it — frozen mid-trade). */
    markerPosition: {type: Number, required: true},
    /** The position a trade would read right now (the standing offset applied). */
    effectivePosition: {type: Number, required: true},
    /** The names seated in the three berths (index-aligned; '' for an empty seat). */
    ownerNames: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
    /** The multiplier row (`rate × cubes = total`) — undefined draws just the rate. */
    bonusMath: {type: Object as PropType<ColonyTrackBonusMath | undefined>, default: undefined},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The stage's transient beats. The dossier passes none of them. */
    latchCell: {type: Number, default: -1},
    settledCell: {type: Number, default: -1},
    buildPreview: {type: Boolean, default: false},
    /** The zone head («ТОРГОВЫЙ ТРЕК» + the standing-offset caption). */
    head: {type: Boolean, default: true},
  },
  computed: {
    /** The card resource(s) the tile's card benefits add — the ONE list every glyph on this surface draws (several for the Redux Vesta). */
    cardResourceKinds(): ReadonlyArray<CardResource> {
      return colonyCardResources(this.metadata);
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    offsetSteps(): number {
      return Math.max(0, this.effectivePosition - this.markerPosition);
    },
    /** THE RULE, as a number: after a trade the track falls back to the
     *  built-colony count — read from the ONE pure source every surface reads. */
    resetPosition(): number {
      return trackResetPosition(this.colony, this.metadata);
    },
    resetPositionAfterBuild(): number {
      return trackResetAfterBuild(this.colony, this.metadata);
    },
    nextBuildSlot(): number {
      return Math.min(this.colony.colonies.length, 2);
    },
    cells(): Array<ColonyTrackCell> {
      const cells: Array<ColonyTrackCell> = [];
      for (let i = 0; i <= this.trackMax; i++) {
        cells.push({
          index: i,
          quantity: this.metadata.trade.quantity[i] ?? 0,
          levy: tradeBenefitAt(this.metadata, i).type === ColonyBenefit.LOSE_RESOURCES,
          marker: i === this.markerPosition,
          effective: i === this.effectivePosition && this.effectivePosition !== this.markerPosition,
          passed: i < this.markerPosition,
        });
      }
      return cells;
    },
    /** The income paid on EVERY trade beside the marker's bonus (the Redux Venus's step) — undefined for every other tile. */
    fixedBenefit(): Benefit | undefined {
      const fixed = tradeFixedIncome(this.metadata);
      return fixed === undefined ? undefined : {type: fixed.type, quantity: [fixed.quantity], resource: fixed.resource};
    },
    buildBenefit(): Benefit {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    colonyBenefit(): Benefit {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    bonusQty(): number {
      return this.metadata.colony.quantity ?? 1;
    },
  },
  methods: {
    /** A card-resource cell over SEVERAL kinds (the Redux Vesta) — the glyph box opens to the row's width. */
    multiKindCell(position: number): boolean {
      return this.cardResourceKinds.length > 1 && tradeBenefitAt(this.metadata, position).type === ColonyBenefit.ADD_RESOURCES_TO_CARD;
    },
    /** The cell's income — kind AND resource at that position (the Redux Pluto: data cells, then card cells). */
    tradeBenefitAt(position: number): Benefit {
      const income = tradeBenefitAt(this.metadata, position);
      return {type: income.type, quantity: this.metadata.trade.quantity, resource: income.resource};
    },
  },
});
</script>
