<template>
  <span
    class="eg-xbadge"
    :class="[badgeClass, {'eg-xbadge--interactive': detail !== undefined}]"
    :tabindex="detail !== undefined ? 0 : undefined"
    :role="detail !== undefined ? 'button' : undefined"
    :aria-label="ariaLabel"
    :aria-expanded="detail !== undefined ? open : undefined"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focus="onEnter"
    @blur="onLeave"
    @click="onToggle"
    @keydown.escape="close"
    ref="anchor">
    <span v-i18n>{{ label }}</span>
    <span v-if="detail !== undefined && !markless" class="eg-xbadge__mark" aria-hidden="true">✦</span>

    <Teleport to="body">
      <div v-if="open && detail !== undefined" class="eg-detail" :class="accentClass" :style="popStyle" role="tooltip">
        <div class="eg-detail__head">
          <span class="eg-detail__title" v-i18n>{{ detail.title }}</span>
          <span v-if="confidenceLabel !== ''" class="eg-detail__conf" :class="'eg-detail__conf--' + detail.confidence">
            <span v-i18n>{{ confidenceLabel }}</span>
          </span>
        </div>
        <p class="eg-detail__explain" v-i18n>{{ detail.explanation }}</p>
        <div v-if="detail.evidence.length > 0" class="eg-detail__evidence">
          <span v-for="(row, i) in detail.evidence" :key="i" class="eg-chip" :class="'eg-chip--' + (row.tone || 'neutral')">
            <template v-if="row.t === 'raw'">{{ row.v }}</template>
            <span v-else v-i18n>{{ row.v }}</span>
          </span>
        </div>
        <!-- §10 — per-card breakdown list (e.g. the cards backing a resource line). -->
        <div v-if="detail.breakdown !== undefined && detail.breakdown.length > 0" class="eg-detail__breakdown">
          <span class="eg-detail__bd-head" v-i18n>Key cards</span>
          <div v-for="(row, i) in detail.breakdown" :key="'b' + i" class="eg-detail__bd-row">
            <span class="eg-detail__bd-label" v-i18n>{{ row.label }}</span>
            <span class="eg-detail__bd-val">{{ row.value }} <span v-i18n>VP</span></span>
          </div>
        </div>
        <p v-if="detail.whyItMatters !== undefined" class="eg-detail__why">
          <span class="eg-detail__why-lbl" v-i18n>Why it matters</span>
          <span v-i18n>{{ detail.whyItMatters }}</span>
        </p>
        <p v-if="detail.caveat !== undefined" class="eg-detail__caveat" v-i18n>{{ detail.caveat }}</p>
      </div>
    </Teleport>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';
import {$t} from '@/client/directives/i18n';

const CONFIDENCE_LABEL: Record<string, string> = {
  exact: 'Exact', measured: 'Measured', partial: 'Partial', ruleOnly: 'Rule',
};

// A premium, accessible explanation popover for an analytical badge / chip. Hover OR
// keyboard-focus opens it; click toggles (touch fallback); ESC closes. Teleported to body
// and fixed-positioned at the badge, flipping above when near the viewport bottom. The
// popover itself is pointer-events:none (pure info) so it never traps the cursor.
export default defineComponent({
  name: 'ExplainableBadge',
  props: {
    label: {type: String, required: true}, // i18n key (the visible badge text)
    detail: {type: Object as () => ChipDetail | undefined, required: false, default: undefined},
    badgeClass: {type: String, required: false, default: 'eg-insight__badge'},
    // Inline narrative terms (§6) suppress the "?" marker — the underline IS the affordance,
    // so the marker never lands inside a «…» quoted name.
    markless: {type: Boolean, required: false, default: false},
  },
  data() {
    return {open: false, popStyle: {} as Record<string, string>, closeTimer: 0};
  },
  computed: {
    ariaLabel(): string {
      return this.detail !== undefined ? `${$t(this.label)} — ${$t(this.detail.explanation)}` : $t(this.label);
    },
    confidenceLabel(): string {
      const c = this.detail?.confidence;
      return c !== undefined ? CONFIDENCE_LABEL[c] ?? '' : '';
    },
    accentClass(): string {
      return 'eg-detail--fam-' + (this.detail?.accent ?? 'generic');
    },
  },
  beforeUnmount() {
    window.clearTimeout(this.closeTimer);
  },
  methods: {
    onEnter() {
      if (this.detail === undefined) {
        return;
      }
      window.clearTimeout(this.closeTimer);
      this.position();
      this.open = true;
    },
    onLeave() {
      // Small delay so a flick of the cursor doesn't strobe the popover.
      this.closeTimer = window.setTimeout(() => {
        this.open = false;
      }, 90);
    },
    onToggle(e: MouseEvent) {
      if (this.detail === undefined) {
        return;
      }
      // Touch / click toggle (hover already covers pointer devices).
      e.stopPropagation();
      if (this.open) {
        this.open = false;
      } else {
        this.position();
        this.open = true;
      }
    },
    close() {
      this.open = false;
    },
    position() {
      const el = this.$refs.anchor as HTMLElement | undefined;
      if (el === undefined || typeof el.getBoundingClientRect !== 'function') {
        return;
      }
      const r = el.getBoundingClientRect();
      const W = 360;
      const margin = 12;
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      let left = r.left;
      if (left + W > vw - margin) {
        left = Math.max(margin, vw - margin - W);
      }
      // Flip above when there isn't room below.
      const below = r.bottom + 8;
      const flipAbove = below + 180 > vh;
      const style: Record<string, string> = {
        position: 'fixed', left: `${Math.round(left)}px`, width: `${W}px`, zIndex: '13000',
      };
      if (flipAbove) {
        style.bottom = `${Math.round(vh - r.top + 8)}px`;
      } else {
        style.top = `${Math.round(below)}px`;
      }
      this.popStyle = style;
    },
  },
});
</script>
