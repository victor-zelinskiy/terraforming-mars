<template>
  <!-- THE VENUS BONUS — THE INNER PRE-SELECT (P89 · ledger EM), standing on the SHARED wild-resource choice since P43
       (ledger EO — `ConsoleWildChoiceStep`, one composition for every «a standard resource OR a resource on a card»).
       This wrapper only states the bonus: its head («Бонус Венеры · Шкала Венеры a → b %»), the 30 % finish's title, the
       specification (`venusWildSpec` — the base always laid out, the OR only where it is really taken, the grid a dial)
       and the candidates' live models. Every host (the play sheet, the blue action's setup, the colony trade's stage)
       mounts THIS, so the three can never draw the bonus differently. -->
  <ConsoleWildChoiceStep :spec="spec" :parts="parts" :focus="focus" :stock="stock" venus
                         :head="{title: 'Venus bonus', reading: stepReading}" or-title="Final step · 30 %"
                         :candidates="candidates" />
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel, VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import ConsoleWildChoiceStep from '@/client/components/console/foundation/ConsoleWildChoiceStep.vue';
import {VenusBonusParts, venusBonusMetaOf, venusStepReading, venusWildCandidates} from '@/client/console/venusBonus/venusBonusPreselect';
import {VenusInnerFocus, venusWildSpec} from '@/client/console/venusBonus/venusBonusInner';
import {WildChoiceSpec} from '@/client/console/wildChoice/wildChoiceInner';

export default defineComponent({
  name: 'ConsoleVenusBonusStep',
  components: {ConsoleWildChoiceStep},
  props: {
    /** The step's own prompt model (`ActionPreviewStep` `venusBonus`). */
    input: {type: Object as PropType<PlayerInputModel>, required: true},
    parts: {type: Object as PropType<VenusBonusParts>, required: true},
    focus: {type: Object as PropType<VenusInnerFocus>, required: true},
    /** The player's stock per standard resource — «current → resulting». */
    stock: {type: Object as PropType<Partial<Record<string, number>>>, default: () => ({})},
  },
  computed: {
    meta(): VenusBonusPromptMeta | undefined {
      return venusBonusMetaOf(this.input);
    },
    stepReading(): string {
      return venusStepReading(this.meta);
    },
    spec(): WildChoiceSpec {
      return this.meta === undefined ?
        {holders: [], amount: () => 0, exclusive: false, lanes: 'dial'} :
        venusWildSpec(this.meta);
    },
    candidates(): ReadonlyArray<CardModel> {
      return venusWildCandidates(this.input) ?? [];
    },
  },
});
</script>
