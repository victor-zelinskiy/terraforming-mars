<template>
  <li class="journal-group"
      :data-correlation-id="header.correlationId"
      :class="[categoryClass, {'journal-group--fresh': headerFresh, 'journal-group--summary': summary, 'journal-group--filtering': filterActive}]">
    <!-- The category spine — runs the full group height, visually binding the
         root action to its consequences as ONE event. -->
    <span class="journal-group__spine" aria-hidden="true"></span>

    <!-- Root action — the dominant header that owns the group. -->
    <div class="journal-group__root" :class="{'journal-group__root--dim': filterActive && !headerMatched}">
      <span class="journal-group__time" :title="fullWhen">{{ when }}</span>
      <span class="journal-group__root-body">
        <JournalTokenRenderer
          v-for="(tok, i) in headerEntries"
          :key="i"
          :token="tok"
          :players="players" />
      </span>
      <!-- A MarsBot turn with an ARCHIVED script — reopen the «Разбор хода»
           review (read-only; never a new game event). -->
      <button v-if="botReplayAvailable"
              type="button"
              class="journal-group__replay"
              :aria-label="$t('Watch turn')"
              @click.stop="openBotReplay">
        <span class="journal-group__replay-glyph" aria-hidden="true">▶</span>
        <span v-i18n>Watch turn</span>
      </button>
      <!-- Summary mode: a compact consequence count instead of the rows. -->
      <span v-if="summary && consequenceCount > 0" class="journal-group__count" :aria-label="$t('Consequences')">
        <span class="journal-group__count-arrow" aria-hidden="true">↳</span>{{ consequenceCount }}
      </span>
    </div>

    <!-- Consequences — compact rows attached to the spine. Event-driven
         (source → impact) when structured events are available, else a
         compacted-LogMessage fallback for old / unsupported logs. -->
    <ul v-if="!summary && hasChildren" class="journal-group__children">
      <template v-if="useEvents">
        <li v-for="(vm, i) in eventVMs" :key="i" class="journal-group__child journal-group__child--event">
          <span class="journal-group__tick" aria-hidden="true"></span>
          <span class="journal-group__child-body">
            <JournalChildRow :vm="vm" :players="players" />
          </span>
        </li>
      </template>
      <template v-else>
        <li v-for="(child, i) in children"
            :key="i"
            class="journal-group__child"
            :class="[
              'journal-group__child--' + (child.role || 'detail'),
              {'journal-group__child--fresh': childFresh(child),
               'journal-group__child--matched': filterActive && childMatched[i],
               'journal-group__child--dim': filterActive && !childMatched[i]}]">
          <span class="journal-group__tick" aria-hidden="true"></span>
          <span class="journal-group__child-body">
            <JournalTokenRenderer
              v-for="(tok, j) in childTokens(child)"
              :key="j"
              :token="tok"
              :players="players" />
          </span>
        </li>
      </template>
    </ul>
  </li>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Log} from '@/common/logs/Log';
import {JournalActionCategory, GameEvent} from '@/common/events/GameEvent';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import JournalChildRow from '@/client/components/journal/JournalChildRow.vue';
import {buildEventChildren, JournalChildVM} from '@/client/components/journal/journalEventChild';
import {botReplayAvailableFor} from '@/client/components/marsbot/marsBotTurnArchive';
import {openBotTurnReviewByCorrelation} from '@/client/components/marsbot/marsBotPresentation';

/**
 * One premium cause/effect GROUP rendered as a single cohesive cluster: a
 * dominant root-action header + its compact consequence rows, all bound by a
 * category-tinted spine so they read as ONE event with its effects.
 *
 * Children are compacted for their grouped context (CLAUDE journal spec):
 * the leading player chip is dropped when it repeats the root actor, so a row
 * reads as a consequence ("gained 2 plants") rather than a standalone action.
 * Effect rows from a DIFFERENT player (e.g. an opponent's Pets firing) keep
 * their player chip — it is the meaningful target.
 *
 * Collapse is NOT per-group: a top-level `mode` (detailed / summary) controls
 * whether consequences are shown in full or as a compact count.
 */
export default defineComponent({
  name: 'JournalGroup',
  components: {JournalTokenRenderer, JournalChildRow},
  props: {
    header: {
      type: Object as () => LogMessage,
      required: true,
    },
    children: {
      type: Array as () => ReadonlyArray<LogMessage>,
      required: true,
    },
    // Structured events of THIS correlation chain (root event included). When
    // present, children render event-driven (source → impact); else fallback.
    events: {
      type: Array as () => ReadonlyArray<GameEvent>,
      default: () => [],
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
    // 'summary' shows only the root + a consequence count; 'detailed' shows rows.
    mode: {
      type: String as () => 'detailed' | 'summary',
      default: 'detailed',
    },
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
    childMatched: {
      type: Array as () => ReadonlyArray<boolean>,
      default: () => [],
    },
  },
  computed: {
    summary(): boolean {
      return this.mode === 'summary';
    },
    categoryClass(): string {
      return 'journal-group--' + (this.category ?? 'generic');
    },
    headerEntries(): ReadonlyArray<string | LogMessageData> {
      return this.parse(this.header);
    },
    headerFresh(): boolean {
      return this.freshSet.has(this.header);
    },
    // The actor of the root action — used to drop redundant child player chips.
    rootPlayerColor(): Color | undefined {
      for (const tok of this.headerEntries) {
        if (typeof tok !== 'string' && tok.type === LogMessageDataType.PLAYER) {
          return tok.value;
        }
      }
      return undefined;
    },
    // Event-driven children (source → impact) for this chain, when events exist.
    eventVMs(): ReadonlyArray<JournalChildVM> {
      if (this.events.length === 0 || this.header.correlationId === undefined) {
        return [];
      }
      return buildEventChildren(this.events, this.header.correlationId, this.rootPlayerColor);
    },
    useEvents(): boolean {
      return this.eventVMs.length > 0;
    },
    hasChildren(): boolean {
      return this.useEvents ? true : this.children.length > 0;
    },
    consequenceCount(): number {
      return this.useEvents ? this.eventVMs.length : this.children.length;
    },
    // A MarsBot turn group whose script is in the client archive — the
    // journal's permanent «watch it again» affordance (reactive: the archive
    // is a reactive Map, so the button appears the moment the turn lands).
    botReplayAvailable(): boolean {
      return this.category === 'automa-turn' && botReplayAvailableFor(this.header.correlationId);
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
    openBotReplay(): void {
      if (this.header.correlationId !== undefined) {
        openBotTurnReviewByCorrelation(this.header.correlationId);
      }
    },
    parse(message: LogMessage): ReadonlyArray<string | LogMessageData> {
      return Log.parse({message: this.$t(message.message), data: message.data});
    },
    // Compact a child for its grouped context: when the row's leading actor is
    // the SAME player as the root action, drop that chip (and the now-leading
    // whitespace) so it reads as a consequence, not a standalone action.
    childTokens(child: LogMessage): ReadonlyArray<string | LogMessageData> {
      const tokens = this.parse(child);
      const first = tokens[0];
      if (this.rootPlayerColor !== undefined &&
          typeof first !== 'string' &&
          first?.type === LogMessageDataType.PLAYER &&
          first.value === this.rootPlayerColor) {
        const rest = tokens.slice(1);
        if (typeof rest[0] === 'string') {
          rest[0] = rest[0].replace(/^\s+/, '');
        }
        return rest;
      }
      return tokens;
    },
    childFresh(child: LogMessage): boolean {
      return this.freshSet.has(child) && !this.headerFresh;
    },
  },
});
</script>
