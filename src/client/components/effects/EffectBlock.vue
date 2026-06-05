<template>
  <!--
    One passive effect = one premium block. Header identifies the SOURCE (card /
    corporation, colour-accented by type); the body reuses the card's own effect
    render (graphic + localized "ЭФФЕКТ: …" description) via the existing
    CardRenderEffectBoxComponent — or a text fallback for edge-case overrides.
    Hover/focus + click are emitted up so the OVERLAY owns a single source-card
    popover + fullscreen viewer (cheap — no per-block popover).
  -->
  <div class="effect-block"
       :class="{
         'effect-block--corp': entry.isCorporation,
         'effect-block--disabled': entry.isDisabled,
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
       :data-test="'effect-block-' + entry.key">
    <div class="effect-block__head">
      <span class="effect-block__accent" aria-hidden="true"></span>
      <span class="effect-block__source" v-i18n>{{ entry.cardName }}</span>
      <span class="effect-block__type" aria-hidden="true">
        <span v-if="entry.isCorporation" v-i18n>Corporation</span>
        <span v-else v-i18n>Card</span>
      </span>
    </div>
    <div class="effect-block__body">
      <CardRenderEffectBoxComponent v-if="entry.effectNode !== undefined"
                                    :effectData="entry.effectNode" />
      <div v-else class="effect-block__text" v-i18n>{{ entry.text }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {EffectEntry} from '@/client/components/effects/effectExtraction';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';

export default defineComponent({
  name: 'EffectBlock',
  components: {CardRenderEffectBoxComponent},
  props: {
    entry: {
      type: Object as PropType<EffectEntry>,
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
      this.$emit('namehover', {name: this.entry.cardName as CardName, rect: el.getBoundingClientRect()});
    },
    onLeave(): void {
      this.$emit('namehover', null);
    },
    onClick(): void {
      this.$emit('open', this.entry.cardName as CardName);
    },
  },
});
</script>
