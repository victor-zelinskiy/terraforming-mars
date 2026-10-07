<template>
  <!--
    «ТАЙЛ ПЛАТИТ КАРТЕ» — the shell-level stage of a card reward a PLACED TILE
    pays (TR21 Arboretum — the cities beside it; TR30 Red Museum, Pets, Martian
    Census — the tile itself; the director: cityDataPayoutBeat.ts). Mounted
    beside the tile-placement layer and never inside a teleported surface, so a
    fixed flight resolves against the viewport.

     - the WAKES: one per token a sender sends — the ocean's shoreline swell in
       the city's register (`--city`); a stack answers twice;
     - the TOKENS: a card-resource token (data, an animal) condensing at its
       sender's edge, a pixel twin of the Resource Transfer Framework's own
       chip (the handoff is invisible);
     - the RECEIVING CARD (own scene only): the chosen card's premium face, its
       capsule counting the touchdowns (`before + landed`), one contact flash
       per token.

    `con-flight-to-board`: every piece here lands on the board's own story (the
    card stands by the field); a workspace over the board covers it.
  -->
  <div v-if="cityPayoutState.phase !== 'idle' || cityPayoutState.degraded"
       class="con-citypay con-flight-to-board" aria-hidden="true"
       :data-city-payout="cityPayoutState.phase"
       :data-city-payout-mode="cityPayoutState.mode"
       :data-city-payout-seq="cityPayoutState.seq"
       :data-city-payout-degraded="cityPayoutState.degraded ? '1' : undefined">
    <div v-for="w in cityPayoutState.wakes" :key="'wake-' + w.id"
         class="con-tileplace__oceanpulse con-tileplace__oceanpulse--city"
         :data-city-wake="w.city"
         :style="wakeStyle(w)"
         :ref="(el) => setRef(wakeEls, w.id, el as HTMLElement | null)">
      <div class="con-tileplace__oceanpulse-wash"></div>
      <div class="con-tileplace__oceanpulse-ring"></div>
    </div>
    <div v-for="t in cityPayoutState.tokens" :key="'token-' + t.id"
         class="con-tileplace__oceancoin" :class="coinClass"
         :data-city-token="t.city"
         :style="tokenStyle(t)"
         :ref="(el) => setRef(tokenEls, t.id, el as HTMLElement | null)">
      <div v-for="s in sparks" :key="s" class="con-tileplace__coin-spark"></div>
      <div class="con-tileplace__coin-ring"></div>
      <div class="con-tileplace__coin-body">
        <span class="con-tileplace__coin-value">+1</span>
        <div class="con-tileplace__coin-sheen"></div>
      </div>
    </div>
    <div v-if="cityPayoutState.card !== undefined" ref="card"
         class="con-citypay__card"
         :class="{'con-citypay__card--measuring': cityPayoutState.card.plate.w === 0}"
         :style="cardStyle"
         :data-played-key="cityPayoutState.card.name"
         :data-city-payout-count="presentedCount">
      <div class="con-citypay__face">
        <ConsoleCardFaceLite :name="cityPayoutState.card.name" :card="presentedModel" :lightweight="true" />
        <div v-if="cityPayoutState.landed > 0" :key="'flash-' + cityPayoutState.landed" class="con-citypay__flash"></div>
      </div>
      <!-- THE READING under the card — «2 → 6», ticking WITH the capsule (the same `before + landed`): the capsule is
           the counter, this is what makes it legible from the couch. Its box is reserved from the first frame. -->
      <div class="con-citypay__read" data-city-payout-read>
        <i class="con-citypay__read-icon" :class="resourceIconClass" aria-hidden="true"></i>
        <span class="con-citypay__read-from">{{ cityPayoutState.card.before }}</span>
        <span class="con-citypay__read-arrow" aria-hidden="true">→</span>
        <b :key="presentedCount" class="con-citypay__read-to">{{ presentedCount }}</b>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {
  CityTokenProxy, CityWake, CityPayoutStageEls, abortCityPayoutBeat, cityPayoutState, registerCityPayoutStage,
} from '@/client/console/tilePlacement/cityDataPayoutBeat';
import {OCEAN_COIN_SPARKS} from '@/client/console/tilePlacement/tilePlacementModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

export default defineComponent({
  name: 'ConsoleCityPayoutLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {
      cityPayoutState,
      wakeEls: new Map<number, HTMLElement>(),
      tokenEls: new Map<number, HTMLElement>(),
      sparks: Array.from({length: OCEAN_COIN_SPARKS}, (_, i) => i),
      unregister: undefined as (() => void) | undefined,
    };
  },
  computed: {
    /** The capsule's count: the payout's start plus every token that has TOUCHED it — never ahead of the contact. */
    presentedCount(): number {
      const card = cityPayoutState.card;
      return card === undefined ? 0 : card.before + cityPayoutState.landed;
    },
    /** The card's own committed model with its count frozen at the scene's presented value. */
    presentedModel(): CardModel | undefined {
      const card = cityPayoutState.card;
      return card?.model === undefined ? undefined : {...card.model, resources: this.presentedCount};
    },
    /** The token's substance — the framework's own chip of the resource (named classes: a probe waits for them). */
    coinClass(): Record<string, boolean> {
      return {
        'con-tileplace__oceancoin--data': cityPayoutState.resource === 'data',
        'con-tileplace__oceancoin--animal': cityPayoutState.resource === 'animal',
      };
    },
    /** The resource the payout moves, as the shared icon vocabulary (data, an animal). */
    resourceIconClass(): string {
      return iconClassFor(cityPayoutState.resource);
    },
    cardStyle(): Record<string, string> {
      const plate = cityPayoutState.card?.plate;
      return plate === undefined ? {} : {left: `${Math.round(plate.x)}px`, top: `${Math.round(plate.y)}px`};
    },
  },
  methods: {
    wakeStyle(w: CityWake): Record<string, string> {
      return {
        left: `${Math.round(w.pulseAt.x - w.pulseSize / 2)}px`,
        top: `${Math.round(w.pulseAt.y - w.pulseSize / 2)}px`,
        width: `${w.pulseSize}px`,
        height: `${w.pulseSize}px`,
      };
    },
    tokenStyle(t: CityTokenProxy): Record<string, string> {
      return {left: `${Math.round(t.at.x)}px`, top: `${Math.round(t.at.y)}px`};
    },
    setRef(map: Map<number, HTMLElement>, id: number, el: HTMLElement | null): void {
      if (el === null) {
        map.delete(id);
      } else {
        map.set(id, el);
      }
    },
  },
  mounted() {
    this.unregister = registerCityPayoutStage({
      els: (): CityPayoutStageEls | undefined => {
        const wakes: Array<HTMLElement> = [];
        const tokens: Array<HTMLElement> = [];
        for (const w of cityPayoutState.wakes) {
          const el = this.wakeEls.get(w.id);
          if (el !== undefined && el.isConnected) {
            wakes.push(el);
          }
        }
        for (const t of cityPayoutState.tokens) {
          const el = this.tokenEls.get(t.id);
          if (el !== undefined && el.isConnected) {
            tokens.push(el);
          }
        }
        const card = this.$refs.card as HTMLElement | undefined;
        return {wakes, tokens, card: card && card.isConnected ? card : undefined};
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
    // Shell teardown / game switch mid-scene: every owed hold is paid at once.
    abortCityPayoutBeat();
  },
});
</script>
