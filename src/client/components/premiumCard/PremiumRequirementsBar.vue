<template>
  <div class="pcard__reqs" :class="{'pcard__reqs--all': hasAll}">
    <template v-for="(req, i) in requirements" :key="i">
      <span v-if="i > 0" class="pcard-req__joiner">{{ joiner }}</span>
      <span class="pcard-req">
        <template v-if="req.isBinary">
          <span v-if="req.negation" class="pcard-req__minus">−</span>
          <span v-if="req.iconUrl !== undefined" class="pcard-req__icon" :style="iconStyle(req)"></span>
          <span v-else class="pcard-req__label">{{ binaryLabel(req) }}</span>
        </template>
        <template v-else>
          <span class="pcard-req__word">{{ comparatorWord(req) }}</span>
          <span class="pcard-req__value">{{ req.value }}{{ req.suffix }}</span>
          <span v-if="req.iconUrl !== undefined"
                class="pcard-req__icon"
                :class="{'pcard-req__icon--wide': isWideIcon(req)}"
                :style="iconStyle(req)"></span>
          <span v-else class="pcard-req__label">{{ req.label }}</span>
        </template>
      </span>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RequirementType} from '@/common/cards/RequirementType';
import {comparatorLabel} from '@/common/cards/requirementComparator';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {translateText} from '@/client/directives/i18n';
import {NormalizedRequirement} from './premiumCardViewModel';

/**
 * The copper requirements band («от 6 [icon] и [icon]») — the canonical
 * «от / до» wording rides the shared requirementComparator. Binary
 * requirements (party / chairman / plants-removed) draw icon-only.
 */
export default defineComponent({
  name: 'PremiumRequirementsBar',
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
    joiner(): string {
      return translateText('and');
    },
  },
  methods: {
    comparatorWord(req: NormalizedRequirement): string {
      return comparatorLabel(req.comparator, getPreferences().lang);
    },
    iconStyle(req: NormalizedRequirement): Record<string, string> {
      return req.iconUrl !== undefined ? {backgroundImage: `url(${req.iconUrl})`} : {};
    },
    isWideIcon(req: NormalizedRequirement): boolean {
      return req.type === RequirementType.VENUS || req.type === RequirementType.OXYGEN;
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
