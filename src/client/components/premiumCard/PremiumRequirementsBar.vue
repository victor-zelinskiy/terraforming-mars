<template>
  <div class="pcard__reqs" :class="reqClass">
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
    <!-- ONE anchor micro-port (right) — the fullscreen info tether's connection
         point; a single calm node, not a pair of decorative facets. -->
    <span class="pcard__reqs-node" aria-hidden="true"></span>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RequirementType} from '@/common/cards/RequirementType';
import {translateText} from '@/client/directives/i18n';
import {NormalizedRequirement} from './premiumCardViewModel';
import PremiumRequirementOperator from './PremiumRequirementOperator.vue';

/**
 * The requirements CASSETTE — a STABLE wide constructive layer of the card (a
 * gunmetal chassis with a chamfered silhouette + an inset satin-copper enamel
 * panel + one calm anchor micro-port), not a content-hugging chip. Its width is
 * a fixed proportion of the card (`--single` → `--multi` → `--dense`), so the
 * zone reads identically across cards and separates the header from the art.
 *
 * Each requirement is a SEGMENT reading «[parameter socket] ≥ 6»: the icon is a
 * primary element, the value is bold + tabular, and the comparator is a bespoke
 * SVG glyph (`PremiumRequirementOperator`) sized ~1.2× the digit — expressive
 * but never dominating. Symbols only (≥/≤), never the legacy «от / до» words.
 * Multiple requirements are split by ONE slim illuminated divider. Binary
 * requirements (party / chairman / plants-removed) draw icon-only. The «{all}»
 * variant swaps the copper enamel to crimson-copper AND adds a crimson inner
 * kant (a STRUCTURAL cue, not just hue), sharing `--pcard-any` with the
 * fullscreen «any player» rule highlight.
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
    /** Width/density variant — the cassette stays a STABLE wide zone; the width
     *  scales in controlled steps with the requirement count (single → multi →
     *  dense), never auto-shrinking to the content. */
    reqClass(): Record<string, boolean> {
      const n = this.requirements.length;
      return {
        'pcard__reqs--all': this.hasAll,
        'pcard__reqs--multi': n > 1,
        'pcard__reqs--dense': n > 2,
      };
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
