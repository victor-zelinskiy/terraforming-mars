<template>
  <!--
    Premium replacement for the legacy ShiftAresGlobalParameters (Butterfly
    Effect — "move each hazard marker up to 1 step up or down"). Hosted inside
    MandatoryInputModal via ModalInputHost. One row per AVAILABLE planetary
    threshold: a diegetic icon + label, a live `current → resulting` threshold
    preview, and a −1 / 0 / +1 segmented control. Diegetic & expansion-neutral
    (no "Ares" in the UI). Submission is byte-identical to the legacy widget:
    {type:'aresGlobalParameters', response:{lowOceanDelta, highOceanDelta,
    temperatureDelta, oxygenDelta}} (all four always sent; 0 for hidden rows).
  -->
  <div class="modal-input modal-input--ares-shift">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title" v-i18n>Shift the planetary event thresholds</h3>
    </header>
    <p class="modal-input__ares-help" v-i18n>Move each planetary threshold up to 1 step up or down.</p>

    <div class="modal-input__ares-rows">
      <div v-for="row in rows" :key="row.deltaKey" class="modal-input__ares-row" :data-test="'ares-row-' + row.deltaKey">
        <div class="modal-input__ares-id">
          <span class="modal-input__option-icon modal-input__ares-icon" :class="row.iconClass" aria-hidden="true"></span>
          <span class="modal-input__ares-label" v-i18n>{{ row.label }}</span>
        </div>

        <div class="modal-input__ares-preview">
          <span class="modal-input__ares-from">{{ row.threshold }}{{ row.unit }}</span>
          <span class="modal-input__ares-arrow" aria-hidden="true">→</span>
          <span class="modal-input__ares-to" :class="{'modal-input__ares-to--changed': row.delta !== 0}">{{ row.resulting }}{{ row.unit }}</span>
        </div>

        <div class="modal-input__ares-seg" role="group">
          <button v-for="opt in OPTIONS" :key="opt"
                  type="button"
                  class="modal-input__ares-seg-btn"
                  :class="{'modal-input__ares-seg-btn--active': row.delta === opt}"
                  :data-test="'ares-seg-' + row.deltaKey + '-' + opt"
                  @click="setDelta(row.deltaKey, opt)">{{ segLabel(opt) }}</button>
        </div>
      </div>
    </div>

    <div v-if="!controlled" class="modal-input__actions">
      <button class="modal-input__primary-btn" @click="confirm" data-test="ares-shift-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ShiftAresGlobalParametersModel} from '@/common/models/PlayerInputModel';
import {ShiftAresGlobalParametersResponse} from '@/common/inputs/InputResponse';
import {AresGlobalParametersResponse} from '@/common/inputs/AresGlobalParametersResponse';
import {HazardData} from '@/common/ares/AresData';
import {translateText} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

type DeltaKey = keyof AresGlobalParametersResponse;
type DeltaValue = -1 | 0 | 1;

type DataModel = {
  lowOceanDelta: DeltaValue;
  highOceanDelta: DeltaValue;
  temperatureDelta: DeltaValue;
  oxygenDelta: DeltaValue;
  OPTIONS: ReadonlyArray<DeltaValue>;
};

type Row = {
  deltaKey: DeltaKey;
  iconClass: string;
  label: string;
  unit: string;
  threshold: number;
  stepSize: number; // °C moves 2 per step; oceans / oxygen move 1
  delta: number;
  resulting: number;
};

export default defineComponent({
  name: 'ModernShiftAresGlobalParameters',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => ShiftAresGlobalParametersModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: ShiftAresGlobalParametersResponse) => void,
      required: true,
    },
    controlled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
  data(): DataModel {
    return {
      lowOceanDelta: 0,
      highOceanDelta: 0,
      temperatureDelta: 0,
      oxygenDelta: 0,
      OPTIONS: [-1, 0, 1],
    };
  },
  computed: {
    hazardData(): HazardData {
      return this.playerinput.aresData.hazardData;
    },
    buttonText(): string {
      return translateText(this.playerinput.buttonLabel);
    },
    // One row per AVAILABLE threshold, in the legacy order.
    rows(): ReadonlyArray<Row> {
      const h = this.hazardData;
      const defs: Array<Omit<Row, 'resulting'>> = [];
      if (h.erosionOceanCount.available) {
        defs.push({deltaKey: 'lowOceanDelta', iconClass: iconClassFor('ocean'), label: 'Erosions appear', unit: '', threshold: h.erosionOceanCount.threshold, stepSize: 1, delta: this.lowOceanDelta});
      }
      if (h.removeDustStormsOceanCount.available) {
        defs.push({deltaKey: 'highOceanDelta', iconClass: iconClassFor('ocean'), label: 'Dust storms recede', unit: '', threshold: h.removeDustStormsOceanCount.threshold, stepSize: 1, delta: this.highOceanDelta});
      }
      if (h.severeErosionTemperature.available) {
        defs.push({deltaKey: 'temperatureDelta', iconClass: iconClassFor('temperature'), label: 'Erosions intensify', unit: '°C', threshold: h.severeErosionTemperature.threshold, stepSize: 2, delta: this.temperatureDelta});
      }
      if (h.severeDustStormOxygen.available) {
        defs.push({deltaKey: 'oxygenDelta', iconClass: iconClassFor('oxygen'), label: 'Dust storms intensify', unit: '%', threshold: h.severeDustStormOxygen.threshold, stepSize: 1, delta: this.oxygenDelta});
      }
      return defs.map((d) => ({...d, resulting: d.threshold + d.delta * d.stepSize}));
    },
    response(): AresGlobalParametersResponse {
      return {
        lowOceanDelta: this.lowOceanDelta,
        highOceanDelta: this.highOceanDelta,
        temperatureDelta: this.temperatureDelta,
        oxygenDelta: this.oxygenDelta,
      };
    },
  },
  mounted(): void {
    this.emitControlled();
  },
  methods: {
    segLabel(opt: number): string {
      return opt > 0 ? `+${opt}` : opt < 0 ? `−${Math.abs(opt)}` : '0';
    },
    setDelta(key: DeltaKey, value: DeltaValue): void {
      this[key] = value;
      this.emitControlled();
    },
    confirm(): void {
      this.onsave({type: 'aresGlobalParameters', response: this.response});
    },
    emitControlled(): void {
      if (this.controlled) {
        this.$emit('change', {type: 'aresGlobalParameters', response: this.response});
      }
    },
  },
});
</script>
