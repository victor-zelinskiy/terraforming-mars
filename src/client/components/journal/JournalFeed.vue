<template>
  <div class="journal-feed">
    <div ref="scroll" class="journal-feed__scroll" @scroll.passive="onScroll">
      <!-- Empty / loading states. -->
      <div v-if="messages.length === 0" class="journal-feed__placeholder">
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

      <!-- Keyed by loadEpoch: a generation switch remounts the list (clean
           fade-in via .journal-feed__list animation), while live appends
           keep the same key so only the fresh tail animates. -->
      <ul v-else :key="loadEpoch" class="journal-feed__list">
        <JournalEntry
          v-for="(message, index) in messages"
          :key="index"
          :message="message"
          :players="players"
          :animateIn="index >= freshFrom" />
      </ul>
    </div>

    <!-- "New events ↓" — appears only when live entries arrived while the
         player was scrolled up reading history. Clicking re-engages
         auto-scroll. -->
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
import {LogMessage} from '@/common/logs/LogMessage';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import JournalEntry from '@/client/components/journal/JournalEntry.vue';

// Distance (px) from the bottom within which we still consider the player
// "at the bottom" and keep auto-scrolling.
const BOTTOM_THRESHOLD = 48;
// How long the enter animation runs; after this we clear the fresh marker
// so subsequent re-renders don't replay it.
const FRESH_WINDOW = 650;

type DataModel = {
  atBottom: boolean;
  showNew: boolean;
  freshFrom: number;
  freshTimer: number | undefined;
};

/**
 * Scrollable journal feed with live-mode behaviour:
 *   - At the bottom + new entries → auto-scroll to follow them.
 *   - Scrolled up + new entries → show an unobtrusive "New events ↓"
 *     pill instead of yanking the view down (spec).
 *   - Only genuinely-new (appended) entries play the enter animation;
 *     a generation switch (signalled by `loadEpoch` changing) swaps the
 *     whole list silently and jumps to the bottom.
 *
 * Append-only assumption: within a generation the server only ever
 * appends log entries, so diffing by length is sufficient to find the
 * fresh tail.
 */
export default defineComponent({
  name: 'JournalFeed',
  components: {JournalEntry},
  props: {
    messages: {
      type: Array as () => ReadonlyArray<LogMessage>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    // Bumped by the parent whenever a DIFFERENT generation is loaded, so
    // the feed can tell "replaced the whole list" from "appended live".
    loadEpoch: {
      type: Number,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    // When a player filter is active, the empty state reads "no entries
    // for the selected filter" rather than "no events this generation".
    filterActive: {
      type: Boolean,
      default: false,
    },
  },
  data(): DataModel {
    return {
      atBottom: true,
      showNew: false,
      // Default beyond any index → nothing animates until a live append.
      freshFrom: Number.POSITIVE_INFINITY,
      freshTimer: undefined,
    };
  },
  watch: {
    // Single source of truth for both "fresh load" and "live append".
    feedSignal(next: [number, number], prev: [number, number]) {
      const [epoch, len] = next;
      const [oldEpoch, oldLen] = prev;

      if (epoch !== oldEpoch) {
        // A new generation was loaded — silent swap, no enter animation.
        this.clearFreshTimer();
        this.freshFrom = Number.POSITIVE_INFINITY;
        this.showNew = false;
        this.atBottom = true;
        this.$nextTick(() => this.scrollToBottom('auto'));
        return;
      }

      if (len > oldLen) {
        // Live append within the current generation.
        this.markFresh(oldLen);
        if (this.atBottom) {
          this.$nextTick(() => this.scrollToBottom('smooth'));
        } else {
          this.showNew = true;
        }
      } else if (len < oldLen) {
        // Unexpected shrink (e.g. undo rewound the log) — resync quietly.
        this.clearFreshTimer();
        this.freshFrom = Number.POSITIVE_INFINITY;
        this.$nextTick(() => this.scrollToBottom('auto'));
      }
    },
  },
  computed: {
    feedSignal(): [number, number] {
      return [this.loadEpoch, this.messages.length];
    },
  },
  methods: {
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
      this.clearFreshTimer();
      this.freshFrom = from;
      this.freshTimer = window.setTimeout(() => {
        this.freshFrom = Number.POSITIVE_INFINITY;
        this.freshTimer = undefined;
      }, FRESH_WINDOW);
    },
    clearFreshTimer(): void {
      if (this.freshTimer !== undefined) {
        window.clearTimeout(this.freshTimer);
        this.freshTimer = undefined;
      }
    },
  },
  mounted(): void {
    this.$nextTick(() => this.scrollToBottom('auto'));
  },
  beforeUnmount(): void {
    this.clearFreshTimer();
  },
});
</script>
