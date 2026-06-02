<template>
  <div class="hand-reason" role="tooltip">
    <span class="hand-reason__bar" aria-hidden="true"></span>
    <span class="hand-reason__lock" aria-hidden="true">✕</span>
    <span class="hand-reason__text">{{ text }}</span>
    <span v-if="tag !== undefined" class="hand-reason__tag card-tag" :class="'tag-' + tag" aria-hidden="true"></span>
    <i v-if="resource !== undefined" class="hand-reason__res resource_icon" :class="'resource_icon--' + resource" aria-hidden="true"></i>
    <span v-if="multiplier !== undefined" class="hand-reason__mult">×{{ multiplier }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {UnplayableReason} from '@/client/components/handCards/cardPlayability';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/**
 * Premium, fully custom reason popover for a card that can't be played
 * (NO native `title` tooltip — spec). Renders a short, game-language
 * explanation, with a tag / resource icon for tag and production
 * requirements so the player sees exactly which one is missing.
 * Positioning + show/hide is owned by `HandCardItem`.
 */
export default defineComponent({
  name: 'HandCardReasonPopover',
  props: {
    reason: {
      type: Object as PropType<UnplayableReason>,
      required: true,
    },
  },
  computed: {
    text(): string {
      const r = this.reason;
      switch (r.kind) {
      case 'turn':
        return translateText('Not your turn right now');
      case 'megacredits':
        return translateTextWithParams('Need ${0} more M€', [String(r.deficit)]);
      case 'param':
        return translateTextWithParams(r.message, r.params.slice());
      case 'tag':
        return translateText('Requires tag');
      case 'production':
        return translateText('Requires production');
      case 'generic':
      default:
        return translateText('Can\'t play this card right now');
      }
    },
    tag(): Tag | undefined {
      return this.reason.kind === 'tag' ? this.reason.tag : undefined;
    },
    resource(): Resource | undefined {
      return this.reason.kind === 'production' ? this.reason.resource : undefined;
    },
    multiplier(): number | undefined {
      if ((this.reason.kind === 'tag' || this.reason.kind === 'production') && this.reason.count > 1) {
        return this.reason.count;
      }
      return undefined;
    },
  },
});
</script>
