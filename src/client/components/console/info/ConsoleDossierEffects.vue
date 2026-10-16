<template>
  <!--
    THE DOSSIER'S EFFECTS PLATE (TR60): the seat's passive effects counted PER EFFECT in the explorer's four families
    (and what is armed for the next card, TR49) — each family a medallion in the explorer's own rail colour with a
    symbol that reads without colour, the count its badge — and the cards that carry them as a row of art coins (the
    objects the families are made of). The seat's quiet whole-game line stays under them. Read-only; the zone is the
    ring's stop. Empty: the silhouettes of the family discs and one line.
  -->
  <div class="con-deffs" :class="{'con-deffs--empty': families.length === 0}" data-dossier-effects>
    <div v-if="families.length > 0" class="con-deffs__families">
      <div v-for="f in families" :key="f.family" class="con-deff" :class="'con-deff--' + f.family" :data-dossier-effect="f.family">
        <span class="con-deff__disc" aria-hidden="true"><span class="con-deff__glyph">{{ GLYPH[f.family] }}</span></span>
        <b class="con-deff__count">{{ f.count }}</b>
        <span class="con-deff__label">{{ $t(f.label) }}</span>
      </div>
    </div>
    <div v-else class="con-deffs__void" data-dossier-empty="effects">
      <span class="con-deff__disc con-deff__disc--ghost" aria-hidden="true"></span>
      <span class="con-deff__disc con-deff__disc--ghost" aria-hidden="true"></span>
      <span class="con-deffs__voidline">{{ $t('No passive effects') }}</span>
    </div>
    <div v-if="cards.length > 0" class="con-deffs__cards" aria-hidden="true">
      <span v-for="name in shownCards" :key="name" class="con-deffs__coin" :style="artStyle(name)"></span>
      <span v-if="cards.length > shownCards.length" class="con-deffs__coinmore">+{{ cards.length - shownCards.length }}</span>
    </div>
    <div v-if="note !== ''" class="con-deffs__note">{{ note }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {DossierEffectFamily} from '@/client/console/infoDossierModel';
import {cardArtUrl, cardArtUrlAtTier, CARD_ART_FALLBACK_URL} from '@/client/cards/cardArt';

/** A family's symbol — a sign that reads in every language: a reaction, a price cut, a multiplier, a standing rule, armed. */
const GLYPH: Readonly<Record<DossierEffectFamily['family'], string>> = {
  armed: '◆',
  triggers: '↻',
  discounts: '−',
  payValue: '×',
  rules: '≡',
};

export default defineComponent({
  name: 'ConsoleDossierEffects',
  props: {
    families: {type: Array as PropType<ReadonlyArray<DossierEffectFamily>>, required: true},
    /** The cards that carry the effects, in tableau order. */
    cards: {type: Array as PropType<ReadonlyArray<CardName>>, default: () => []},
    note: {type: String, default: ''},
    maxCards: {type: Number, default: 6},
  },
  data() {
    return {GLYPH};
  },
  computed: {
    shownCards(): ReadonlyArray<CardName> {
      return this.cards.slice(0, this.maxCards);
    },
  },
  methods: {
    artStyle(name: CardName): Record<string, string> {
      const url = cardArtUrl(name);
      return {backgroundImage: `url(${url === undefined ? CARD_ART_FALLBACK_URL : cardArtUrlAtTier(url, 'thumb')})`};
    },
  },
});
</script>
