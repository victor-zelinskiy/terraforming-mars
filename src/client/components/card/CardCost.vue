<template>
  <!--
    Cost group: BASE cost (always) → small chevron → EFFECTIVE cost
    (only when modifiers apply). Laid out as a single horizontal
    flex row so the effective-cost badge sits to the RIGHT of the
    base cost instead of dangling underneath it. The previous
    absolute-positioned variant (left:-8px, top:45px on
    .card-old-cost) was visually overlapping the title area on cards
    with long names — flagged by the user on "Тренировочный лагерь
    колонистов" and similar.

    Semantics — IMPORTANT:
      `amount`   = base cost printed on the card (e.g. 8).
      `newCost`  = EFFECTIVE cost after all discounts / modifiers
                   currently in play (e.g. 6). NOT the discount
                   amount. We never display a minus sign; the
                   second badge IS the final number the player will
                   pay. The chevron between the two reads as "→"
                   so the relationship "base → effective" is
                   unambiguous.

    The `hide_discount_on_cards` preference suppresses the second
    badge entirely. When `newCost === amount` we also suppress it
    (no modifier is in play, nothing to telegraph).
  -->
  <div class="card-cost-group">
    <div :class="getClasses()">{{ amount === null ? 0 : amount }}</div>
    <template v-if="displayTwoCosts()">
      <span class="card-cost-arrow" aria-hidden="true">▸</span>
      <div class="card-effective-cost"
           :title="effectiveCostTitle"
           data-test="card-effective-cost">
        {{ newCost }}
      </div>
    </template>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'CardCost',
  props: {
    amount: {
      type: Number as () => number | undefined,
      default: undefined,
    },
    newCost: {
      type: Number as () => number | undefined,
      default: undefined,
    },
  },
  computed: {
    /*
     * Native tooltip via the `title` attribute — no JS hover state
     * required, no new tooltip framework introduced. Localised
     * through the existing `translateText` helper.
     */
    effectiveCostTitle(): string {
      return translateText('Effective cost after discounts');
    },
  },
  methods: {
    getClasses(): string {
      const classes = ['card-cost'];
      if (this.amount === undefined) {
        classes.push('visibility-hidden');
      }
      return classes.join(' ');
    },
    displayTwoCosts(): boolean {
      const hideDiscount = getPreferences().hide_discount_on_cards;
      return this.newCost !== undefined && this.newCost !== this.amount && !hideDiscount;
    },
  },
});

</script>
