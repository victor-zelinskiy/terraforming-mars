<template>
  <!--
    LITE CARD FACE — the honest lightweight twin of <Card> used by the
    console deal cinematic as the flying proxy.

    "Same card in lite mode → same card in full mode": it reuses the REAL
    card frame classes and the REAL header components, so the proxy is
    visually the same card — not a skeleton:
     - the `.card-container.filterDiv` root + `.card-content-wrapper >
       .card-title` structure lights up the SAME sci-fi chassis frame,
       type-colour band and L-corner ticks (cards_scifi.less keys its
       `:has(...)` selectors off exactly this DOM shape);
     - CardCost / CardTags / CardTitle are the real (cheap, presentational)
       components — same cost coin, same tag icons, same title plate,
       same per-corp logo.

    What it deliberately DROPS is the heavy interior: CardContent's
    recursive render-data tree, requirements plate, expansion badges, VP
    badge, resource counter, zoom/hover/click handlers. The body is the
    shared art hook (`cardArtUrl`) with the same fallback the full card
    has today — the bare type-gradient card face.

    Render-once, zero interactivity, zero computed churn beyond a single
    manifest lookup.
  -->
  <div class="card-container filterDiv con-card-lite" :class="rootClass" aria-hidden="true">
    <span class="card-corner card-corner--tl"></span>
    <span class="card-corner card-corner--tr"></span>
    <span class="card-corner card-corner--bl"></span>
    <span class="card-corner card-corner--br"></span>
    <div class="card-content-wrapper" v-i18n>
      <div v-if="isProjectCard" class="card-cost-and-tags">
        <CardCost :amount="cost" />
        <CardTags :tags="tags" />
      </div>
      <CardTitle :title="name" :type="cardType" />
      <div class="con-card-lite__body" :class="bodyClass" :style="artStyle"></div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardArtUrl} from '@/client/cards/cardArt';
import CardCost from '@/client/components/card/CardCost.vue';
import CardTags from '@/client/components/card/CardTags.vue';
import CardTitle from '@/client/components/card/CardTitle.vue';

export default defineComponent({
  name: 'ConsoleCardFaceLite',
  components: {CardCost, CardTags, CardTitle},
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
  },
  computed: {
    cardInstance(): ClientCard | undefined {
      return getCard(this.name);
    },
    cardType(): CardType {
      return this.cardInstance?.type ?? CardType.AUTOMATED;
    },
    isProjectCard(): boolean {
      const t = this.cardType;
      return t === CardType.AUTOMATED || t === CardType.ACTIVE || t === CardType.EVENT;
    },
    cost(): number | undefined {
      return this.isProjectCard ? this.cardInstance?.cost : undefined;
    },
    tags(): Array<Tag> {
      const tags = [...(this.cardInstance?.tags ?? [])];
      if (this.cardType === CardType.EVENT) {
        tags.push(Tag.EVENT);
      }
      return tags;
    },
    rootClass(): string {
      // The same per-card class the full card carries (future art hooks
      // key off it) + a type marker for the lite body fallback.
      return 'card-' + this.name.toLowerCase().replaceAll(' ', '-');
    },
    bodyClass(): string {
      return 'con-card-lite__body--' + this.cardType;
    },
    artStyle(): Record<string, string> {
      const url = cardArtUrl(this.name);
      // Same art, same crop as the full card will use; no art → the bare
      // type-gradient face (the full card's current look), NEVER a blur-up.
      return url !== undefined ? {backgroundImage: `url(${url})`} : {};
    },
  },
});
</script>
