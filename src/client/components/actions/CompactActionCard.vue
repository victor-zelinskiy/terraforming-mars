<template>
  <!--
    A COMPACT action summary — just the printed action graphic (cost/resources →
    result) + a small status badge, no long description and no ВЫПОЛНИТЬ button.
    One reusable renderer used in BOTH the overlay's compact grid rows AND the
    confirmation modal's mini source card. Selecting it never EXECUTES — it only
    focuses the action (the overlay's details panel / modal owns the CTA). A
    text-only / override action renders in the SAME premium chrome (no legacy block).
  -->
  <div class="compact-action"
       :class="[
         'compact-action--' + status,
         {'compact-action--selected': selected, 'compact-action--dense': dense, 'compact-action--static': !interactive},
       ]"
       :tabindex="interactive && focusable ? 0 : -1"
       :role="interactive ? 'button' : undefined"
       :aria-pressed="interactive ? selected : undefined"
       :data-hint="reason"
       :data-test="dataTest"
       @click="onClick"
       @keydown.enter.prevent="onClick"
       @keydown.space.prevent="onClick"
       @mouseenter="onEnter"
       @mouseleave="onLeave"
       @focus="onEnter"
       @blur="onLeave">
    <!-- The action graphic node (scoped under .card-container for the sprite CSS). -->
    <div v-if="node !== undefined && node.actionNode !== undefined" class="compact-action__render card-container" v-i18n v-strip-action-prefix>
      <CardRenderEffectBoxComponent :effectData="node.actionNode" />
    </div>
    <div v-else-if="node !== undefined && node.renderRoot !== undefined" class="compact-action__render card-container" v-i18n v-strip-action-prefix>
      <CardRenderData :renderData="node.renderRoot" />
    </div>
    <!-- Text-only / combined-node-with-a-title fallback — premium text, never legacy. -->
    <span v-else class="compact-action__text" v-i18n v-strip-action-prefix>{{ fallbackText }}</span>

    <!-- Small status dot for non-available states (available = no badge, the
         selected ring already reads as actionable). -->
    <span v-if="badgeStatus !== ''" class="compact-action__badge" :class="'compact-action__badge--' + badgeStatus" aria-hidden="true">
      <span class="compact-action__badge-dot"></span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';

type GroupNode = ActionGroup['nodes'][number];

export default defineComponent({
  name: 'CompactActionCard',
  components: {CardRenderEffectBoxComponent, CardRenderData},
  directives: {stripActionPrefix},
  props: {
    // The action render node (graphic). Undefined → render `title` (a combined-node
    // branch in the modal, or a pure-title fallback).
    node: {
      type: Object as PropType<GroupNode>,
      default: undefined,
    },
    // Fallback text when there is no node (e.g. a Self-Replicating Robots branch).
    title: {
      type: String,
      default: '',
    },
    // The "why can't I act" reason for an UNAVAILABLE action — shown as a premium
    // tooltip on hover (empty for an available action → no tooltip). Mirrors the
    // hand overlay's «Разыграть» unavailable-reason affordance.
    reason: {
      type: String,
      default: '',
    },
    // The action's status — drives the badge + selectable styling.
    status: {
      type: String as PropType<ActionStatus>,
      default: 'available',
    },
    selected: {
      type: Boolean,
      default: false,
    },
    // Whether this card participates in click/keyboard selection (false = a static
    // display, e.g. the modal mini-card that only opens a description on hover).
    interactive: {
      type: Boolean,
      default: true,
    },
    focusable: {
      type: Boolean,
      default: true,
    },
    dense: {
      type: Boolean,
      default: false,
    },
    dataTest: {
      type: String,
      default: undefined,
    },
  },
  emits: ['select', 'hover'],
  computed: {
    fallbackText(): string {
      return this.node?.text ?? this.title;
    },
    // 'available' draws no badge (the selected ring conveys actionable); the other
    // states show a calm coloured dot.
    badgeStatus(): string {
      return this.status === 'available' ? '' : this.status;
    },
  },
  methods: {
    onClick(): void {
      if (this.interactive) {
        this.$emit('select');
      }
    },
    onEnter(e: MouseEvent | FocusEvent): void {
      const el = e.currentTarget as HTMLElement | null;
      this.$emit('hover', el !== null ? el.getBoundingClientRect() : null);
    },
    onLeave(): void {
      this.$emit('hover', null);
    },
  },
});
</script>
