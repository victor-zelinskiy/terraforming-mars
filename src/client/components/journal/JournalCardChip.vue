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
       standard projects. Mutually exclusive by card type. -->
  <CardPreviewPopover
    v-if="!isStandardProject"
    :name="name"
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
      @close="showZoom = false" />
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
};

export default defineComponent({
  name: 'JournalCardChip',
  components: {CardZoomModal, CardPreviewPopover, StandardProjectPreviewPopover},
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
    };
  },
  computed: {
    cardType(): CardType | undefined {
      return getCard(this.name)?.type;
    },
    isStandardProject(): boolean {
      return this.cardType === CardType.STANDARD_PROJECT || this.cardType === CardType.STANDARD_ACTION;
    },
    label(): string {
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
      if (!this.isStandardProject) {
        classes.push('journal-chip--zoomable');
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
      // Standard projects never open fullscreen.
      if (this.isStandardProject) {
        return;
      }
      // Opening fullscreen — drop the hover preview so they don't stack.
      this.onLeave();
      this.showZoom = true;
      nextTick(() => {
        (this.$refs as {zoomModal?: {show: () => void}}).zoomModal?.show();
      });
    },
  },
  beforeUnmount(): void {
    this.clearHoverTimer();
  },
});
</script>
