<template>
  <!-- ── Dashboard blocks (the bot participant's overview) ─────────────── -->
  <template v-if="mode === 'dashboard'">
    <!-- The bot's ECONOMY (M€ supply, floaters) and its TAG TRACKS live on
         the LEFT RAIL now — the Information Workspace overrides the rail to
         the inspected seat and it renders the dedicated bot presentation
         (marsBotRailModel). This dashboard keeps only the detail the rail
         cannot carry: decks, piles, storage — plus the printed-board guide
         behind X (the botBoard detail). -->
    <!-- The bot's CORPORATION (Rule Book B) — its own card: bot rules only,
         identity/art from the original. The face carries the live resource
         count; the fullscreen inspect lives in the «Разыграно» corporation
         slot (X → the unified table). -->
    <section v-if="automa.corporation !== undefined" class="con-info__block con-info__block--botcorp">
      <h3 class="con-info__block-title">{{ $t('Corporation') }}</h3>
      <MarsBotCorpFace :id="automa.corporation.id" :resources="automa.corporation.resources"
                       :resource="automa.corporation.resource" compact />
    </section>

    <section class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Decks') }}</h3>
      <div class="con-info__stat-lines">
        <div class="con-info__stat-line"><span>{{ $t('Action deck') }}</span><b class="con-info__mint">{{ automa.actionDeckSize }}</b></div>
        <div class="con-info__stat-line"><span>{{ $t('Bonus deck') }}</span><b>{{ automa.bonusDeckSize }}</b></div>
      </div>
      <div class="con-info__note">{{ $t('One flip per turn; an empty action deck means MarsBot passes') }}</div>
    </section>

    <!-- (The «Разыгранные карты» summary is the UNIFIED block in
         ConsoleInfoMode now — same block for humans and the bot, X opens
         the same premium table over the bot's played pile.) -->
    <section class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Bonus cards') }}
        <span class="con-info__hotkey"><GamepadGlyph control="triggerR" /></span>
      </h3>
      <div class="con-info__stat-lines">
        <div v-if="automa.recurringBonusCards.length > 0" class="con-info__stat-line"><span>{{ $t('Recurring') }}</span><b class="con-info__mint">{{ automa.recurringBonusCards.length }}</b></div>
        <div class="con-info__stat-line"><span>{{ $t('Discard pile') }}</span><b>{{ automa.bonusDiscard.length }}</b></div>
        <div class="con-info__stat-line"><span>{{ $t('Destroyed cards') }}</span><b>{{ automa.destroyedBonusCards.length }}</b></div>
      </div>
      <div class="con-info__note">{{ $t('Discarded cards can return after a reshuffle; destroyed cards never do') }}</div>
    </section>

    <section v-if="storageEntries.length > 0" class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('Shipping storage') }}</h3>
      <div class="con-info__stat-lines">
        <div v-for="s in storageEntries" :key="s.colony" class="con-info__stat-line">
          <span>{{ $t(s.colony) }}</span><b>{{ s.count }}</b>
        </div>
        <div v-if="automa.secondFleetUnlocked" class="con-info__stat-line"><span>{{ $t('Trade fleets') }}</span><b>2</b></div>
      </div>
      <div class="con-info__note">{{ $t('Every 5 resources here exchange into a tracker step') }}</div>
    </section>
  </template>

  <!-- ── Detail: the printed board (tracks, TV-sized) + the teaching layer ── -->
  <div v-else-if="mode === 'botBoard'" class="con-info__scroll con-info__detail-scroll">
    <MarsBotTracks :tracks="automa.tracks" :botColor="bot.color" :corporation="automa.corporation" large />
    <div class="con-info__note con-bot__legend">{{ $t('The cube marks the current position; ✕ marks regressed spaces whose action will not trigger again') }}</div>
    <div class="mb-guide mb-guide--console">
      <div v-for="section in guide" :key="section.id" class="mb-guide__block">
        <h4 class="mb-guide__title">
          <span class="mb-guide__glyph" aria-hidden="true">{{ section.glyph }}</span>
          <span v-i18n>{{ section.title }}</span>
        </h4>
        <p v-for="(body, i) in section.body" :key="i" class="mb-guide__body" v-i18n>{{ body }}</p>
      </div>
    </div>
  </div>

  <!-- (The played pile detail moved to the UNIFIED embedded «Разыграно»
       table — the workspace's X detail renders it through the same premium
       overlay as a human tableau.) -->

  <!-- ── Detail: the open bonus piles ───────────────────────────────────── -->
  <div v-else-if="mode === 'botBonus'" class="con-info__scroll con-info__detail-scroll">
    <template v-if="automa.recurringBonusCards.length > 0">
      <h4 class="con-bot__pile-title">{{ $t('Recurring bonus cards') }}</h4>
      <p class="con-info__note con-bot__pile-note">{{ $t('These cards never go to the discard — they are shuffled back into the action deck every generation') }}</p>
      <div class="con-bot__bonuses">
        <BonusCardFace v-for="id in automa.recurringBonusCards" :key="id" :id="id" :ctx="ctx" large />
      </div>
    </template>
    <h4 class="con-bot__pile-title">{{ $t('Bonus discard') }}</h4>
    <p class="con-info__note con-bot__pile-note">{{ $t('Resolved bonus cards rest here and are shuffled back in when the bonus deck runs out') }}</p>
    <div v-if="automa.bonusDiscard.length === 0" class="con-info__empty">{{ $t('Empty') }}</div>
    <div v-else class="con-bot__bonuses">
      <BonusCardFace v-for="id in automa.bonusDiscard" :key="id" :id="id" :ctx="ctx" large />
    </div>
    <template v-if="automa.destroyedBonusCards.length > 0">
      <h4 class="con-bot__pile-title">{{ $t('Destroyed bonus cards') }}</h4>
      <p class="con-info__note con-bot__pile-note">{{ $t('Destroyed cards are removed from the game permanently — they are never reshuffled') }}</p>
      <div class="con-bot__bonuses">
        <BonusCardFace v-for="id in automa.destroyedBonusCards" :key="id" :id="id" :ctx="ctx" large destroyed />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
