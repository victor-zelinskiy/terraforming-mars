<!--
@console-shared LIVE — console native stands on this file, so it is NOT covered
by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
-->
<template>
  <!--
    CARD FACE FACADE — the ONE routing point onto the premium card renderer.
    EVERY card type renders premium since desktop-removal wave 4 (projects +
    preludes + corporations + standard projects/actions + CEOs; the scope
    gate stays premiumCardTheme.isPremiumFaceType). Legacy Card.vue is
    DELETED — this facade remains because 30+ hosts import it as `Card`
    (the stable host contract), and because an unknown/unregistered card
    name must keep rendering NOTHING rather than crash a host.
  -->
  <PremiumCard v-if="premium"
               :card="card"
               :actionUsed="actionUsed"
               :robotCard="robotCard"
               :cubeColor="cubeColor"
               :autoTall="autoTall"
               :lightweight="lightweight"
               :artTier="artTier"
               :inert="inert">
    <slot/>
  </PremiumCard>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardArtTier} from '@/client/cards/cardArt';
import {Color} from '@/common/Color';
import {getCard} from '@/client/cards/ClientCardManifest';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';

export default defineComponent({
  name: 'CardFace',
  components: {PremiumCard},
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
    // hidden cards never touch the zoom mechanism.
    inert: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** Art resolution tier (cardArt.ts) — dense grids pass 'thumb'. */
    artTier: {
      type: String as () => CardArtTier,
      required: false,
      default: 'full',
    },
  },
  computed: {
    /** False only for an unknown/unregistered card name — render nothing. */
    premium(): boolean {
      const type = getCard(this.card.name)?.type;
      return type !== undefined && isPremiumFaceType(type);
    },
  },
});
</script>
