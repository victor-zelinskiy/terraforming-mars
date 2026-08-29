<template>
  <!--
    «ВЫ ПОЛУЧИТЕ» — the ONE outcome block of the Hydronetwork, whatever door
    the move came through. The player's own preview and a card's offer render
    THIS, so typography, icon scale, the «сейчас → станет» reading, the «или»
    separator and the zero-delta honesty can never fork between flows again.

    Three honest shapes, decided by the DATA:
      - an UNRESOLVED choice (options given, nothing chosen): both
        alternatives as the track prints them — never a concrete delta for a
        decision the player has not made;
      - resolved/fixed lines: per-pool before → after, a +N chip for a real
        gain, and the quiet «Без изменений» word for an honest zero (a bare
        «502 → 502» read as a concrete result of nothing);
      - abstract chips / VP where no concrete line exists.
  -->
  <div class="con-hydro__gains">
    <span class="con-hydro__section-label">{{ $t(label) }}</span>
    <template v-if="unresolved">
      <span class="con-hydro__gains-choice">
        <HydroReward :chips="options![0]" :compact="true" />
        <span class="con-hydro__stop-or">{{ $t('or') }}</span>
        <HydroReward :chips="options![1]" :compact="true" />
      </span>
    </template>
    <template v-else>
      <span v-for="(l, i) in view.lines" :key="i" class="con-hydro__delta" :class="{'con-hydro__delta--zero': l.delta === 0}">
        <span class="con-hydro__delta-ico" :class="{'con-hydro__delta-ico--prod': l.production}">
          <span class="con-hydro__delta-img" :class="iconClass(l)" aria-hidden="true"></span>
        </span>
        <span class="con-hydro__beforeafter"><b>{{ l.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydro__after">{{ l.after }}</b></span>
        <span v-if="l.delta !== 0" class="con-hydro__plus">+{{ l.delta }}</span>
        <span v-else class="con-hydro__zero">{{ $t('No change') }}</span>
      </span>
      <HydroReward v-if="view.lines.length === 0 && view.rawChips.length > 0" :chips="view.rawChips" :compact="compact" />
      <span v-if="view.vp !== undefined" class="con-hydro__vpline">
        <span class="con-hydro__stage-vp">{{ view.vp }} {{ $t('VP') }}</span>
        <span>{{ $t('VP at game end') }}</span>
      </span>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import {$t} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {HydroDeltaLine, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {HydroStage} from '@/client/components/hydronetwork/hydroStages';

export default defineComponent({
  name: 'ConsoleHydroGains',
  components: {HydroReward},
  props: {
    view: {type: Object as PropType<HydroRewardView>, required: true},
    /** The stage's alternatives — given while the choice is UNRESOLVED. */
    options: {type: Array as PropType<HydroStage['rewardOptions']>, default: undefined},
    label: {type: String, default: 'You will gain'},
    compact: {type: Boolean, default: false},
  },
  computed: {
    unresolved(): boolean {
      return this.options !== undefined && this.options.length > 1;
    },
  },
  methods: {
    $t,
    iconClass(l: HydroDeltaLine): string {
      if (l.special === 'jovian-tag') {
        return 'resource-tag tag-jovian';
      }
      if (l.special === 'animals') {
        return 'card-resource card-resource-animal';
      }
      return l.resource !== undefined ? iconClassFor(l.resource) : '';
    },
  },
});
</script>
