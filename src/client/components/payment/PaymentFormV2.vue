<template>
  <div class="payment-v2-form">
    <div class="payment-v2-form__rows">
      <PaymentRowV2
        v-for="unit of visibleOrder"
        :key="unit"
        :unit="unit"
        :modelValue="payment[unit]"
        :available="ledger[unit].available"
        :max="rowMax(unit)"
        :rate="ledger[unit].rate"
        :description="descriptions[unit]"
        :reserved="!!ledger[unit].reserved"
        @plus="addValue(unit)"
        @minus="reduceValue(unit)"
        @max="maxValue(unit)" />
    </div>

    <!-- Progress bar reads totalSpent() each render. The visible fill is
         capped at the cost rail so over-pay doesn't push past — colour
         state (under / exact / over) carries that signal instead. -->
    <div class="payment-v2__progress" :class="progressClass">
      <div class="payment-v2__progress-rail">
        <div class="payment-v2__progress-fill" :style="progressFillStyle"></div>
      </div>
      <div class="payment-v2__progress-readout">
        <span class="payment-v2__progress-paid">{{ totalSpent() }}</span>
        <span class="payment-v2__progress-sep">/</span>
        <span class="payment-v2__progress-cost">{{ cost }}</span>
        <span class="payment-v2__progress-state" v-i18n>{{ progressStateLabel }}</span>
      </div>
    </div>

    <div class="payment-v2__warning" v-if="warning !== undefined">
      <span class="payment-v2__warning-icon">!</span>
      <span>{{ $t(warning) }}</span>
    </div>

    <!-- Confirm button rendered only when host asks. When PaymentFormV2 is
         nested in a layout that owns its own submit, the host calls
         `paymentForm.handleSave()` via the ref instead and the button is
         hidden — same protocol the V1 PaymentForm follows. -->
    <div class="payment-v2__actions" v-if="showsave">
      <button class="payment-v2__confirm-btn"
              :class="{'payment-v2__confirm-btn--disabled': !canSave()}"
              :disabled="!canSave()"
              @click="handleSave"
              data-test="save">
        <span class="payment-v2__confirm-btn-label">{{ $t(buttonLabel) }}</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Payment} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Ledger} from '@/client/components/PaymentLedger';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';
import {sum} from '@/common/utils/utils';
import PaymentRowV2 from '@/client/components/payment/PaymentRowV2.vue';

// Same labels V1's PaymentForm uses — i18n keys live in the locale files
// already. Caller can pass `descriptions` to override per-row labels.
const DEFAULT_DESCRIPTIONS: Record<SpendableResource, string> = {
  steel: 'Steel',
  titanium: 'Titanium',
  heat: 'Heat',
  seeds: 'Seeds',
  auroraiData: 'Data',
  kuiperAsteroids: 'Asteroids',
  spireScience: 'Science',
  megacredits: 'M€',
  floaters: 'Floaters',
  graphene: 'Graphene',
  lunaArchivesScience: 'Science',
  microbes: 'Microbes',
  plants: 'Plants',
};

type DataModel = {
  payment: Payment;
  warning: string | undefined;
};

