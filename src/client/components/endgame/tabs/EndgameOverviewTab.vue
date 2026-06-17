<template>
  <div class="eg-tab eg-overview">
    <!-- ── DUEL: head-to-head ────────────────────────────────────────── -->
    <section v-if="mode === 'duel'" class="eg-overview__duel">
      <div class="eg-duel">
        <div v-for="(p, side) in duelPlayers" :key="p.color"
             class="eg-duel__side" :class="['eg-duel__side--' + (side === 0 ? 'left' : 'right'), {'eg-duel__side--winner': p.isWinner}]"
             :style="{'--eg-pc': hex(p.color)}">
          <div class="eg-duel__crown" v-if="p.isWinner" aria-hidden="true">♛</div>
          <div class="eg-duel__name">
            <span class="eg-duel__dot" :class="'player_bg_color_' + p.color"></span>
            <span>{{ p.name }}</span>
            <span v-if="isViewer(p.color)" class="eg-duel__you" v-i18n>You</span>
          </div>
          <div class="eg-duel__corp" v-if="corp(p) !== ''" v-i18n>{{ corp(p) }}</div>
          <div class="eg-duel__total">{{ p.total }}<span class="eg-duel__total-unit" v-i18n>VP</span></div>
        </div>
        <div class="eg-duel__center">
          <div class="eg-duel__vs">VS</div>
          <div class="eg-duel__delta" v-if="model.margin > 0">
            <span class="eg-duel__delta-val">+{{ model.margin }}</span>
            <span class="eg-duel__delta-lbl" v-i18n>Lead</span>
          </div>
          <div class="eg-duel__delta eg-duel__delta--tie" v-else>
            <span class="eg-duel__delta-lbl" v-i18n>Decided on M€</span>
          </div>
        </div>
      </div>

      <!-- per-category who-won row -->
      <div class="eg-catwins">
        <div v-for="cat in model.categories" :key="cat.key" class="eg-catwin"
             :class="catWinClass(cat)">
          <span class="eg-catwin__label" v-i18n>{{ cat.label }}</span>
          <div class="eg-catwin__bars">
            <span class="eg-catwin__val eg-catwin__val--l">{{ cat.values[duelPlayers[0].color] || 0 }}</span>
            <div class="eg-catwin__track">
              <span class="eg-catwin__fill eg-catwin__fill--l" :style="mirrorStyle(cat, duelPlayers[0].color, 'l')"></span>
              <span class="eg-catwin__fill eg-catwin__fill--r" :style="mirrorStyle(cat, duelPlayers[1].color, 'r')"></span>
            </div>
            <span class="eg-catwin__val eg-catwin__val--r">{{ cat.values[duelPlayers[1].color] || 0 }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── STANDINGS: podium + leaderboard ───────────────────────────── -->
    <section v-else-if="mode === 'standings'" class="eg-overview__standings">
      <div class="eg-podium">
        <div v-for="p in podium" :key="p.color" class="eg-podium__slot" :class="'eg-podium__slot--' + p.place"
             :style="{'--eg-pc': hex(p.color)}">
          <div class="eg-podium__player">
            <span class="eg-podium__dot" :class="'player_bg_color_' + p.color"></span>
            <span class="eg-podium__name">{{ p.name }}</span>
          </div>
          <div class="eg-podium__vp">{{ p.total }}<span v-i18n>VP</span></div>
          <div class="eg-podium__stand">
            <span class="eg-podium__place">{{ p.place }}</span>
          </div>
        </div>
      </div>

      <div class="eg-leaderboard">
        <div v-for="p in model.players" :key="p.color" class="eg-lbrow" :class="{'eg-lbrow--winner': p.isWinner, 'eg-lbrow--you': isViewer(p.color)}"
             :style="{'--eg-pc': hex(p.color)}">
          <span class="eg-lbrow__place">{{ p.place }}</span>
          <span class="eg-lbrow__dot" :class="'player_bg_color_' + p.color"></span>
          <span class="eg-lbrow__name">{{ p.name }}<span v-if="isViewer(p.color)" class="eg-lbrow__you" v-i18n>You</span></span>
          <span class="eg-lbrow__corp" v-if="corp(p) !== ''" v-i18n>{{ corp(p) }}</span>
          <span class="eg-lbrow__strong" v-if="p.strongestCategory !== undefined">
            <span class="eg-lbrow__strong-lbl" v-i18n>{{ categoryLabel(p.strongestCategory) }}</span>
          </span>
          <span class="eg-lbrow__total">{{ p.total }}<span class="eg-lbrow__total-unit" v-i18n>VP</span></span>
        </div>
      </div>

      <!-- per-category who-won chips -->
      <div class="eg-catchips">
        <div v-for="cat in model.categories" :key="cat.key" class="eg-catchip">
          <span class="eg-catchip__label" v-i18n>{{ cat.label }}</span>
          <span v-if="cat.leaders.length === 1" class="eg-catchip__leader" :style="{'--eg-pc': hex(cat.leaders[0])}">
            <span class="eg-catchip__dot" :class="'player_bg_color_' + cat.leaders[0]"></span>
            <span class="eg-catchip__name">{{ nameOf(cat.leaders[0]) }}</span>
          </span>
          <span v-else class="eg-catchip__tie" v-i18n>Tie</span>
        </div>
      </div>
    </section>

    <!-- ── SOLO ──────────────────────────────────────────────────────── -->
    <section v-else class="eg-overview__solo">
      <div class="eg-solo" :class="model.soloWin ? 'eg-solo--win' : 'eg-solo--loss'">
        <div class="eg-solo__verdict" v-i18n>{{ model.soloWin ? 'Victory' : 'Defeat' }}</div>
        <div class="eg-solo__total" v-if="model.winner !== undefined">{{ model.winner.total }}<span v-i18n>VP</span></div>
      </div>
    </section>

    <!-- ── Match facts: the headline numbers of THIS game ─────────────── -->
    <section v-if="facts.length > 0" class="eg-facts">
      <div v-for="f in facts" :key="f.key" class="eg-fact"
           :style="f.color !== undefined ? {'--eg-pc': hex(f.color)} : {}">
        <span class="eg-fact__icon" aria-hidden="true">{{ f.glyph }}</span>
        <div class="eg-fact__main">
          <span class="eg-fact__label" v-i18n>{{ f.label }}</span>
          <span v-if="f.kind === 'card' && f.cardName !== undefined" class="eg-fact__value eg-fact__value--card">
            <JournalCardChip v-if="isCard(f.cardName)" :name="asCardName(f.cardName)" />
            <span v-else v-i18n>{{ f.cardName }}</span>
            <span class="eg-fact__vp">+{{ f.vp }}</span>
          </span>
          <span v-else class="eg-fact__value">{{ f.value }}</span>
        </div>
      </div>
    </section>

    <!-- ── Insights: the analysts' read of the game (premium hierarchy) ── -->
    <section v-if="insightLines.length > 0" class="eg-insights">
      <!-- Iteration 9: the composed "why this game was special" headline (Story DNA). -->
      <header v-if="storyHeadline !== undefined" class="eg-storyhead" :class="'eg-storyhead--' + storyHeadline.titleKind">
        <span class="eg-storyhead__kicker" v-i18n>Why this game was special</span>
        <h2 class="eg-storyhead__title">{{ storyHeadline.title }}</h2>
        <div v-if="storyHeadline.chips.length > 0" class="eg-storyhead__chips">
          <span v-for="chip in storyHeadline.chips" :key="chip" class="eg-storyhead__chip">{{ chip }}</span>
        </div>
      </header>
      <h2 v-else class="eg-section-title" v-i18n>How it was decided</h2>

      <!-- HERO — the single defining story of the game. -->
      <article v-if="heroInsight !== undefined" class="eg-insight eg-insight--hero"
               :class="[familyClass(heroInsight), 'eg-insight--var-' + (heroInsight.uiVariant || 'hero')]"
               :style="insightStyle(heroInsight, 0)">
        <span class="eg-insight__glow" aria-hidden="true"></span>
        <span class="eg-insight__icon" aria-hidden="true">{{ heroInsight.glyph }}</span>
        <div class="eg-insight__body">
          <ExplainableBadge :label="heroInsight.badge" :detail="heroInsight.detail" />
          <span class="eg-insight__text">{{ heroInsight.text }}</span>
          <!-- Evidence chips: the numbers + meaning behind the headline. -->
          <div v-if="heroInsight.chips.length > 0" class="eg-insight__chips">
            <span v-for="(ch, ci) in heroInsight.chips" :key="ci" class="eg-chip" :class="'eg-chip--' + ch.tone">{{ ch.text }}</span>
          </div>
          <!-- DUEL rivalry row: the two players the contrast is between. -->
          <div v-if="rivalDots(heroInsight).length === 2" class="eg-insight__rivals">
            <span class="eg-insight__rival" :style="{'--eg-pc': hex(rivalDots(heroInsight)[0].color)}">
              <span class="eg-insight__rival-dot" :class="'player_bg_color_' + rivalDots(heroInsight)[0].color"></span>{{ rivalDots(heroInsight)[0].name }}
            </span>
            <span class="eg-insight__rival-vs">VS</span>
            <span class="eg-insight__rival" :style="{'--eg-pc': hex(rivalDots(heroInsight)[1].color)}">
              <span class="eg-insight__rival-dot" :class="'player_bg_color_' + rivalDots(heroInsight)[1].color"></span>{{ rivalDots(heroInsight)[1].name }}
            </span>
          </div>
        </div>
      </article>

      <!-- WHY THE WINNER WON. -->
      <section v-if="winnerInsights.length > 0" class="eg-storysec eg-storysec--won">
        <h3 class="eg-storysec__head" v-i18n>Why the winner won</h3>
        <div class="eg-insights__grid">
          <article v-for="(line, i) in winnerInsights" :key="line.id"
                   class="eg-insight" :class="['eg-insight--' + line.severity, familyClass(line)]"
                   :style="insightStyle(line, i)">
            <span class="eg-insight__icon" aria-hidden="true">{{ line.glyph }}</span>
            <div class="eg-insight__body">
              <ExplainableBadge :label="line.badge" :detail="line.detail" />
              <span class="eg-insight__text">{{ line.text }}</span>
              <div v-if="line.chips.length > 0" class="eg-insight__chips">
                <span v-for="(ch, ci) in line.chips" :key="ci" class="eg-chip" :class="'eg-chip--' + ch.tone">{{ ch.text }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- WHY THE RUNNER-UP FELL SHORT. -->
      <section v-if="runnerLostInsights.length > 0" class="eg-storysec eg-storysec--lost">
        <h3 class="eg-storysec__head" v-i18n>Why the runner-up fell short</h3>
        <div class="eg-insights__grid">
          <article v-for="(line, i) in runnerLostInsights" :key="line.id"
                   class="eg-insight" :class="['eg-insight--' + line.severity, familyClass(line)]"
                   :style="insightStyle(line, i)">
            <span class="eg-insight__icon" aria-hidden="true">{{ line.glyph }}</span>
            <div class="eg-insight__body">
              <ExplainableBadge :label="line.badge" :detail="line.detail" />
              <span class="eg-insight__text">{{ line.text }}</span>
              <div v-if="line.chips.length > 0" class="eg-insight__chips">
                <span v-for="(ch, ci) in line.chips" :key="ci" class="eg-chip" :class="'eg-chip--' + ch.tone">{{ ch.text }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- PLAYER ARCS — how each player played. -->
      <section v-if="playerArcViews.length >= 2" class="eg-storysec eg-storysec--arcs">
        <h3 class="eg-storysec__head" v-i18n>How the players played</h3>
        <div class="eg-arcs">
          <article v-for="arc in playerArcViews" :key="arc.color" class="eg-arc"
                   :class="{'eg-arc--winner': arc.isWinner}" :style="{'--eg-pc': hex(arc.color)}">
            <div class="eg-arc__head">
              <span class="eg-arc__dot" :class="'player_bg_color_' + arc.color"></span>
              <span class="eg-arc__name">{{ arc.name }}</span>
              <span v-if="isViewer(arc.color)" class="eg-arc__you" v-i18n>You</span>
              <span v-if="arc.isWinner" class="eg-arc__crown" aria-hidden="true">♛</span>
            </div>
            <ExplainableBadge badge-class="eg-arc__style" :label="arc.style" :detail="arc.styleDetail" />
            <div v-if="arc.tags.length > 0" class="eg-arc__tags">
              <span v-for="(tg, ti) in arc.tags" :key="ti" class="eg-chip eg-chip--neutral" v-i18n>{{ tg }}</span>
            </div>
            <div class="eg-arc__facets">
              <div v-if="arc.workedBadge !== undefined" class="eg-arc__facet eg-arc__facet--good">
                <span class="eg-arc__facet-lbl" v-i18n>Worked</span>
                <span class="eg-arc__facet-val" v-i18n>{{ arc.workedBadge }}</span>
              </div>
              <div v-if="arc.failedBadge !== undefined" class="eg-arc__facet eg-arc__facet--bad">
                <span class="eg-arc__facet-lbl" v-i18n>Fell short</span>
                <span class="eg-arc__facet-val" v-i18n>{{ arc.failedBadge }}</span>
              </div>
              <div v-if="arc.strongest !== undefined" class="eg-arc__facet">
                <span class="eg-arc__facet-lbl" v-i18n>Strongest</span>
                <span class="eg-arc__facet-val" v-i18n>{{ categoryLabel(arc.strongest) }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- THE MOST UNUSUAL EPISODES. -->
      <section v-if="highlightInsights.length > 0" class="eg-storysec eg-storysec--highlights">
        <h3 class="eg-storysec__head" v-i18n>The most unusual episodes</h3>
        <div class="eg-insights__grid">
          <article v-for="(line, i) in highlightInsights" :key="line.id"
                   class="eg-insight" :class="['eg-insight--' + line.severity, familyClass(line)]"
                   :style="insightStyle(line, i)">
            <span class="eg-insight__icon" aria-hidden="true">{{ line.glyph }}</span>
            <div class="eg-insight__body">
              <ExplainableBadge :label="line.badge" :detail="line.detail" />
              <span class="eg-insight__text">{{ line.text }}</span>
              <div v-if="line.chips.length > 0" class="eg-insight__chips">
                <span v-for="(ch, ci) in line.chips" :key="ci" class="eg-chip" :class="'eg-chip--' + ch.tone">{{ ch.text }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- SUPPORTING DETAILS — compact. -->
      <div v-if="detailInsights.length > 0" class="eg-insights__compact">
        <article v-for="(line, i) in detailInsights" :key="line.id"
                 class="eg-insight eg-insight--compact" :class="familyClass(line)"
                 :style="insightStyle(line, i)">
          <span class="eg-insight__icon" aria-hidden="true">{{ line.glyph }}</span>
          <div class="eg-insight__body">
            <ExplainableBadge :label="line.badge" :detail="line.detail" />
            <span class="eg-insight__text">{{ line.text }}</span>
          </div>
        </article>
      </div>

      <!-- SHOW MORE — the rest of the analysis. -->
      <button v-if="hiddenInsights.length > 0" type="button" class="eg-insights__more" @click="showMore = !showMore">
        <span v-i18n>{{ showMore ? 'Show less' : 'Show more analysis' }}</span>
      </button>
      <div v-if="showMore && hiddenInsights.length > 0" class="eg-insights__compact eg-insights__compact--extra">
        <article v-for="(line, i) in hiddenInsights" :key="line.id"
                 class="eg-insight eg-insight--compact" :class="familyClass(line)"
                 :style="insightStyle(line, i)">
          <span class="eg-insight__icon" aria-hidden="true">{{ line.glyph }}</span>
          <div class="eg-insight__body">
            <ExplainableBadge :label="line.badge" :detail="line.detail" />
            <span class="eg-insight__text">{{ line.text }}</span>
          </div>
        </article>
      </div>
    </section>

    <!-- ── DEV: Story DNA debug panel (?egDebug) — calibration visibility only ── -->
    <section v-if="debug && model.storyDna !== undefined" class="eg-dnadebug">
      <h3 class="eg-dnadebug__title">Story DNA · {{ model.storyDna.storyType }}</h3>
      <div class="eg-dnadebug__scores">
        unique {{ round2(model.storyDna.uniquenessScore) }} · drama {{ round2(model.storyDna.dramaScore) }} ·
        rarity {{ round2(model.storyDna.rarityScore) }} · conf {{ round2(model.storyDna.confidence) }} ·
        hero «{{ model.storyDna.recommendedHeroCluster }}»
      </div>
      <div class="eg-dnadebug__reasons">
        <div v-for="r in model.storyDna.debug.reasons" :key="r">· {{ r }}</div>
      </div>
      <div v-if="model.storyDna.twists.length > 0" class="eg-dnadebug__reasons">
        twists: {{ model.storyDna.twists.map((t) => t.kind).join(', ') }}
      </div>
      <table class="eg-dnadebug__table">
        <thead><tr><th>id</th><th>icon</th><th>role</th><th>section</th><th>band</th><th>evidence</th><th>boost</th><th>score</th></tr></thead>
        <tbody>
          <tr v-for="ins in debugInsights" :key="ins.id">
            <td>{{ ins.id }}</td><td>{{ ins.icon }}</td><td>{{ ins.storyRole }}</td><td>{{ ins.storySection }}</td><td>{{ ins.rankSection }}</td>
            <td>{{ evKey(ins) }}</td><td>{{ ins.storyBoost || 0 }}</td><td>{{ round2(ins.finalScore) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {EndgameModel, EndgameCategory, EndgameCategoryKey, EndgamePlayerScore, ENDGAME_CATEGORY_LABEL} from '@/client/components/endgame/endgameModel';
import {EndgameInsightView, InsightIcon} from '@/client/components/endgame/insightEngine';
import type {StoryType, StoryTwistKind} from '@/client/components/endgame/gameStoryDna';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {getCard} from '@/client/cards/ClientCardManifest';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import ExplainableBadge from '@/client/components/endgame/ExplainableBadge.vue';
import {translateTextWithParams, $t} from '@/client/directives/i18n';

// Insight icons → text glyphs (deliberately NOT emoji — they stay in the
// monochrome sci-fi palette and tint via CSS).
const ICON_GLYPH: Record<InsightIcon, string> = {
  crown: '♛',
  swap: '⇄',
  surge: '↗',
  target: '◎',
  scale: 'Ξ',
  globe: '◐',
  cards: '▤',
  hex: '⬡',
  flag: '⚑',
  spark: '✦',
  // Iteration 11 — visual identity (monochrome geometric glyphs, tinted via CSS).
  coin: '⊛', // economy
  orbit: '◍', // colony
  transfer: '⇌', // steal / transfer
  trophy: '✷', // award
  medal: '✸', // milestone
  eye: '⊙', // reveal / card flow
  lock: '⊟', // unused potential
  cog: '⟳', // blue action
  star: '✪', // special / rare card
  split: '⋔', // duel style contrast
  finish: '‖', // photo finish / tiebreaker
};

// Story-type → short chip label (English i18n key, translated for the headline chips).
const STORY_TYPE_LABEL: Record<StoryType, string> = {
  photo_finish: 'Photo finish',
  late_comeback: 'Late comeback',
  runaway: 'Runaway win',
  duel_styles: 'Duel of styles',
  economy_upset: 'Economy upset',
  terraforming_vs_cards: 'Planet vs cards',
  award_betrayal: 'Award betrayal',
  attack_pressure: 'Attack pressure',
  rare_card_drama: 'Rare-card drama',
  category_counterplay: 'Counterplay',
  card_flow_advantage: 'Card flow',
  colony_engine: 'Colony engine',
  standard_project_plan: 'Standard projects',
  engine_not_converted: 'Unconverted engine',
  balanced_control: 'All-round win',
};
const TWIST_LABEL: Record<StoryTwistKind, string> = {
  weakerEconomyWon: 'Won with less economy',
  lessTerraformingWon: 'Won with less terraforming',
  bestCardLost: 'Best card, still lost',
  ledMostLost: 'Led most, lost',
  moneyNoConversion: 'Money, no points',
  sponsorLostAward: 'Award backfired',
};

type EvidenceChipView = {text: string; tone: string};
type InsightLine = {
  id: string;
  severity: string;
  glyph: string;
  badge: string; // i18n key (v-i18n translates)
  text: string; // fully composed, translated
  color?: Color;
  family?: string;
  uiVariant?: string;
  rankSection?: string;
  storyRole?: string;
  storySection?: string;
  chips: Array<EvidenceChipView>; // evidence chips (composed/translated)
  detail?: ChipDetail; // Iteration 12 — hover/focus explanation
  relatedPlayers?: ReadonlyArray<Color>;
};

// One player's "arc" for the Player Arcs section (duel: both; else winner+runner-up).
type ArcView = {
  color: Color;
  name: string;
  isWinner: boolean;
  style: string; // i18n key
  tags: Array<string>; // i18n keys (style/pressure/money flags)
  strongest?: EndgameCategoryKey;
  workedBadge?: string; // i18n key — what worked (their strongest visible insight)
  failedBadge?: string; // i18n key — where it fell short
  styleDetail?: ChipDetail; // Iteration 12 — "why this style" explanation
};

type Fact = {
  key: string;
  kind: 'text' | 'card';
  label: string; // i18n key
  glyph: string;
  value: string;
  color?: Color;
  cardName?: string;
  vp?: number;
};

export default defineComponent({
  name: 'EndgameOverviewTab',
  components: {JournalCardChip, ExplainableBadge},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    // Declared so the shell's shared <component :is> props don't fall through
    // as DOM attributes (this tab doesn't read `view`).
    view: {type: Object, required: false, default: undefined},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  data() {
    return {showMore: false, debug: false};
  },
  mounted() {
    // Dev-only Story DNA debug panel — calibration visibility (?egDebug).
    try {
      this.debug = new URLSearchParams(window.location.search).has('egDebug');
    } catch (_e) {
      this.debug = false;
    }
  },
  computed: {
    mode(): string {
      return this.model.mode;
    },
    // Iteration 9: the composed "why this game was special" headline from the Story DNA.
    storyHeadline(): {title: string; titleKind: string; chips: Array<string>} | undefined {
      const dna = this.model.storyDna;
      if (dna === undefined) {
        return undefined;
      }
      const chips: Array<string> = [$t(STORY_TYPE_LABEL[dna.storyType])];
      for (const tw of dna.twists.slice(0, 2)) {
        chips.push($t(TWIST_LABEL[tw.kind]));
      }
      return {title: $t(dna.headlineKey), titleKind: dna.titleKind, chips};
    },
    // The composed insights with their raw scoring fields — for the ?egDebug table.
    debugInsights(): Array<EndgameInsightView> {
      return this.model.insights;
    },
    heroInsight(): InsightLine | undefined {
      return this.insightLines.find((l) => l.rankSection === 'hero');
    },
    // The VISIBLE (non-hero, non-hidden) insights, ready to be grouped into sections.
    visibleInsights(): Array<InsightLine> {
      return this.insightLines.filter((l) =>
        l.rankSection !== 'hero' && l.rankSection !== 'hidden');
    },
    // Iteration 10: section-grouped report. A line with no storySection (legacy/no DNA)
    // falls back into "whyWinnerWon" so it's never dropped.
    winnerInsights(): Array<InsightLine> {
      return this.visibleInsights.filter((l) =>
        l.storySection === 'whyWinnerWon' || (l.storySection === undefined && l.rankSection === 'primary'));
    },
    runnerLostInsights(): Array<InsightLine> {
      return this.visibleInsights.filter((l) => l.storySection === 'whyRunnerLost');
    },
    highlightInsights(): Array<InsightLine> {
      return this.visibleInsights.filter((l) => l.storySection === 'highlights' || l.storySection === 'mainStory' && l.rankSection !== 'hero');
    },
    detailInsights(): Array<InsightLine> {
      // Visible "details" + any legacy secondary line with no section.
      return this.visibleInsights.filter((l) =>
        l.storySection === 'details' || (l.storySection === undefined && l.rankSection === 'secondary'));
    },
    hiddenInsights(): Array<InsightLine> {
      return this.insightLines.filter((l) => l.rankSection === 'hidden');
    },
    // Iteration 10: per-player ARC views (duel: both; else winner + runner-up).
    playerArcViews(): Array<ArcView> {
      const dna = this.model.storyDna;
      if (dna === undefined) {
        return [];
      }
      const seats: Array<EndgamePlayerScore | undefined> = [this.model.winner, this.model.runnerUp];
      const views: Array<ArcView> = [];
      for (const p of seats) {
        if (p === undefined) {
          continue;
        }
        const arc = dna.playerArcs[p.color];
        if (arc === undefined) {
          continue;
        }
        const mine = this.insightLines.filter((l) => l.color === p.color);
        const worked = mine.find((l) =>
          l.storyRole === 'headline' || l.storyRole === 'whyWinnerWon' || l.storyRole === 'signatureMoment' || l.storyRole === 'contrast');
        const failed = mine.find((l) => l.storyRole === 'almost' || l.storyRole === 'whyRunnerLost');
        views.push({
          color: p.color, name: p.name, isWinner: p.isWinner,
          style: arc.style, tags: [...arc.shortSummaryTags],
          strongest: p.strongestCategory,
          workedBadge: worked?.badge, failedBadge: failed?.badge,
          styleDetail: arc.styleDetail,
        });
      }
      return views;
    },
    duelPlayers(): Array<EndgamePlayerScore> {
      // Winner on the left for a stable, readable head-to-head.
      const [a, b] = this.model.players;
      return a.isWinner ? [a, b] : [b, a];
    },
    podium(): Array<EndgamePlayerScore> {
      // Arrange as 2nd · 1st · 3rd for the classic raised-center podium.
      const top = this.model.players.slice(0, 3);
      const first = top.find((p) => p.place === 1) ?? top[0];
      const others = top.filter((p) => p !== first);
      const result: Array<EndgamePlayerScore> = [];
      if (others[0]) {
        result.push(others[0]);
      }
      result.push(first);
      if (others[1]) {
        result.push(others[1]);
      }
      return result;
    },
    insightLines(): Array<InsightLine> {
      return this.model.insights.map((ins) => this.composeInsight(ins));
    },
    // The headline "match facts" strip: victory profile, the key moment, the
    // margin, the most valuable card, lead changes. Each is derived from the
    // analytical model — nothing is invented here.
    facts(): Array<Fact> {
      const out: Array<Fact> = [];
      const m = this.model;
      const t = m.timeline;
      if (m.profile !== undefined) {
        out.push({
          key: 'profile', kind: 'text', label: 'Victory profile', glyph: '⬡',
          value: $t(m.profile.label), color: m.winner?.color,
        });
      }
      if (m.mode !== 'solo' && t !== undefined) {
        if (t.winnerTookLeadGen !== undefined) {
          const isComeback = t.maxDeficit >= 5 && t.winnerTookLeadGen >= Math.max(2, m.generation - 1);
          out.push({
            key: 'moment', kind: 'text', label: 'Key moment', glyph: isComeback ? '⇄' : '⚑',
            value: $t('Generation') + ' ' + t.winnerTookLeadGen, color: m.winner?.color,
          });
        } else if (t.wireToWire) {
          out.push({
            key: 'moment', kind: 'text', label: 'Key moment', glyph: '♛',
            value: $t('Entire game'), color: m.winner?.color,
          });
        }
      }
      if (m.mode !== 'solo' && m.runnerUp !== undefined) {
        out.push({
          key: 'margin', kind: 'text', label: 'Final margin', glyph: 'Ξ',
          value: m.margin > 0 ? `+${m.margin} ${$t('VP')}` : $t('M€ tiebreaker'),
          color: m.winner?.color,
        });
      }
      if (t !== undefined && t.leadChanges >= 2) {
        out.push({
          key: 'leadChanges', kind: 'text', label: 'Lead changes', glyph: '⇄',
          value: String(t.leadChanges),
        });
      }
      if (m.bestCard !== undefined) {
        out.push({
          key: 'bestCard', kind: 'card', label: 'Best card', glyph: '▤',
          value: '', color: m.bestCard.color, cardName: m.bestCard.cardName, vp: m.bestCard.victoryPoint,
        });
      }
      return out;
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    round2(v: number | undefined): string {
      return v === undefined ? '—' : (Math.round(v * 100) / 100).toString();
    },
    // The dedup identity, mirroring insightEngine.evidenceKeyOf (debug visibility).
    evKey(ins: EndgameInsightView): string {
      return ins.evidenceKey ?? `${ins.storyCluster ?? ins.family ?? ins.group}|${[...(ins.relatedPlayers ?? [])].sort().join('+')}`;
    },
    isViewer(color: Color): boolean {
      return this.viewerColor === color;
    },
    nameOf(color: Color): string {
      return this.model.players.find((p) => p.color === color)?.name ?? '';
    },
    corp(p: EndgamePlayerScore): string {
      return p.corporations.join(' / ');
    },
    categoryLabel(key: EndgameCategoryKey): string {
      return ENDGAME_CATEGORY_LABEL[key];
    },
    isCard(name: string): boolean {
      return getCard(name as CardName) !== undefined;
    },
    asCardName(name: string): CardName {
      return name as CardName;
    },
    catWinClass(cat: EndgameCategory): Record<string, boolean> {
      const left = this.duelPlayers[0].color;
      const right = this.duelPlayers[1].color;
      return {
        'eg-catwin--left': cat.leaders.length === 1 && cat.leaders[0] === left,
        'eg-catwin--right': cat.leaders.length === 1 && cat.leaders[0] === right,
        'eg-catwin--tie': cat.leaders.length !== 1,
      };
    },
    mirrorStyle(cat: EndgameCategory, color: Color, side: 'l' | 'r'): Record<string, string> {
      const v = cat.values[color] ?? 0;
      const pct = cat.max > 0 ? (v / cat.max) * 100 : 0;
      return {width: pct + '%', background: endgamePlayerHex(color), [side === 'l' ? 'marginLeft' : 'marginRight']: 'auto'};
    },
    // Turn an engine insight into a render line: translate the template and
    // each typed param (`raw` stays, `i18n`/`card` run through the translator).
    composeInsight(ins: EndgameInsightView): InsightLine {
      const params = ins.params.map((p) => p.t === 'raw' ? p.v : $t(p.v));
      return {
        id: ins.id,
        severity: ins.severity,
        glyph: ICON_GLYPH[ins.icon] ?? '✦',
        badge: ins.badge,
        text: translateTextWithParams(ins.textKey, params),
        color: ins.color,
        family: ins.family,
        uiVariant: ins.uiVariant,
        rankSection: ins.rankSection,
        storyRole: ins.storyRole,
        storySection: ins.storySection,
        chips: (ins.evidenceChips ?? []).map((ch) => ({text: ch.t === 'raw' ? ch.v : $t(ch.v), tone: ch.tone ?? 'neutral'})),
        detail: ins.detail,
        relatedPlayers: ins.relatedPlayers,
      };
    },
    // The two rivals of a duel-contrast insight (winner + runner-up), for the VS row.
    rivalDots(line: InsightLine): Array<{color: Color; name: string}> {
      if (line.family !== 'duelContrast' || (line.relatedPlayers?.length ?? 0) < 2) {
        return [];
      }
      return (line.relatedPlayers ?? []).slice(0, 2).map((c) => ({color: c, name: this.nameOf(c)}));
    },
    // Premium accent class by story family (styled in endgame.less).
    familyClass(line: InsightLine): string {
      return 'eg-insight--fam-' + (line.family ?? 'generic');
    },
    insightStyle(line: InsightLine, index: number): Record<string, string> {
      const style: Record<string, string> = {'--eg-stagger': String(index)};
      if (line.color !== undefined) {
        style['--eg-pc'] = endgamePlayerHex(line.color);
      }
      return style;
    },
  },
});
</script>
