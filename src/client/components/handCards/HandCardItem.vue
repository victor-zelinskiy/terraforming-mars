<template>
  <div class="hand-card-item"
       :class="{
         'hand-card-item--unplayable': !playable,
         'hand-card-item--sale': saleMode,
         'hand-card-item--sale-selected': saleMode && selected,
       }">
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
      <span v-if="saleMode && selected" class="hand-card-item__sale-tick" aria-hidden="true">✓</span>
    </div>

    <div class="hand-card-item__action">
      <!--
        Sale mode (Sell patents standard project): the action is "select this
        card for sale", not "play it" — playability is irrelevant, every held
        card is selectable. Selection lives in module state and is submitted
        only on the final ПРОДАТЬ.
      -->
      <button v-if="saleMode"
              type="button"
              class="hand-card-sell-btn"
              :class="{'hand-card-sell-btn--selected': selected}"
              :aria-pressed="selected"
              @click.stop="$emit('toggle-select', entry.name)">
        <span class="hand-card-sell-btn__glow" aria-hidden="true"></span>
        <span class="hand-card-sell-btn__label" v-i18n>{{ selected ? 'Deselect' : 'Select' }}</span>
      </button>

      <button v-else-if="playable"
              type="button"
              class="hand-card-play-btn hand-card-play-btn--ready"
              @click.stop="$emit('play', entry.name)">
        <span class="hand-card-play-btn__glow" aria-hidden="true"></span>
        <span class="hand-card-play-btn__label" v-i18n>Play card</span>
      </button>

      <!--
        Disabled state. The button is a compact "НЕДОСТУПНА" footer; the
        concrete server-derived reasons live in a premium popover revealed on
        hover / focus of the (keyboard-focusable) wrapper — no native title.
        `placeReason` flips the popover above/below and nudges it sideways so
        it never spills out of the scroll area or fully covers the card.
      -->
      <div v-else
           class="hand-card-item__disabled"
           :class="{'hand-card-item__disabled--below': reasonBelow}"
           tabindex="0"
           @mouseenter="onReasonEnter"
           @mouseleave="onReasonLeave"
           @focus="onReasonEnter"
           @blur="onReasonLeave">
        <button type="button" class="hand-card-play-btn hand-card-play-btn--disabled" disabled>
          <span class="hand-card-play-btn__label" v-i18n>Unavailable</span>
        </button>
        <transition name="hand-reason-fade">
          <HandCardReasonPopover v-if="showReason && reasons.length > 0" :reasons="reasons" :style="reasonStyle" />
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {HandCardEntry} from '@/client/components/handCards/handCardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';

/**
 * One slot in the hand grid: the card silhouette plus a play affordance
 * beneath it. Playable cards get the active РАЗЫГРАТЬ button; unplayable
 * cards are dimmed (CSS) and show a compact "НЕДОСТУПНА" footer that reveals
 * a premium reason popover (server-derived reasons) on hover / focus. Single
 * click on the card opens fullscreen.
 */
export default defineComponent({
  name: 'HandCardItem',
  components: {Card, HandCardReasonPopover},
  props: {
    entry: {
      type: Object as PropType<HandCardEntry>,
      required: true,
    },
    // Sell-patents sale mode: swap the play affordance for a select toggle.
    saleMode: {
      type: Boolean,
      default: false,
    },
    // Whether this card is currently selected for sale (sale mode only).
    selected: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['open', 'play', 'toggle-select'],
  data() {
    return {
      showReason: false,
      // Flip the popover below the button when there isn't room above.
      reasonBelow: false,
      // Horizontal nudge (px) so the popover stays inside the scroll area.
      reasonShift: 0,
    };
  },
  computed: {
    playable(): boolean {
      return this.entry.state.playable;
    },
    reasons(): ReadonlyArray<UnplayableReason> {
      return this.entry.state.reasons;
    },
    label(): string {
      return this.entry.name.split(':')[0];
    },
    reasonStyle(): Record<string, string> {
      return {
        'marginLeft': `${this.reasonShift}px`,
        // Keep the caret pointing at the button after a sideways nudge.
        '--reason-caret': `${-this.reasonShift}px`,
      };
    },
  },
  methods: {
    onReasonEnter(): void {
      this.showReason = true;
      this.$nextTick(() => this.placeReason());
    },
    onReasonLeave(): void {
      this.showReason = false;
      this.reasonBelow = false;
      this.reasonShift = 0;
    },
    // Measure once the popover is in the DOM: flip below when it would
    // overflow the top of the scroll area, and nudge it horizontally so it
    // doesn't spill past either edge.
    placeReason(): void {
      const root = this.$el as HTMLElement;
      const wrapper = root.querySelector('.hand-card-item__disabled') as HTMLElement | null;
      const pop = root.querySelector('.hand-reason') as HTMLElement | null;
      if (wrapper === null || pop === null) {
        return;
      }
      const scroller = root.closest('.hand-board__body') as HTMLElement | null;
      const wrapRect = wrapper.getBoundingClientRect();
      const scRect = scroller?.getBoundingClientRect();
      const pad = 8;

      const limitTop = scRect ? scRect.top : 0;
      this.reasonBelow = (wrapRect.top - pop.offsetHeight - 12) < limitTop;

      if (scRect !== undefined) {
        const popW = pop.offsetWidth;
        const centerX = wrapRect.left + wrapRect.width / 2;
        const leftEdge = centerX - popW / 2;
        const rightEdge = centerX + popW / 2;
        let shift = 0;
        if (leftEdge < scRect.left + pad) {
          shift = (scRect.left + pad) - leftEdge;
        } else if (rightEdge > scRect.right - pad) {
          shift = (scRect.right - pad) - rightEdge;
        }
        this.reasonShift = Math.round(shift);
      }
    },
  },
});
</script>