/**
 * The MarsBot participant sections of the console INFO MODE — the bot's
 * dashboard blocks plus its three details (printed board + the teaching layer
 * / played pile / bonus piles). The human extras/actions/effects don't exist
 * for the Automa, so these replace them while the viewed participant is the
 * bot. Bonus cards render through the SHARED `BonusCardFace` — the effect
 * lines are already resolved for THIS game's expansion set; the teaching
 * blocks come from the SHARED `marsBotGuide`, so console and desktop explain
 * the bot identically. Read-only public data; input routing stays in
 * ConsoleShell and button hints stay in the info-mode footer.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {GuideSection, MarsBotGuideContext, marsBotGuide} from '@/client/components/marsbot/marsBotGuide';
import MarsBotTracks from '@/client/components/marsbot/MarsBotTracks.vue';
import BonusCardFace from '@/client/components/marsbot/BonusCardFace.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleMarsBotSections',
  components: {MarsBotTracks, BonusCardFace, MarsBotCorpFace, GamepadGlyph},
  props: {
    mode: {type: String as PropType<'dashboard' | 'botBoard' | 'botBonus'>, required: true},
    bot: {type: Object as PropType<PublicPlayerModel>, required: true},
    automa: {type: Object as PropType<MarsBotModel>, required: true},
    /** The expansion context — resolves bonus-card faces + guide sections for THIS game. */
    ctx: {type: Object as PropType<MarsBotGuideContext>, required: true},
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
    guide(): ReadonlyArray<GuideSection> {
      return marsBotGuide(this.automa.difficulty, this.ctx);
    },
  },
});
</script>
