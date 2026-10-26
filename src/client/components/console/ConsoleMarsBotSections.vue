<template>
  <!-- ── «ЭКРАН БОТА» — the bot's internals HUB, as a DOSSIER (the Information polish of 2026-10-19): every rule
       stands WITH ITS OBJECT. One plate per thing the algorithm plays with — the corporation (and the difficulty that
       bends it), the two decks, the bonus piles (a door), the printed board (a door, its miniature on the plate), the
       scoring (the M€ → VP ladder and the clock), the shipping storage and the Hydronetwork when this game has them —
       each plate its objects at the scene's scale and, under them, its paragraph of the SHARED teaching layer
       (`marsBotGuide`, the desktop's own text). The plates are a grid solved to the opening: nothing scrolls, nothing
       stands outside its plate. The two doors are the hub's focus ring — A descends, B returns here. -->
  <div v-if="mode === 'botScreen'" ref="hub" class="con-botscr" :class="{'con-botscr--wide': extraPlates > 0}" :data-botscr-extras="extraPlates" data-botscr-fit="0">
    <section v-if="automa.corporation !== undefined" class="con-botscr__plate con-botscr__plate--corp con-info__block--botcorp">
      <h3 class="con-botscr__kicker">{{ $t('Corporation') }}</h3>
      <div class="con-botscr__corpface">
        <MarsBotCorpFace :id="automa.corporation.id" :resources="automa.corporation.resources"
                         :resource="automa.corporation.resource" compact />
      </div>
      <!-- THE PORTFOLIO (campaign): the corporations the bot HOLDS — their boxes switched off, each paying only its
           dividend at the end, read LIVE (the server's own numbers). Smaller faces, quieter by material, never a halo. -->
      <div v-if="holdings.length > 0" class="con-botscr__portfolio" data-bot-portfolio>
        <span class="con-botscr__portlabel">{{ $t('Holdings · dividend only') }}</span>
        <div class="con-botscr__holdings">
          <div v-for="h in holdings" :key="h.id" class="con-botscr__holding" :data-holding="h.id">
            <div class="con-botscr__holdface"><MarsBotCorpFace :id="h.id" compact /></div>
            <b class="con-botscr__divvp" :data-dividend-vp="h.vp">+{{ h.vp }} <span class="con-botscr__divunit">{{ $t('VP') }}</span></b>
            <span class="con-botscr__divname">{{ $t(h.name) }}</span>
          </div>
        </div>
      </div>
      <span class="con-botscr__difficulty">{{ $t(difficultyLabel) }}</span>
      <p v-for="(body, i) in bodyOf('difficulty')" :key="i" class="con-botscr__prose" v-i18n>{{ body }}</p>
      <p v-for="(body, i) in bodyOf('clock')" :key="'c' + i" class="con-botscr__prose con-botscr__prose--warn" v-i18n>{{ body }}</p>
    </section>
    <section v-else class="con-botscr__plate con-botscr__plate--corp">
      <h3 class="con-botscr__kicker">{{ $t('Difficulty') }}</h3>
      <span class="con-botscr__difficulty">{{ $t(difficultyLabel) }}</span>
      <p v-for="(body, i) in bodyOf('difficulty')" :key="i" class="con-botscr__prose" v-i18n>{{ body }}</p>
      <p v-for="(body, i) in bodyOf('clock')" :key="'c' + i" class="con-botscr__prose con-botscr__prose--warn" v-i18n>{{ body }}</p>
    </section>

    <section class="con-botscr__plate con-botscr__plate--decks">
      <h3 class="con-botscr__kicker">{{ $t('Decks') }}</h3>
      <div class="con-botscr__objects">
        <span class="con-botscr__pile" data-bot-pile="action">
          <span class="con-botscr__backs" :class="{'con-botscr__backs--empty': automa.actionDeckSize === 0}" aria-hidden="true"><span></span><span></span><span></span></span>
          <b class="con-botscr__count">{{ automa.actionDeckSize }}</b>
          <span class="con-botscr__objlabel">{{ $t('Action deck') }}</span>
        </span>
        <span class="con-botscr__pile" data-bot-pile="bonus">
          <span class="con-botscr__backs" :class="{'con-botscr__backs--empty': automa.bonusDeckSize === 0}" aria-hidden="true"><span></span><span></span><span></span></span>
          <b class="con-botscr__count">{{ automa.bonusDeckSize }}</b>
          <span class="con-botscr__objlabel">{{ $t('Bonus deck') }}</span>
        </span>
      </div>
      <p v-for="(body, i) in bodyOf('actionDeck')" :key="i" class="con-botscr__prose" v-i18n>{{ body }}</p>
    </section>

    <!-- The two deep references — the focus ring's entries (the cursor's ring is the plate's own layer). -->
    <section class="con-botscr__plate con-botscr__plate--bonus con-botscr__entry"
             :class="{'con-botscr__entry--focused': focus === 'botBonus'}"
             data-bot-entry="botBonus">
      <h3 class="con-botscr__kicker">{{ $t('Bonus cards') }}</h3>
      <div class="con-botscr__objects">
        <span v-if="automa.recurringBonusCards.length > 0" class="con-botscr__token" data-bot-pile="recurring">
          <b class="con-botscr__count con-botscr__count--accent">{{ automa.recurringBonusCards.length }}</b>
          <span class="con-botscr__objlabel">{{ $t('Recurring') }}</span>
        </span>
        <span class="con-botscr__token" data-bot-pile="discard">
          <b class="con-botscr__count">{{ automa.bonusDiscard.length }}</b>
          <span class="con-botscr__objlabel">{{ $t('Discard pile') }}</span>
        </span>
        <span class="con-botscr__token" data-bot-pile="destroyed">
          <b class="con-botscr__count con-botscr__count--loss">{{ automa.destroyedBonusCards.length }}</b>
          <span class="con-botscr__objlabel">{{ $t('Destroyed cards') }}</span>
        </span>
      </div>
      <p v-for="(body, i) in bodyOf('bonusDeck')" :key="i" class="con-botscr__prose" v-i18n>{{ body }}</p>
    </section>

    <section class="con-botscr__plate con-botscr__plate--board con-botscr__entry"
             :class="{'con-botscr__entry--focused': focus === 'botBoard'}"
             data-bot-entry="botBoard">
      <h3 class="con-botscr__kicker">{{ $t('MarsBot board') }}</h3>
      <!-- The door's object: the printed board itself, in miniature (inert — the board's own screen is one A away). -->
      <div class="con-botscr__minboard" aria-hidden="true">
        <div class="con-botscr__minboard-scale">
          <MarsBotTracks :tracks="automa.tracks" :botColor="bot.color" :corporation="automa.corporation" />
        </div>
      </div>
      <p class="con-botscr__prose con-botscr__prose--door">{{ $t('The printed tracks, the cube and the teaching notes') }}</p>
    </section>

    <section class="con-botscr__plate con-botscr__plate--scoring">
      <h3 class="con-botscr__kicker">{{ $t('MarsBot scoring') }}</h3>
      <div class="con-botscr__objects">
        <span v-if="mcRate > 0" class="con-botscr__token" data-bot-ladder>
          <b class="con-botscr__count">{{ mcRate }}<i class="con-botscr__mc resource_icon resource_icon--megacredits" aria-hidden="true"></i></b>
          <span class="con-botscr__objlabel">{{ $t('M€ per VP at game end') }}</span>
        </span>
        <span v-if="automa.floaters > 0" class="con-botscr__token">
          <b class="con-botscr__count">{{ automa.floaters }}</b>
          <span class="con-botscr__objlabel">{{ $t('Floaters') }}</span>
        </span>
      </div>
      <p v-for="(body, i) in bodyOf('scoring')" :key="'s' + i" class="con-botscr__prose" v-i18n>{{ body }}</p>
    </section>

    <section v-if="hasSection('shipping')" class="con-botscr__plate con-botscr__plate--extra">
      <h3 class="con-botscr__kicker">{{ $t('Shipping storage') }}</h3>
      <div v-if="storageEntries.length > 0 || automa.secondFleetUnlocked" class="con-botscr__objects">
        <span v-for="s in storageEntries" :key="s.colony" class="con-botscr__token">
          <b class="con-botscr__count">{{ s.count }}</b>
          <span class="con-botscr__objlabel">{{ $t(s.colony) }}</span>
        </span>
        <span v-if="automa.secondFleetUnlocked" class="con-botscr__token">
          <b class="con-botscr__count">2</b>
          <span class="con-botscr__objlabel">{{ $t('Trade fleets') }}</span>
        </span>
      </div>
      <p v-for="(body, i) in bodyOf('shipping')" :key="i" class="con-botscr__prose" v-i18n>{{ body }}</p>
    </section>

    <section v-if="hasSection('hydronetwork')" class="con-botscr__plate con-botscr__plate--extra">
      <h3 class="con-botscr__kicker">{{ $t('Hydronetwork') }}</h3>
      <p v-for="(body, i) in bodyOf('hydronetwork')" :key="i" class="con-botscr__prose" v-i18n>{{ body }}</p>
    </section>
  </div>

  <!-- ── «ПЛАНШЕТ БОТА» — the printed board at the SCENE's scale (its px-authored mat rides `zoom × --con-ui-scale`,
       the console's scale model for embedded px content) + the cube legend, and the three rules that READ this board
       (its turn, the trackers, the failed action) beside it. A nested route of «Экран бота»: B returns to the hub. -->
  <div v-else-if="mode === 'botBoard'" class="con-botboard">
    <div class="con-botboard__stage">
      <MarsBotTracks :tracks="automa.tracks" :botColor="bot.color" :corporation="automa.corporation" large />
    </div>
    <div class="con-botboard__legend con-bot__legend">{{ $t('The cube marks the current position; ✕ marks regressed spaces whose action will not trigger again') }}</div>
    <div class="mb-guide con-botboard__guide">
      <div v-for="section in boardGuide" :key="section.id" class="con-botboard__rule" :data-guide="section.id">
        <h4 class="con-botscr__kicker con-botboard__ruletitle">
          <span class="con-botboard__glyph" aria-hidden="true">{{ section.glyph }}</span>
          <span v-i18n>{{ section.title }}</span>
        </h4>
        <p v-for="(body, i) in section.body" :key="i" class="con-botscr__prose" v-i18n>{{ body }}</p>
      </div>
    </div>
  </div>

  <!-- ── «БОНУСНЫЕ КАРТЫ» — the open bonus piles as PILES (a nested route): the recurring cards (when the corporation
       has them), the discard, the destroyed — each a column with its rule; an empty pile is a composed object (its
       outline and one word), never a bare line. The faces are the SHARED `BonusCardFace` (px-authored, `zoom ×
       --con-ui-scale`). -->
  <div v-else-if="mode === 'botBonus'" class="con-botbonus" :data-bonus-piles="bonusPiles.length">
    <section v-for="pile in bonusPiles" :key="pile.key" class="con-botbonus__pile" :data-bonus-pile="pile.key">
      <h4 class="con-botscr__kicker">{{ $t(pile.title) }} <b class="con-botbonus__count">{{ pile.ids.length }}</b></h4>
      <p class="con-botscr__prose">{{ $t(pile.note) }}</p>
      <div v-if="pile.ids.length === 0" class="con-botbonus__void">
        <span class="con-botbonus__outline" aria-hidden="true"></span>
        <span class="con-botbonus__voidline">{{ $t('Empty') }}</span>
      </div>
      <div v-else class="con-botbonus__faces" :data-faces="pile.ids.length">
        <BonusCardFace v-for="id in pile.ids" :key="id" :id="id" :ctx="ctx" large :destroyed="pile.key === 'destroyed'" />
      </div>
    </section>
  </div>
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
import {defineComponent, markRaw, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {BotScreenEntry} from '@/client/console/infoRoute';
import {GuideSection, MarsBotGuideContext, marsBotGuide} from '@/client/components/marsbot/marsBotGuide';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import MarsBotTracks from '@/client/components/marsbot/MarsBotTracks.vue';
import BonusCardFace from '@/client/components/marsbot/BonusCardFace.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import {BonusCardId, MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {marsBotDividendInfo} from '@/common/automa/MarsBotDividendData';

/** The teaching sections that read the printed board (their home is the board's own screen). */
const BOARD_RULES: ReadonlyArray<string> = ['turn', 'tracks', 'failed'];
/** The prose's steps down the type ladder before the hub gives up fitting (secondary → caption → floor). */
const HUB_FIT_LEVELS = 2;

export default defineComponent({
  name: 'ConsoleMarsBotSections',
  components: {MarsBotTracks, BonusCardFace, MarsBotCorpFace},
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
  data() {
    return {
      /** The hub's own box watcher (raw — a native observer never goes through a reactive proxy). */
      hubObserver: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    difficultyLabel(): string {
      return DIFFICULTY_LABEL[this.automa.difficulty];
    },
    /** The campaign portfolio's HOLDINGS with their live dividend (empty in every ordinary game). */
    holdings(): ReadonlyArray<{id: MarsBotCorpId, vp: number, name: string}> {
      return (this.automa.holdings ?? []).map((h) => ({id: h.id, vp: h.dividend.vp, name: marsBotDividendInfo(h.id).name}));
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
    /** The rules that READ the printed board — they stand beside it on its own screen. */
    boardGuide(): ReadonlyArray<GuideSection> {
      return this.guide.filter((s) => BOARD_RULES.includes(s.id));
    },
    /** The hub's plates past the core five: the shipping storage and the Hydronetwork, when this game has them. */
    extraPlates(): number {
      return ['shipping', 'hydronetwork'].filter((id) => this.hasSection(id)).length;
    },
    /** The bonus route's piles, in the order a card travels: recurring (when any) · discard · destroyed. */
    bonusPiles(): ReadonlyArray<{key: string, title: string, note: string, ids: ReadonlyArray<BonusCardId>}> {
      const piles: Array<{key: string, title: string, note: string, ids: ReadonlyArray<BonusCardId>}> = [];
      if (this.automa.recurringBonusCards.length > 0) {
        piles.push({key: 'recurring', title: 'Recurring bonus cards', note: 'These cards never go to the discard — they are shuffled back into the action deck every generation', ids: this.automa.recurringBonusCards});
      }
      piles.push({key: 'discard', title: 'Bonus discard', note: 'Resolved bonus cards rest here and are shuffled back in when the bonus deck runs out', ids: this.automa.bonusDiscard});
      piles.push({key: 'destroyed', title: 'Destroyed bonus cards', note: 'Destroyed cards are removed from the game permanently — they are never reshuffled', ids: this.automa.destroyedBonusCards});
      return piles;
    },
  },
  mounted() {
    this.observeHub();
  },
  updated() {
    this.observeHub();
  },
  beforeUnmount() {
    this.hubObserver?.disconnect();
    this.hubObserver = undefined;
  },
  methods: {
    /**
     * THE HUB SITS IN ITS OPENING: every plate's content must stand inside its plate. The prose is the one part that
     * yields — measured, never guessed: the reading size steps down (`data-botscr-fit` 0 → 1 → 2, the type ladder's
     * own tokens) until no plate overflows. A handheld lays the plates out as a flowing two-column read instead (the
     * plates never clip there), so the walk ends at 0. Attribute writes only — no reactive state, no render loop.
     */
    fitHub(): void {
      const hub = this.$refs.hub as HTMLElement | undefined;
      if (hub === undefined) {
        return;
      }
      const plates = Array.from(hub.querySelectorAll<HTMLElement>('.con-botscr__plate'));
      for (let level = 0; level <= HUB_FIT_LEVELS; level++) {
        hub.dataset.botscrFit = String(level);
        if (!plates.some((plate) => plate.scrollHeight > plate.clientHeight + 1)) {
          return;
        }
      }
    },
    observeHub(): void {
      const hub = this.$refs.hub as HTMLElement | undefined;
      if (hub === undefined) {
        this.hubObserver?.disconnect();
        this.hubObserver = undefined;
        return;
      }
      if (this.hubObserver === undefined && typeof ResizeObserver !== 'undefined') {
        this.hubObserver = markRaw(new ResizeObserver(() => this.fitHub()));
        this.hubObserver.observe(hub);
      }
      this.fitHub();
    },
    hasSection(id: string): boolean {
      return this.guide.some((s) => s.id === id);
    },
    /** A teaching section's paragraphs (English i18n keys), by its id — empty when this game has no such section. */
    bodyOf(id: string): ReadonlyArray<string> {
      return this.guide.find((s) => s.id === id)?.body ?? [];
    },
  },
});
</script>
