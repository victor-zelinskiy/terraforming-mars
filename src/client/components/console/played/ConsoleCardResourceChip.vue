<template>
  <span class="con-cardres"
        :class="['con-cardres--' + variant, {'con-cardres--zero': count === 0}]"
        aria-hidden="true">
    <i class="con-cardres__icon" :class="iconClass"></i>
    <b class="con-cardres__n">{{ count }}</b>
  </span>
</template>

<script lang="ts">
/**
 * THE SELF-TARGET PROXY'S RESOURCE READING.
 *
 * ⚠️ IT IS NOT FOR CARDS. A card states its own stored count through the
 * premium face's carved capsule, at bottom-left beside the expansion stamp
 * (`.pcard__res`) — one anchor, reserved by the premium language long before
 * this. Hosts feed that capsule by passing the live `CardModel` through
 * `ConsoleCardFaceLite`; anything drawn ON TOP of a card here would be a second
 * counter at a second anchor, which is exactly the «the layout jumps» report
 * that removed the overlay this component used to render.
 *
 * What is left is the one reading that has no card to sit on: the «ИСТОЧНИК ·
 * ЭТА КАРТА» proxy is a navigation stop, not a face, and its option's current
 * amount still belongs beside its name.
 *
 * The division of labour, unchanged:
 *   · the card's own capsule — the CURRENT count. Neutral warm gold.
 *   · the Result / Summary   — the PROJECTED change (`2 → 3`). Emerald.
 * Green belongs to what WILL happen; a standing quantity is not an event.
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
    /** Today only `proxy` — see the header on why nothing rides a card. */
    variant: {type: String, default: 'proxy'},
  },
  computed: {
    iconClass(): string {
      // The same normalisation every console surface uses for a resource key.
      return iconClassFor(this.icon.toLowerCase().replace(/\s+/g, '-'));
    },
  },
});
</script>
