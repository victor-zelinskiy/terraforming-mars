<template>
  <aside class="journal-panel" role="complementary" :aria-label="$t('Journal')">
    <span class="journal-panel__corner journal-panel__corner--tl" aria-hidden="true"></span>
    <span class="journal-panel__corner journal-panel__corner--tr" aria-hidden="true"></span>
    <span class="journal-panel__corner journal-panel__corner--bl" aria-hidden="true"></span>
    <span class="journal-panel__corner journal-panel__corner--br" aria-hidden="true"></span>

    <header class="journal-panel__header">
      <div class="journal-panel__titlebar">
        <div class="journal-panel__titlewrap">
          <span class="journal-panel__glyph" aria-hidden="true"></span>
          <h2 class="journal-panel__title" v-i18n>Journal</h2>
        </div>
        <button
          type="button"
          class="journal-panel__close"
          :aria-label="$t('Close')"
          @click="$emit('close')">✕</button>
      </div>
      <div class="journal-panel__controls">
        <JournalGenerationSelector
          :current="generation"
          :selected="selectedGeneration"
          @select="selectGeneration" />
        <JournalFilterSelector
          v-if="players.length > 1"
          :players="players"
          :selected="filter"
          @select="selectFilter" />
      </div>
    </header>

    <JournalFeed
      :messages="filteredMessages"
      :players="players"
      :loadEpoch="loadEpoch"
      :loading="loading"
      :filterActive="filterActive" />
  </aside>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {paths} from '@/common/app/paths';
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {ParticipantId} from '@/common/Types';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import JournalGenerationSelector from '@/client/components/journal/JournalGenerationSelector.vue';
import JournalFilterSelector from '@/client/components/journal/JournalFilterSelector.vue';
import JournalFeed from '@/client/components/journal/JournalFeed.vue';
import {JournalFilter, messagePassesFilter} from '@/client/components/journal/journalFilter';

/**
 * Premium journal panel — the modern replacement for the legacy
 * `bar-overlay--log` + `LogPanel`. Reuses the EXACT same data source
 * (`GET /api/game/logs?id=&generation=`, structured `LogMessage[]`); only
 * the presentation, layout and interactivity are new.
 *
 * Live feed: every server update bumps `step`. While the player is
 * "following latest" (viewing the current generation) we re-fetch the
 * current generation so newly-logged entries stream in. Selecting an
 * older generation drops out of follow mode and shows that generation as
 * static history; selecting the current one re-engages live mode.
 *
 * `loadEpoch` is bumped only when a DIFFERENT generation is loaded, so
 * `JournalFeed` can distinguish "whole list replaced" (silent jump) from
 * "appended live" (animate the new tail).
 */
// How often the open journal re-polls the logs endpoint while following
// the latest generation. The journal MUST NOT rely solely on the
// `step`/playerView prop changing: the app's lightweight `/api/waitingFor`
// poll updates `playersWaitingFor` WITHOUT refreshing the full playerView
// while the viewer is mid-prompt (simultaneous draft / research phases),
// so opponents' freshly-logged actions would otherwise never reach the
// journal until the phase resolved or the panel was re-opened. This
// independent timer guarantees near-real-time updates in every phase.
const LIVE_POLL_INTERVAL_MS = 1500;

type DataModel = {
  messages: ReadonlyArray<LogMessage>,
  selectedGeneration: number,
  followLatest: boolean,
  loadEpoch: number,
  loading: boolean,
  abort: AbortController | undefined,
  pollTimer: number | undefined,
  // Active player filter. Persists across generation changes and survives
  // the playerkey remount (panel is App-level). Default: show everything.
  filter: JournalFilter,
};

