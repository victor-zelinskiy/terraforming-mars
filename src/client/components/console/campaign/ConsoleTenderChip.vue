<template>
  <span class="con-tchip" :class="[`con-tchip--${status}`, `con-tchip--tier-${tier}`]"
        :data-cmap-tender="id" :data-cmap-tender-status="status">
    <!--
      A TENDER CHIP — the holding in one line wherever a title's emblem stood before (the map's rail, a podium row, the
      overview, the dossier): the name on a kant in the TIER's metal, the status as a word, never a glow. The full
      certificate is the plaque / the reader; this is its index entry.
    -->
    <i class="con-tchip__mark" aria-hidden="true"></i>
    <span class="con-tchip__name">{{ $t(nameKey) }}</span>
    <span v-if="status !== 'held'" class="con-tchip__status">{{ $t(statusKey) }}</span>
  </span>
</template>

<script setup lang="ts">
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {TenderId, TenderStatus, tenderDef, tenderNameKey} from '@/common/campaign/tenders';
import {tenderStatusKey} from '@/client/console/campaign/tenderHoldings';

defineOptions({name: 'ConsoleTenderChip'});
const props = defineProps({
  id: {type: String as PropType<TenderId>, required: true},
  status: {type: String as PropType<TenderStatus>, default: 'held'},
});

const nameKey = computed((): string => tenderNameKey(props.id));
const statusKey = computed((): string => tenderStatusKey(props.status));
const tier = computed((): string => tenderDef(props.id).tier);
</script>
