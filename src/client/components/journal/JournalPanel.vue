<template>
  <aside class="journal-panel" role="complementary" :aria-label="$t('Journal')">
    <span class="journal-panel__corner journal-panel__corner--tl" aria-hidden="true"></span>
    <span class="journal-panel__corner journal-panel__corner--tr" aria-hidden="true"></span>
    <span class="journal-panel__corner journal-panel__corner--bl" aria-hidden="true"></span>
    <span class="journal-panel__corner journal-panel__corner--br" aria-hidden="true"></span>

    <header class="journal-panel__header">
      <div class="journal-panel__titlewrap">
        <span class="journal-panel__glyph" aria-hidden="true"></span>
        <h2 class="journal-panel__title" v-i18n>Journal</h2>
      </div>
      <JournalGenerationSelector
        :current="generation"
        :selected="selectedGeneration"
        @select="selectGeneration" />
      <button
        type="button"
        class="journal-panel__close"
        :aria-label="$t('Close')"
        @click="$emit('close')">✕</button>
    </header>

    <JournalFeed
      :messages="messages"
      :players="players"
      :loadEpoch="loadEpoch"
      :loading="loading" />
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
import JournalFeed from '@/client/components/journal/JournalFeed.vue';

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
type DataModel = {
  messages: ReadonlyArray<LogMessage>,
  selectedGeneration: number,
  followLatest: boolean,
  loadEpoch: number,
  loading: boolean,
  abort: AbortController | undefined,
};

export default defineComponent({
  name: 'JournalPanel',
  components: {JournalGenerationSelector, JournalFeed},
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
  },
  watch: {
    // Fires on every server response. Drives the live feed while the
    // player is following the latest generation.
    step(): void {
      if (!this.followLatest) {
        return;
      }
      const gen = this.generation;
      if (this.selectedGeneration !== gen) {
        // A new generation began while following — load it.
        this.selectedGeneration = gen;
        this.fetchLogs(gen, true);
      } else {
        // Same generation — pull any appended entries.
        this.fetchLogs(gen, false);
      }
    },
  },
  methods: {
    selectGeneration(gen: number): void {
      if (gen === this.selectedGeneration) {
        return;
      }
      this.selectedGeneration = gen;
      this.followLatest = gen === this.generation;
      this.fetchLogs(gen, true);
    },
    fetchLogs(generation: number, bumpEpoch: boolean): void {
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
      this.loading = true;

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
          this.messages = data;
          if (bumpEpoch) {
            this.loadEpoch++;
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
    this.fetchLogs(this.generation, true);
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    if (this.abort !== undefined) {
      this.abort.abort();
    }
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
