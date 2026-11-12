<template>
  <div class="card-rows">
    <CardRowData v-for="(cardData, i) in renderData.rows" :rowData="cardData" :key="i" />
  </div>
</template>

<script setup lang="ts">

import {ICardRenderRoot} from '@/common/cards/render/Types';
import CardRowData from '@/client/components/card/CardRowData.vue';

defineOptions({name: 'CardRenderData'});
defineProps({
  renderData: {
    type: Object as () => ICardRenderRoot,
    required: true,
  },
});

</script>

