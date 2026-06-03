<template>
  <div class="hand-reason" role="tooltip">
    <div class="hand-reason__head">
      <span class="hand-reason__lock" aria-hidden="true">✕</span>
      <span class="hand-reason__head-label" v-i18n>Unavailable</span>
    </div>
    <ul class="hand-reason__list">
      <li
        v-for="(r, i) in reasons"
        :key="i"
        class="hand-reason__row"
        :class="'hand-reason__row--' + r.type">
        <span class="hand-reason__bar" aria-hidden="true"></span>
        <span
          v-if="r.tag !== undefined"
          class="hand-reason__icon card-tag"
          :class="'tag-' + r.tag"
          aria-hidden="true"></span>
        <i
          v-else-if="r.resource !== undefined"
          class="hand-reason__icon resource_icon"
          :class="'resource_icon--' + r.resource"
          aria-hidden="true"></i>
        <span v-else class="hand-reason__glyph" aria-hidden="true"></span>
        <span class="hand-reason__text">{{ text(r) }}</span>
        <span v-if="r.current !== undefined" class="hand-reason__now">{{ now(r) }}</span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateTextWithParams} from '@/client/directives/i18n';

/**
 * Premium, fully custom popover listing WHY a hand card can't be played
 * (NO native `title` tooltip — spec). Reasons are produced authoritatively
 * on the server (`unplayableReasons.ts`) and arrive as a list: cost,
 * requirements, tags, production, tile placement, targets, bespoke rules.
 * Each row renders a category accent, an optional tag / resource icon, the
 * translated text, and a muted "now: N" badge showing the current value so
 * the player sees the gap at a glance. Positioning (above / below, clamped)
 * is owned by the host (`HandCardItem` / the fullscreen actions slot).
 */
export default defineComponent({
  name: 'HandCardReasonPopover',
  props: {
    reasons: {
      type: Array as PropType<ReadonlyArray<UnplayableReason>>,
      required: true,
    },
  },
  methods: {
    text(r: UnplayableReason): string {
      return translateTextWithParams(r.message, [...(r.params ?? [])]);
    },
    now(r: UnplayableReason): string {
      const unit = r.message.includes('%') ? '%' : (r.message.includes('°C') ? '°C' : '');
      return translateTextWithParams('Now: ${0}', [`${r.current}${unit}`]);
    },
  },
});
</script>
