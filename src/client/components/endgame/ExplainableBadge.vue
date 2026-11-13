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

<script setup vapor lang="ts">
import {computed, ref, useTemplateRef} from 'vue';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {useFlowScope} from '@/client/console/session/useFlowScope';

const CONFIDENCE_LABEL: Record<string, string> = {
  exact: 'Exact', measured: 'Measured', partial: 'Partial', ruleOnly: 'Rule',
};

// A premium, accessible explanation popover for an analytical badge / chip. Hover OR
// keyboard-focus opens it; click toggles (touch fallback); ESC closes. Teleported to body
// and fixed-positioned at the badge, flipping above when near the viewport bottom. The
// popover itself is pointer-events:none (pure info) so it never traps the cursor.
defineOptions({name: 'ExplainableBadge'});
const props = defineProps({
  label: {type: String, required: true}, // i18n key (the visible badge text)
  detail: {type: Object as () => ChipDetail | undefined, required: false, default: undefined},
  badgeClass: {type: String, required: false, default: 'eg-insight__badge'},
  // Inline narrative terms (§6) suppress the "?" marker — the underline IS the affordance,
  // so the marker never lands inside a «…» quoted name.
  markless: {type: Boolean, required: false, default: false},
});

const flow = useFlowScope('explainable-badge');
const anchor = useTemplateRef<HTMLElement>('anchor');
const open = ref(false);
const popStyle = ref<Record<string, string>>({});
let cancelClose: () => void = () => {};
const ariaLabel = computed((): string => {
  return props.detail !== undefined ? `${$t(props.label)} — ${$t(props.detail.explanation)}` : $t(props.label);
});
const confidenceLabel = computed((): string => {
  const c = props.detail?.confidence;
  return c !== undefined ? CONFIDENCE_LABEL[c] ?? '' : '';
});
const accentClass = computed((): string => {
  return 'eg-detail--fam-' + (props.detail?.accent ?? 'generic');
});
function onEnter() {
  if (props.detail === undefined) {
    return;
  }
  cancelClose();
  position();
  open.value = true;
}
function onLeave() {
  // Small delay so a flick of the cursor doesn't strobe the popover.
  cancelClose = flow.after(90, 'the badge popover\'s close delay', () => {
    open.value = false;
  });
}
function onToggle(e: MouseEvent) {
  if (props.detail === undefined) {
    return;
  }
  // Touch / click toggle (hover already covers pointer devices).
  e.stopPropagation();
  if (open.value) {
    open.value = false;
  } else {
    position();
    open.value = true;
  }
}
function close() {
  open.value = false;
}
function position() {
  const el = anchor.value ?? undefined;
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
  popStyle.value = style;
}
</script>
