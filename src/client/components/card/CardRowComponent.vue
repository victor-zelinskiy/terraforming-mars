<template>
  <CardRenderItemComponent v-if="isItem(componentData)" :item="componentData"/>
  <CardRenderSymbolComponent v-else-if="isSymbol(componentData)" :item="componentData" />
  <CardProductionBoxComponent v-else-if="isProduction(componentData)" :rows="componentData.rows" />
  <CardRenderEffectBoxComponent v-else-if="isEffect(componentData)" :effectData="componentData" />
  <CardRenderTileComponent v-else-if="isTile(componentData)" :item="componentData" />
  <CardDescription v-else-if="isDescription(componentData)" :item="componentData" />
  <CardRenderCorpBoxComponent v-else-if="isCorpBox(componentData)" :rows="componentData.rows" :label="corpBoxLabel()" />
  <div v-else>n/a</div>
</template>

<script setup lang="ts">

import {isIDescription} from '@/common/cards/render/ICardRenderDescription';
import {
  ICardRenderCorpBoxAction,
  ICardRenderCorpBoxEffect,
  ICardRenderCorpBoxEffectAction,
  isICardRenderCorpBoxAction,
  isICardRenderCorpBoxEffect,
  isICardRenderCorpBoxEffectAction,
  isICardRenderEffect,
  isICardRenderItem,
  isICardRenderProductionBox,
  isICardRenderSymbol,
  isICardRenderTile,
  ItemType,
} from '@/common/cards/render/Types';
import CardRenderItemComponent from '@/client/components/card/CardRenderItemComponent.vue';
import CardProductionBoxComponent from '@/client/components/card/CardProductionBoxComponent.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderCorpBoxComponent from '@/client/components/card/CardRenderCorpBoxComponent.vue';
import CardRenderTileComponent from '@/client/components/card/CardRenderTileComponent.vue';
import CardDescription from '@/client/components/card/CardDescription.vue';
import CardRenderSymbolComponent from '@/client/components/card/CardRenderSymbolComponent.vue';

defineOptions({name: 'CardRowComponent'});
const props = defineProps({
  componentData: {
    type: Object as () => ItemType,
    required: true,
  },
});

const isItem = isICardRenderItem;
const isSymbol = isICardRenderSymbol;
const isEffect = isICardRenderEffect;
function isDescription(componentData: ItemType): boolean {
  return typeof componentData === 'string' || componentData instanceof String || isIDescription(props.componentData);
}
const isTile = isICardRenderTile;
const isProduction = isICardRenderProductionBox;
const isCorpBoxEffect = isICardRenderCorpBoxEffect;
const isCorpBoxAction = isICardRenderCorpBoxAction;
const isCorpBoxEffectAction = isICardRenderCorpBoxEffectAction;
function isCorpBox(item: ItemType): item is ICardRenderCorpBoxEffect | ICardRenderCorpBoxAction | ICardRenderCorpBoxEffectAction {
  return isCorpBoxEffect(item) || isCorpBoxAction(item) || isCorpBoxEffectAction(item);
}
function corpBoxLabel(): string {
  if (isCorpBoxEffect(props.componentData)) {
    return 'effect';
  } else if (isCorpBoxAction(props.componentData)) {
    return 'action';
  } else if (isCorpBoxEffectAction(props.componentData)) {
    return 'effect/action';
  }
  return 'n/a';
}

</script>
