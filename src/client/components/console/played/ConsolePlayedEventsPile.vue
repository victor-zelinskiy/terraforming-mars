<template>
  <!--
    The FACE-DOWN events pile — per the printed rules, played events lie
    rubашкой вверх in one stack. Shows the canonical sleeve art, a physical
    thickness (up to three offset backs), the count, and an «открыть» hint
    when focused. ONE focus target for the whole stack; activating it opens
    the nested events list.
  -->
  <div class="con-played__pile con-played__pile--events" :style="{width: slotW + 'px'}">
    <div class="con-played__slot con-played__slot--events"
         :class="{'con-played__slot--focused': focused}"
         :style="{height: cardH + 'px'}"
         :data-played-key="EVENTS_PILE_KEY"
         @click="$emit('open')">
      <div class="con-played__lift">
        <div class="con-played__backstack con-played__focusbox" :style="{height: cardH + 'px'}">
          <div v-if="count > 2" class="con-card-back con-played__back con-played__back--3" aria-hidden="true"></div>
          <div v-if="count > 1" class="con-card-back con-played__back con-played__back--2" aria-hidden="true"></div>
          <div class="con-card-back con-played__back con-played__back--1" aria-hidden="true"></div>
          <span class="con-played__events-count">{{ count }}</span>
        </div>
        <span class="con-played__events-hint" v-i18n>Open</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {EVENTS_PILE_KEY} from '@/client/components/console/consolePlayedModel';

export default defineComponent({
  name: 'ConsolePlayedEventsPile',
  props: {
    count: {type: Number, required: true},
    focused: {type: Boolean, required: true},
    slotW: {type: Number, required: true},
    cardH: {type: Number, required: true},
  },
  emits: {
    open: () => true,
  },
  data() {
    return {EVENTS_PILE_KEY};
  },
});
</script>
