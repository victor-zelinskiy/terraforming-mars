<template>
  <!--
    CORPORATION IDENTITY ZONE — takes the art viewport's grid slot on the
    premium corporation face. Corporations have no card art by design; the
    zone renders the corporation's BRAND WORDMARK via the existing
    CardCorporationLogo system (bespoke SVGs / css wordmarks / image logos),
    over a dark boardroom plate, with a small type kicker below.

    The `.pcard-corp-stage` wrapper replays the legacy geometry the logos are
    calibrated against (the ~300px-wide legacy title zone) — the logo styles
    in cards_v2.less are scoped `:is(.card-container, .pcard-corp-stage)`.
    Deliberately NOT the literal `card-container` class: hosts zoom
    `:is(.card-container, .pcard)` descendants, so a nested .card-container
    inside a .pcard would be zoomed twice.
  -->
  <div class="pcard-corp" aria-hidden="true">
    <div class="pcard-corp-stage">
      <CardCorporationLogo :title="name" />
    </div>
    <span class="pcard-corp__kicker">{{ kicker }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {translateText} from '@/client/directives/i18n';
import CardCorporationLogo from '@/client/components/card/CardCorporationLogo.vue';

export default defineComponent({
  name: 'PremiumCorpIdentity',
  components: {CardCorporationLogo},
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
  },
  computed: {
    kicker(): string {
      return translateText('Corporation');
    },
  },
});
</script>
