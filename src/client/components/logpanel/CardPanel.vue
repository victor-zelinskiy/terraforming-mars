<template>
  <div class="card-panel" v-if="message !== undefined && show">
    <AppButton size="big" type="close" :disableOnServerBusy="false" @click="hideMe" align="right"/>
    <div id="log_panel_card" class="cardbox" v-for="name in cards" :key="name">
      <Card :card="{name, isSelfReplicatingRobotsCard: isSelfReplicatingRobotsCard(name), resources: getResourcesOnCard(name)}"/>
    </div>
    <div id="log_panel_card" class="cardbox" v-for="name in globalEvents" :key="name">
      <global-event :globalEventName="name" type="prior" :showIcons="false"></global-event>
    </div>
    <div id="log_panel_card" class="cardbox" v-for="name in colonies" :key="name">
      <colony :colony="getColony(name)"></colony>
    </div>
  </div>
</template>

<script setup vapor lang="ts">

import {computed} from 'vue';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import Card from '@/client/components/card/CardFace.vue';
import GlobalEvent from '@/client/components/turmoil/GlobalEvent.vue';
import AppButton from '@/client/components/common/AppButton.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';

defineOptions({name: 'log-panel'});
const props = defineProps({
  message: {
    type: Object as () => LogMessage,
    required: true,
  },
  players: {
    type: Array as () => Array<PublicPlayerModel>,
    required: true,
  },
});
const emit = defineEmits(['hide']);

const show = computed((): boolean => {
  return cards.value.length + globalEvents.value.length + colonies.value.length > 0;
});
const cards = computed((): ReadonlyArray<CardName> => {
  return props.message.data
    .filter((datum) => datum.type === LogMessageDataType.CARD || datum.type === LogMessageDataType.CARDS)
    .flatMap((datum) => datum.type === LogMessageDataType.CARD ? [datum.value] : datum.value);
});
const globalEvents = computed((): Array<GlobalEventName> => {
  return props.message.data.filter((datum) => datum.type === LogMessageDataType.GLOBAL_EVENT).map((datum) => datum.value);
});
const colonies = computed((): Array<ColonyName> => {
  return props.message.data.filter((datum) => datum.type === LogMessageDataType.COLONY).map((datum) => datum.value);
});
function hideMe() {
  emit('hide');
}
function getColony(name: ColonyName): ColonyModel {
  return simpleColonyModel(name);
}
function isSelfReplicatingRobotsCard(cardName: CardName) {
  for (const player of props.players) {
    if (player.selfReplicatingRobotsCards.some((card) => card.name === cardName)) {
      return true;
    }
  }
  return false;
}
function getResourcesOnCard(cardName: CardName) {
  for (const player of props.players) {
    const playedCard = player.tableau.find((card) => card.name === cardName);
    if (playedCard !== undefined) {
      return playedCard.resources;
    }
    const srrCard = player.selfReplicatingRobotsCards.find((card) => card.name === cardName);
    if (srrCard !== undefined) {
      return srrCard.resources;
    }
  }

  return undefined;
}

</script>
