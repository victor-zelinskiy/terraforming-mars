<template>
  <!-- Literal (already-translated) text between placeholders. -->
  <span v-if="typeof(token) === 'string'" class="journal-text">{{ token }}</span>

  <!-- Typed token. Inside this v-else `token` is narrowed to
       LogMessageData (mirrors the legacy LogMessageComponent structure
       so vue-tsc narrows the discriminated union the same way). -->
  <span v-else>
    <span v-if="token.type === undefined || token.value === undefined"></span>

    <!-- Player — colour-coded chip. -->
    <span v-else-if="token.type === LogMessageDataType.PLAYER"
          class="journal-player"
          :class="'player_translucent_bg_color_' + token.value">
      <span class="journal-player__dot" :class="'player_bg_color_' + token.value" aria-hidden="true"></span>
      <span class="journal-player__name">{{ playerName(token.value) }}</span>
    </span>

    <!-- Single card / standard project. -->
    <JournalCardChip v-else-if="token.type === LogMessageDataType.CARD" :name="token.value" :attrs="token.attrs" />

    <!-- Several cards, locale-joined ("A, B and C"). -->
    <span v-else-if="token.type === LogMessageDataType.CARDS" class="journal-cards">
      <span v-if="token.attrs && token.attrs.ellipsis" class="journal-chip journal-chip--standard">…</span>
      <template v-else>
        <template v-for="(part, i) in cardParts" :key="i">
          <JournalCardChip v-if="part.kind === 'card'" :name="part.name" :attrs="token.attrs" />
          <span v-else class="journal-text">{{ part.text }}</span>
        </template>
      </template>
    </span>

    <!-- Board space — a "show on map" button; never leaks the raw id. -->
    <button v-else-if="token.type === LogMessageDataType.SPACE"
            type="button"
            class="journal-token journal-token--space"
            :aria-label="$t('Show on map')"
            @click.stop.prevent="onSpaceClick(token.value)">
      <svg class="journal-token--space__pin" width="11" height="13" viewBox="0 0 11 13" aria-hidden="true">
        <path d="M5.5 0C2.46 0 0 2.4 0 5.36 0 9.1 5.5 13 5.5 13S11 9.1 11 5.36C11 2.4 8.54 0 5.5 0Zm0 7.3a1.96 1.96 0 1 1 0-3.92 1.96 1.96 0 0 1 0 3.92Z"/>
      </svg>
      <span v-i18n>Show on map</span>
    </button>

    <!-- Named game objects — semantic, calm chips. -->
    <span v-else-if="token.type === LogMessageDataType.GLOBAL_EVENT" class="journal-token journal-token--global-event" v-i18n>{{ token.value }}</span>
    <JournalColonyChip v-else-if="token.type === LogMessageDataType.COLONY" :name="token.value" />
    <JournalMaChip v-else-if="token.type === LogMessageDataType.AWARD" kind="award" :name="token.value" />
    <JournalMaChip v-else-if="token.type === LogMessageDataType.MILESTONE" kind="milestone" :name="token.value" />
    <span v-else-if="token.type === LogMessageDataType.PARTY" class="journal-token journal-token--party" v-i18n>{{ token.value }}</span>
    <span v-else-if="token.type === LogMessageDataType.UNDERGROUND_TOKEN" class="journal-token journal-token--underground" v-i18n>{{ undergroundDescription[token.value] }}</span>
    <span v-else-if="token.type === LogMessageDataType.TILE_TYPE" class="journal-em" v-i18n>{{ tileTypeToString[token.value] }}</span>

    <!-- RAW_STRING is intentionally untranslated; everything else (incl.
         STRING, SPACE_BONUS) gets a translation pass like the legacy UI. -->
    <span v-else-if="token.type === LogMessageDataType.RAW_STRING" class="journal-em">{{ token.value }}</span>
    <span v-else class="journal-em" v-i18n>{{ token.value }}</span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {SpaceId} from '@/common/Types';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {tileTypeToString} from '@/common/TileType';
import {undergroundResourceTokenDescription} from '@/common/underworld/UndergroundResourceToken';
import {range} from '@/common/utils/utils';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {gameLocaleToIntlLocale} from '@/client/utils/LocaleUtils';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import JournalColonyChip from '@/client/components/journal/JournalColonyChip.vue';
import JournalMaChip from '@/client/components/journal/JournalMaChip.vue';
import {highlightBoardSpace} from '@/client/components/journal/boardCellHighlight';

type CardPart = {kind: 'card', name: CardName} | {kind: 'text', text: string};

/**
 * Renders ONE parsed token from a journal entry — a literal string or a
 * typed `LogMessageData`. This is the single switchboard that turns the
 * server's structured log data into semantic, interactive chips: the
 * modern replacement for legacy `LogMessageComponent`'s inline v-html.
 */
export default defineComponent({
  name: 'JournalTokenRenderer',
  components: {JournalCardChip, JournalColonyChip, JournalMaChip},
  props: {
    token: {
      type: [String, Object] as PropType<string | LogMessageData>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
  },
  computed: {
    LogMessageDataType(): typeof LogMessageDataType {
      return LogMessageDataType;
    },
    tileTypeToString(): typeof tileTypeToString {
      return tileTypeToString;
    },
    undergroundDescription(): typeof undergroundResourceTokenDescription {
      return undergroundResourceTokenDescription;
    },
    formatter(): Intl.ListFormat {
      return new Intl.ListFormat(
        gameLocaleToIntlLocale(getPreferences().lang),
        {type: 'conjunction', style: 'long'});
    },
    // Splits a CARDS token into an ordered mix of card chips and the
    // locale-specific connective literals ("A, B and C") so the joining
    // text honours the player's language — same approach the legacy
    // renderer used, but yielding components instead of HTML strings.
    cardParts(): ReadonlyArray<CardPart> {
      const t = this.token;
      if (typeof t === 'string' || t.type !== LogMessageDataType.CARDS) {
        return [];
      }
      const cards = t.value;
      const indexes = range(cards.length).map(String);
      const parts = this.formatter.formatToParts(indexes);
      return parts.map((part): CardPart => {
        if (part.type === 'element') {
          return {kind: 'card', name: cards[Number(part.value)]};
        }
        return {kind: 'text', text: part.value};
      });
    },
  },
  methods: {
    playerName(color: Color): string {
      return this.players.find((p) => p.color === color)?.name ?? color;
    },
    onSpaceClick(spaceId: SpaceId): void {
      highlightBoardSpace(spaceId);
    },
  },
});
</script>
