<template>
  <div class="journal-feed">
    <div ref="scroll" class="journal-feed__scroll" @scroll.passive="onScroll">
      <!-- Empty / loading states. -->
      <div v-if="renderNodes.length === 0" class="journal-feed__placeholder">
        <template v-if="loading">
          <span class="journal-feed__spinner" aria-hidden="true"></span>
          <span v-i18n>Loading…</span>
        </template>
        <template v-else>
          <span class="journal-feed__placeholder-glyph" aria-hidden="true">⌖</span>
          <span v-if="filterActive" v-i18n>No entries for the selected filter</span>
          <span v-else v-i18n>No events this generation</span>
        </template>
      </div>

      <!-- Keyed by loadEpoch: a generation switch / filter change remounts the
           list (clean fade-in); live appends keep the key, and each group keeps
           a stable correlation key so only the fresh tail animates. -->
      <ul v-else :key="loadEpoch" class="journal-feed__list">
        <template v-for="(node, index) in renderNodes" :key="nodeKey(node, index)">
          <JournalGroup
            v-if="node.kind === 'group'"
            :header="node.group.header"
            :children="node.group.children"
            :category="node.group.category"
            :players="players"
            :freshSet="freshSet"
            :filterActive="filterActive"
            :headerMatched="node.headerMatched"
            :childMatched="node.childMatched" />
          <JournalEntry
            v-else
            :message="node.message"
            :players="players"
            :animateIn="freshSet.has(node.message)" />
        </template>
      </ul>
    </div>

    <!-- "New events ↓" — appears only when live entries arrived while the
         player was scrolled up reading history. -->
    <Transition name="journal-newpill">
      <button v-if="showNew"
              type="button"
              class="journal-feed__newpill"
              @click="jumpToBottom">
        <span v-i18n>New events</span>
        <span class="journal-feed__newpill-arrow" aria-hidden="true">↓</span>
      </button>
    </Transition>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import JournalEntry from '@/client/components/journal/JournalEntry.vue';
import JournalGroup from '@/client/components/journal/JournalGroup.vue';
import {buildJournalView, JournalGroupNode} from '@/client/components/journal/journalView';
import {JournalFilter, messagePassesFilter} from '@/client/components/journal/journalFilter';

const BOTTOM_THRESHOLD = 48;
const FRESH_WINDOW = 650;

// A rendered node: a premium cause/effect GROUP, or a flat standalone row
// (system line, generation divider, legacy/ungrouped log).
type GroupRenderNode = {
  kind: 'group';
  group: JournalGroupNode;
  headerMatched: boolean;
  childMatched: ReadonlyArray<boolean>;
};
type MessageRenderNode = {kind: 'message'; message: LogMessage};
type RenderNode = GroupRenderNode | MessageRenderNode;

type DataModel = {
  atBottom: boolean;
  showNew: boolean;
  // The just-arrived live messages (by reference) — drives the enter animation
  // on exactly the fresh rows, whether a new group or a child of an existing one.
  freshSet: ReadonlySet<LogMessage>;
  freshTimer: number | undefined;
};

/**
 * Scrollable premium journal feed. Groups the flat `LogMessage[]` into
 * cause/effect nodes via `buildJournalView` (by structured `correlationId`,
 * never by parsing text), then renders each as a {@link JournalGroup} (root +
 * children) or a flat {@link JournalEntry} (standalone / divider / legacy).
 *
 * Filtering is GROUP-AWARE: a group survives if its header OR any child matches,
 * and matched children are highlighted in context (never orphaned). Live-append
 * detection still works on the RAW message count (independent of the filter).
 */
export default defineComponent({
  name: 'JournalFeed',
  components: {JournalEntry, JournalGroup},
  props: {
    messages: {
      type: Array as () => ReadonlyArray<LogMessage>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    loadEpoch: {
      type: Number,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    filter: {
      type: Object as () => JournalFilter,
      default: () => ({kind: 'all'} as JournalFilter),
    },
    color: {
      type: String as () => Color,
      required: true,
    },
  },
  data(): DataModel {
    return {
      atBottom: true,
      showNew: false,
      freshSet: new Set<LogMessage>(),
      freshTimer: undefined,
    };
  },
  watch: {
    feedSignal(next: [number, number], prev: [number, number]) {
      const [epoch, len] = next;
      const [oldEpoch, oldLen] = prev;

      if (epoch !== oldEpoch) {
        // A new generation / filter change — silent swap, no enter animation.
        this.clearFresh();
        this.showNew = false;
        this.atBottom = true;
        this.$nextTick(() => this.scrollToBottom('auto'));
        return;
      }

      if (len > oldLen) {
        this.markFresh(oldLen);
        if (this.atBottom) {
          this.$nextTick(() => this.scrollToBottom('smooth'));
        } else {
          this.showNew = true;
        }
      } else if (len < oldLen) {
        this.clearFresh();
        this.$nextTick(() => this.scrollToBottom('auto'));
      }
    },
  },
  computed: {
    feedSignal(): [number, number] {
      return [this.loadEpoch, this.messages.length];
    },
    filterActive(): boolean {
      return this.filter.kind !== 'all';
    },
    renderNodes(): ReadonlyArray<RenderNode> {
      const active = this.filterActive;
      const passes = (m: LogMessage): boolean => !active || messagePassesFilter(m, this.filter, this.color);
      const out: Array<RenderNode> = [];
      for (const node of buildJournalView(this.messages)) {
        if (node.kind === 'message') {
          if (passes(node.message)) {
            out.push({kind: 'message', message: node.message});
          }
          continue;
        }
        const headerMatched = passes(node.header);
        const childMatched = node.children.map(passes);
        // Keep the whole group when anything in it matches — context preserved.
        if (!active || headerMatched || childMatched.some(Boolean)) {
          out.push({kind: 'group', group: node, headerMatched, childMatched});
        }
      }
      return out;
    },
  },
  methods: {
    nodeKey(node: RenderNode, index: number): string {
      return node.kind === 'group' ? `g${node.group.correlationId}` : `m${index}`;
    },
    onScroll(): void {
      const el = this.$refs.scroll as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
      if (this.atBottom) {
        this.showNew = false;
      }
    },
    scrollToBottom(behavior: 'auto' | 'smooth'): void {
      const el = this.$refs.scroll as HTMLElement | undefined;
      if (el === undefined) {
        return;
      }
      el.scrollTo({top: el.scrollHeight, behavior});
      this.atBottom = true;
    },
    jumpToBottom(): void {
      this.showNew = false;
      this.scrollToBottom('smooth');
    },
    markFresh(from: number): void {
      this.clearFresh();
      this.freshSet = new Set(this.messages.slice(from));
      this.freshTimer = window.setTimeout(() => {
        this.freshSet = new Set<LogMessage>();
        this.freshTimer = undefined;
      }, FRESH_WINDOW);
    },
    clearFresh(): void {
      if (this.freshTimer !== undefined) {
        window.clearTimeout(this.freshTimer);
        this.freshTimer = undefined;
      }
      this.freshSet = new Set<LogMessage>();
    },
  },
  mounted(): void {
    this.$nextTick(() => this.scrollToBottom('auto'));
  },
  beforeUnmount(): void {
    this.clearFresh();
  },
});
</script>
