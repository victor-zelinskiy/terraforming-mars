<template>
  <div class="eg-tab eg-overview">
    <!-- ── Result block — duel / multiplayer (§2). No category bars (§1). ── -->
    <ResultHeroDuel v-if="mode === 'duel'" :model="model" :viewer-color="viewerColor" />
    <ResultHeroMultiplayer v-else-if="mode === 'standings'" :model="model" :viewer-color="viewerColor" />

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
      <!-- §31 block 2 — "the defining story". The one-line DNA headline is the result-block
           thesis now; here the kicker + story-shape chips introduce the detailed hero card. -->
      <header v-if="storyHeadline !== undefined" class="eg-storyhead" :class="'eg-storyhead--' + storyHeadline.titleKind">
        <span class="eg-storyhead__kicker" v-i18n>What defined this game</span>
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
            <!-- Iteration 13 — the corporation identity (archetype badge + corp name). -->
            <div v-if="arc.corporation !== undefined" class="eg-arc__corp" :class="'eg-arc__corp--' + arc.corporation.realized">
              <span class="eg-arc__corp-icon" aria-hidden="true">◈</span>
              <span class="eg-arc__corp-name" v-i18n>{{ arc.corporation.name }}</span>
              <ExplainableBadge badge-class="eg-arc__corp-badge" :label="arc.corporation.archetypeLabel" :detail="arc.corporation.detail" />
              <span v-if="arc.corporation.realized === 'merged'" class="eg-arc__corp-tag eg-arc__corp-tag--merged" v-i18n>Merger</span>
              <span v-else-if="arc.corporation.realized === 'underused'" class="eg-arc__corp-tag eg-arc__corp-tag--untapped" v-i18n>Untapped</span>
            </div>
            <div v-if="arc.tags.length > 0" class="eg-arc__tags">
              <span v-for="(tg, ti) in arc.tags" :key="ti" class="eg-chip eg-chip--neutral" v-i18n>{{ tg }}</span>
            </div>
            <!-- §20 — the supporting strategy lines (what strengthened the plan). -->
            <div v-if="arc.supportLines.length > 0" class="eg-arc__support">
              <span class="eg-arc__support-lbl" v-i18n>Supported by</span>
              <span v-for="(s, si) in arc.supportLines" :key="si" class="eg-chip eg-chip--neutral" v-i18n>{{ s }}</span>
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
              <div v-if="arc.scoringLine !== undefined || arc.strongest !== undefined" class="eg-arc__facet">
                <span class="eg-arc__facet-lbl" v-i18n>Top scoring line</span>
                <span class="eg-arc__facet-val" v-i18n>{{ arc.scoringLine !== undefined ? arc.scoringLine : categoryLabel(arc.strongest) }}</span>
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
import {EndgameModel, EndgameCategoryKey, EndgamePlayerScore, ENDGAME_CATEGORY_LABEL} from '@/client/components/endgame/endgameModel';
import {EndgameInsightView, InsightIcon} from '@/client/components/endgame/insightEngine';
import type {StoryType, StoryTwistKind} from '@/client/components/endgame/gameStoryDna';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';
import {strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {getCard} from '@/client/cards/ClientCardManifest';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import ExplainableBadge from '@/client/components/endgame/ExplainableBadge.vue';
import ResultHeroDuel from '@/client/components/endgame/ResultHeroDuel.vue';
import ResultHeroMultiplayer from '@/client/components/endgame/ResultHeroMultiplayer.vue';
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
  corp: '◈', // Iteration 13 — corporation identity
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
  merger_story: 'Double corporation',
  corporation_identity: 'Corporation engine',
  strategy_engine: 'One clear plan',
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
  // Rework §20 — the supporting strategy lines (i18n labels) + the strongest SCORING line.
  supportLines: Array<string>; // i18n keys (secondary archetype labels)
  scoringLine?: string; // i18n key — the strongest line that actually scored
  // Iteration 13 — the player's corporation identity (name + archetype + how realized).
  corporation?: {name: string; archetypeLabel: string; realized: string; detail?: ChipDetail};
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
  components: {JournalCardChip, ExplainableBadge, ResultHeroDuel, ResultHeroMultiplayer},
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
      // §23 — at most 2–3 decisive reasons, never a wall of cards. The selector already
      // ranked them strongest-first, so the slice keeps the best.
      return this.visibleInsights
        .filter((l) => l.storySection === 'whyWinnerWon' || (l.storySection === undefined && l.rankSection === 'primary'))
        .slice(0, 3);
    },
    runnerLostInsights(): Array<InsightLine> {
      return this.visibleInsights.filter((l) => l.storySection === 'whyRunnerLost').slice(0, 2);
    },
    highlightInsights(): Array<InsightLine> {
      // §31 — 3–4 memorable episodes maximum.
      return this.visibleInsights
        .filter((l) => l.storySection === 'highlights' || l.storySection === 'mainStory' && l.rankSection !== 'hero')
        .slice(0, 4);
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
        // Rework §20 — supporting lines + the strongest line that actually scored points.
        const prof = p.strategyProfile;
        const supportLines = (prof?.secondary ?? []).map((d) => strategyLabel(d.archetype));
        const scoringDet = prof?.all.find((d) => d.isScoring && d.vpContribution > 0);
        views.push({
          color: p.color, name: p.name, isWinner: p.isWinner,
          style: arc.style, tags: [...arc.shortSummaryTags],
          strongest: p.strongestCategory,
          workedBadge: worked?.badge, failedBadge: failed?.badge,
          styleDetail: arc.styleDetail,
          supportLines,
          scoringLine: scoringDet !== undefined ? strategyLabel(scoringDet.archetype) : undefined,
          corporation: arc.corporation,
        });
      }
      return views;
    },
    insightLines(): Array<InsightLine> {
      return this.model.insights.map((ins) => this.composeInsight(ins));
    },
    // The headline NUMBERS of this game (the margin lives in the result block now; the
    // vague "Victory profile" and "Entire game" fillers are gone — §28). Only a REAL key
    // moment (a clear generation the lead changed for good) is shown.
    facts(): Array<Fact> {
      const out: Array<Fact> = [];
      const m = this.model;
      const t = m.timeline;
      if (m.mode !== 'solo' && t !== undefined && t.winnerTookLeadGen !== undefined) {
        const isComeback = t.maxDeficit >= 5 && t.winnerTookLeadGen >= Math.max(2, m.generation - 1);
        out.push({
          key: 'moment', kind: 'text', label: isComeback ? 'Took the lead in gen' : 'Decisive moment', glyph: isComeback ? '⇄' : '⚑',
          value: $t('Generation') + ' ' + t.winnerTookLeadGen, color: m.winner?.color,
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
    categoryLabel(key: EndgameCategoryKey | undefined): string {
      return key === undefined ? '' : ENDGAME_CATEGORY_LABEL[key];
    },
    isCard(name: string): boolean {
      return getCard(name as CardName) !== undefined;
    },
    asCardName(name: string): CardName {
      return name as CardName;
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
        chips: (ins.evidenceChips ?? []).map((ch) => ({
          text: (ch.t === 'raw' ? ch.v : $t(ch.v)) + (ch.label !== undefined ? ' ' + $t(ch.label) : ''),
          tone: ch.tone ?? 'neutral',
        })),
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
