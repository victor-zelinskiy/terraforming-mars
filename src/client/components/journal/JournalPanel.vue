<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
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
        <!-- The compact Detailed/Summary toggle rides the title row's free
             space; the wider dropdowns sit on the controls row below. -->
        <div class="journal-mode" role="group" :aria-label="$t('Journal detail level')">
          <button
            type="button"
            class="journal-mode__btn"
            :class="{'journal-mode__btn--active': detail === 'detailed'}"
            :aria-pressed="detail === 'detailed'"
            @click="setDetail('detailed')"><span v-i18n>Detailed</span></button>
          <button
            type="button"
            class="journal-mode__btn"
            :class="{'journal-mode__btn--active': detail === 'summary'}"
            :aria-pressed="detail === 'summary'"
            @click="setDetail('summary')"><span v-i18n>Summary</span></button>
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
      :messages="messages"
      :players="players"
      :loadEpoch="loadEpoch"
      :loading="loading"
      :filter="filter"
      :color="color"
      :mode="detail"
      :events="events" />
  </aside>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {GameEvent} from '@/common/events/GameEvent';
import {ParticipantId} from '@/common/Types';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import JournalGenerationSelector from '@/client/components/journal/JournalGenerationSelector.vue';
import JournalFilterSelector from '@/client/components/journal/JournalFilterSelector.vue';
import JournalFeed from '@/client/components/journal/JournalFeed.vue';
import {JournalFilter} from '@/client/components/journal/journalFilter';
import {journalState, JournalDetailMode} from '@/client/components/journal/journalState';
import {createJournalDataSource, JournalDataSource} from '@/client/components/journal/journalDataSource';

/**
 * Premium journal panel — the modern replacement for the legacy
 * `bar-overlay--log` + `LogPanel`. Reuses the EXACT same data source
 * (`GET /api/game/logs?id=&generation=`, structured `LogMessage[]`); only
 * the presentation, layout and interactivity are new.
 *
 * The fetch / live-follow / poller brain lives in `journalDataSource.ts`
 * (shared with the console-native `ConsoleJournalPanel` — one brain, two
 * shells); this component is the DESKTOP shell: header controls, filter,
 * detail-mode toggle, Esc-to-close.
 */
type DataModel = {
  source: JournalDataSource,
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
      source: createJournalDataSource({
        id: () => this.viewModel.id,
        generation: () => this.viewModel.game.generation,
      }),
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
    id(): ParticipantId | undefined {
      return this.viewModel.id;
    },
    // Top-level detail mode (module-scoped → survives the PlayerHome remount).
    detail(): JournalDetailMode {
      return journalState.detail;
    },
    // Feed state proxies (the shared data source owns the truth).
    messages(): ReadonlyArray<LogMessage> {
      return this.source.state.messages;
    },
    events(): ReadonlyArray<GameEvent> {
      return this.source.state.events;
    },
    selectedGeneration(): number {
      return this.source.state.selectedGeneration;
    },
    loadEpoch(): number {
      return this.source.state.loadEpoch;
    },
    loading(): boolean {
      return this.source.state.loading;
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
      this.source.selectGeneration(gen);
    },
    setDetail(mode: JournalDetailMode): void {
      if (journalState.detail === mode) {
        return;
      }
      journalState.detail = mode;
      // Soft fade-swap + scroll-to-bottom rather than a jump, like a filter change.
      this.source.bumpEpoch();
    },
    selectFilter(filter: JournalFilter): void {
      this.filter = filter;
      // Bump the feed epoch so the (re-filtered) list does a soft fade-in
      // swap + scroll-to-bottom rather than being mis-read as a live
      // append/shrink. The raw messages and selected generation are
      // untouched — only the visible subset changes.
      this.source.bumpEpoch();
    },
    pullLatest(): void {
      this.source.pullLatest();
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
    // Initial load + the independent live poll — keeps the feed fresh in
    // EVERY phase, not just when the playerView happens to refresh.
    this.source.start();
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    this.source.dispose();
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