export default defineComponent({
  name: 'JournalPanel',
  components: {JournalGenerationSelector, JournalFilterSelector, JournalFeed},
  props: {
    viewModel: {
      type: Object as () => ViewModel,
      required: true,
    },
    color: {
      type: String as () => Color,
      required: true,
    },
    step: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  emits: ['close'],
  data(): DataModel {
    return {
      messages: [],
      selectedGeneration: -1,
      followLatest: true,
      loadEpoch: 0,
      loading: false,
      abort: undefined,
      pollTimer: undefined,
      filter: {kind: 'all'},
    };
  },
  computed: {
    generation(): number {
      return this.viewModel.game.generation;
    },
    players(): ReadonlyArray<PublicPlayerModel> {
      return this.viewModel.players;
    },
    // Messages after the active player filter. The feed renders THIS, so
    // a live entry that doesn't pass the filter never changes the list
    // length → no scroll, no jump. Filtering is on structured data only
    // (see journalFilter.ts).
    filteredMessages(): ReadonlyArray<LogMessage> {
      if (this.filter.kind === 'all') {
        return this.messages;
      }
      return this.messages.filter((m) => messagePassesFilter(m, this.filter, this.color));
    },
    filterActive(): boolean {
      return this.filter.kind !== 'all';
    },
    id(): ParticipantId | undefined {
      return this.viewModel.id;
    },
  },
  watch: {
    // Instant update when the full playerView DOES refresh (the viewer's
    // own actions, opponents' actions during normal turn-based play). This
    // is the low-latency path; the interval poll below is the safety net
    // for phases where playerView never refreshes (simultaneous draft /
    // research while the viewer holds a prompt).
    step(): void {
      this.pullLatest();
    },
  },
  methods: {
    selectGeneration(gen: number): void {
      if (gen === this.selectedGeneration) {
        return;
      }
      this.selectedGeneration = gen;
      this.followLatest = gen === this.generation;
      this.fetchLogs(gen, {bumpEpoch: true, showLoading: true});
    },
    selectFilter(filter: JournalFilter): void {
      this.filter = filter;
      // Bump the feed epoch so the (re-filtered) list does a soft fade-in
      // swap + scroll-to-bottom rather than being mis-read as a live
      // append/shrink. The raw messages and selected generation are
      // untouched — only the visible subset changes.
      this.loadEpoch++;
    },
    // Re-pull the current generation while following the latest. Used by
    // both the `step` watcher (instant) and the interval poll (safety net).
    // A generation rollover (detected via the reactive `generation`) loads
    // the new generation as a fresh epoch; otherwise it appends silently.
    pullLatest(): void {
      if (!this.followLatest) {
        return;
      }
      const gen = this.generation;
      if (this.selectedGeneration !== gen) {
        this.selectedGeneration = gen;
        this.fetchLogs(gen, {bumpEpoch: true, showLoading: false});
      } else {
        this.fetchLogs(gen, {bumpEpoch: false, showLoading: false});
      }
    },
    fetchLogs(generation: number, opts: {bumpEpoch: boolean, showLoading: boolean}): void {
      if (this.id === undefined) {
        return;
      }
      // Abort any in-flight request so a slow historical fetch can't land
      // after a newer one.
      if (this.abort !== undefined) {
        this.abort.abort();
      }
      const controller = new AbortController();
      this.abort = controller;
      if (opts.showLoading) {
        this.loading = true;
      }

      const url = `${paths.API_GAME_LOGS}?id=${this.id}&generation=${generation}`;
      fetch(url, {signal: controller.signal})
        .then((resp) => {
          if (!resp.ok) {
            console.error(`error updating journal, response code ${resp.status}`);
            return null;
          }
          return resp.json();
        })
        .then((data: Array<LogMessage> | null) => {
          if (data === null) {
            this.loading = false;
            return;
          }
          // The log is append-only within a generation, so on a silent
          // live poll we only swap (and re-render) when the length grew —
          // identical-length polls are no-ops. A generation load always
          // swaps + bumps the epoch so the feed re-keys cleanly.
          if (opts.bumpEpoch) {
            this.messages = data;
            this.loadEpoch++;
          } else if (data.length !== this.messages.length) {
            this.messages = data;
          }
          this.loading = false;
        })
        .catch((err) => {
          if (err.name === 'AbortError') {
            return;
          }
          this.loading = false;
          console.error('error updating journal, unable to reach server');
        });
    },
    startPolling(): void {
      if (this.pollTimer !== undefined) {
        return;
      }
      this.pollTimer = window.setInterval(() => this.pullLatest(), LIVE_POLL_INTERVAL_MS);
    },
    stopPolling(): void {
      if (this.pollTimer !== undefined) {
        window.clearInterval(this.pollTimer);
        this.pollTimer = undefined;
      }
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') {
        return;
      }
      // Don't steal Escape from a fullscreen card (native <dialog>) or any
      // other open dialog — let those close first.
      if (document.querySelector('dialog[open]') !== null) {
        return;
      }
      this.$emit('close');
    },
  },
  mounted(): void {
    this.selectedGeneration = this.generation;
    this.followLatest = true;
    this.fetchLogs(this.generation, {bumpEpoch: true, showLoading: true});
    // Independent live poll — keeps the feed fresh in EVERY phase, not
    // just when the playerView happens to refresh.
    this.startPolling();
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    this.stopPolling();
    if (this.abort !== undefined) {
      this.abort.abort();
    }
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
