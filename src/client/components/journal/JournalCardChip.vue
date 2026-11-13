<template>
  <span
    ref="chip"
    class="journal-chip journal-chip--card"
    :class="chipClasses"
    tabindex="0"
    role="button"
    :aria-label="$t(label)"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focus="onEnter"
    @blur="onLeave"
    @click.stop.prevent="onClick"
    @keydown.enter.prevent="onClick"
    @keydown.space.prevent="onClick">
    <span class="journal-chip__dot" aria-hidden="true"></span>
    <!-- v-i18n localizes the card / standard-project name (the legacy log
         did `$t(name)` too). Translations live in the card locale files
         (cards.json, promo.json, standard_projects.json, …). -->
    <span class="journal-chip__label" v-i18n>{{ label }}</span>
    <span v-if="showTags" class="journal-chip__tags" aria-hidden="true">
      <span v-for="(tag, i) in tags" :key="i" class="journal-chip__tag" :class="'tag-' + tag"></span>
    </span>
    <span v-if="showCost" class="journal-chip__cost">
      <span class="journal-chip__cost-value">{{ cost }}</span>
      <i class="resource_icon resource_icon--megacredits"></i>
    </span>
  </span>

  <CardPreviewPopover
    v-if="!isStandardProject && !isHydronetwork"
    :name="name"
    :visible="previewVisible"
    :anchor="anchor" />
  <HydronetPreviewPopover
    v-else-if="isHydronetwork"
    :visible="previewVisible"
    :anchor="anchor" />
  <StandardProjectPreviewPopover
    v-else
    :name="name"
    :visible="previewVisible"
    :anchor="anchor" />

  <Teleport to="body">
    <CardZoomModal
      v-if="showZoom"
      ref="zoomModal"
      :card="{name}"
      @close="onZoomClose" />
  </Teleport>
</template>

<script setup lang="ts">
/*
 * — before the root `<CardPreviewPopover v-if="!isStandardProject && !isHydronetwork" …>`:
 * Hover preview: full card for project cards, compact effect card for
 * standard projects, the compact HYDRO card for the Delta Project
 * (P29 — it has NO user-facing card, so fullscreen stays suppressed
 * but the hover now explains what the Hydronetwork is).
 *
 * — before the root `<Teleport to="body">`:
 * Fullscreen (project cards only — standard projects never zoom).
 *
 * (These comments stood between the template's roots; each names the root it stood before.)
 */
import {computed, nextTick, ref, useTemplateRef} from 'vue';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {LogMessageDataAttrs} from '@/common/logs/LogMessageData';
import {getCard} from '@/client/cards/ClientCardManifest';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';
import HydronetPreviewPopover from '@/client/components/journal/HydronetPreviewPopover.vue';
import StandardProjectPreviewPopover from '@/client/components/journal/StandardProjectPreviewPopover.vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';

/**
 * A single inline card token inside the journal feed.
 *
 * - Project cards: hover → modern `CardPreviewPopover` (small floating
 *   card); click → fullscreen via the fork's `CardZoomModal`.
 * - Standard projects: hover → compact `StandardProjectPreviewPopover`
 *   (pictogram + effect, NOT a legacy card); click does nothing
 *   (fullscreen intentionally unavailable per the journal spec).
 *
 * The chip is keyboard-focusable; Enter/Space mirror click and focus
 * mirrors hover so the preview is reachable without a mouse.
 */

const cardTypeModifier: Record<CardType, string | undefined> = {
  event: 'journal-chip--event',
  corporation: 'journal-chip--corporation',
  active: 'journal-chip--active',
  automated: 'journal-chip--automated',
  prelude: 'journal-chip--prelude',
  ceo: 'journal-chip--ceo',
  standard_project: 'journal-chip--standard',
  standard_action: 'journal-chip--standard',
  proxy: undefined,
  resolution: 'journal-chip--resolution',
};

// Small delay so a preview doesn't flash while the cursor merely sweeps
// across the feed (spec: "не мгновенно агрессивно").
const HOVER_DELAY = 170;

defineOptions({name: 'JournalCardChip'});
const props = defineProps({
  name: {
    type: String as () => CardName,
    required: true,
  },
  attrs: {
    type: Object as () => LogMessageDataAttrs | undefined,
    default: undefined,
  },
});

