<template>
  <div class="card-requirement">
      <div class="card-item-container" :class="nextTo">
        <!-- REMOVED_PLANTS: binary signal — plants were removed this generation -->
        <template v-if="type === RequirementType.REMOVED_PLANTS">
          <div class="card-special card-minus"></div>
          <div class="card-resource card-resource-plant red-outline"></div>
        </template>
        <!-- PRODUCTION: production box + threshold operator + count -->
        <template v-else-if="type === RequirementType.PRODUCTION">
          <div class="card-production-box card-production-box--req">
            <div class="card-production-box-row">
              <div class="card-production-box-row-item">
                <div class="card-item-container">
                  <div :class="productionClass"></div>
                </div>
              </div>
            </div>
          </div>
          <span class="card-req-operator" :class="{'card-req-operator--word': wordOperator}">{{ operator }}</span>
          <span class="card-req-value">{{ count }}</span>
        </template>
        <!-- PARTY: specific party must rule / be allied — CardParty handles the visual, no threshold -->
        <CardParty v-else-if="type === RequirementType.PARTY" :party="party" size="req" />
        <!-- CHAIRMAN: binary — you must be the chairman, no threshold -->
        <div v-else-if="type === RequirementType.CHAIRMAN" :class="componentClasses"></div>
        <!-- Standard countable: [icon] [≥/≤ | от/до/минимум/максимум] [value][suffix] -->
        <template v-else>
          <div :class="componentClasses"></div>
          <span class="card-req-operator" :class="{'card-req-operator--word': wordOperator}">{{ operator }}</span>
          <span class="card-req-value">{{ amount }}{{ suffix }}</span>
        </template>
      </div>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {CardRequirementDescriptor, requirementType} from '@/common/cards/CardRequirementDescriptor';
import {RequirementType} from '@/common/cards/RequirementType';
import {comparatorLabel, requirementScale} from '@/common/cards/requirementComparator';
import {getPreferences} from '@/client/utils/PreferencesManager';
import CardParty from '@/client/components/card/CardParty.vue';
import {PartyName} from '@/common/turmoil/PartyName';

export default defineComponent({
  name: 'CardRequirementComponent',
  props: {
    requirement: {
      type: Object as () => CardRequirementDescriptor,
      required: true,
    },
    leftMargin: {
      type: Boolean,
      required: false,
      default: true,
    },
  },
  components: {
    CardParty,
  },
  computed: {
    type(): RequirementType {
      return requirementType(this.requirement);
    },
    count(): number {
      // TAG requirements without an explicit count mean "at least 1 of this tag".
      // populateCount() on the server does not fill count for TAG (no numeric synonym),
      // so count arrives as undefined — default to 1, not 0.
      if (this.requirement.count === undefined && this.type === RequirementType.TAG) {
        return 1;
      }
      return this.requirement.count ?? 0;
    },
    // Threshold operator. English (and every non-RU locale) keeps the compact
    // math glyphs (≥ for minimums, ≤ for maximums). Russian replaces them with
    // short words — «от / до» for global-parameter scales, «минимум / максимум»
    // for object counts — so the requirement reads as plain language while the
    // icon and the numeric value are untouched (display-only).
    // Binary types (REMOVED_PLANTS, PARTY, CHAIRMAN) are handled in the template separately.
    operator(): string {
      const kind = this.requirement.max ? 'max' : 'min';
      return comparatorLabel(kind, requirementScale(this.type), getPreferences().lang);
    },
    // True when the operator is rendered as a word (RU) rather than a glyph —
    // drives a smaller type size so a long word like «минимум» stays compact.
    wordOperator(): boolean {
      return getPreferences().lang === 'ru';
    },
    // Numeric threshold — always the raw count value.
    amount(): number {
      return this.count;
    },
    suffix(): string {
      switch (this.type) {
      case RequirementType.OXYGEN:
      case RequirementType.VENUS:
        return '%';
      case RequirementType.TEMPERATURE:
        return '°C';
      }
      return '';
    },
    componentClasses(): Array<string> {
      const classes = this.componentClassArray;
      if (this.requirement.all) {
        classes.push('red-outline');
      }
      return classes;
    },
    componentClassArray(): Array<string> {
      switch (this.type) {
      case RequirementType.OXYGEN:
        return ['card-global-requirement', 'card-oxygen--req'];
      case RequirementType.TEMPERATURE:
        return ['card-global-requirement', 'card-temperature--req'];
      case RequirementType.OCEANS:
        return ['card-global-requirement', 'card-ocean--req'];
      case RequirementType.VENUS:
        return ['card-global-requirement', 'card-venus--req'];
      case RequirementType.TR:
        return ['card-tile', 'card-tr', 'card-tr--req'];
      case RequirementType.RESOURCE_TYPES:
        return ['card-resource', 'card-resource-wild'];
      case RequirementType.GREENERIES:
        return ['card-tile', 'greenery-tile--M', 'tile--req'];
      case RequirementType.CITIES:
        return ['card-tile', 'city-tile--M', 'tile--req'];
      case RequirementType.COLONIES:
        return ['card-resource-colony', 'card-resource-colony--req'];
      case RequirementType.FLOATERS:
        return ['card-resource-tag--S', 'card-tag-floater'];
      case RequirementType.CHAIRMAN:
        return ['card-chairman--req'];
      case RequirementType.PARTY_LEADERS:
        return ['card-party-leader--req'];
      case RequirementType.TAG:
        return ['card-resource-tag--S', 'card-tag-' + this.requirement.tag];
      case RequirementType.HABITAT_RATE:
        return ['card-habitat-rate', 'card-habitat-rate--req'];
      case RequirementType.MINING_RATE:
        return ['card-mining-rate', 'card-mining-rate--req'];
      case RequirementType.LOGISTIC_RATE:
        return ['card-logistic-rate', 'card-logistic-rate--req'];
      case RequirementType.HABITAT_TILES:
        return ['card-tile-lunar-habitat--S', 'tile--req'];
      case RequirementType.MINING_TILES:
        return ['card-tile-lunar-mine--S', 'tile--req'];
      case RequirementType.ROAD_TILES:
        return ['card-tile-lunar-road--S', 'tile--req'];
      case RequirementType.UNDERGROUND_TOKENS:
        return ['card-underground-resources'];
      case RequirementType.CORRUPTION:
        return ['card-resource', 'card-resource-corruption'];
      case RequirementType.PRODUCTION:
      case RequirementType.REMOVED_PLANTS:
        // Handled by dedicated template branches, not via classes.
        break;
      }
      return [];
    },
    party(): PartyName {
      if (this.type === RequirementType.PARTY && this.requirement.party) {
        return this.requirement.party;
      } else {
        // Doesn't matter what this value is, as it is ignored.
        return PartyName.GREENS;
      }
    },
    productionClass(): string {
      if (this.type === RequirementType.PRODUCTION) {
        const resource = this.requirement.production;
        return `card-resource card-resource-${resource}`;
      } else {
        // Doesn't matter what this value is, as it is ignored.
        return '';
      }
    },
    RequirementType() {
      return RequirementType;
    },
    nextTo(): string {
      if (this.requirement.nextTo) {
        return 'nextto-leftside';
      }
      if (this.leftMargin) {
        return 'nextto-rightside';
      }
      return '';
    },
  },
});
</script>
