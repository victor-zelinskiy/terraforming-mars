<template>
  <!--
    One SOURCE group. The source (card / corporation) is named ONCE in a light
    auxiliary label; EACH passive effect it grants is its OWN bordered, hoverable
    block (one effect = one block — grouping is only a soft visual bracket, never
    a single merged block, so future per-effect features like "last triggered"
    stay cleanly per-effect). Each effect reuses the card's own render wrapped in
    a bare `.card-container` (so the card-scoped icon sprites render) + `v-i18n`
    (so plate text like "СТАНДАРТНЫЕ ПРОЕКТЫ" is localized, mirroring Card.vue's
    `card-content-wrapper`). Hover/click are emitted up (with the hovered block's
    rect) so the OVERLAY owns one shared source-card popover + fullscreen viewer.
  -->
  <div class="effect-group"
       :class="{
         'effect-group--corp': group.isCorporation,
         'effect-group--disabled': group.isDisabled,
         'effect-group--selected': group.cardName === selectedKey,
       }"
       :data-test="'effect-block-' + group.key">
    <div class="effect-group__label">
      <span class="effect-group__accent" aria-hidden="true"></span>
      <span class="effect-group__source" v-i18n>{{ group.cardName }}</span>
      <span class="effect-group__type" aria-hidden="true">
        <span v-if="group.isCorporation" v-i18n>Corporation</span>
        <span v-else v-i18n>Card</span>
      </span>
    </div>
    <div class="effect-group__items">
      <div v-for="eff in group.effects"
           :key="eff.key"
           class="effect-item"
           tabindex="0"
           role="button"
           @mouseenter="onEnter"
           @mouseleave="onLeave"
           @focus="onEnter"
           @blur="onLeave"
           @click="onClick"
           @keydown.enter="onClick"
           :data-test="'effect-item-' + eff.key">
        <div v-if="eff.effectNode !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
          <CardRenderEffectBoxComponent :effectData="eff.effectNode" />
        </div>
        <div v-else-if="eff.renderRoot !== undefined" class="effect-item__render card-container" v-i18n v-strip-effect-prefix>
          <CardRenderData :renderData="eff.renderRoot" />
          <div v-if="eff.text" class="effect-item__desc">(<span v-i18n>{{ eff.text }}</span>)</div>
        </div>
        <div v-else class="effect-item__text" v-i18n v-strip-effect-prefix>{{ eff.text }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {EffectGroup} from '@/client/components/effects/effectExtraction';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import {stripEffectPrefix} from '@/client/directives/stripEffectPrefix';

export default defineComponent({
  name: 'EffectBlock',
  components: {CardRenderEffectBoxComponent, CardRenderData},
  directives: {stripEffectPrefix},
  props: {
    group: {
      type: Object as PropType<EffectGroup>,
      required: true,
    },
    // The selected source card name (master-detail) — highlights this group.
    selectedKey: {
      type: String as PropType<CardName>,
      default: undefined,
    },
  },
  emits: ['namehover', 'open'],
  methods: {
    onEnter(e: MouseEvent | FocusEvent): void {
      const el = e.currentTarget as HTMLElement | null;
      if (el === null) {
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
