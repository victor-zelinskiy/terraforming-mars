<template>
  <section
    class="cm-meter"
    :class="[`cm-meter--${variant}`, {'cm-meter--pending': pending, 'cm-meter--ready': view !== undefined}]"
    data-deck-meter
    :data-deck-meter-status="status"
    :aria-label="$t('Decks')"
  >
    <div class="cm-meter__head">
      <span class="cm-meter__title">{{ $t('Decks') }}</span>
      <span v-if="failed" class="cm-meter__status" data-deck-meter-error>{{ $t('The deck counts could not be refreshed') }}</span>
    </div>
    <!-- The numbers are the SERVER's (`PUT /api/deck-composition`); while the next answer is in flight the previous ones
         stay, dimmed on an opacity layer — never a blank, never «…» in a number's place. -->
    <div class="cm-meter__tiles">
      <div
        v-for="tile in tiles"
        :key="tile.id"
        class="cm-meter__tile"
        :class="`cm-meter__tile--${tile.id}`"
        :data-deck-tile="tile.id"
        :data-deck-total="tile.total"
      >
        <span class="cm-meter__value"><ConsoleFlipValue :value="tile.total" accent="gold" :flip-on-decrease="true" /></span>
        <span class="cm-meter__label">{{ $t(tile.labelKey) }}</span>
      </div>
    </div>
    <template v-if="variant === 'deck'">
      <!-- The project deck by COLOUR — part of a whole, the premium face's green · blue · red in that fixed order;
           each segment a full-width layer scaled on X (transform only), the 2 px surface gap its own layer. -->
      <div class="cm-meter__bar" aria-hidden="true">
        <span
          v-for="(segment, i) in segments"
          :key="segment.kind"
          class="cm-meter__segment"
          :class="`cm-meter__segment--${segment.kind}`"
          :style="{transform: `translateX(${offset(i) * 100}%) scaleX(${segment.share})`}"
        ></span>
        <span
          v-for="i in [1, 2]"
          :key="'gap' + i"
          class="cm-meter__gap"
          :style="{transform: `translateX(${offset(i) * 100}%)`}"
        ><span class="cm-meter__gap-line"></span></span>
      </div>
      <div class="cm-meter__legend">
        <span v-for="segment in segments" :key="segment.kind" class="cm-meter__key" :class="`cm-meter__key--${segment.kind}`" :data-deck-segment="segment.kind">
          <span class="cm-meter__swatch" aria-hidden="true"></span>
          <span class="cm-meter__key-label">{{ readSegment(segment) }}</span>
        </span>
      </div>
    </template>
    <div v-if="extras.length > 0" class="cm-meter__extras">
      <span class="cm-meter__extras-label">{{ $t('Also in the party') }}</span>
      <span v-for="extra in extras" :key="extra.id" class="cm-meter__extra" :data-deck-extra="extra.id">{{ readExtra(extra) }}</span>
    </div>
  </section>
</template>

<script lang="ts">
/**
 * THE DECK METER (T04 «the deck is visible before launch») — what the party's decks will
 * hold for the creator's CURRENT settings, read off the server's own count
 * (`deckCompositionState` ← `PUT /api/deck-composition`) through the pure
 * `deckCompositionModel`. ONE component on three surfaces: the expansions deck's head
 * (`variant="deck"` — the totals, the project deck by colour, what else the party deals),
 * the briefing (`variant="brief"` — the totals and the extras), and the launch plate reads
 * the same model as one line. Never a cursor target (the deck's walk is the tiles').
 *
 * Form (the dataviz method): three STAT TILES for the three totals (a one-bar chart would be
 * an anti-pattern); ONE part-to-whole bar for the projects by type — the premium face's
 * card colours, validated on the console surface (green stepped into the lightness band),
 * every segment directly labelled with its count and word, so the colour is never alone.
 */
import {defineComponent, PropType} from 'vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';
import {deckCompositionState} from '@/client/console/menu/deckCompositionState';
import {DeckExtra, DeckMeterView, DeckTile, ProjectSegment, deckMeterView} from '@/client/console/menu/deckCompositionModel';
import {translateTextWithParams} from '@/client/directives/i18n';

export type DeckMeterVariant = 'deck' | 'brief';

export default defineComponent({
  name: 'ConsoleDeckMeter',
  components: {ConsoleFlipValue},
  props: {
    variant: {type: String as PropType<DeckMeterVariant>, default: 'deck'},
  },
  computed: {
    view(): DeckMeterView | undefined {
      const composition = deckCompositionState.composition;
      return composition === undefined ? undefined : deckMeterView(composition);
    },
    tiles(): ReadonlyArray<DeckTile> {
      return this.view?.tiles ?? [];
    },
    segments(): ReadonlyArray<ProjectSegment> {
      return this.view?.segments ?? [];
    },
    extras(): ReadonlyArray<DeckExtra> {
      return this.view?.extras ?? [];
    },
    status(): string {
      return deckCompositionState.status;
    },
    pending(): boolean {
      return deckCompositionState.status === 'loading' && this.view !== undefined;
    },
    failed(): boolean {
      return deckCompositionState.status === 'error';
    },
  },
  methods: {
    /** Where segment `i` starts — the shares before it, in the fixed order. */
    offset(i: number): number {
      return this.segments.slice(0, i).reduce((sum, s) => sum + s.share, 0);
    },
    readSegment(segment: ProjectSegment): string {
      return translateTextWithParams(segment.labelKey, [String(segment.count)]);
    },
    readExtra(extra: DeckExtra): string {
      return translateTextWithParams(extra.key, [...extra.params]);
    },
  },
});
</script>
