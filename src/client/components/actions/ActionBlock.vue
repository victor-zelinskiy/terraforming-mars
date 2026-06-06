<template>
  <!--
    One activatable ACTION source (a card / corporation). Unlike an effect block,
    this READS AS A BUTTON: the action graphic sits in the body, a prominent
    ВЫПОЛНИТЬ control sits in the footer. The whole block reflects the action's
    availability state (available / soft / rules / activated). Hover the body →
    the SOURCE card floats in (emitted up to the overlay's shared popover); click
    the body → fullscreen. The footer ВЫПОЛНИТЬ emits `activate`; when disabled it
    reveals the premium reason popover on hover/focus.
  -->
  <div class="action-block"
       :class="[
         'action-block--' + state.status,
         {
           'action-block--corp': isCorporation,
           'action-block--disabled-card': isDisabled,
         },
       ]"
       :data-test="'action-block-' + cardName">
    <div class="action-block__head">
      <span class="action-block__accent" aria-hidden="true"></span>
      <span class="action-block__source" v-i18n>{{ cardName }}</span>
      <span class="action-block__type" aria-hidden="true">
        <span v-if="isCorporation" v-i18n>Corporation</span>
        <span v-else v-i18n>Card</span>
      </span>
      <span v-if="headerBadge !== ''"
            class="action-block__status"
            :class="'action-block__status--' + state.status">
        <span class="action-block__status-dot" aria-hidden="true"></span>
        <span v-i18n>{{ headerBadge }}</span>
      </span>
    </div>

    <div class="action-block__body"
         tabindex="0"
         role="button"
         @mouseenter="onPreviewEnter"
         @mouseleave="onPreviewLeave"
         @focus="onPreviewEnter"
         @blur="onPreviewLeave"
         @click="$emit('open', cardName)"
         @keydown.enter="$emit('open', cardName)">
      <div v-for="node in group.nodes"
           :key="node.key"
           class="action-block__render-wrap">
        <div v-if="node.actionNode !== undefined" class="action-block__render card-container" v-i18n v-strip-action-prefix>
          <CardRenderEffectBoxComponent :effectData="node.actionNode" />
        </div>
        <div v-else-if="node.renderRoot !== undefined" class="action-block__render card-container" v-i18n v-strip-action-prefix>
          <CardRenderData :renderData="node.renderRoot" />
          <div v-if="node.text" class="action-block__render-desc"><span v-i18n>{{ node.text }}</span></div>
        </div>
        <div v-else class="action-block__render-text" v-i18n v-strip-action-prefix>{{ node.text }}</div>
      </div>
    </div>

    <div class="action-block__footer">
      <!-- Activatable right now — the single strong CTA. -->
      <button v-if="state.activatable"
              type="button"
              class="action-activate-btn action-activate-btn--ready"
              :data-test="'action-activate-' + cardName"
              @click.stop="$emit('activate', cardName)">
        <span class="action-activate-btn__glow" aria-hidden="true"></span>
        <span class="action-activate-btn__icon" aria-hidden="true">▶</span>
        <span class="action-activate-btn__label" v-i18n>Activate</span>
      </button>

      <!-- Disabled (soft / rules / activated) — premium reason popover on hover. -->
      <div v-else
           class="action-block__disabled-wrap"
           tabindex="0"
           @mouseenter="onReasonEnter"
           @mouseleave="onReasonLeave"
           @focus="onReasonEnter"
           @blur="onReasonLeave">
        <button type="button"
                class="action-activate-btn"
                :class="'action-activate-btn--' + state.status"
                disabled>
          <span class="action-activate-btn__label" v-i18n>{{ footerLabel }}</span>
        </button>

        <transition name="action-reason-fade">
          <HandCardReasonPopover
            v-if="showReason && state.status === 'rules' && state.reasons.length > 0"
            :reasons="state.reasons"
            heading="Cannot activate"
            :class="{'hand-reason--below': reasonBelow}"
            :style="reasonStyle" />
          <div v-else-if="showReason && softText !== ''"
               class="hand-soft-reason"
               :class="{'hand-soft-reason--below': reasonBelow}"
               :style="reasonStyle"
               role="tooltip">
            <span class="hand-soft-reason__dot" aria-hidden="true"></span>
            <span class="hand-soft-reason__text">{{ softText }}</span>
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import {ActionState} from '@/client/components/actions/actionPlayability';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ActionBlock',
  components: {CardRenderEffectBoxComponent, CardRenderData, HandCardReasonPopover},
  directives: {stripActionPrefix},
  props: {
    entry: {
      type: Object as PropType<ActionEntry>,
      required: true,
    },
  },
  emits: ['namehover', 'open', 'activate'],
  data() {
    return {
      showReason: false,
      reasonBelow: false,
      reasonShift: 0,
    };
  },
  computed: {
    group(): ActionGroup {
      return this.entry.group;
    },
    cardName(): CardName {
      return this.entry.cardName;
    },
    isCorporation(): boolean {
      return this.entry.isCorporation;
    },
    isDisabled(): boolean {
      return this.entry.group.isDisabled;
    },
    state(): ActionState {
      return this.entry.state;
    },
    headerBadge(): string {
      switch (this.state.status) {
      case 'activated': return 'Activated';
      case 'rules': return 'Unavailable';
      case 'soft': return 'Not now';
      default: return '';
      }
    },
    footerLabel(): string {
      switch (this.state.status) {
      case 'activated': return 'Activated';
      case 'rules': return 'Unavailable';
      default: return 'Activate'; // soft — disabled, calm
      }
    },
    softText(): string {
      const r = this.state.softReason;
      return r === undefined ? '' : translateTextWithParams(r.message, [...(r.params ?? [])]);
    },
    reasonStyle(): Record<string, string> {
      return {
        'marginLeft': `${this.reasonShift}px`,
        '--reason-caret': `${-this.reasonShift}px`,
      };
    },
  },
  methods: {
    onPreviewEnter(e: MouseEvent | FocusEvent): void {
      const el = e.currentTarget as HTMLElement | null;
      if (el === null) {
        return;
      }
      this.$emit('namehover', {name: this.cardName, rect: el.getBoundingClientRect()});
    },
    onPreviewLeave(): void {
      this.$emit('namehover', null);
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
    // Flip the popover below the footer when there's no room above, and nudge it
    // horizontally so it never spills past the scroll area's edges. Mirrors
    // HandCardItem.placeReason.
    placeReason(): void {
      const root = this.$el as HTMLElement;
      const wrapper = root.querySelector('.action-block__disabled-wrap') as HTMLElement | null;
      const pop = root.querySelector('.hand-reason, .hand-soft-reason') as HTMLElement | null;
      if (wrapper === null || pop === null) {
        return;
      }
      const scroller = root.closest('.actions-board__body') as HTMLElement | null;
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
