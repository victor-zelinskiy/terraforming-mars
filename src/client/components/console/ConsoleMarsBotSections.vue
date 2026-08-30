<template>
  <!-- ── «ЭКРАН БОТА» — the bot's internals HUB (R3 from its summary).
       Everything that explains HOW the algorithm works lives here, off the
       shared participant summary: decks + discard/reshuffle rules, the
       track internals, the storage conversion rule, the M€→VP ladder, the
       corporation's bot rules, the difficulty. Its two deep references
       (the printed board, the open bonus piles) are FOCUSABLE ENTRIES —
       A descends, B returns here, one level at a time. -->
  <template v-if="mode === 'botScreen'">
    <!-- The corporation — bot rules only, identity/art from the original.
         (The corp also lives in «Разыграно»'s corporation slot — this is
         the RULES read, that is the card-table one.) -->
    <section v-if="automa.corporation !== undefined" class="con-info__block con-info__block--botcorp">
      <h3 class="con-info__block-title">{{ $t('Corporation') }}
        <span class="con-botscr__difficulty">{{ $t(difficultyLabel) }}</span>
      </h3>
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

    <!-- The two deep references — the focus ring's entries. -->
    <section class="con-info__block con-botscr__entry"
             :class="{'con-botscr__entry--focused': focus === 'botBoard'}"
             data-bot-entry="botBoard">
      <h3 class="con-info__block-title">{{ $t('MarsBot board') }}
        <!-- A opens the FOCUSED entry — the glyph rides the ring. -->
        <span v-if="focus === 'botBoard'" class="con-info__hotkey"><GamepadGlyph control="confirm" /></span>
      </h3>
      <div class="con-info__note con-info__note--door">{{ $t('The printed tracks, the cube and the teaching notes') }}</div>
    </section>

    <section class="con-info__block con-botscr__entry"
             :class="{'con-botscr__entry--focused': focus === 'botBonus'}"
             data-bot-entry="botBonus">
      <h3 class="con-info__block-title">{{ $t('Bonus cards') }}
        <span v-if="focus === 'botBonus'" class="con-info__hotkey"><GamepadGlyph control="confirm" /></span>
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

    <!-- The scoring MECHANICS — why the summary's shared categories read
         what they read (the ladder, the difficulty clause). -->
    <section class="con-info__block">
      <h3 class="con-info__block-title">{{ $t('MarsBot scoring') }}</h3>
      <div class="con-info__stat-lines">
        <div v-if="mcRate > 0" class="con-info__stat-line"><span>{{ $t('M€ per VP at game end') }}</span><b>{{ mcRate }}</b></div>
        <div v-if="automa.floaters > 0" class="con-info__stat-line"><span>{{ $t('Floaters') }}</span><b>{{ automa.floaters }}</b></div>
      </div>
      <div class="con-info__note">{{ $t('Leftover M€ converts to VP at game end') }}</div>
      <div v-if="countsCardVp" class="con-info__note">{{ $t('On Hard and Brutal, printed VP icons on flipped cards score 1 VP each') }}</div>
    </section>
  </template>

  <!-- ── «ПЛАНШЕТ БОТА» — the printed board (tracks, TV-sized) + the
       teaching layer. A nested route of «Экран бота»: B returns to the
       hub, never to the summary. -->
  <template v-else-if="mode === 'botBoard'">
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
  </template>

  <!-- ── «БОНУСНЫЕ КАРТЫ» — the open bonus piles (a nested route). ────── -->
  <template v-else-if="mode === 'botBonus'">
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
  </template>
</template>

<script lang="ts">
/**
 * «ЭКРАН БОТА» + its two nested routes — the MarsBot internals of the
 * console Information workspace. The participant SUMMARY shows the bot as
 * one more player at the table; THIS surface is where its machinery lives:
 * decks, discard/reshuffle, storage exchange, the M€→VP ladder, the
 * difficulty clause, the printed board and the open bonus piles.
 *
 * Bonus cards render through the SHARED `BonusCardFace` — the effect lines
 * are already resolved for THIS game's expansion set; the teaching blocks
 * come from the SHARED `marsBotGuide`, so console and desktop explain the
 * bot identically. Read-only public data; input routing stays in
 * ConsoleShell and button hints stay in the one command bar.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {BotScreenEntry} from '@/client/console/infoRoute';
import {GuideSection, MarsBotGuideContext, marsBotGuide} from '@/client/components/marsbot/marsBotGuide';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import MarsBotTracks from '@/client/components/marsbot/MarsBotTracks.vue';
import BonusCardFace from '@/client/components/marsbot/BonusCardFace.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleMarsBotSections',
  components: {MarsBotTracks, BonusCardFace, MarsBotCorpFace, GamepadGlyph},
  props: {
    mode: {type: String as PropType<'botScreen' | 'botBoard' | 'botBonus'>, required: true},
    bot: {type: Object as PropType<PublicPlayerModel>, required: true},
    automa: {type: Object as PropType<MarsBotModel>, required: true},
    /** The expansion context — resolves bonus-card faces + guide sections for THIS game. */
    ctx: {type: Object as PropType<MarsBotGuideContext>, required: true},
    /** The hub's focus ring — which deep entry the cursor stands on. */
    focus: {type: String as PropType<BotScreenEntry>, default: 'botBoard'},
    /** The bot seat's M€ supply (the scoring block's ladder input). */
    megacredits: {type: Number, default: 0},
  },
  computed: {
    difficultyLabel(): string {
      return DIFFICULTY_LABEL[this.automa.difficulty];
    },
    storageEntries(): Array<{colony: string, count: number}> {
      const storage = this.automa.shippingStorage;
      if (storage === undefined) {
        return [];
      }
      return Object.entries(storage)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
        .map(([colony, count]) => ({colony, count}));
    },
    /** The current M€→VP ladder rate (from the live breakdown's automa
     *  block — server truth; 0 hides the row on a pre-automa model). */
    mcRate(): number {
      return this.bot.victoryPointsBreakdown.automa?.mcPerVp ?? 0;
    },
    countsCardVp(): boolean {
      return this.automa.difficulty === 'hard' || this.automa.difficulty === 'brutal';
    },
    guide(): ReadonlyArray<GuideSection> {
      return marsBotGuide(this.automa.difficulty, this.ctx);
    },
  },
});
</script>
