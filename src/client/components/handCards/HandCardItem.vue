<template>
  <div class="hand-card-item"
       :class="{
         'hand-card-item--unplayable': showUnplayableDim,
         'hand-card-item--sale': saleMode,
         'hand-card-item--sale-selected': saleMode && selected,
         'hand-card-item--dissolving': dissolving,
         'hand-card-item--reason-open': showReason,
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

      <!--
        Playability indicator — a compact icon + text pill centred along the
        bottom edge of the card (clear of the cost top-left, the sale tick
        top-right, and the expansion glyph bottom-left). Rendered whenever the
        card can't be PLAYED right now, in BOTH normal and sale mode (so it
        never pops in / out when toggling sale), and purely SECONDARY: in sale
        mode the card stays fully selectable. The short label wraps to two
        lines on small cards instead of truncating. Hover / focus reveals the
        shared reason popover (hosted in the action footer below). No native
        title tooltip (spec).
      -->
      <button v-if="!playable && reasons.length > 0"
              type="button"
              class="hand-card-item__playblock"
              :aria-label="$t('Cannot play now')"
              @click.stop
              @mouseenter="onReasonEnter"
              @mouseleave="onReasonLeave"
              @focus="onReasonEnter"
              @blur="onReasonLeave">
        <span class="hand-card-item__playblock-icon" aria-hidden="true">⊘</span>
        <span class="hand-card-item__playblock-label" v-i18n>Cannot play</span>
      </button>
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
        Normal mode, unplayable: a disabled "НЕДОСТУПНА" footer. Hovering /
        focusing it ALSO reveals the reason popover (same as the card badge),
        so the player can read the WHY from either affordance.
      -->
      <div v-else
           class="hand-card-item__disabled"
           tabindex="0"
           @mouseenter="onReasonEnter"
           @mouseleave="onReasonLeave"
           @focus="onReasonEnter"
           @blur="onReasonLeave">
        <button type="button" class="hand-card-play-btn hand-card-play-btn--disabled" disabled>
          <span class="hand-card-play-btn__label" v-i18n>Unavailable</span>
        </button>
      </div>

      <!--
        Single shared reason popover for BOTH hover sources (card badge +
        footer). Anchored above the action footer, flipped / nudged by
        `placeReason` so it stays inside the scroll area.
      -->
      <transition name="hand-reason-fade">
        <HandCardReasonPopover
          v-if="showReason && reasons.length > 0"
          :reasons="reasons"
          heading="Cannot play now"
          :class="{'hand-reason--below': reasonBelow}"
          :style="reasonStyle" />
      </transition>
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
 * beneath it.
 *
 * Playability is shown as a compact icon-only badge on the card corner,
 * present in both normal and sale modes so it never pops in / out when
 * toggling sale. In normal mode an unplayable card is also dimmed and its
 * action footer reads "НЕДОСТУПНА"; in SALE mode the card is NOT dimmed and
 * the footer is the ВЫБРАТЬ / СНЯТЬ ВЫБОР toggle (the card stays sellable).
 * Hovering / focusing EITHER the badge OR the disabled footer reveals the
 * shared reason popover (server-derived reasons), anchored above the footer.
 * Single click on the card opens fullscreen.
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
    // True while this sold card plays its exit (dissolve) animation, just
    // before the sale is submitted and it leaves the hand.
    dissolving: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['open', 'play', 'toggle-select'],
  data() {
    return {
      showReason: false,
      // Flip the popover below the footer when there isn't room above.
      reasonBelow: false,
      // Horizontal nudge (px) so the popover stays inside the scroll area.
      reasonShift: 0,
    };
  },
  computed: {
    playable(): boolean {
      return this.entry.state.playable;
    },
    // Dim the card only in NORMAL mode. In sale mode an unplayable card must
    // read as fully selectable, so it's never dimmed — the icon badge carries
    // the (secondary) playability info instead.
    showUnplayableDim(): boolean {
      return !this.playable && !this.saleMode;
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
        // Keep the caret pointing at the footer after a sideways nudge.
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
    // doesn't spill past either edge. Anchored to the action footer (the
    // popover's positioned parent), which works for both hover sources.
    placeReason(): void {
      const root = this.$el as HTMLElement;
      const wrapper = root.querySelector('.hand-card-item__action') as HTMLElement | null;
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
