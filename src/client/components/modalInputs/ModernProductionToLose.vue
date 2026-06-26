<template>
  <!--
    Premium replacement for the legacy SelectProductionToLose (choose which
    production to decrease to pay a cost — e.g. an Ares hazard-adjacency penalty).
    Hosted inside MandatoryInputModal via ModalInputHost.

    Two modes:
      • cost === 1 (SINGLE-PICK): no steppers — each deductible resource is a
        selectable tile; clicking one picks it (the common Ares case "lose 1
        production of your choice"). A lone option is pre-selected.
      • cost > 1: per-resource steppers, constrained so the running total can't
        exceed available production; confirm unlocks at exactly `cost`.

    Title is built client-side from `cost` (diegetic + translated) — the server's
    baked "Choose N unit(s)…" string is bypassed. Submission is byte-identical to
    SelectProductionToLose.vue: {type: 'productionToLose', units}.
  -->
  <div class="modal-input modal-input--production-to-lose">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div class="modal-input__subtitle" v-i18n>Which resource production would you prefer to decrease?</div>

    <!-- SINGLE-PICK: selectable resource tiles (no steppers). -->
    <div v-if="singlePick" class="modal-input__prod-picks">
      <button v-for="unit in deductibleUnits" :key="unit"
              type="button"
              class="modal-input__prod-pick"
              :class="{'modal-input__prod-pick--active': units[unit] > 0}"
              @click="pickSingle(unit)"
              :data-test="'modern-ptl-pick-' + unit">
        <span class="modal-input__prod-frame">
          <span class="resource_icon" :class="'resource_icon--' + unit"></span>
        </span>
        <span class="modal-input__dist-name">{{ resourceName(unit) }}</span>
        <span class="modal-input__prod-pick-mark" aria-hidden="true">−1</span>
      </button>
    </div>

    <!-- MULTI: per-resource steppers (distribute the loss). -->
    <template v-else>
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
    </template>

    <div v-if="!controlled" class="modal-input__actions">
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
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

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
    // CONTROLLED mode: hide the inner confirm; the chosen production loss is
    // captured live (emitted via @change only once EXACTLY `cost` units are
    // allocated, else `undefined`) and committed by the host modal's own confirm.
    controlled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
  data(): DataModel {
    return {
      units: {...Units.EMPTY},
    };
  },
  computed: {
    cost(): number {
      return this.playerinput.payProduction.cost;
    },
    // One reduction → a clean single-pick UI (no steppers / no "N of M" counter).
    singlePick(): boolean {
      return this.cost === 1;
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
    // Built from `cost` (diegetic + translated), bypassing the server's baked
    // "Choose N unit(s) of production to lose" string (untranslatable + awkward).
    titleText(): string {
      return this.cost === 1 ?
        translateText('Reduce a production') :
        translateTextWithParams('Reduce production by ${0}', [String(this.cost)]);
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
  watch: {
    // Controlled: emit the response only at EXACTLY `cost` units (a complete,
    // valid choice), else `undefined` so the host gates its confirm. Deep — the
    // steppers / single-pick mutate `units` in place.
    units: {
      deep: true,
      handler(): void {
        if (this.controlled) {
          this.$emit('change', this.total === this.cost ? {type: 'productionToLose', units: {...this.units}} : undefined);
        }
      },
    },
  },
  mounted(): void {
    // A single forced option (one deductible resource, lose 1) reads as a
    // confirmation — pre-select it so the player just confirms.
    if (this.singlePick && this.deductibleUnits.length === 1) {
      this.pickSingle(this.deductibleUnits[0]);
    }
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
    // Single-pick: select exactly this resource (clear the rest).
    pickSingle(unit: keyof Units): void {
      const fresh = {...Units.EMPTY};
      fresh[unit] = 1;
      this.units = fresh;
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
