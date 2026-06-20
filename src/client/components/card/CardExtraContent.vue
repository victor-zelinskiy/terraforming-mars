<template>
    <div class="card-extra-content-container">
      <!-- The legacy "little green men" alien sprite (Search for Life with a
           resource) was removed fork-wide: it covered the card art and read as an
           out-of-place placeholder. The science-resource counter already conveys
           "life found". -->
      <div v-if="isMiningTileOnSteel()" class="mined-metal mined-steel" />
      <div v-if="isMiningTileOnTitanium()" class="mined-metal mined-titanium" />
    </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';

export default defineComponent({
  name: 'CardExtraContent',
  props: {
    card: {
      type: Object as () => CardModel,
      required: true,
    },
  },
  methods: {
    isMiningTileOnSteel() {
      return this.card.name !== CardName.SPECIALIZED_SETTLEMENT && this.card.bonusResource?.includes(Resource.STEEL);
    },
    isMiningTileOnTitanium() {
      return this.card.name !== CardName.SPECIALIZED_SETTLEMENT && this.card.bonusResource?.includes(Resource.TITANIUM);
    },
  },
});

</script>

