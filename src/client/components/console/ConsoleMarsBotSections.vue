<template>
  <!-- ── Dashboard blocks (the bot participant's overview) ─────────────── -->
  <template v-if="mode === 'dashboard'">
    <section class="con-info__block con-info__block--resources">
      <h3 class="con-info__block-title">{{ $t('Economy') }}</h3>
      <div class="con-info__res-grid">
        <div class="con-info__res">
          <i class="con-info__res-icon resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          <span class="con-info__res-value">{{ bot.megacredits }}</span>
        </div>
        <div v-if="automa.floaters > 0" class="con-info__res">
          <i class="con-info__res-icon card-resource card-resource-floater" aria-hidden="true"></i>
          <span class="con-info__res-value">{{ automa.floaters }}</span>
        </div>
      </div>
      <div class="con-info__note">{{ $t('MarsBot has no production — its economy is the M€ supply') }}</div>
    </section>

    <section class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Tracks') }}
        <span class="con-info__hotkey"><GamepadGlyph control="secondary" /></span>
      </h3>
      <div class="con-info__stat-lines">
        <div v-for="(t, i) in automa.tracks" :key="i" class="con-info__stat-line con-bot__track-line">
          <span class="con-bot__track-tags"><Tag v-if="tagOf(t)" :tag="tagOf(t)!" size="med" type="secondary" /></span>
          <span class="con-bot__track-bar" aria-hidden="true"><span class="con-bot__track-fill" :style="{width: fillPercent(t)}"></span></span>
          <b>{{ t.position }}<span class="con-bot__track-max">/{{ t.maxPosition }}</span></b>
        </div>
      </div>
    </section>

    <section class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Decks') }}</h3>
      <div class="con-info__stat-lines">
        <div class="con-info__stat-line"><span>{{ $t('Action deck') }}</span><b class="con-info__mint">{{ automa.actionDeckSize }}</b></div>
        <div class="con-info__stat-line"><span>{{ $t('Bonus deck') }}</span><b>{{ automa.bonusDeckSize }}</b></div>
      </div>
      <div class="con-info__note">{{ $t('Face-down deck contents are hidden') }}</div>
    </section>

    <section class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Played cards') }}
        <span class="con-info__hotkey"><GamepadGlyph control="triggerL" /></span>
      </h3>
      <div class="con-info__stat-lines">
        <div class="con-info__stat-line"><span>{{ $t('Project cards') }}</span><b class="con-info__mint">{{ automa.playedPile.length }}</b></div>
      </div>
    </section>

    <section class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Bonus cards') }}
        <span class="con-info__hotkey"><GamepadGlyph control="triggerR" /></span>
      </h3>
      <div class="con-info__stat-lines">
        <div class="con-info__stat-line"><span>{{ $t('Discard') }}</span><b>{{ automa.bonusDiscard.length }}</b></div>
        <div class="con-info__stat-line"><span>{{ $t('Destroyed') }}</span><b>{{ automa.destroyedBonusCards.length }}</b></div>
      </div>
    </section>

    <section v-if="storageEntries.length > 0" class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Shipping storage') }}</h3>
      <div class="con-info__stat-lines">
        <div v-for="s in storageEntries" :key="s.colony" class="con-info__stat-line">
          <span>{{ $t(s.colony) }}</span><b>{{ s.count }}</b>
        </div>
        <div v-if="automa.secondFleetUnlocked" class="con-info__stat-line"><span>{{ $t('Trade fleets') }}</span><b>2</b></div>
      </div>
    </section>
  </template>

  <!-- ── Detail: the printed board (tracks, TV-sized) ───────────────────── -->
  <div v-else-if="mode === 'botBoard'" class="con-info__scroll con-info__detail-scroll">
    <MarsBotTracks :tracks="automa.tracks" :botColor="bot.color" large />
    <div class="con-info__note con-bot__legend">{{ $t('The cube marks the current position; ✕ marks regressed spaces whose action will not trigger again') }}</div>
  </div>

  <!-- ── Detail: the played project pile (real card renders) ───────────── -->
  <div v-else-if="mode === 'botPlayed'" class="con-info__scroll con-info__detail-scroll">
    <div v-if="automa.playedPile.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No cards played yet') }}</div>
    <div v-else class="con-info__excards">
      <div v-for="(name, i) in automa.playedPile" :key="name + '#' + i" class="con-info__excard">
        <Card :card="{name}" :key="name" lightweight />
      </div>
    </div>
  </div>

  <!-- ── Detail: the open bonus piles ───────────────────────────────────── -->
  <div v-else-if="mode === 'botBonus'" class="con-info__scroll con-info__detail-scroll">
    <h4 class="con-bot__pile-title">{{ $t('Bonus discard') }}</h4>
    <div v-if="automa.bonusDiscard.length === 0" class="con-info__empty">{{ $t('Empty') }}</div>
    <div v-else class="con-bot__bonuses">
      <div v-for="id in automa.bonusDiscard" :key="id" class="mb-bonus">
        <span class="mb-bonus__name">{{ $t(bonusName(id)) }}</span>
        <span class="mb-bonus__text">{{ $t(bonusText(id)) }}</span>
      </div>
    </div>
    <template v-if="automa.destroyedBonusCards.length > 0">
      <h4 class="con-bot__pile-title">{{ $t('Destroyed bonus cards') }}</h4>
      <div class="con-bot__bonuses">
        <div v-for="id in automa.destroyedBonusCards" :key="id" class="mb-bonus mb-bonus--destroyed">
          <span class="mb-bonus__name">{{ $t(bonusName(id)) }}</span>
          <span class="mb-bonus__text">{{ $t(bonusText(id)) }}</span>
          <span class="mb-bonus__destroyed-chip">{{ $t('Removed from the game') }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
/**
 * The MarsBot participant sections of the console INFO MODE — the bot's
 * dashboard blocks plus its three details (printed board / played pile /
 * bonus piles). The human extras/actions/effects don't exist for the Automa,
 * so these replace them while the viewed participant is the bot. Read-only,
 * public `GameModel.automa` data; input routing stays in ConsoleShell and
 * button hints stay in the info-mode footer (never inside these blocks).
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {bonusCardInfo} from '@/common/automa/BonusCardData';
import {Tag as CardTag} from '@/common/cards/Tag';
import {trackTag} from '@/client/components/marsbot/marsBotView';
import MarsBotTracks from '@/client/components/marsbot/MarsBotTracks.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import Tag from '@/client/components/Tag.vue';
import Card from '@/client/components/card/Card.vue';

export default defineComponent({
  name: 'ConsoleMarsBotSections',
  components: {MarsBotTracks, GamepadGlyph, Tag, Card},
  props: {
    mode: {type: String as PropType<'dashboard' | 'botBoard' | 'botPlayed' | 'botBonus'>, required: true},
    bot: {type: Object as PropType<PublicPlayerModel>, required: true},
    automa: {type: Object as PropType<MarsBotModel>, required: true},
  },
  computed: {
    storageEntries(): Array<{colony: string, count: number}> {
      const storage = this.automa.shippingStorage;
      if (storage === undefined) {
        return [];
      }
      return Object.entries(storage)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
        .map(([colony, count]) => ({colony, count}));
    },
  },
  methods: {
    tagOf(track: MarsBotTrackModel): CardTag | undefined {
      return trackTag(track);
    },
    fillPercent(track: MarsBotTrackModel): string {
      if (track.maxPosition <= 0) {
        return '0%';
      }
      return `${Math.round((track.position / track.maxPosition) * 100)}%`;
    },
    bonusName(id: BonusCardId): string {
      return bonusCardInfo(id).name;
    },
    bonusText(id: BonusCardId): string {
      return bonusCardInfo(id).text;
    },
  },
});
</script>
