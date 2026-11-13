<template>
  <div v-if="globalEvent !== undefined" :class="klass">
    <div class="card-container global-event-container">
      <div class="card-content-wrapper" v-i18n>
        <CardParty class="card-party--revealed" :party="globalEvent.revealedDelegate" />
        <CardParty class="card-party--current" :party="globalEvent.currentDelegate" />
        <div class="global-event-title"><span class="global-event-name">{{globalEventName}}</span></div>
        <div class="card-content global-event-card-content">
          <CardRenderData v-if="globalEvent.renderData !== undefined" :renderData="globalEvent.renderData" />
          <CardDescription :item='globalEvent.description' />
        </div>
      </div>
    </div>
    <span v-if="showDistance" class="global-event-distance" v-i18n>{{ type }}</span>
    <slot/>
  </div>
</template>

<script setup lang="ts">

import {computed, onMounted} from 'vue';
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

// The event is read ONCE, at set-up (a host re-keys the card to show another).
//
// An event the client's manifest does not know (a client older than the server's deck) is a DATA error: it is REPORTED
// to the app's error handler — once, from the mount — and the card renders NOTHING (the root's `v-if`). It is never
// thrown from the set-up: what a throwing set-up leaves behind is each runtime's own business — the virtual DOM
// renders nothing, a Vapor component of a development build goes on to render its template without its bindings, and
// under a virtual-DOM parent the interop fails that parent's patch with a second error. The guard is the component's.
const globalEvent: IClientGlobalEvent | undefined = getGlobalEvent(props.globalEventName);
if (globalEvent === undefined) {
  onMounted(() => {
    throw new Error(`Can't find card ${props.globalEventName}`);
  });
}
const klass = computed((): string => {
  const common = 'global-event global-event--' + props.type;
  if (props.showDistance) {
    return common + ' global-event--show-distance';
  }
  return common;
});

</script>
