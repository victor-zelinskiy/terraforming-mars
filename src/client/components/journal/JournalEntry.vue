<template>
  <!-- Generation boundary marker. -->
  <li v-if="isGenerationMarker" class="journal-gen-divider">
    <span class="journal-gen-divider__line" aria-hidden="true"></span>
    <span class="journal-gen-divider__label"><span v-i18n>Generation</span>&nbsp;{{ generationNumber }}</span>
    <span class="journal-gen-divider__line" aria-hidden="true"></span>
  </li>

  <!-- Normal entry. -->
  <li v-else
      class="journal-entry"
      :class="{'journal-entry--fresh': animateIn, 'journal-entry--private': isPrivate, 'journal-entry--announcement': isAnnouncement}">
    <span class="journal-entry__rail" aria-hidden="true"></span>
    <span class="journal-entry__time" :title="fullWhen">{{ when }}</span>
    <span class="journal-entry__body">
      <JournalTokenRenderer
        v-for="(tok, i) in entries"
        :key="i"
        :token="tok"
        :players="players" />
    </span>
  </li>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {Log} from '@/common/logs/Log';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';

/**
 * A single journal feed row. Two shapes:
 *   - `NEW_GENERATION` messages render as a centred divider.
 *   - everything else renders a time gutter + the parsed token line.
 *
 * Parsing reuses the shared `Log.parse()` so the token stream is byte-
 * identical to what the legacy renderer consumed — only the presentation
 * is new. `animateIn` is set by the feed ONLY for entries that just
 * arrived in live mode, so a generation switch (full list swap) doesn't
 * replay the enter animation on every row.
 */
export default defineComponent({
  name: 'JournalEntry',
  components: {JournalTokenRenderer},
  props: {
    message: {
      type: Object as () => LogMessage,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    animateIn: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    isGenerationMarker(): boolean {
      return this.message.type === LogMessageType.NEW_GENERATION;
    },
    isAnnouncement(): boolean {
      return this.message.type === LogMessageType.ANNOUNCEMENT;
    },
    generationNumber(): number {
      return Number(this.message.data[0]?.value ?? 0);
    },
    isPrivate(): boolean {
      return this.message.playerId !== undefined;
    },
    entries(): ReadonlyArray<string | LogMessageData> {
      const e = {
        message: this.$t(this.message.message),
        data: this.message.data,
      };
      return Log.parse(e);
    },
    when(): string {
      const d = new Date(this.message.timestamp);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    },
    fullWhen(): string {
      return new Date(this.message.timestamp).toLocaleString();
    },
  },
});
</script>
