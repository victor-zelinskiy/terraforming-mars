<template>
  <div class="hand-card-item"
       :class="{
         'hand-card-item--unplayable': showUnplayableDim,
         'hand-card-item--sale': saleMode,
         'hand-card-item--sale-selected': saleMode && selected,
         'hand-card-item--select-disabled': selectDisabled,
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

      <!--
        Playability indicator — a compact ICON-ONLY badge (⊘) in the card's
        top-right corner (free of the cost top-left, the VP bottom-right and the
        expansion glyph bottom-left). Icon-only so it never wraps and never
        overlaps the victory-point badge. Rendered ONLY for a genuine RULES
        block (the card can't be played by the game rules) — a soft block (not
        your turn / finish your current action) is not a requirement failure, so
        it gets no badge. Shown only in sale/mandatory-select mode, where cards
        are not dimmed and the footer is a selection toggle. In normal play the
        disabled footer already owns the reason tooltip, so the card badge stays
        hidden to avoid duplicate affordances.
      -->
      <button v-if="showPlayBlockBadge"
              type="button"
              class="hand-card-item__playblock"
              :aria-label="$t('Cannot play now')"
              @click.stop
              @mouseenter="onReasonEnter"
              @mouseleave="onReasonLeave"
              @focus="onReasonEnter"
              @blur="onReasonLeave">
        <span class="hand-card-item__playblock-icon" aria-hidden="true">⊘</span>
      </button>

      <!--
        Self-replicating Robots host marker. This card lives ON the SRR card,
        not literally in hand; the game still lets the player play it with its
        cost reduced by the resources on it (the discounted cost is already
        shown on the card face). An absolute pill (no layout shift) flags the
        host + the discount; the full explanation rides a premium tooltip.
      -->
      <div v-if="isRobotCard" class="hand-card-item__robot" :data-hint="robotHint">
        <span class="hand-card-item__robot-mark" aria-hidden="true"></span>
        <span class="hand-card-item__robot-label" v-i18n>Robots</span>
        <span v-if="robotDiscount > 0" class="hand-card-item__robot-discount">−{{ robotDiscount }}</span>
      </div>
    </div>

    <div class="hand-card-item__action">
      <!--
        Sale mode (Sell patents standard project): the action is "select this
        card for sale", not "play it" — playability is irrelevant, every held
        card is selectable. Selection lives in module state and is submitted
        only on the final ПРОДАТЬ.
      -->
      <!--
        `aria-disabled` (NOT the native `disabled` attr) so the button still
        receives :hover/:focus — a native disabled button swallows hover and the
        reason popover below would never show (CLAUDE.md "disabled buttons
        swallow :hover"). The click is a safe no-op for a non-candidate
        (`toggleHandSelectSelection` ignores names outside `selectable`).
      -->
      <button v-if="saleMode"
              type="button"
              class="hand-card-sell-btn"
              :class="{'hand-card-sell-btn--selected': selected}"
              :aria-pressed="selected"
              :aria-disabled="selectDisabled"
              @click.stop="onSellClick"
              @mouseenter="selectDisabled && onReasonEnter()"
              @mouseleave="selectDisabled && onReasonLeave()"
              @focus="selectDisabled && onReasonEnter()"
              @blur="selectDisabled && onReasonLeave()">
        <span class="hand-card-sell-btn__glow" aria-hidden="true"></span>
        <span class="hand-card-sell-btn__label" v-i18n>{{ selected ? 'Deselect' : 'Select' }}</span>
      </button>

      <button v-else-if="playable"
              type="button"
              class="hand-card-play-btn hand-card-play-btn--ready"
              @click.stop="$emit('play', entry.name)">
        <span class="hand-card-play-btn__glow" aria-hidden="true"></span>
        <span class="hand-card-play-btn__label" v-i18n>Play now</span>
      </button>

      <!--
        Soft block (not your turn / finish your current action): the card meets
        every rule, it's just not the player's moment. Keep the РАЗЫГРАТЬ label
        (it IS playable, just not now) but disable it with a calm "waiting"
        style — never the "НЕДОСТУПНА" wording. Hover / focus reveals a simple
        one-line explanation, NOT the requirements list.
      -->
      <div v-else-if="softBlocked"
           class="hand-card-item__softblock"
           tabindex="0"
           @mouseenter="onReasonEnter"
           @mouseleave="onReasonLeave"
           @focus="onReasonEnter"
           @blur="onReasonLeave">
        <button type="button" class="hand-card-play-btn hand-card-play-btn--waiting" disabled>
          <span class="hand-card-play-btn__label" v-i18n>Play now</span>
        </button>
      </div>

      <!--
        Rules block in normal play: a disabled "НЕДОСТУПНА" footer. Hovering /
        focusing it reveals the requirements popover. In sale/select modes the
        footer is replaced by a selection toggle and the card badge carries this
        same playability reason.
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
        Reason hover. A RULES block shows the full requirements list; a SOFT
        block shows a single calm one-liner. Both anchor above the action footer
        and are flipped / nudged by `placeReason` so they stay inside the scroll
        area.
      -->
      <transition name="hand-reason-fade">
        <HandCardReasonPopover
          v-if="showReason && rulesBlocked && reasons.length > 0"
          :reasons="reasons"
          heading="Cannot play now"
          :class="{'hand-reason--below': reasonBelow}"
          :style="reasonStyle" />
        <div
          v-else-if="showReason && softBlocked && softText !== ''"
          class="hand-soft-reason"
          :class="{'hand-soft-reason--below': reasonBelow}"
          :style="reasonStyle"
          role="tooltip">
          <span class="hand-soft-reason__dot" aria-hidden="true"></span>
          <span class="hand-soft-reason__text">{{ softText }}</span>
        </div>
        <!--
          Mandatory SELECT mode, non-candidate card. The server only sends the
          candidate LIST for a SelectCard (no per-card rejection reason), so the
          one-liner states the card isn't eligible; the exact requirement is the
          prompt title shown in the overlay's select strip.
        -->
        <div
          v-else-if="showReason && selectDisabled"
          class="hand-soft-reason"
          :class="{'hand-soft-reason--below': reasonBelow}"
          :style="reasonStyle"
          role="tooltip">
          <span class="hand-soft-reason__dot" aria-hidden="true"></span>
          <!-- A client-driven pick supplies the EXACT reason this card can't be
               chosen (e.g. "No building or space tag"); a server SelectCard has
               no per-card reason, so fall back to the generic eligibility note. -->
          <span v-if="selectReason !== ''" class="hand-soft-reason__text">{{ selectReason }}</span>
          <span v-else class="hand-soft-reason__text" v-i18n>This card doesn't match the current selection</span>
        </div>
      </transition>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {HandCardEntry} from '@/client/components/handCards/handCardModel';
import {HandCardBlock} from '@/client/components/handCards/cardPlayability';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';

/**
 * One slot in the hand grid: the card silhouette plus a play affordance
 * beneath it.
 *
 * In normal mode an unplayable card is dimmed and its action footer reads
 * "НЕДОСТУПНА"; that footer owns the reason tooltip. In sale / mandatory-select
 * mode the card is NOT dimmed and the footer is the ВЫБРАТЬ / СНЯТЬ ВЫБОР
 * toggle, so a compact icon-only badge on the card carries the playability
 * reason without blocking selection. Single click on the card opens fullscreen.
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
    // Mandatory SELECT mode only: this card is NOT in the prompt's candidate
    // set (a filtered prompt) — show it for context but dim it + disable its
    // toggle so the player can see it's not a valid pick.
    selectDisabled: {
      type: Boolean,
      default: false,
    },
    // The EXACT premium-tooltip reason a select-disabled card can't be picked
    // (client-driven pick only — e.g. "No building or space tag"). '' → the
    // generic eligibility note is shown instead.
    selectReason: {
      type: String,
      default: '',
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
    block(): HandCardBlock {
      return this.entry.state.block;
    },
    // Genuinely unplayable by the game rules — drives the dim, the badge and
    // the requirements popover.
    rulesBlocked(): boolean {
      return this.block === 'rules';
    },
    // Playable by the rules, just not the player's window (not their turn /
    // finish current action). Calm disabled button + simple hover, no dim/badge.
    softBlocked(): boolean {
      return this.block === 'soft';
    },
    // Dim the card only for a RULES block in NORMAL mode. A soft block keeps the
    // card bright (it IS playable, just not now); in sale mode every card must
    // read as fully selectable, so it's never dimmed either.
    showUnplayableDim(): boolean {
      return this.rulesBlocked && !this.saleMode;
    },
    reasons(): ReadonlyArray<UnplayableReason> {
      return this.entry.state.reasons;
    },
    // Normal play already has a disabled footer with the same tooltip. Keep the
    // card-level badge only for sale / mandatory-select modes, where the footer
    // is repurposed as a selection toggle and cards are not dimmed.
    showPlayBlockBadge(): boolean {
      return this.saleMode && this.rulesBlocked && this.reasons.length > 0;
    },
    // The single calm one-liner for a soft block ("Not your turn right now" /
    // "Finish your current action first"), translated for the hover tooltip.
    softText(): string {
      const r = this.entry.state.softReason;
      return r === undefined ? '' : translateTextWithParams(r.message, [...(r.params ?? [])]);
    },
    label(): string {
      return this.entry.name.split(':')[0];
    },
    // A card hosted on Self-replicating Robots — playable from the hand overlay
    // with a cost discount equal to the resources on it.
    isRobotCard(): boolean {
      return this.entry.card.isSelfReplicatingRobotsCard === true;
    },
    // The SRR cost discount = the resource count stored on the hosted card.
    robotDiscount(): number {
      return this.entry.card.resources ?? 0;
    },
    // Premium-tooltip text for the host pill (full name + the discount).
    robotHint(): string {
      if (this.robotDiscount > 0) {
        return translateTextWithParams('Hosted on Self-replicating Robots, cost reduced by ${0} M€', [String(this.robotDiscount)]);
      }
      return translateText('Hosted on Self-replicating Robots');
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
    // Select-toggle click. A no-op for a non-candidate card (the button is only
    // aria-disabled, so the click still fires) — keeps the selection clean
    // without relying on the downstream guard alone.
    onSellClick(): void {
      if (this.selectDisabled) {
        return;
      }
      this.$emit('toggle-select', this.entry.name);
    },
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
      const pop = root.querySelector('.hand-reason, .hand-soft-reason') as HTMLElement | null;
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
