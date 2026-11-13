<template>
  <div :class="klass">
    <div class="card-container global-event-container">
      <div class="card-content-wrapper" v-i18n>
        <CardParty class="card-party--revealed" :party="revealed" />
        <CardParty class="card-party--current" :party="current" />
        <div class="global-event-title"><span class="global-event-name">{{globalEventName}}</span></div>
        <div class="card-content global-event-card-content">
          <CardRenderData v-if="renderData !== undefined" :renderData="renderData" />
          <CardDescription :item='description' />
        </div>
      </div>
    </div>
    <span v-if="showDistance" class="global-event-distance" v-i18n>{{ type }}</span>
    <slot/>
  </div>
</template>

<script setup lang="ts">

import {computed, ref} from 'vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import CardParty from '@/client/components/card/CardParty.vue';
import {IClientGlobalEvent} from '@/common/turmoil/IClientGlobalEvent';
import {getGlobalEvent} from '@/client/turmoil/ClientGlobalEventManifest';
import CardDescription from '@/client/components/card/CardDescription.vue';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';
import {vI18n} from '@/client/directives/vDirectives';

export type RenderType = 'coming' | 'current' | 'distant' | 'prior';

defineOptions({name: 'global-event'});
const props = defineProps({
  globalEventName: {
    type: String as () => GlobalEventName,
    required: true,
  },
  type: {
    type: String as () => RenderType,
    required: true,
  },
  showDistance: {
    type: Boolean,
    default: false,
  },
});

const globalEvent: IClientGlobalEvent | undefined = getGlobalEvent(props.globalEventName);
if (globalEvent === undefined) {
  throw new Error(`Can't find card ${props.globalEventName}`);
}

const renderData = ref(globalEvent.renderData);
const revealed = ref(globalEvent.revealedDelegate);
const current = ref(globalEvent.currentDelegate);
const description = ref(globalEvent.description);
const klass = computed((): string => {
  const common = 'global-event global-event--' + props.type;
  if (props.showDistance) {
    return common + ' global-event--show-distance';
  }
  return common;
});

</script>