const flow = useFlowScope('journal-card-chip');
const chip = useTemplateRef<HTMLElement>('chip');
const zoomModal = useTemplateRef<{show: () => void}>('zoomModal');
const previewVisible = ref(false);
const anchor = ref<DOMRect | undefined>(undefined);
let cancelHover = () => {};
const showZoom = ref(false);
// Suppresses hover-preview re-show while fullscreen is open AND for a
// short window after it closes. When a <dialog> closes over a stationary
// cursor the browser fires a phantom `mouseenter` on the chip (hover is
// re-evaluated on top-layer change, no pointer move) — without this the
// preview would pop back up after the player closes the fullscreen card.
const blockHover = ref(false);
let cancelBlock = () => {};
const cardType = computed((): CardType | undefined => {
  return getCard(props.name)?.type;
});
const isStandardProject = computed((): boolean => {
  return cardType.value === CardType.STANDARD_PROJECT || cardType.value === CardType.STANDARD_ACTION;
});
// The Delta Project is presented as the global "Гидросеть" subsystem — the
// technical card must never leak into the UI (name / hover / fullscreen).
const isHydronetwork = computed((): boolean => {
  return props.name === CardName.DELTA_PROJECT;
});
const label = computed((): string => {
  if (isHydronetwork.value) {
    return 'Hydronetwork';
  }
  // Strip ":" suffix (e.g. "Self-Replicating Robots: Foo") like the
  // rest of the log UI.
  return props.name.split(':')[0];
});
const chipClasses = computed((): Array<string> => {
  const classes: Array<string> = [];
  const type = cardType.value;
  const mod = type !== undefined ? cardTypeModifier[type] : undefined;
  if (mod !== undefined) {
    classes.push(mod);
  }
  if (!isStandardProject.value && !isHydronetwork.value) {
    classes.push('journal-chip--zoomable');
  }
  if (isHydronetwork.value) {
    classes.push('journal-chip--system');
  }
  return classes;
});
const tags = computed((): ReadonlyArray<string> => {
  return getCard(props.name)?.tags ?? [];
});
const showTags = computed((): boolean => {
  return props.attrs?.tags === true && tags.value.length > 0;
});
const cost = computed((): number | undefined => {
  return getCard(props.name)?.cost;
});
const showCost = computed((): boolean => {
  return props.attrs?.cost === true && cost.value !== undefined;
});

function onEnter(): void {
  // Ignore the phantom mouseenter the browser fires while fullscreen
  // is open / just closed (see blockHover). Real hovers are unaffected.
  if (blockHover.value) {
    return;
  }
  // NOTE: this is a multi-root component (chip + teleported popovers),
  // so it has no root element of its own (a fragment's text anchor, not
  // the span) — read the rect from the explicit ref instead.
  const chipNow = chip.value ?? undefined;
  if (chipNow === undefined) {
    return;
  }
  anchor.value = chipNow.getBoundingClientRect();
  clearHoverTimer();
  cancelHover = flow.after(HOVER_DELAY, 'the chip\'s hover delay', () => {
    // Guard again at fire time — fullscreen may have opened during the
    // delay.
    if (showZoom.value || blockHover.value) {
      return;
    }
    // Re-read the rect in case the feed scrolled during the delay.
    anchor.value = chipNow.getBoundingClientRect();
    previewVisible.value = true;
  });
}
function onLeave(): void {
  clearHoverTimer();
  previewVisible.value = false;
}
function clearHoverTimer(): void {
  cancelHover();
}
function onClick(): void {
  // Standard projects + the Гидросеть system chip never open fullscreen.
  if (isStandardProject.value || isHydronetwork.value) {
    return;
  }
  // Opening fullscreen — drop the hover preview so they don't stack,
  // and block hover until shortly after the modal closes.
  onLeave();
  blockHover.value = true;
  showZoom.value = true;
  nextTick(() => {
    zoomModal.value?.show();
  });
}
function onZoomClose(): void {
  showZoom.value = false;
  // Kill any pending preview + keep hover blocked briefly so the
  // phantom mouseenter fired as the dialog leaves the top layer can't
  // re-open the popover. A genuine re-hover after this window works.
  onLeave();
  cancelBlock();
  cancelBlock = flow.after(250, 'the chip\'s hover block lifts', () => {
    blockHover.value = false;
  });
}
</script>
