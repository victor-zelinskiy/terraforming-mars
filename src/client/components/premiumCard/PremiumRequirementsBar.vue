<template>
  <div class="pcard__reqs" :class="{'pcard__reqs--all': hasAll}">
    <span class="pcard__reqs-node pcard__reqs-node--l" aria-hidden="true"></span>
    <template v-for="(req, i) in requirements" :key="i">
      <span v-if="i > 0" class="pcard-req__sep" aria-hidden="true"></span>
      <span class="pcard-req" :class="{'pcard-req--binary': req.isBinary}">
        <!-- binary requirement (party / chairman / plants-removed): icon-only
             with an optional «minus» overlay, or a text label for the party. -->
        <template v-if="req.isBinary">
          <span v-if="req.negation" class="pcard-req__minus" aria-hidden="true">−</span>
          <span v-if="req.iconUrl !== undefined" class="pcard-req__socket" :class="socketClass(req)">
            <span class="pcard-req__icon" :class="iconClass(req)" :style="iconStyle(req)"></span>
          </span>
          <span v-else class="pcard-req__label">{{ binaryLabel(req) }}</span>
        </template>
        <!-- formula requirement: [icon socket] [≥/≤] [value][suffix] -->
        <template v-else>
          <span v-if="req.iconUrl !== undefined" class="pcard-req__socket" :class="socketClass(req)">
            <span class="pcard-req__icon" :class="iconClass(req)" :style="iconStyle(req)"></span>
          </span>
          <span v-else class="pcard-req__label">{{ req.label }}</span>
          <PremiumRequirementOperator :comparator="req.comparator" />
          <span class="pcard-req__value">{{ req.value
            }}<span v-if="req.suffix" class="pcard-req__suffix">{{ req.suffix }}</span></span>
        </template>
      </span>
    </template>
    <span class="pcard__reqs-node pcard__reqs-node--r" aria-hidden="true"></span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RequirementType} from '@/common/cards/RequirementType';
import {translateText} from '@/client/directives/i18n';
import {NormalizedRequirement} from './premiumCardViewModel';
import PremiumRequirementOperator from './PremiumRequirementOperator.vue';

/**
 * The requirements CASSETTE — a structured metallic strip (gunmetal chassis +
 * inset copper panel + faceted hex ends) reading the threshold formula
 * «[parameter socket] ≥ 6». The comparator is a bespoke SVG glyph
 * (`PremiumRequirementOperator`), NOT the shared «от / до» word wording — the
 * premium face deliberately speaks the symbolic ≥/≤ language while the legacy
 * renderer keeps the RU words. Binary requirements (party / chairman /
 * plants-removed) draw icon-only. The «{all}» accent shifts the whole cassette
 * toward the crimson-copper `--pcard-any` hue shared with the fullscreen
 * «any player» rule highlight.
 */
export default defineComponent({
  name: 'PremiumRequirementsBar',
  components: {PremiumRequirementOperator},
  props: {
    requirements: {
      type: Array as () => ReadonlyArray<NormalizedRequirement>,
      required: true,
    },
  },
  computed: {
    hasAll(): boolean {
      return this.requirements.some((r) => r.all);
    },
  },
  methods: {
    iconStyle(req: NormalizedRequirement): Record<string, string> {
      return req.iconUrl !== undefined ? {backgroundImage: `url(${req.iconUrl})`} : {};
    },
    /** Oxygen / Venus icons are horizontal chips — a wider socket + icon. */
    isWideIcon(req: NormalizedRequirement): boolean {
      return req.type === RequirementType.VENUS || req.type === RequirementType.OXYGEN;
    },
    socketClass(req: NormalizedRequirement): Record<string, boolean> {
      return {'pcard-req__socket--wide': this.isWideIcon(req)};
    },
    iconClass(req: NormalizedRequirement): Record<string, boolean> {
      return {'pcard-req__icon--wide': this.isWideIcon(req)};
    },
    binaryLabel(req: NormalizedRequirement): string {
      if (req.party !== undefined) {
        return translateText(req.party);
      }
      return req.label !== undefined ? translateText(req.label) : '';
    },
  },
});
</script>
