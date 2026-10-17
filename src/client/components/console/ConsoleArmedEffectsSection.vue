<template>
  <!-- «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ» in the Information mode's «ЭФФЕКТЫ»
       (TR49 class) — the armed one-play effects of the INSPECTED seat (the
       public model: a rival's are as visible as the viewer's own, the arming
       card lies face-up on their table). It stands above the effects
       explorer, the party strip's precedent: one tile per effect — the
       SOURCE card's own face, what it does to the next card, and when it
       ends. Absent when nothing is armed. -->
  <section v-if="effects.length > 0" class="con-armsec" :aria-label="$t('Armed for your next card')" data-armed-section>
    <header class="con-armsec__head">
      <span class="con-armsec__spark" aria-hidden="true">⚡</span>
      <span class="con-armsec__kicker">{{ $t('Armed for your next card') }}</span>
      <span class="con-armsec__sub">{{ $t('Spent by the next card played this generation, lost on the pass') }}</span>
    </header>
    <div class="con-armsec__row">
      <div v-for="e in effects" :key="e.key" class="con-armsec__item" :data-armed-kind="e.kind" :data-armed-source="e.source">
        <div class="con-armsec__face" aria-hidden="true">
          <ConsoleCardFaceLite :name="e.source" lightweight />
        </div>
        <div class="con-armsec__why">
          <b class="con-armsec__name">{{ $t(e.source) }}</b>
          <span class="con-armsec__formula">
            <span v-if="e.kind === 'requirementWaiver'" class="con-armed__struck" aria-hidden="true">{{ $t('Global requirements') }}</span>
            <!-- the PARTY family (TR70): the printed party plate, struck — the face's own glyph of the waiver -->
            <PremiumPartyRequirementGlyph v-else-if="e.kind === 'partyWaiver'" class="pprq--waived con-armed__pprq" />
            <span v-else class="con-armed__badge">{{ e.badge }}</span>
            {{ e.formula }}
          </span>
          <span class="con-armsec__expiry">{{ $t('One play') }} · {{ e.expiry }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ArmedEffectView, armedEffectsOf} from '@/client/console/armedEffects';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';

export default defineComponent({
  name: 'ConsoleArmedEffectsSection',
  components: {ConsoleCardFaceLite, PremiumPartyRequirementGlyph},
  props: {
    /** The INSPECTED seat (its public model). */
    player: {type: Object as PropType<Pick<PublicPlayerModel, 'armedPlayEffects'>>, required: true},
  },
  computed: {
    effects(): ReadonlyArray<ArmedEffectView> {
      return armedEffectsOf(this.player);
    },
  },
});
</script>
