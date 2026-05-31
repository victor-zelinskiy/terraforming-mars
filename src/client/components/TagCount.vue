<template>
  <div :class="outerClass">
    <underground-token v-if="claimedToken !== undefined" :token="claimedToken" location="tag-count"/>
    <Tag v-else :tag="(tag as CardTag)" :size="size" :type="type"/>
    <span :class="innerClass">{{ count }}</span>
    <AnimatedMetricValue
      v-if="feedbackEnabled"
      :value="(count as number)"
      :metricKey="metricKey"
      :scopeKey="scopeKey"
      :epoch="epoch"
      :variant="feedbackVariant" />
  </div>
</template>

<script lang="ts">

import {defineComponent, PropType} from 'vue';
import Tag from '@/client/components/Tag.vue';
import UndergroundToken from '@/client/components/underworld/UndergroundToken.vue';
import {Tag as CardTag} from '@/common/cards/Tag';
import {SpecialTags} from '@/client/cards/SpecialTags';
import {TemporaryBonusToken} from '@/common/underworld/UndergroundResourceToken';
import {ClaimedToken} from '@/common/underworld/UnderworldPlayerData';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import type {DeltaChipVariant} from '@/client/components/feedback/DeltaChip.vue';

// Display-only tags used in PlayerTags for overview counts.
type DisplayTag = 'vp' | 'tr' | 'handicap' | 'cards' | 'escape';

/*
 * Tag IDs that should use the more spacious "misc" variant rather
 * than the compact tag variant. These are non-card-tag counters where
 * a change is conceptually closer to a global stat update (a new
 * city / colony / influence step) than to a card tag arriving.
 */
const MISC_VARIANT_TAGS = new Set<string>([
  SpecialTags.CITY_COUNT,
  SpecialTags.COLONY_COUNT,
  SpecialTags.INFLUENCE,
  SpecialTags.UNDERGROUND_TOKEN_COUNT,
  SpecialTags.CORRUPTION,
  SpecialTags.NEGATIVE_VP,
  'cards',
]);

/*
 * Tag IDs whose change is game-defining and deserves a stronger,
 * dedicated transition: Victory Points and Terraforming Rating.
 * Anything in this set bypasses MISC_VARIANT_TAGS — the visual
 * vocabulary is "this changed the score" rather than "another
 * counter ticked".
 */
const SCORE_VARIANT_TAGS = new Set<string>([
  'vp',
  'tr',
]);

export default defineComponent({
  name: 'tag-count',
  props: {
    tag: {
      type: String as () => CardTag | SpecialTags | DisplayTag,
      required: true,
    },
    undergroundToken: {
      type: String as () => TemporaryBonusToken | undefined,
      required: false,
      default: undefined,
    },
    count: {
      type: [Number, String] as PropType<number | string>,
    },
    size: {
      type: String,
      required: true,
    },
    type: {
      type: String,
    },
    showWhenZero: {
      // When true, show even if the value is zero.
      required: false,
      default: false,
    },
    /*
     * Change-feedback addressing. Empty scopeKey disables feedback
     * — call sites that don't carry a player scope (legacy
     * spectator view, card-zoom tags, etc.) just omit it and keep
     * the old presentation untouched.
     */
    scopeKey: {
      type: String,
      default: '',
    },
    epoch: {
      type: String,
      default: '',
    },
  },
  components: {
    Tag,
    UndergroundToken,
    AnimatedMetricValue,
  },
  computed: {
    outerClass(): string {
      const classes = ['tag-display'];
      if (this.count === 0 && this.showWhenZero === false) {
        classes.push('tag-no-show');
      }
      return classes.join(' ');
    },
    innerClass(): string {
      const classes = ['tag-count-display'];
      if (this.count === 0 && this.showWhenZero === false) {
        classes.push('tag-count-no-show');
      }

      return classes.join(' ');
    },
    claimedToken(): ClaimedToken | undefined {
      if (this.undergroundToken === undefined) {
        return undefined;
      }
      return {token: this.undergroundToken, shelter: false, active: true};
    },
    /*
     * Feedback is only enabled when (a) the caller passed a non-
     * empty scopeKey, (b) the count is a real number — hidden-VP
     * placeholders ('?') and other string values are excluded —
     * and (c) the tag isn't a 'separator'/'all'/'handicap'-style
     * sentinel that doesn't represent a live game value.
     */
    feedbackEnabled(): boolean {
      if (this.scopeKey === '') {
        return false;
      }
      if (typeof this.count !== 'number') {
        return false;
      }
      if (this.tag === 'handicap' || this.tag === 'escape') {
        return false;
      }
      return true;
    },
    metricKey(): string {
      return `tag.${this.tag}`;
    },
    feedbackVariant(): DeltaChipVariant {
      if (SCORE_VARIANT_TAGS.has(this.tag)) {
        return 'score';
      }
      if (MISC_VARIANT_TAGS.has(this.tag)) {
        return 'misc';
      }
      return 'tag';
    },
  },
});
</script>

