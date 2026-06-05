<template>
  <!--
    Premium replacement for the legacy SelectProductionToLose (choose which
    production to decrease to pay a cost). Hosted inside MandatoryInputModal
    via ModalInputHost. Per-resource steppers (only the resources the player
    can actually deduct are shown), constrained so the running total can't
    exceed the available production; confirm unlocks at exactly `cost`.

    Submission is byte-identical to SelectProductionToLose.vue:
      {type: 'productionToLose', units}.
  -->
  <div class="modal-input modal-input--production-to-lose">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div class="modal-input__subtitle" v-i18n>Which resource production would you prefer to decrease?</div>

    <div class="modal-input__dist">
      <div v-for="unit in deductibleUnits" :key="unit"
           class="modal-input__dist-row"
           :class="{'modal-input__dist-row--active': units[unit] > 0}">
        <span class="modal-input__dist-id">
          <span class="modal-input__prod-frame">
            <span class="resource_icon" :class="'resource_icon--' + unit"></span>
          </span>
          <span class="modal-input__dist-name">{{ resourceName(unit) }}</span>
        </span>
        <span class="modal-input__dist-controls">
          <button class="modal-input__step-btn"
                  :disabled="units[unit] <= 0"
                  @click="step(unit, -1)"
                  :data-test="'modern-ptl-dec-' + unit">−</button>
          <span class="modal-input__step-value modal-input__step-value--sm"
                :data-test="'modern-ptl-value-' + unit">{{ units[unit] }}</span>
          <button class="modal-input__step-btn"
                  :disabled="total >= cost || units[unit] >= maxFor(unit)"
                  @click="step(unit, 1)"
                  :data-test="'modern-ptl-inc-' + unit">+</button>
        </span>
      </div>
    </div>

    <div class="modal-input__dist-counter"
         :class="{'modal-input__dist-counter--complete': total === cost}">
      <span class="modal-input__dist-counter-text">{{ counterText }}</span>
    </div>

    <div class="modal-input__actions">
      <button class="modal-input__primary-btn"
              :disabled="total !== cost"
              @click="confirm"
              data-test="modern-ptl-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectProductionToLoseModel} from '@/common/models/PlayerInputModel';
import {SelectProductionToLoseResponse} from '@/common/inputs/InputResponse';
import {Units} from '@/common/Units';
import {sum} from '@/common/utils/utils';
import {translateText, translateMessage} from '@/client/directives/i18n';

type DataModel = {
  units: Units;
};

export default defineComponent({
  name: 'ModernProductionToLose',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectProductionToLoseModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectProductionToLoseResponse) => void,
      required: true,
    },
  },
  data(): DataModel {
    return {
      units: {...Units.EMPTY},
    };
  },
  computed: {
    cost(): number {
      return this.playerinput.payProduction.cost;
    },
    total(): number {
      return sum(Units.values(this.units));
    },
    // Only the resources the player can actually decrease. Megacredit
    // production floors at -5, so it's deductible while above that floor;
    // every other resource is deductible while its production is positive.
    deductibleUnits(): Array<keyof Units> {
      return Units.keys.filter((unit) => this.maxFor(unit) > 0);
    },
    titleText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    buttonText(): string {
      return translateText(this.playerinput.buttonLabel);
    },
    counterText(): string {
      return translateText('Selected ${0} of ${1}')
        .replace('${0}', String(this.total))
        .replace('${1}', String(this.cost));
    },
  },
  methods: {
    resourceName(unit: keyof Units): string {
      return translateText(unit);
    },
    // How many units of `unit` production can be expended. Mirrors the legacy
    // SelectProductionToLose.expendableProductionQuantity.
    maxFor(unit: keyof Units): number {
      const production = this.playerinput.payProduction.units[unit];
      return unit === 'megacredits' ? production + 5 : production;
    },
    step(unit: keyof Units, direction: number): void {
      const next = this.units[unit] + direction;
      this.units[unit] = Math.min(Math.max(next, 0), this.maxFor(unit));
    },
    confirm(): void {
      if (this.total !== this.cost) {
        return;
      }
      this.onsave({type: 'productionToLose', units: this.units});
    },
  },
});
</script>
