<template>
  <div class="hand-card-item" :class="{'hand-card-item--unplayable': !playable}">
    <!--
      Card silhouette. Single click opens the modern fullscreen viewer —
      `@click.capture.stop` suppresses Card.vue's own (preference-gated)
      click so a tap always zooms. The РАЗЫГРАТЬ button sits OUTSIDE this
      wrapper so clicking it never also opens fullscreen.
    -->
    <div class="hand-card-item__card"
         tabindex="0"
         role="button"
         :aria-label="label"
         @click.capture.stop="$emit('open', entry.card)"
         @keydown.enter.prevent="$emit('open', entry.card)"
         @keydown.space.prevent="$emit('open', entry.card)">
      <Card :card="entry.card" />
    </div>

    <div class="hand-card-item__action">
      <button v-if="playable"
              type="button"
              class="hand-card-play-btn hand-card-play-btn--ready"
              @click.stop="$emit('play', entry.name)">
        <span class="hand-card-play-btn__glow" aria-hidden="true"></span>
        <span class="hand-card-play-btn__label" v-i18n>Play card</span>
      </button>

      <!--
        Disabled state. The button itself is non-interactive, so hover /
        focus is tracked on the wrapper (which is keyboard-focusable) to
        reveal the premium reason popover — no native title tooltip.
      -->
      <div v-else
           class="hand-card-item__disabled"
           tabindex="0"
           @mouseenter="showReason = true"
           @mouseleave="showReason = false"
           @focus="showReason = true"
           @blur="showReason = false">
        <button type="button" class="hand-card-play-btn hand-card-play-btn--disabled" disabled>
          <span class="hand-card-play-btn__label" v-i18n>Unavailable</span>
        </button>
        <transition name="hand-reason-fade">
          <HandCardReasonPopover v-if="showReason && reason !== undefined" :reason="reason" />
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {HandCardEntry} from '@/client/components/handCards/handCardModel';
import {UnplayableReason} from '@/client/components/handCards/cardPlayability';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';

/**
 * One slot in the hand grid: the card silhouette plus a play affordance
 * beneath it. Playable cards get the active РАЗЫГРАТЬ button; unplayable
 * cards are dimmed (CSS) and show a disabled button that reveals the
 * reason popover on hover / focus. Single click on the card opens
 * fullscreen.
 */
export default defineComponent({
  name: 'HandCardItem',
  components: {Card, HandCardReasonPopover},
  props: {
    entry: {
      type: Object as PropType<HandCardEntry>,
      required: true,
    },
  },
  emits: ['open', 'play'],
  data() {
    return {
      showReason: false,
    };
  },
  computed: {
    playable(): boolean {
      return this.entry.state.playable;
    },
    reason(): UnplayableReason | undefined {
      return this.entry.state.reason;
    },
    label(): string {
      return this.entry.name.split(':')[0];
    },
  },
});
</script>
