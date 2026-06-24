<template>
  <!--
    Premium replacement for the legacy Stormcraft heat-payment AndOptions (two
    bare SelectAmount widgets + ВЫПОЛНИТЬ). Hosted inside MandatoryInputModal via
    ModalInputHost when the prompt carries `spendHeatPrompt`. The player chooses
    how many FLOATERS to spend (each worth 2 heat); the remaining heat is drawn
    from stock automatically (the minimal valid spend the server enforces), so
    every reachable floater count is a VALID, no-overspend combination. Submission
    is byte-identical to the legacy AndOptions:
      {type:'and', responses:[{type:'amount', amount:heat}, {type:'amount', amount:floaters}]}.
  -->
  <div class="modal-input modal-input--spend-heat">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <!-- Floater allocation — the only control; each floater = 2 heat. -->
    <div class="modal-input__dist">
      <div class="modal-input__dist-row" :class="{'modal-input__dist-row--active': floaters > 0}">
        <span class="modal-input__dist-id">
          <span class="spend-heat__icon card-resource card-resource-floater" aria-hidden="true"></span>
          <span class="modal-input__dist-name" v-i18n>{{ floaterLabel }}</span>
        </span>
        <span class="modal-input__dist-controls">
          <button class="modal-input__step-btn"
                  :disabled="floaters <= minFloaters"
                  @click="reduce"
                  data-test="spend-heat-floaters-dec">−</button>
          <span class="modal-input__step-value modal-input__step-value--sm" data-test="spend-heat-floaters-value">{{ floaters }}</span>
          <button class="modal-input__step-btn"
                  :disabled="floaters >= maxFloaters"
                  @click="add"
                  data-test="spend-heat-floaters-inc">+</button>
        </span>
      </div>
    </div>

    <!-- Breakdown: floaters-as-heat + stock heat = covered. -->
    <div class="spend-heat__breakdown">
      <span class="spend-heat__part">
        <span class="spend-heat__icon card-resource card-resource-floater" aria-hidden="true"></span>
        <span class="spend-heat__amt">{{ floaters }}</span>
        <span class="spend-heat__arrow" aria-hidden="true">→</span>
        <span class="spend-heat__heat">{{ floaters * 2 }}</span>
        <span class="spend-heat__icon resource_icon resource_icon--heat" aria-hidden="true"></span>
      </span>
      <span class="spend-heat__op" aria-hidden="true">+</span>
      <span class="spend-heat__part">
        <span class="spend-heat__heat">{{ stockHeat }}</span>
        <span class="spend-heat__icon resource_icon resource_icon--heat" aria-hidden="true"></span>
        <span class="spend-heat__cap" v-i18n>from stock</span>
      </span>
    </div>

    <div class="modal-input__dist-counter modal-input__dist-counter--complete">
      <span class="modal-input__dist-counter-text">{{ counterText }}</span>
    </div>

    <!-- The own confirm button is hidden in CONTROLLED mode (pre-collected as a step
         in the play / action modal, whose single CTA confirms everything at once). -->
    <div v-if="!controlled" class="modal-input__actions">
      <button class="modal-input__primary-btn"
              :disabled="!valid"
              @click="confirm"
              data-test="spend-heat-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {AndOptionsModel, SelectAmountModel} from '@/common/models/PlayerInputModel';
import {AndOptionsResponse} from '@/common/inputs/InputResponse';
import {translateText, translateMessage} from '@/client/directives/i18n';

export default defineComponent({
  name: 'SpendHeatContent',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => AndOptionsModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: AndOptionsResponse) => void,
      required: true,
    },
    // CONTROLLED mode: hosted as a STEP inside the play / action modal — emit the
    // (always-valid) response on every change so the host captures it, and hide the
    // own confirm button (the modal's single CTA commits everything).
    controlled: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      floaters: 0,
    };
  },
  computed: {
    // The heat to cover (the marker amount; falls back to the two maxes if absent).
    target(): number {
      return this.playerinput.spendHeatPrompt?.amount ?? 0;
    },
    heatOption(): SelectAmountModel {
      return this.playerinput.options[0] as SelectAmountModel;
    },
    floaterOption(): SelectAmountModel {
      return this.playerinput.options[1] as SelectAmountModel;
    },
    maxHeat(): number {
      return this.heatOption?.max ?? 0;
    },
    // Fewest floaters that still let stock heat cover the rest.
    minFloaters(): number {
      return Math.max(0, Math.ceil((this.target - this.maxHeat) / 2));
    },
    // Most floaters worth spending (never more than needed to cover the target).
    maxFloaters(): number {
      const optionMax = this.floaterOption?.max ?? 0;
      return Math.min(optionMax, Math.ceil(this.target / 2));
    },
    // Heat drawn from stock = the remainder after floaters (clamped at 0; floaters
    // can overshoot by 1 when there's no stock heat for the odd unit).
    stockHeat(): number {
      return Math.max(0, this.target - this.floaters * 2);
    },
    covered(): number {
      return this.stockHeat + this.floaters * 2;
    },
    valid(): boolean {
      return this.covered >= this.target && this.stockHeat <= this.maxHeat && this.floaters >= this.minFloaters && this.floaters <= this.maxFloaters;
    },
    titleText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    buttonText(): string {
      return translateText(this.playerinput.buttonLabel || 'Confirm');
    },
    floaterLabel(): string {
      const t = this.floaterOption?.title;
      return typeof t === 'string' ? t : (t !== undefined ? translateMessage(t) : 'Floaters');
    },
    counterText(): string {
      return translateText('Covered ${0} of ${1} heat')
        .replace('${0}', String(this.covered))
        .replace('${1}', String(this.target));
    },
  },
  created(): void {
    // Default to the FEWEST floaters (use stock heat first, preserve floaters).
    // Set in `created` (before the first render) so the initial paint is correct.
    this.floaters = this.minFloaters;
  },
  mounted(): void {
    // In controlled mode, emit the default response immediately so the host has it
    // even if the player never touches the stepper.
    if (this.controlled) {
      this.emit();
    }
  },
  watch: {
    floaters(): void {
      if (this.controlled) {
        this.emit();
      }
    },
  },
  methods: {
    response(): AndOptionsResponse {
      // Order MUST match the AndOptions: option 0 = heat, option 1 = floaters.
      return {
        type: 'and',
        responses: [
          {type: 'amount', amount: this.stockHeat},
          {type: 'amount', amount: this.floaters},
        ],
      };
    },
    emit(): void {
      if (this.valid) {
        this.onsave(this.response());
      }
    },
    add(): void {
      if (this.floaters < this.maxFloaters) {
        this.floaters += 1;
      }
    },
    reduce(): void {
      if (this.floaters > this.minFloaters) {
        this.floaters -= 1;
      }
    },
    confirm(): void {
      if (!this.valid) {
        return;
      }
      this.onsave(this.response());
    },
  },
});
</script>

<style scoped lang="less">
.spend-heat__breakdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 10px 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #cfe0f0;
}
.spend-heat__part {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.spend-heat__icon {
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  display: inline-block;
}
.spend-heat__arrow,
.spend-heat__op {
  color: #7f93a8;
  font-weight: 700;
}
.spend-heat__heat {
  color: #ff9d5c;
}
.spend-heat__cap {
  font-size: 11.5px;
  font-weight: 500;
  color: #8aa0b6;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
</style>
