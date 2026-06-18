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

    <!--
      Payment summary — the at-a-glance "is this enough?" panel: amount paid /
      cost with a coin, the readiness status (ГОТОВО when covered, else how much
      is still missing), and a completion bar. The bar reads totalSpent() each
      render; the fill is capped at the cost rail so over-pay doesn't push past —
      colour state (under / exact / over) carries that signal instead.
    -->
    <div class="payment-v2__summary" :class="progressClass">
      <div class="payment-v2__summary-top">
        <span class="payment-v2__summary-label" v-i18n>Paid</span>
        <span class="payment-v2__summary-amount">
          <span class="payment-v2__summary-paid">{{ totalSpent() }}</span>
          <span class="payment-v2__summary-sep">/</span>
          <span class="payment-v2__summary-cost">{{ cost }}</span>
          <i class="resource_icon resource_icon--megacredits payment-v2__summary-coin"></i>
        </span>
        <span class="payment-v2__summary-status"
              :class="isPaid ? 'payment-v2__summary-status--ready' : 'payment-v2__summary-status--short'">
          <template v-if="isPaid"><span v-i18n>Ready</span></template>
          <template v-else>
            <span class="payment-v2__summary-status-label" v-i18n>Short</span>
            <span class="payment-v2__summary-status-value">{{ remaining }}</span>
            <i class="resource_icon resource_icon--megacredits payment-v2__summary-status-coin"></i>
          </template>
        </span>
      </div>
      <div class="payment-v2__progress-rail">
        <div class="payment-v2__progress-fill" :style="progressFillStyle"></div>
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
      if (total < this.cost) {
        return 'payment-v2__progress--under';
      }
      if (total > this.cost) {
        return 'payment-v2__progress--over';
      }
      return 'payment-v2__progress--exact';
    },
    // The cost is covered (exact OR unavoidable rate>1 over-pay both count as
    // "enough") → the summary shows ГОТОВО and the host CTA may enable.
    isPaid(): boolean {
      return this.totalSpent() >= this.cost;
    },
    // How much M€-equivalent is still missing when under-paying (0 when covered).
    remaining(): number {
      return Math.max(0, this.cost - this.totalSpent());
    },
    progressFillStyle(): Record<string, string> {
      const total = this.totalSpent();
      const ratio = this.cost <= 0 ? 1 : Math.min(1, total / this.cost);
      return {width: `${(ratio * 100).toFixed(1)}%`};
    },
  },
  methods: {
    // The STRICT cap — how high this row can go without overpaying.
    //
    //  - rate === 1 (M€, heat, Kuiper Asteroids, Luna Archives science):
    //    cap at "remaining cost net of OTHER resources' contributions".
    //    Exact-match is always achievable with 1:1 resources, so there's
    //    never a reason to overpay deliberately with these.
    //
    //  - rate > 1 (steel ×2, titanium ×3, seeds ×5, etc.): cap at the
    //    MINIMUM count needed to cover the remaining cost (ceil division).
    //    Unavoidable overpay is OK — e.g. cost 11 with only titanium
    //    needs 4 × 3 = 12, overpaying 1. Pushing further (5 titanium = 15)
    //    is purely wasteful.
    //
    // Used internally by `addValue` to decide the standard-path vs. swap-path
    // and by `maxValue` to compute the target snap point. The display cap
    // exposed to the +/MAX buttons (`rowMax` below) is more permissive — it
    // also includes M€-swap headroom so the player can switch from M€ to an
    // alt resource without first manually decrementing M€.
    baseCap(unit: SpendableResource): number {
      const rate = this.ledger[unit].rate;
      const othersContrib = this.totalSpent() - this.payment[unit] * rate;
      const remainingForThis = Math.max(0, this.cost - othersContrib);
      if (rate === 1) {
        return Math.min(this.ledger[unit].available, remainingForThis);
      }
      return Math.min(this.ledger[unit].available, Math.ceil(remainingForThis / rate));
    },
    // Display cap for the +/MAX buttons. Extends `baseCap` with "swap
    // headroom" — additional units the player can acquire by reducing
    // ANOTHER resource that's currently allocated. Two swap modes are
    // supported:
    //
    //  1. Same-rate swap (1:1). Every unit of another resource at the
    //     same rate contributes exactly one extra spot in this row.
    //     Covers the canonical cases:
    //       - + on heat (rate 1) frees an M€ (rate 1) per click,
    //       - + on M€ frees a heat (or kuiper / luna science),
    //       - + on a rate-1 resource frees another rate-1 resource.
    //
    //  2. Cross-rate M€ swap. ONLY when `unit` is an alt-resource with
    //     rate > 1: each extra unit costs `rate` M€. Lets the player
    //     dial up steel (×2) / titanium (×3) / seeds (×5) etc. without
    //     manually − M€ multiple times first. The reverse direction
    //     (+ M€ funded by reducing a rate>1 resource) is omitted —
    //     it would either add multiple M€ per click (surprising) or
    //     under-pay; clicking − on the rate>1 resource is the clean
    //     manual path for that case.
    rowMax(unit: SpendableResource): number {
      const base = this.baseCap(unit);
      const rate = this.ledger[unit].rate;

      // Same-rate swap budget — sum of allocations across every other
      // resource at the same rate.
      let swapBudget = 0;
      for (const other of this.order) {
        if (other === unit) {
          continue;
        }
        if (this.ledger[other].rate === rate) {
          swapBudget += this.payment[other];
        }
      }

      // Cross-rate M€-funded swap budget (alt-resources only).
      if (unit !== 'megacredits' && rate > 1) {
        swapBudget += Math.floor(this.payment.megacredits / rate);
      }

      const remainingPool = Math.max(0, this.ledger[unit].available - base);
      return base + Math.min(swapBudget, remainingPool);
    },
    addValue(unit: SpendableResource): void {
      if (this.payment[unit] >= this.ledger[unit].available) {
        return;
      }

      if (this.payment[unit] < this.baseCap(unit)) {
        // Standard path: there's still under-paid headroom in the cost.
        this.payment[unit] += 1;
        if (unit !== 'megacredits') {
          this.setRemainingMCValue();
        }
        return;
      }

      // Swap path. baseCap is exhausted (cost already covered) but the
      // player has more of `unit` available. Find a swap partner and
      // exchange 1 unit. Total contribution is unchanged.
      const rate = this.ledger[unit].rate;

      // Same-rate partner first (1:1, cleanest). Iteration order follows
      // `this.order` — for + on M€ this finds heat first (the canonical
      // partner), for + on heat this finds M€ (heat sits before M€ in
      // the order so M€ is hit as a later candidate).
      for (const other of this.order) {
        if (other === unit) {
          continue;
        }
        if (this.ledger[other].rate !== rate) {
          continue;
        }
        if (this.payment[other] <= 0) {
          continue;
        }
        this.payment[other] -= 1;
        this.payment[unit] += 1;
        return;
      }

      // Cross-rate fallback: alt-resource swapping in via M€. Only valid
      // for unit !== M€ with rate > 1; the reverse direction is omitted
      // (see `rowMax` comment) so + on M€ stays a no-op here when only
      // rate-mismatched partners are present — matches what disabling
      // would do, except the user already saw + enabled via rowMax,
      // so this branch should only ever fire on alt-resource clicks.
      if (unit !== 'megacredits' && rate > 1 && this.payment.megacredits >= rate) {
        this.payment.megacredits -= rate;
        this.payment[unit] += 1;
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
      // MAX means "use as much of THIS resource as possible, then cover only the
      // remaining cost with the other resources — NEVER overpay." The old code set
      // the unit to the FULL cost while only re-balancing M€, leaving any seeded
      // steel/titanium allocated on top → a large overpay (the reported Helion heat
      // case: cost 10 + steel 3 [→6] made heat 10, total 16). We instead max the unit
      // up to what covers the whole cost, then re-fill the remainder with the OTHER
      // resources (excluded from re-fill so the maxed unit isn't re-added).
      const rate = this.ledger[unit].rate;
      const unitMax = Math.min(
        this.ledger[unit].available,
        rate === 1 ? this.cost : Math.ceil(this.cost / rate));
      const remaining = Math.max(0, this.cost - unitMax * rate);
      const ledgerWithoutUnit = {...this.ledger, [unit]: {...this.ledger[unit], available: 0}};
      const filled = computeDefaultPayment(remaining, this.order, ledgerWithoutUnit, /* reserveMegacredits=*/ false);
      this.payment = {...filled, [unit]: unitMax};
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
      if (this.cost === 0) {
        return true;
      }
      const total = this.totalSpent();
      if (total < this.cost) {
        return false;
      }
      for (const unit of this.order) {
        if (this.payment[unit] > this.ledger[unit].available) {
          return false;
        }
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
