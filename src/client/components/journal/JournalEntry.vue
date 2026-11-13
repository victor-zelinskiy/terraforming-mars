<template>
  <li v-if="isGenerationMarker" class="journal-gen-divider">
    <span class="journal-gen-divider__line" aria-hidden="true"></span>
    <span class="journal-gen-divider__label"><span v-i18n>Generation</span>&nbsp;{{ generationNumber }}</span>
    <span class="journal-gen-divider__line" aria-hidden="true"></span>
  </li>

  <li v-else
      class="journal-entry"
      :data-correlation-id="message.correlationId"
      :class="{'journal-entry--fresh': animateIn, 'journal-entry--private': isPrivate, 'journal-entry--announcement': isAnnouncement}">
    <!-- Normal entry. -->
    <span class="journal-entry__rail" aria-hidden="true"></span>
    <span v-if="timeShown" class="journal-entry__time" :aria-label="fullWhen">{{ when }}</span>
    <span class="journal-entry__body">
      <template v-for="(tok, i) in entries" :key="i">
        <!-- Several cards drawn at once read as their faces (CH — a fan, never a sheet of names). -->
        <JournalCardFan v-if="fanOf(tok) !== undefined" :cards="fanOf(tok)!" kind="kept" />
        <JournalTokenRenderer v-else :token="tok" :players="players" />
      </template>
    </span>
  </li>
</template>

<script setup lang="ts">
/*
 * Generation boundary marker.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed} from 'vue';
import {vI18n} from '@/client/directives/vDirectives';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {parseLocalizedLog} from '@/client/components/journal/logLocalization';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import JournalCardFan from '@/client/components/journal/JournalCardFan.vue';
import {CardName} from '@/common/cards/CardName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

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
defineOptions({name: 'JournalEntry'});
const props = defineProps({
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
  /** The feed shows the stamp only where it changes (the panel decides — it knows the previous row). */
  timeShown: {
    type: Boolean,
    default: true,
  },
});

const isGenerationMarker = computed((): boolean => {
  return props.message.type === LogMessageType.NEW_GENERATION;
});
const isAnnouncement = computed((): boolean => {
  return props.message.type === LogMessageType.ANNOUNCEMENT;
});
const generationNumber = computed((): number => {
  return Number(props.message.data[0]?.value ?? 0);
});
const isPrivate = computed((): boolean => {
  return props.message.playerId !== undefined;
});
const entries = computed((): ReadonlyArray<string | LogMessageData> => {
  // The shared seam: translate + parse + resolve plural groups across
  // token boundaries («2 {деления}» with the number in its own token).
  return parseLocalizedLog(props.message);
});
const when = computed((): string => {
  const d = new Date(props.message.timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
});
const fullWhen = computed((): string => {
  return new Date(props.message.timestamp).toLocaleString();
});
/** A token of SEVERAL cards (two or more, not an ellipsis) — the fan's cards; anything else renders as a token. */
function fanOf(tok: string | LogMessageData): ReadonlyArray<CardName> | undefined {
  if (typeof tok === 'string' || tok.type !== LogMessageDataType.CARDS || tok.attrs?.ellipsis === true) {
    return undefined;
  }
  const cards = tok.value as ReadonlyArray<CardName>;
  return cards.length >= 2 ? cards : undefined;
}
</script>
