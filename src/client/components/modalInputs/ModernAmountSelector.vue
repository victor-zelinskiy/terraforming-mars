<template>
  <!--
    Premium replacement for the legacy SelectAmount (a bare number input).
    Hosted inside MandatoryInputModal via ModalInputHost. A sci-fi stepper
    with −/+ controls, a MAX shortcut and a confirm button.

    When the server marks the amount as a CONVERSION (`playerinput.conversion`,
    e.g. Supercapacitors energy → heat, Insulation heat production → M€
    production), the modal leads with a rich [spend] → [receive] composition:
    both sides show their resource icon, the live signed delta, and — when the
    icon is a standard resource — the viewer's `current → resulting` figure
    (derived client-side from the public player model; the server only sends
    the hint). Without `conversion` it stays the bare stepper as before.

    Submission is byte-identical to SelectAmount.vue: {type: 'amount', amount}.
  -->
  <div class="modal-input modal-input--amount">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
    </header>

    <div v-if="conversion !== undefined" class="modal-input__convert" data-test="modern-amount-convert">
      <div class="modal-input__convert-side modal-input__convert-side--spend">
        <span class="modal-input__convert-side-label" v-i18n>To be spent</span>
        <span class="modal-input__convert-figure">
          <span class="modal-input__convert-icon-wrap" :class="{'modal-input__prod-frame': fromIsProduction}">
            <span class="modal-input__option-icon" :class="fromIconClass" aria-hidden="true"></span>
          </span>
          <span class="modal-input__convert-delta modal-input__convert-delta--spend">−{{ amount }}</span>
        </span>
        <span v-if="fromIsProduction" class="modal-input__convert-scope" v-i18n>Production rate</span>
        <span v-if="fromCurrent !== undefined" class="modal-input__convert-preview">
          <span class="modal-input__convert-preview-from">{{ fromCurrent }}</span>
          <span class="modal-input__convert-preview-arrow" aria-hidden="true">→</span>
          <span class="modal-input__convert-preview-to">{{ fromResulting }}</span>
        </span>
      </div>

      <span class="modal-input__convert-arrow" aria-hidden="true">➜</span>

      <div class="modal-input__convert-side modal-input__convert-side--gain">
        <span class="modal-input__convert-side-label" v-i18n>You will receive</span>
        <span class="modal-input__convert-figure">
          <span class="modal-input__convert-icon-wrap" :class="{'modal-input__prod-frame': toIsProduction}">
            <span class="modal-input__option-icon" :class="toIconClass" aria-hidden="true"></span>
          </span>
          <span class="modal-input__convert-delta modal-input__convert-delta--gain">+{{ toDelta }}</span>
        </span>
        <span v-if="toIsProduction" class="modal-input__convert-scope" v-i18n>Production rate</span>
        <span v-if="toCurrent !== undefined" class="modal-input__convert-preview">
          <span class="modal-input__convert-preview-from">{{ toCurrent }}</span>
          <span class="modal-input__convert-preview-arrow" aria-hidden="true">→</span>
          <span class="modal-input__convert-preview-to modal-input__convert-preview-to--gain">{{ toResulting }}</span>
        </span>
      </div>
    </div>

    <!--
      Practical-change composition: SPEND (the model's `icon`) → RESULT
      (`amountResult`). Reuses the conversion layout so "spend X energy → draw X
      cards" reads the same as a resource conversion, updating live with the
      stepper. Only when there's no `conversion` (which owns that layout).
    -->
    <div v-if="conversion === undefined && amountResult !== undefined"
         class="modal-input__convert modal-input__convert--result"
         data-test="modern-amount-result">
      <div class="modal-input__convert-side modal-input__convert-side--spend">
        <span class="modal-input__convert-side-label" v-i18n>To be spent</span>
        <span class="modal-input__convert-figure">
          <span class="modal-input__convert-icon-wrap">
            <span class="modal-input__option-icon" :class="iconClass" aria-hidden="true"></span>
          </span>
          <span class="modal-input__convert-delta modal-input__convert-delta--spend">−{{ amount }}</span>
        </span>
        <span v-if="availableCurrent !== undefined" class="modal-input__convert-preview">
          <span class="modal-input__convert-preview-from">{{ availableCurrent }}</span>
          <span class="modal-input__convert-preview-arrow" aria-hidden="true">→</span>
          <span class="modal-input__convert-preview-to">{{ availableResulting }}</span>
        </span>
      </div>

      <span class="modal-input__convert-arrow" aria-hidden="true">➜</span>

      <div class="modal-input__convert-side modal-input__convert-side--gain">
        <span v-if="resultLabel !== ''" class="modal-input__convert-side-label">{{ resultLabel }}</span>
        <span class="modal-input__convert-figure">
          <span class="modal-input__convert-icon-wrap">
            <span class="modal-input__option-icon" :class="resultIconClass" aria-hidden="true"></span>
          </span>
          <span class="modal-input__convert-delta modal-input__convert-delta--gain">+{{ resultValue }}</span>
        </span>
      </div>
    </div>

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
      <button class="modal-input__max-btn" @click="setMax" data-test="modern-amount-max">
        <span v-i18n>MAX</span>
        <span class="modal-input__max-btn-value">{{ playerinput.max }}</span>
      </button>
    </div>

    <div class="modal-input__range-hint">{{ playerinput.min }} – {{ playerinput.max }}</div>

    <!--
      Availability line — when the amount has no conversion / result composition
      but DOES spend a standard resource, still show how much is on hand so the
      bound reads clearly ("сколько доступно сейчас"). Hidden for parameter / card
      amounts (no per-player figure).
    -->
    <div v-if="conversion === undefined && amountResult === undefined && availableCurrent !== undefined"
         class="modal-input__amount-avail"
         data-test="modern-amount-avail">
      <span class="modal-input__amount-avail-icon modal-input__option-icon" :class="iconClass" aria-hidden="true"></span>
      <span class="modal-input__amount-avail-label" v-i18n>In stock</span>
      <span class="modal-input__amount-avail-value">{{ availableCurrent }}</span>
    </div>

    <!--
      The inner confirm button is hidden in CONTROLLED mode: the amount is
      captured live (emitted via @change on every change) and committed by the
      HOST modal's own confirm button (the action / play confirmation modal).
      In the standalone (non-controlled) mandatory modal this button IS the submit.
    -->
    <div v-if="!controlled" class="modal-input__actions">
      <button class="modal-input__primary-btn" @click="confirm" data-test="modern-amount-confirm">
        {{ buttonText }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectAmountModel, AmountConversionModel, AmountResultModel} from '@/common/models/PlayerInputModel';
import {SelectAmountResponse} from '@/common/inputs/InputResponse';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';

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
    // CONTROLLED mode (hosted inside the action / play confirm modal): hide the
    // inner confirm button and emit the chosen amount LIVE via `@change` (on mount
    // + every step), so the modal captures it as its current state and commits it
    // with its OWN confirm. Default false → the standalone modal keeps the inner
    // confirm (it is the submit there).
    controlled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
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
    conversion(): AmountConversionModel | undefined {
      return this.playerinput.conversion;
    },
    ratio(): number {
      return this.conversion?.ratio ?? 1;
    },
    toDelta(): number {
      return this.amount * this.ratio;
    },
    fromIconClass(): string {
      return iconClassFor(this.conversion?.from);
    },
    toIconClass(): string {
      return iconClassFor(this.conversion?.to);
    },
    fromIsProduction(): boolean {
      return this.conversion?.fromScope === 'production';
    },
    toIsProduction(): boolean {
      return this.conversion?.toScope === 'production';
    },
    // The viewer's live `current` for each side, derived client-side from the
    // public player model — undefined (→ no preview row) for non-standard icons.
    fromCurrent(): number | undefined {
      const c = this.conversion;
      return c === undefined ? undefined : playerResourceValue(this.playerView.thisPlayer, c.from, c.fromScope ?? 'stock');
    },
    fromResulting(): number | undefined {
      return this.fromCurrent === undefined ? undefined : this.fromCurrent - this.amount;
    },
    toCurrent(): number | undefined {
      const c = this.conversion;
      return c === undefined ? undefined : playerResourceValue(this.playerView.thisPlayer, c.to, c.toScope ?? 'stock');
    },
    toResulting(): number | undefined {
      return this.toCurrent === undefined ? undefined : this.toCurrent + this.toDelta;
    },
    // ── "Practical change" result composition + availability ────────────────
    amountResult(): AmountResultModel | undefined {
      return this.playerinput.amountResult;
    },
    resultIconClass(): string {
      return iconClassFor(this.amountResult?.icon);
    },
    // The result value scales with the chosen amount (e.g. draw `amount` cards).
    resultValue(): number {
      return this.amount * (this.amountResult?.perUnit ?? 1);
    },
    resultLabel(): string {
      const l = this.amountResult?.label;
      return l === undefined || l === '' ? '' : translateText(l);
    },
    // The viewer's CURRENT stock of the SPENT resource (the model's `icon`), used
    // for both the result composition's `current → resulting` preview and the
    // standalone availability line. undefined when `icon` isn't a standard resource.
    availableCurrent(): number | undefined {
      return playerResourceValue(this.playerView.thisPlayer, this.playerinput.icon ?? '', 'stock');
    },
    availableResulting(): number | undefined {
      return this.availableCurrent === undefined ? undefined : this.availableCurrent - this.amount;
    },
  },
  watch: {
    // In controlled mode keep the host modal's captured value in sync with every
    // amount change (step / MAX). The amount is always within [min, max], so it's
    // always a valid response.
    amount(): void {
      this.emitControlled();
    },
  },
  mounted(): void {
    // Controlled: seed the host with the initial (default) amount immediately, so
    // its confirm is enabled without the player having to touch the stepper.
    this.emitControlled();
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
    // Emit the live value to the host modal (controlled mode only).
    emitControlled(): void {
      if (this.controlled) {
        this.$emit('change', {type: 'amount', amount: this.amount});
      }
    },
  },
});
</script>
