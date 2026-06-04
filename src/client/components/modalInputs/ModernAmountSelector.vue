<template>
  <!--
    Premium replacement for the legacy SelectAmount (a bare number input).
    Hosted inside MandatoryInputModal via ModalInputHost. A sci-fi stepper
    with −/+ controls, a MAX shortcut and a confirm button.

    Submission is byte-identical to SelectAmount.vue: {type: 'amount', amount}.
  -->
  <div class="modal-input modal-input--amount">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div class="modal-input__stepper">
      <button class="modal-input__step-btn"
              :disabled="amount <= playerinput.min"
              @click="step(-1)"
              data-test="modern-amount-dec">−</button>
      <span class="modal-input__step-readout">
        <span class="modal-input__step-value" data-test="modern-amount-value">{{ amount }}</span>
        <span v-if="unitText !== ''" class="modal-input__step-unit">{{ unitText }}</span>
        <span v-if="iconClass !== ''" class="modal-input__step-icon modal-input__option-icon" :class="iconClass" aria-hidden="true"></span>
      </span>
      <button class="modal-input__step-btn"
              :disabled="amount >= playerinput.max"
              @click="step(1)"
              data-test="modern-amount-inc">+</button>
      <button class="modal-input__max-btn" @click="setMax" data-test="modern-amount-max" v-i18n>MAX</button>
    </div>

    <div class="modal-input__range-hint">{{ playerinput.min }} – {{ playerinput.max }}</div>

    <div class="modal-input__actions">
      <button class="modal-input__primary-btn" @click="confirm" data-test="modern-amount-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectAmountModel} from '@/common/models/PlayerInputModel';
import {SelectAmountResponse} from '@/common/inputs/InputResponse';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

type DataModel = {
  amount: number;
};

export default defineComponent({
  name: 'ModernAmountSelector',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectAmountModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectAmountResponse) => void,
      required: true,
    },
  },
  data(): DataModel {
    return {
      amount: this.playerinput.maxByDefault ? this.playerinput.max : this.playerinput.min,
    };
  },
  computed: {
    titleText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    buttonText(): string {
      return translateText(this.playerinput.buttonLabel);
    },
    iconClass(): string {
      return iconClassFor(this.playerinput.icon);
    },
    unitText(): string {
      return this.playerinput.unit ?? '';
    },
  },
  methods: {
    step(direction: number): void {
      const next = this.amount + direction;
      this.amount = Math.min(Math.max(next, this.playerinput.min), this.playerinput.max);
    },
    setMax(): void {
      this.amount = this.playerinput.max;
    },
    confirm(): void {
      this.onsave({type: 'amount', amount: this.amount});
    },
  },
});
</script>
