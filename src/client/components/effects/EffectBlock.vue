<template>
  <!--
    One SOURCE group = one premium block. The source (card / corporation) is
    named ONCE in the header (colour-accented by type); EACH passive effect it
    grants is a separate sub-block underneath (so "this card gave several
    effects" reads clearly, with no name duplication). Each effect reuses the
    card's own render (graphic + localized "ЭФФЕКТ: …") via
    CardRenderEffectBoxComponent — wrapped in a bare `.card-container` so the
    card-scoped icon CSS (`.card-container .card-resource`, tags, …) applies and
    the sprite icons actually render. Hover/click are emitted up so the OVERLAY
    owns a single shared source-card popover + fullscreen viewer.
  -->
  <div class="effect-block"
       :class="{
         'effect-block--corp': group.isCorporation,
         'effect-block--disabled': group.isDisabled,
       }"
       ref="block"
       tabindex="0"
       role="button"
       @mouseenter="onEnter"
       @mouseleave="onLeave"
       @focus="onEnter"
       @blur="onLeave"
       @click="onClick"
       @keydown.enter="onClick"
       :data-test="'effect-block-' + group.key">
    <div class="effect-block__head">
      <span class="effect-block__accent" aria-hidden="true"></span>
      <span class="effect-block__source" v-i18n>{{ group.cardName }}</span>
      <span class="effect-block__type" aria-hidden="true">
        <span v-if="group.isCorporation" v-i18n>Corporation</span>
        <span v-else v-i18n>Card</span>
      </span>
    </div>
    <div class="effect-block__effects">
      <div v-for="eff in group.effects" :key="eff.key" class="effect-block__effect">
        <div v-if="eff.effectNode !== undefined" class="effect-block__render card-container">
          <CardRenderEffectBoxComponent :effectData="eff.effectNode" />
        </div>
        <div v-else class="effect-block__text" v-i18n>{{ eff.text }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {EffectGroup} from '@/client/components/effects/effectExtraction';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';

export default defineComponent({
  name: 'EffectBlock',
  components: {CardRenderEffectBoxComponent},
  props: {
    group: {
      type: Object as PropType<EffectGroup>,
      required: true,
    },
  },
  emits: ['namehover', 'open'],
  methods: {
    onEnter(): void {
      const el = this.$refs.block as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      this.$emit('namehover', {name: this.group.cardName as CardName, rect: el.getBoundingClientRect()});
    },
    onLeave(): void {
      this.$emit('namehover', null);
    },
    onClick(): void {
      this.$emit('open', this.group.cardName as CardName);
    },
  },
});
</script>