export default defineComponent({
  name: 'PaymentFormV2',
  components: {PaymentRowV2},
  props: {
    cost: {
      type: Number,
      required: true,
    },
    order: {
      type: Array as () => ReadonlyArray<SpendableResource>,
      required: true,
    },
    ledger: {
      type: Object as () => Ledger,
      required: true,
    },
    showsave: {
      type: Boolean,
      default: false,
    },
    buttonLabel: {
      type: String,
      required: true,
    },
    descriptions: {
      type: Object as () => Record<SpendableResource, string>,
      default: () => DEFAULT_DESCRIPTIONS,
    },
  },
  emits: ['save', 'change'],
  data(): DataModel {
    return {
      // Seed with intelligent default. Mirrors V1 PaymentForm.data().
      // When the host needs to reset (e.g. card switch in SelectProjectCardToPlay),
      // it remounts us via :key prop — same pattern V1 uses.
      payment: computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits=*/ false),
      warning: undefined,
    };
  },
  watch: {
    payment: {
      deep: true,
      immediate: true,
      handler(val: Payment) {
        this.$emit('change', val);
      },
    },
  },
  computed: {
    // Filtered version of `order` — only resources the player actually has
    // any of show up as a row. Without this we'd render dead 0/0 rows for
    // resources gated by canUse (e.g. graphene becomes "usable" for any
    // SPACE/CITY-tagged card whether or not the player owns Carbon
    // Nanosystems), which is visual noise. Mirrors V1 PaymentForm which
    // wraps each row in `v-if="ledger[unit]?.available > 0"`.
    visibleOrder(): ReadonlyArray<SpendableResource> {
      return this.order.filter((unit) => this.ledger[unit].available > 0);
    },
    progressClass(): string {
      const total = this.totalSpent();
      if (total < this.cost) return 'payment-v2__progress--under';
      if (total > this.cost) return 'payment-v2__progress--over';
      return 'payment-v2__progress--exact';
    },
    progressStateLabel(): string {
      const total = this.totalSpent();
      if (total < this.cost) return 'Underpaying';
      if (total > this.cost) return 'Overpaying';
      return 'Ready';
    },
    progressFillStyle(): Record<string, string> {
      const total = this.totalSpent();
      const ratio = this.cost <= 0 ? 1 : Math.min(1, total / this.cost);
      return {width: `${(ratio * 100).toFixed(1)}%`};
    },
  },
  methods: {
    // +/MAX cap depends on the resource's exchange rate:
    //
    //  - rate === 1 (M€, heat, Kuiper Asteroids, Luna Archives science):
    //    cap at "remaining cost net of OTHER resources' contributions".
    //    Exact-match is always achievable with 1:1 resources, so there's
    //    never a reason to overpay deliberately — the + button should
    //    refuse rather than silently waste resources.
    //
    //  - rate > 1 (steel ×2, titanium ×3, seeds ×5, etc.): cap at the
    //    MINIMUM count needed to cover the remaining cost (ceil division).
    //    Unavoidable overpay is OK — e.g. cost 11 with only titanium
    //    needs 4 × 3 = 12, overpaying 1. Pushing further (5 titanium = 15)
    //    is purely wasteful, blocked at the + button.
    rowMax(unit: SpendableResource): number {
      const rate = this.ledger[unit].rate;
      const othersContrib = this.totalSpent() - this.payment[unit] * rate;
      const remainingForThis = Math.max(0, this.cost - othersContrib);
      if (rate === 1) {
        return Math.min(this.ledger[unit].available, remainingForThis);
      }
      return Math.min(this.ledger[unit].available, Math.ceil(remainingForThis / rate));
    },
    addValue(unit: SpendableResource): void {
      if (unit === 'megacredits') {
        if (this.payment[unit] < this.rowMax('megacredits')) {
          this.payment[unit] += 1;
        }
      } else {
        if (this.payment[unit] < this.ledger[unit].available) {
          this.payment[unit] += 1;
          this.setRemainingMCValue();
        }
      }
    },
    reduceValue(unit: SpendableResource): void {
      if (this.payment[unit] > 0) {
        this.payment[unit] -= 1;
        if (unit !== 'megacredits') {
          this.setRemainingMCValue();
        }
      }
    },
    setRemainingMCValue(): void {
      const nonMCspend = this.totalSpent() - this.payment.megacredits;
      const remainingMC = Math.max(0, this.cost - nonMCspend);
      const megacredits = Math.min(this.ledger.megacredits.available, remainingMC);
      this.payment.megacredits = megacredits;
    },
    maxValue(unit: SpendableResource): void {
      const target = Math.min(this.ledger[unit].available, Math.floor(this.cost / this.ledger[unit].rate));
      if (this.payment[unit] < target) {
        this.payment[unit] = target;
        if (unit !== 'megacredits') {
          this.setRemainingMCValue();
        } else {
          const saved = this.payment.megacredits;
          this.payment = computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits=*/ true);
          this.payment.megacredits = saved;
        }
      }
    },
    totalSpent(): number {
      return sum(this.order.map((unit) => this.payment[unit] * this.ledger[unit].rate));
    },
    // Public — used by both the local Confirm button (disabled state) and
    // by host components that render their own submit button and want to
    // gate it on a valid payment.
    //
    // Over-pay is ALLOWED — sometimes unavoidable for resources with
    // rate > 1 (e.g. paying 11 M€ with only titanium needs 4 × 3 = 12).
    // The + button on 1:1 rate resources is capped at the remaining cost
    // via `rowMax`, so deliberate over-pay with M€ / heat / 1:1 resources
    // is prevented earlier in the UI. Confirm only fails when the player
    // hasn't covered the cost yet OR somehow exceeds resource availability.
    canSave(): boolean {
      if (this.cost === 0) return true;
      const total = this.totalSpent();
      if (total < this.cost) return false;
      for (const unit of this.order) {
        if (this.payment[unit] > this.ledger[unit].available) return false;
      }
      return true;
    },
    // Public — called by host's `saveData` ref path (legacy radio-UI
    // submit) and by our own Confirm button. Validates the same
    // conditions as `canSave` (cost covered, availability not exceeded)
    // and emits 'save'. The avoidable-overpay block and the
    // "Warning: overpaying by N" popup that V1 had are intentionally
    // dropped — `rowMax` now prevents wasteful 1:1 overpay at the
    // button-disable level, and rate > 1 overpay is often unavoidable.
    handleSave(): void {
      this.warning = undefined;
      if (this.cost === 0) {
        this.$emit('save', this.payment);
        return;
      }
      for (const unit of this.order) {
        if (this.payment[unit] > this.ledger[unit].available) {
          this.warning = `You do not have enough ${unit}`;
          return;
        }
      }
      if (this.totalSpent() < this.cost) {
        this.warning = 'Haven\'t spent enough';
        return;
      }
      this.$emit('save', this.payment);
    },
  },
});
</script>
