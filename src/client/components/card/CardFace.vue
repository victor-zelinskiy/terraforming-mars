<template>
  <!--
    CARD FACE FACADE — the ONE routing point between the premium card
    renderer (project cards + preludes; scope gate = isPremiumFaceType) and
    the legacy renderer (corporations / CEOs / standard projects until their
    own premium pass).

    ZERO visual logic lives here: both branches are architecturally
    independent renderers receiving the SAME host contract (the legacy
    <Card> prop set). Hosts import THIS component (registered as `Card`),
    so widening the premium scope later never touches a host again.
  -->
  <PremiumCard v-if="premium"
               :card="card"
               :actionUsed="actionUsed"
               :robotCard="robotCard"
               :cubeColor="cubeColor"
               :autoTall="autoTall"
               :lightweight="lightweight"
               :inert="inert">
    <slot/>
  </PremiumCard>
  <Card v-else
        :card="card"
        :actionUsed="actionUsed"
        :robotCard="robotCard"
        :cubeColor="cubeColor"
        :autoTall="autoTall"
        :lightweight="lightweight"
        :inert="inert">
    <slot/>
  </Card>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {Color} from '@/common/Color';
import {getCard} from '@/client/cards/ClientCardManifest';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import Card from './Card.vue';

export default defineComponent({
  name: 'CardFace',
  components: {PremiumCard, Card},
  props: {
    card: {
      type: Object as () => CardModel,
      required: true,
    },
    actionUsed: {
      type: Boolean,
      required: false,
      default: false,
    },
    robotCard: {
      type: Object as () => CardModel | undefined,
      required: false,
      default: undefined,
    },
    cubeColor: {
      type: String as () => Color,
      required: false,
      default: 'neutral',
    },
    autoTall: {
      type: Boolean,
      required: false,
      default: false,
    },
    lightweight: {
      type: Boolean,
      required: false,
      default: false,
    },
    // Fully passive render (no click→fullscreen). Used by the boot warm-up so its
    // hidden cards never touch the zoom mechanism. PremiumCard already honours it;
    // Card (legacy) now does too.
    inert: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  computed: {
    premium(): boolean {
      const type = getCard(this.card.name)?.type;
      return type !== undefined && isPremiumFaceType(type);
    },
  },
});
</script>
