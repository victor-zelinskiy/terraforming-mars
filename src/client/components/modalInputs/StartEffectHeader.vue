<template>
  <!--
    Hero header for a START-OF-GAME effect (a corporation's or prelude's initial
    effect). Shown ABOVE the hosted input inside MandatoryInputModal when the
    server tagged the top-level prompt with `source` (see StartEffectSource).
    Turns a bare "select X" into a "your corporation / prelude enters play"
    moment: the source card preview + a labelled accent. Click the card to open
    it fullscreen.
  -->
  <div class="start-effect-header" :class="'start-effect-header--' + source.kind">
    <span class="start-effect-header__accent" aria-hidden="true"></span>
    <div class="start-effect-header__card" @click="openZoom" :data-test="'start-effect-card'">
      <Card :card="cardModel" />
    </div>
    <div class="start-effect-header__text">
      <span class="start-effect-header__kind">{{ kindLabel }}</span>
      <span class="start-effect-header__name">{{ cardLabel }}</span>
    </div>

    <CardZoomModal v-if="zoomOpen"
                   ref="zoom"
                   :card="cardModel"
                   @close="zoomOpen = false" />
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {StartEffectSource} from '@/common/models/PlayerInputModel';
import {translateText} from '@/client/directives/i18n';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

type DataModel = {
  zoomOpen: boolean;
};

export default defineComponent({
  name: 'StartEffectHeader',
  components: {Card, CardZoomModal},
  props: {
    source: {
      type: Object as () => StartEffectSource,
      required: true,
    },
  },
  data(): DataModel {
    return {zoomOpen: false};
  },
  computed: {
    cardModel(): CardModel {
      return {name: this.source.card};
    },
    kindLabel(): string {
      return translateText(this.source.kind === 'corporation' ? 'Corporation start effect' : 'Prelude start effect');
    },
    cardLabel(): string {
      return translateText(this.source.card);
    },
  },
  methods: {
    openZoom(): void {
      this.zoomOpen = true;
      nextTick(() => {
        (this.$refs.zoom as InstanceType<typeof CardZoomModal> | undefined)?.show();
      });
    },
  },
});
</script>
