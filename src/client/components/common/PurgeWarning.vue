<template>
  <span v-if="expectedPurgeTimeMs != 0">
    <div :class="hoursLeft < 48 ? 'general-warning' : ''">
      <span>{{translateTextWithParams('Warning: This game will be purged in approximately ${0} hours.', [Math.floor(hoursLeft).toString()])}}</span>
      <a href="https://github.com/terraforming-mars/terraforming-mars/wiki/FAQ#purge" target="_blank">
        <span v-i18n>Why?</span>
      </a>
    </div>
  </span>
</template>
<script setup lang="ts">
import {translateTextWithParams} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {computed} from 'vue';

defineOptions({name: 'PurgeWarning'});
const props = defineProps({
  expectedPurgeTimeMs: {
    type: Number,
    required: true,
  },
});

const hoursLeft = computed((): number => {
  const nowMs = Date.now();
  const diffMs = props.expectedPurgeTimeMs - nowMs;
  const diffh = diffMs / 3_600_000;
  return diffh;
});
</script>
