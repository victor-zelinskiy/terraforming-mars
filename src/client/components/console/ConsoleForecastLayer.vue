<template>
  <!--
    THE «ЭФФЕКТЫ» LAYER (R3) of a STAGE — a LEVEL inside the host, the composers'
    own: the host's work column PARKS in place (`data-forecast-browse`), the
    effects explorer in its forecast mode UNFOLDS out of the door's rect
    (`data-forecast-row`) into the host's box, B / R3 fold it back with every
    capture intact. The host positions this layer (`.con-fxlayer` is absolute
    in the host's `position: relative` column), publishes its crumb tail
    (`forecastStageText(host, …)`) and its bar (`forecastExplorerUi(host)
    .barCommands`), and routes its input here (`forecastHostIntent`).
  -->
  <transition :css="false"
              @enter="forecastFocusEnterHook"
              @leave="forecastFocusLeaveHook"
              @enter-cancelled="forecastFocusEnterCancelledHook"
              @leave-cancelled="forecastFocusLeaveCancelledHook">
    <div v-if="open" key="fx" class="con-fxlayer" data-forecast-layer>
      <div class="con-fxpanel" data-forecast-surface>
        <ConsoleEffectsExplorer ref="explorer"
                                mode="forecast"
                                :operation="operation"
                                :explorerUi="ui"
                                :forecast="forecast"
                                :cards="cards"
                                :color="color"
                                :players="players"
                                :statsByColor="statsByColor" />
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {ForecastOperation} from '@/client/console/effectForecastModel';
import {EffectForecastHost, effectForecastOpen, forecastExplorerUi} from '@/client/console/consoleEffectForecast';
import {EffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {
  forecastFocusEnterHook, forecastFocusLeaveHook, forecastFocusEnterCancelledHook, forecastFocusLeaveCancelledHook,
} from '@/client/console/consoleForecastFocusMotion';
import ConsoleEffectsExplorer, {ForecastSeat} from '@/client/components/console/ConsoleEffectsExplorer.vue';

export default defineComponent({
  name: 'ConsoleForecastLayer',
  components: {ConsoleEffectsExplorer},
  props: {
    /** The host this layer belongs to — its own cursors, its own «open». */
    host: {type: String as PropType<EffectForecastHost>, required: true},
    forecast: {type: Object as PropType<EffectForecast | undefined>, default: undefined},
    /** The viewer's tableau (live resources of own sources). */
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, default: () => []},
    color: {type: String, default: ''},
    players: {type: Array as PropType<ReadonlyArray<ForecastSeat>>, default: () => []},
    statsByColor: {type: Object as PropType<Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>>>, default: () => ({})},
    /** The WHEN answer of an immediate reaction («сразу после выполнения» for a stage's act). */
    operation: {type: String as PropType<ForecastOperation>, default: 'action'},
  },
  computed: {
    open(): boolean {
      return effectForecastOpen(this.host);
    },
    ui(): EffectsExplorerUi {
      return forecastExplorerUi(this.host);
    },
  },
  methods: {
    forecastFocusEnterHook,
    forecastFocusLeaveHook,
    forecastFocusEnterCancelledHook,
    forecastFocusLeaveCancelledHook,
    /** B inside the layer: the explorer folds its dossier first; `false` = nothing to fold, the host closes the layer. */
    consumeBack(): boolean {
      const explorer = this.$refs.explorer as InstanceType<typeof ConsoleEffectsExplorer> | undefined;
      return explorer?.consumeEffectsBack() === true;
    },
    handleIntent(intent: GamepadIntent): void {
      const explorer = this.$refs.explorer as InstanceType<typeof ConsoleEffectsExplorer> | undefined;
      explorer?.handleIntent(intent);
    },
  },
});
</script>
