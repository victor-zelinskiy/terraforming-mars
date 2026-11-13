<template>
  <span v-if="reading.bonus > 0" class="con-inf-mod" :data-hint="hint" :aria-label="hint" data-inf-mod :data-inf-mod-amount="reading.bonus">+{{ reading.bonus }}</span>
</template>
<script setup vapor lang="ts">
/*
 * THE MODIFIER OF INFLUENCE (T05 Event Analysts — `influenceReading.ts`): «+N» beside an influence number that
 *       already IS the final one, saying how much of it stands beyond the Career. Drawn only when N > 0; it never
 *       re-colours the number beside it; the hint names the givers. One element, one class, every host.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, PropType} from 'vue';
import {InfluenceReading} from '@/client/console/parliament/influenceReading';
import {influenceModHint} from '@/client/components/console/parliament/consoleInfluenceModModel';

defineOptions({name: 'ConsoleInfluenceMod'});
const props = defineProps({
  reading: {type: Object as PropType<InfluenceReading>, required: true},
});

const hint = computed((): string => {
  return influenceModHint(props.reading);
});
</script>
