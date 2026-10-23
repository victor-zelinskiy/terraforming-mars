<template>
  <!-- THE MODIFIER OF INFLUENCE (T05 Event Analysts — `influenceReading.ts`): «+N» beside an influence number that
       already IS the final one, saying how much of it stands beyond the Career. Drawn only when N > 0; it never
       re-colours the number beside it; the hint names the givers. One element, one class, every host. -->
  <span v-if="reading.bonus > 0" class="con-inf-mod" :data-hint="hint" :aria-label="hint" data-inf-mod :data-inf-mod-amount="reading.bonus">+{{ reading.bonus }}</span>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {translateText} from '@/client/directives/i18n';
import {InfluenceReading} from '@/client/console/parliament/influenceReading';

/** The giver of an entry the server keeps no name for (an older save) — the Information zone's own word. */
export const INFLUENCE_OTHER_SOURCE = 'other';

/** «Сверх Карьеры: Анализ событий +1 · …» — the modifier's hint, in the sources' own order. */
export function influenceModHint(reading: InfluenceReading): string {
  const parts = reading.sources.map((entry) => `${translateText(entry.source ?? INFLUENCE_OTHER_SOURCE)} +${entry.amount}`);
  const head = translateText('beyond the Agenda track');
  return parts.length === 0 ? `${head} +${reading.bonus}` : `${head}: ${parts.join(' · ')}`;
}

export default defineComponent({
  name: 'ConsoleInfluenceMod',
  props: {
    reading: {type: Object as PropType<InfluenceReading>, required: true},
  },
  computed: {
    hint(): string {
      return influenceModHint(this.reading);
    },
  },
});
</script>
