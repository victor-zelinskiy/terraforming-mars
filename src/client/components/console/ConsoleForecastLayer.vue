<template>
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
                                :branches="branches"
                                :cards="cards"
                                :color="color"
                                :players="players"
                                :statsByColor="statsByColor" />
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
/*
 * THE «ЭФФЕКТЫ» LAYER (R3) of a STAGE — a LEVEL inside the host, the composers'
 * own: the host's work column PARKS in place (`data-forecast-browse`), the
 * effects explorer in its forecast mode UNFOLDS out of the door's rect
 * (`data-forecast-row`) into the host's box, B / R3 fold it back with every
 * capture intact. The host positions this layer (`.con-fxlayer` is absolute
 * in the host's `position: relative` column), publishes its crumb tail
 * (`forecastStageText(host, …)`) and its bar (`forecastExplorerUi(host)
 * .barCommands`), and routes its input here (`forecastHostIntent`).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType, useTemplateRef} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {ForecastBranchInfo, ForecastOperation} from '@/client/console/effectForecastModel';
import {EffectForecastHost, effectForecastOpen, forecastExplorerUi} from '@/client/console/consoleEffectForecast';
import {EffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {
  forecastFocusEnterHook, forecastFocusLeaveHook, forecastFocusEnterCancelledHook, forecastFocusLeaveCancelledHook,
} from '@/client/console/consoleForecastFocusMotion';
import ConsoleEffectsExplorer, {ForecastSeat} from '@/client/components/console/ConsoleEffectsExplorer.vue';

defineOptions({name: 'ConsoleForecastLayer'});
const props = defineProps({
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
  /** The branches a host's «depends» facts are titled by (a prelude's unchosen variant — P65 · GH). */
  branches: {type: Array as PropType<ReadonlyArray<ForecastBranchInfo>>, default: () => []},
});

const explorer = useTemplateRef<InstanceType<typeof ConsoleEffectsExplorer>>('explorer');
const open = computed((): boolean => {
  return effectForecastOpen(props.host);
});
const ui = computed((): EffectsExplorerUi => {
  return forecastExplorerUi(props.host);
});
/** B inside the layer: the explorer folds its dossier first; `false` = nothing to fold, the host closes the layer. */
function consumeBack(): boolean {
  const explorerNow = explorer.value;
  return explorerNow?.consumeEffectsBack() === true;
}
function handleIntent(intent: GamepadIntent): void {
  const explorerNow = explorer.value;
  explorerNow?.handleIntent(intent);
}

// What the six hosts reach through their `ref="forecastLayer"` (`forecastHostIntent` — `ForecastLayerHandle`).
defineExpose({consumeBack, handleIntent});
</script>
