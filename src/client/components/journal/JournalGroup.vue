<template>
  <li class="journal-group"
      :class="[categoryClass, {'journal-group--fresh': headerFresh, 'journal-group--filtering': filterActive}]"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false">
    <!-- Root action — the visually dominant header of the group. -->
    <div class="journal-group__root" :class="{'journal-group__root--dim': filterActive && !headerMatched}">
      <span class="journal-group__time" :title="fullWhen">{{ when }}</span>
      <span class="journal-group__cat" aria-hidden="true"></span>
      <span class="journal-group__root-body">
        <JournalTokenRenderer
          v-for="(tok, i) in headerEntries"
          :key="i"
          :token="tok"
          :players="players" />
      </span>
    </div>

    <!-- Consequences — compact child rows on a shared connector. -->
    <ul v-if="children.length > 0" class="journal-group__children" :class="{'journal-group__children--hover': hovered}">
      <li v-for="(child, i) in shownChildren"
          :key="i"
          class="journal-group__child"
          :class="[
            'journal-group__child--' + (child.role || 'detail'),
            {'journal-group__child--fresh': childFresh(child),
             'journal-group__child--matched': filterActive && childMatched[childKey(child)],
             'journal-group__child--dim': filterActive && !childMatched[childKey(child)]}]">
        <span class="journal-group__branch" aria-hidden="true"></span>
        <span class="journal-group__child-body">
          <JournalTokenRenderer
            v-for="(tok, j) in parse(child)"
            :key="j"
            :token="tok"
            :players="players" />
        </span>
      </li>

      <!-- Collapsed-tail toggle for long chains. -->
      <li v-if="collapsible" class="journal-group__toggle-row">
        <button type="button"
                class="journal-group__toggle"
                :aria-expanded="expanded"
                @click="expanded = !expanded">
          <span class="journal-group__toggle-chevron" :class="{'journal-group__toggle-chevron--up': expanded}" aria-hidden="true">⌄</span>
          <span v-if="!expanded">+{{ hiddenCount }}</span>
          <span v-else v-i18n>Collapse</span>
        </button>
      </li>
    </ul>
  </li>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Log} from '@/common/logs/Log';
import {JournalActionCategory} from '@/common/events/GameEvent';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';

// Chains longer than this collapse their tail behind a "+N" toggle so a busy
// turn stays a calm, readable group rather than a wall of rows.
const COLLAPSE_THRESHOLD = 3;

type DataModel = {
  expanded: boolean;
  hovered: boolean;
};

/**
 * One premium cause/effect GROUP: a dominant root-action header + its compact
 * consequence rows on a shared connector. Renders entirely from the structured
 * `correlationId`/`role`/`category` already on each `LogMessage` — no text
 * parsing for grouping. Long chains collapse; an active filter expands so a
 * matched child is never hidden and is highlighted in context.
 */
export default defineComponent({
  name: 'JournalGroup',
  components: {JournalTokenRenderer},
  props: {
    header: {
      type: Object as () => LogMessage,
      required: true,
    },
    children: {
      type: Array as () => ReadonlyArray<LogMessage>,
      required: true,
    },
    category: {
      type: String as () => JournalActionCategory | undefined,
      required: false,
      default: undefined,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    // The just-arrived live messages — drives the per-row enter animation.
    freshSet: {
      type: Object as () => ReadonlySet<LogMessage>,
      default: () => new Set<LogMessage>(),
    },
    filterActive: {
      type: Boolean,
      default: false,
    },
    headerMatched: {
      type: Boolean,
      default: true,
    },
    // Aligned to `children` by index — which child rows pass the active filter.
    childMatched: {
      type: Array as () => ReadonlyArray<boolean>,
      default: () => [],
    },
  },
  data(): DataModel {
    return {expanded: false, hovered: false};
  },
  computed: {
    categoryClass(): string {
      return 'journal-group--' + (this.category ?? 'generic');
    },
    // Header is fresh only for a brand-new group → the whole group animates in.
    headerFresh(): boolean {
      return this.freshSet.has(this.header);
    },
    headerEntries(): ReadonlyArray<string | LogMessageData> {
      return this.parse(this.header);
    },
    // When filtering, show every child so a matched one deep in the chain stays
    // visible (highlighted); otherwise collapse the tail of long chains.
    collapsible(): boolean {
      return !this.filterActive && this.children.length > COLLAPSE_THRESHOLD;
    },
    shownChildren(): ReadonlyArray<LogMessage> {
      if (this.collapsible && !this.expanded) {
        return this.children.slice(0, COLLAPSE_THRESHOLD);
      }
      return this.children;
    },
    hiddenCount(): number {
      return Math.max(0, this.children.length - COLLAPSE_THRESHOLD);
    },
    when(): string {
      const d = new Date(this.header.timestamp);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
    fullWhen(): string {
      return new Date(this.header.timestamp).toLocaleString();
    },
  },
  methods: {
    parse(message: LogMessage): ReadonlyArray<string | LogMessageData> {
      return Log.parse({message: this.$t(message.message), data: message.data});
    },
    // Index of a child within the original `children` array (for the matched map).
    childKey(child: LogMessage): number {
      return this.children.indexOf(child);
    },
    // A child appended to an already-present group animates on its own.
    childFresh(child: LogMessage): boolean {
      return this.freshSet.has(child) && !this.headerFresh;
    },
  },
});
</script>
