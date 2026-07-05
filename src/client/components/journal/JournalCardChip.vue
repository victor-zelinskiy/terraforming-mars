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

  <!-- Hover preview: full card for project cards, compact effect card for
       standard projects, the compact HYDRO card for the Delta Project
       (P29 — it has NO user-facing card, so fullscreen stays suppressed
       but the hover now explains what the Hydronetwork is). -->
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

  <!-- Fullscreen (project cards only — standard projects never zoom). -->
  <Teleport to="body">
    <CardZoomModal
      v-if="showZoom"
      ref="zoomModal"
      :card="{name}"
      @close="onZoomClose" />
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {LogMessageDataAttrs} from '@/common/logs/LogMessageData';
import {getCard} from '@/client/cards/ClientCardManifest';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';
import HydronetPreviewPopover from '@/client/components/journal/HydronetPreviewPopover.vue';
import StandardProjectPreviewPopover from '@/client/components/journal/StandardProjectPreviewPopover.vue';

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
};

// Small delay so a preview doesn't flash while the cursor merely sweeps
// across the feed (spec: "не мгновенно агрессивно").
const HOVER_DELAY = 170;

type DataModel = {
  previewVisible: boolean;
  anchor: DOMRect | undefined;
  hoverTimer: number | undefined;
  showZoom: boolean;
  // Suppresses hover-preview re-show while fullscreen is open AND for a
  // short window after it closes. When a <dialog> closes over a stationary
  // cursor the browser fires a phantom `mouseenter` on the chip (hover is
  // re-evaluated on top-layer change, no pointer move) — without this the
  // preview would pop back up after the player closes the fullscreen card.
  blockHover: boolean;
  blockTimer: number | undefined;
};

export default defineComponent({
  name: 'JournalCardChip',
  components: {CardZoomModal, CardPreviewPopover, HydronetPreviewPopover, StandardProjectPreviewPopover},
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
    attrs: {
      type: Object as () => LogMessageDataAttrs | undefined,
      default: undefined,
    },
  },
  data(): DataModel {
    return {
      previewVisible: false,
      anchor: undefined,
      hoverTimer: undefined,
      showZoom: false,
      blockHover: false,
      blockTimer: undefined,
    };
  },
  computed: {
    cardType(): CardType | undefined {
      return getCard(this.name)?.type;
    },
    isStandardProject(): boolean {
      return this.cardType === CardType.STANDARD_PROJECT || this.cardType === CardType.STANDARD_ACTION;
    },
    // The Delta Project is presented as the global "Гидросеть" subsystem — the
    // technical card must never leak into the UI (name / hover / fullscreen).
    isHydronetwork(): boolean {
      return this.name === CardName.DELTA_PROJECT;
    },
    label(): string {
      if (this.isHydronetwork) {
        return 'Hydronetwork';
      }
      // Strip ":" suffix (e.g. "Self-Replicating Robots: Foo") like the
      // rest of the log UI.
      return this.name.split(':')[0];
    },
    chipClasses(): Array<string> {
      const classes: Array<string> = [];
      const type = this.cardType;
      const mod = type !== undefined ? cardTypeModifier[type] : undefined;
      if (mod !== undefined) {
        classes.push(mod);
      }
      if (!this.isStandardProject && !this.isHydronetwork) {
        classes.push('journal-chip--zoomable');
      }
      if (this.isHydronetwork) {
        classes.push('journal-chip--system');
      }
      return classes;
    },
    tags(): ReadonlyArray<string> {
      return getCard(this.name)?.tags ?? [];
    },
    showTags(): boolean {
      return this.attrs?.tags === true && this.tags.length > 0;
    },
    cost(): number | undefined {
      return getCard(this.name)?.cost;
    },
    showCost(): boolean {
      return this.attrs?.cost === true && this.cost !== undefined;
    },
  },
  methods: {
    onEnter(): void {
      // Ignore the phantom mouseenter the browser fires while fullscreen
      // is open / just closed (see blockHover). Real hovers are unaffected.
      if (this.blockHover) {
        return;
      }
      // NOTE: this is a multi-root component (chip + teleported popovers),
      // so `this.$el` is the fragment's text anchor, not the span — read
      // the rect from the explicit ref instead.
      const chip = this.$refs.chip as HTMLElement | undefined;
      if (chip === undefined) {
        return;
      }
      this.anchor = chip.getBoundingClientRect();
      this.clearHoverTimer();
      this.hoverTimer = window.setTimeout(() => {
        // Guard again at fire time — fullscreen may have opened during the
        // delay.
        if (this.showZoom || this.blockHover) {
          return;
        }
        // Re-read the rect in case the feed scrolled during the delay.
        this.anchor = chip.getBoundingClientRect();
        this.previewVisible = true;
      }, HOVER_DELAY);
    },
    onLeave(): void {
      this.clearHoverTimer();
      this.previewVisible = false;
    },
    clearHoverTimer(): void {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
    },
    onClick(): void {
      // Standard projects + the Гидросеть system chip never open fullscreen.
      if (this.isStandardProject || this.isHydronetwork) {
        return;
      }
      // Opening fullscreen — drop the hover preview so they don't stack,
      // and block hover until shortly after the modal closes.
      this.onLeave();
      this.blockHover = true;
      this.showZoom = true;
      nextTick(() => {
        (this.$refs as {zoomModal?: {show: () => void}}).zoomModal?.show();
      });
    },
    onZoomClose(): void {
      this.showZoom = false;
      // Kill any pending preview + keep hover blocked briefly so the
      // phantom mouseenter fired as the dialog leaves the top layer can't
      // re-open the popover. A genuine re-hover after this window works.
      this.onLeave();
      if (this.blockTimer !== undefined) {
        window.clearTimeout(this.blockTimer);
      }
      this.blockTimer = window.setTimeout(() => {
        this.blockHover = false;
        this.blockTimer = undefined;
      }, 250);
    },
  },
  beforeUnmount(): void {
    this.clearHoverTimer();
    if (this.blockTimer !== undefined) {
      window.clearTimeout(this.blockTimer);
    }
  },
});
</script>
