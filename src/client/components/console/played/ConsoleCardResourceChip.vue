<template>
  <span class="con-cardres"
        :class="['con-cardres--' + variant, {'con-cardres--zero': count === 0, 'con-cardres--pop': pop}]"
        aria-hidden="true">
    <i class="con-cardres__icon" :class="iconClass"></i>
    <b class="con-cardres__n">{{ count }}</b>
  </span>
</template>

<script lang="ts">
/**
 * THE CARD RESOURCE CHIP — how many of a card's OWN resource are on it, said
 * once, the same way, everywhere.
 *
 * WHAT IT REPLACES. The count was told in four incompatible dialects at once: a
 * gold disc carrying a bare number (no icon at all — the player had to already
 * know the card holds floaters), a compact icon+number chip inside the
 * self-target proxy, a full-width «2 на этой карте» plate under the hero, and
 * the Result line's `2 → 3`. Three of those state the SAME fact.
 *
 * THE DIVISION OF LABOUR the chip settles:
 *   · this chip, ON the card  — the CURRENT count. Neutral dark gold.
 *   · the Result / Summary    — the PROJECTED change (`2 → 3`). Emerald.
 * Green belongs to what WILL happen; a standing quantity is not an event, so it
 * never wears the gain colour.
 *
 * ⚠️ IT IS AUTHORED IN THE CARD'S OWN PX SPACE, and that is what makes it
 * physical rather than a floating overlay. Every console host draws its card
 * inside a CSS `zoom` context (`.con-composer__actcard`, `.con-ptsel__slot`)
 * whose factor already folds in `--con-ui-scale`; a rem-authored child there
 * would be scaled twice. Px means the chip is measured in the same 320×460
 * space the card face is — so it rides the card's zoom, its focus lift, its
 * scale, a FLIP and the fullscreen inspect BY CONSTRUCTION, with no second
 * animation to keep in sync and no overlay to re-position. The one variant that
 * is NOT on a card (`proxy`) is rem-authored, because there it is ordinary UI.
 *
 * It knows no card and no resource: the icon key and the count arrive from the
 * caller, which already holds the server's `{type, count}`.
 */
import {defineComponent} from 'vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';

export default defineComponent({
  name: 'ConsoleCardResourceChip',
  props: {
    /** Resource key (`CardResource` value or an `optionIcons` key). */
    icon: {type: String, required: true},
    count: {type: Number, required: true},
    /**
     * `card` — mounted on a card face, in that card's px space.
     * `proxy` — the self-target handle's own compact read, in rem.
     */
    variant: {type: String, default: 'card'},
    /** The one-shot gain beat, when a host owns one. */
    pop: {type: Boolean, default: false},
  },
  computed: {
    iconClass(): string {
      // The same normalisation every console surface uses for a resource key.
      return iconClassFor(this.icon.toLowerCase().replace(/\s+/g, '-'));
    },
  },
});
</script>
