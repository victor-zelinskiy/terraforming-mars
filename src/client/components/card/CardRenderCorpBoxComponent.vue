<template>
      <div :class="getClasses()">
          <div class="card-corporation-label">{{ label }}</div>
          <div v-for="(rowData, index) in rows[0]" :key="index">
            <CardRenderItemComponent v-if="isICardRenderItem(rowData)" :item="rowData"/>
            <CardRenderSymbolComponent v-else-if="isICardRenderSymbol(rowData)" :item="rowData" />
            <CardRenderEffectBoxComponent v-if="isICardRenderEffect(rowData)" :effectData="rowData" />
          </div>
      </div>
</template>

<script setup lang="ts">

import CardRenderItemComponent from '@/client/components/card/CardRenderItemComponent.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderSymbolComponent from '@/client/components/card/CardRenderSymbolComponent.vue';
import {isICardRenderEffect, isICardRenderItem, isICardRenderSymbol, ItemType} from '@/common/cards/render/Types';

defineOptions({name: 'CardRenderCorpBoxComponent'});
defineProps({
  rows: {
    type: Array as () => Array<Array<ItemType>>,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
});

function getClasses(): string {
  const classes: Array<string> = ['card-corporation-box'];
  return classes.join(' ');
}

</script>

