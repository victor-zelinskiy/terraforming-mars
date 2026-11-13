<template>
        <div class="card-row">
            <CardRowComponent v-for="(componentData, i) in rowData" :componentData="componentData" :key="i" />
        </div>
</template>

<script setup vapor lang="ts">

import CardRowComponent from '@/client/components/card/CardRowComponent.vue';
import {ItemType} from '@/common/cards/render/Types';

defineOptions({name: 'CardRowData'});
defineProps({
  rowData: {
    type: Array as () => Array<ItemType>,
    required: true,
  },
});

</script>

