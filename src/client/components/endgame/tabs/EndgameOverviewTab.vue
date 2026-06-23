<template>
  <div class="eg-tab eg-overview">
    <!-- ── Result block — duel / multiplayer (§2). No category bars (§1). ── -->
    <ResultHeroDuel v-if="mode === 'duel'" :model="model" :viewer-color="viewerColor" :thesis="heroThesisText" />
    <ResultHeroMultiplayer v-else-if="mode === 'standings'" :model="model" :viewer-color="viewerColor" :thesis="heroThesisText" />

    <!-- ── SOLO ──────────────────────────────────────────────────────── -->
    <section v-else class="eg-overview__solo">
      <div class="eg-solo" :class="model.soloWin ? 'eg-solo--win' : 'eg-solo--loss'">
        <div class="eg-solo__verdict" v-i18n>{{ model.soloWin ? 'Victory' : 'Defeat' }}</div>
        <div class="eg-solo__total" v-if="model.winner !== undefined">{{ model.winner.total }}<span v-i18n>VP</span></div>
      </div>
    </section>

    <!-- ── §8 — The story of the game in 30 seconds (narrative prose). ── -->
    <section v-if="storyView.length > 0" class="eg-story30">
      <h3 class="eg-story30__head" v-i18n>The story of this game</h3>
      <p class="eg-story30__body">
        <span v-for="(s, si) in storyView" :key="si">{{ s }} </span>
      </p>
    </section>

    <!-- ── §6/§24 — TWO COLUMNS: "what defined" (editorial) + the key-episode timeline. ── -->
    <div v-if="whatDefinedRows.length > 0 || timelineView.length > 0" class="eg-cols">
      <!-- §13 — What defined the game: cause / contrast / memorable turn (terse editorial). -->
      <section v-if="whatDefinedRows.length > 0" class="eg-defined">
        <h3 class="eg-defined__head" v-i18n>What defined this game</h3>
        <div class="eg-defined__rows">
          <div v-for="row in whatDefinedRows" :key="row.kind" class="eg-defined__row" :class="'eg-defined__row--' + row.kind">
            <span class="eg-defined__label" v-i18n>{{ row.label }}</span>
            <span class="eg-defined__text">{{ row.text }}</span>
          </div>
        </div>
      </section>

      <!-- §9 — Key episodes timeline (the chronological thread of how it played out). -->
      <section v-if="timelineView.length > 0" class="eg-tl">
        <h3 class="eg-tl__head" v-i18n>Key episodes of the game</h3>
        <ol class="eg-tl__list">
          <li v-for="ep in timelineView" :key="ep.id" class="eg-tl__item" :class="'eg-tl__item--' + ep.role"
              :style="ep.color !== undefined ? {'--eg-pc': hex(ep.color)} : {}">
            <span class="eg-tl__node" aria-hidden="true"></span>
            <div class="eg-tl__card">
              <span class="eg-tl__phase">{{ ep.phaseLabel }}</span>
              <span class="eg-tl__text">{{ ep.text }}</span>
              <div v-if="ep.chips.length > 0" class="eg-tl__chips">
                <span v-for="(ch, ci) in ep.chips" :key="ci" class="eg-chip" :class="'eg-chip--' + ch.tone">{{ ch.text }}</span>
              </div>
            </div>
          </li>
        </ol>
      </section>
    </div>

    <!-- ── §11 — Why the winner won (decisive drivers only, evidence-backed). ── -->
    <section v-if="decisiveView.length > 0" class="eg-storysec eg-storysec--won">
      <h3 class="eg-storysec__head" v-i18n>Why the winner won</h3>
      <div class="eg-insights__grid">
        <article v-for="ep in decisiveView" :key="ep.id" class="eg-insight eg-insight--major eg-insight--fam-cardStory"
                 :style="ep.color !== undefined ? {'--eg-pc': hex(ep.color)} : {}">
          <div class="eg-insight__body">
            <span class="eg-insight__badge" v-i18n>{{ ep.badge }}</span>
            <span class="eg-insight__text">{{ ep.text }}</span>
            <div v-if="ep.chips.length > 0" class="eg-insight__chips">
              <span v-for="(ch, ci) in ep.chips" :key="ci" class="eg-chip" :class="'eg-chip--' + ch.tone">{{ ch.text }}</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="eg-insights">
      <!-- §10 — THE MOST UNUSUAL EPISODES (above player profiles — more engaging). -->
      <section v-if="unusualView.length > 0" class="eg-storysec eg-storysec--highlights">
        <h3 class="eg-storysec__head" v-i18n>The most unusual episodes</h3>
        <div class="eg-insights__grid">
          <article v-for="ep in unusualView" :key="ep.id" class="eg-insight eg-insight--normal eg-insight--fam-rareEvent"
                   :style="ep.color !== undefined ? {'--eg-pc': hex(ep.color)} : {}">
            <div class="eg-insight__body">
              <span class="eg-insight__badge" v-i18n>{{ ep.badge }}</span>
              <span class="eg-insight__text">{{ ep.text }}</span>
              <div v-if="ep.chips.length > 0" class="eg-insight__chips">
                <span v-for="(ch, ci) in ep.chips" :key="ci" class="eg-chip" :class="'eg-chip--' + ch.tone">{{ ch.text }}</span>
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

      <!-- §8/§21 — ADDITIONAL OBSERVATIONS: the residual analysis, deduped against the
           story surfaces above (no "show more" toggle, no repeats). -->
      <section v-if="additionalLines.length > 0" class="eg-storysec eg-storysec--extra">
        <h3 class="eg-storysec__head" v-i18n>Additional observations</h3>
        <div class="eg-insights__compact">
          <article v-for="(line, i) in additionalLines" :key="line.id"
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
      <!-- Iteration 15 — episode / story diagnostics (§18). -->
      <div class="eg-dnadebug__reasons">hero thesis: {{ model.heroThesis !== undefined ? model.heroThesis.key : '— (none)' }}</div>
      <div class="eg-dnadebug__reasons">story sentences: {{ model.story.length }}</div>
      <div class="eg-dnadebug__reasons" v-if="model.keyEpisodes.length === 0">⚠ no key episodes (insufficient data / quiet game)</div>
      <table class="eg-dnadebug__table" v-if="model.keyEpisodes.length > 0">
        <thead><tr><th>episode</th><th>role</th><th>phase</th><th>gen</th><th>impact</th><th>conf</th></tr></thead>
        <tbody>
          <tr v-for="ep in model.keyEpisodes" :key="ep.id">
            <td>{{ ep.id }}</td><td>{{ ep.role }}</td><td>{{ ep.phase }}</td>
            <td>{{ ep.generation !== undefined ? ep.generation : '—' }}</td><td>{{ round2(ep.impact) }}</td><td>{{ ep.confidence }}</td>
          </tr>
        </tbody>
      </table>
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
import {EndgameModel, EndgameCategoryKey, EndgamePlayerScore, ENDGAME_CATEGORY_LABEL} from '@/client/components/endgame/endgameModel';
import {EndgameInsightView, InsightIcon} from '@/client/components/endgame/insightEngine';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';
import {strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {
  type KeyEpisode, type EpisodePhase, timelineEpisodes, unusualEpisodes, decisiveEpisodes,
} from '@/client/components/endgame/keyEpisodeEngine';
import type {StorySentence} from '@/client/components/endgame/gameNarrative';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
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

// Phase → soft label (i18n key), used when no generation pins a beat (§9).
const PHASE_LABEL: Record<EpisodePhase, string> = {
  early: 'Early plan', mid: 'Mid-game', late: 'Before the finish', scoring: 'Final scoring',
};

type EvidenceChipView = {text: string; tone: string};
// Iteration 15 — one composed timeline / episode card (translated).
type EpisodeLine = {
  id: string;
  role: string;
  phaseLabel: string; // i18n key
  badge: string; // i18n key
  text: string; // fully composed + translated
  color?: Color;
  chips: Array<EvidenceChipView>;
};
// One row of the "What defined this game" editorial synopsis (§13) — terse, no chips.
type DefinedRow = {kind: 'cause' | 'contrast' | 'episode'; label: string; text: string};
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

export default defineComponent({
  name: 'EndgameOverviewTab',
  components: {ExplainableBadge, ResultHeroDuel, ResultHeroMultiplayer},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    // Declared so the shell's shared <component :is> props don't fall through
    // as DOM attributes (this tab doesn't read `view`).
    view: {type: Object, required: false, default: undefined},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  data() {
    return {debug: false};
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
    // Iteration 15 — the impact-correct hero thesis (composed upstream §16), translated.
    heroThesisText(): string {
      const h = this.model.heroThesis;
      if (h !== undefined) {
        return translateTextWithParams(h.key, h.params.map((p) => p.t === 'raw' ? p.v : $t(p.v)));
      }
      return this.model.storyDna !== undefined ? $t(this.model.storyDna.headlineKey) : '';
    },
    // §8 — the 30-second story sentences (translated, in order).
    storyView(): Array<string> {
      return this.model.story.map((s) => translateTextWithParams(s.key, s.params.map((p) => p.t === 'raw' ? p.v : $t(p.v))));
    },
    // §9 — the chronological key-episode timeline.
    timelineView(): Array<EpisodeLine> {
      return timelineEpisodes(this.model.keyEpisodes).map((e) => this.composeEpisode(e));
    },
    // §11 — the decisive drivers (why the winner won) — evidence-backed, 2–3.
    decisiveView(): Array<EpisodeLine> {
      return decisiveEpisodes(this.model.keyEpisodes).map((e) => this.composeEpisode(e));
    },
    // §10 — the memorable-but-not-decisive episodes (kept separate from the timeline).
    unusualView(): Array<EpisodeLine> {
      return unusualEpisodes(this.model.keyEpisodes).map((e) => this.composeEpisode(e));
    },
    // §13 — the editorial "what defined this game" synopsis (terse, distinct from the
    // full episode cards — no verbatim repeat across surfaces, §7).
    whatDefinedRows(): Array<DefinedRow> {
      const wd = this.model.whatDefined;
      const rows: Array<DefinedRow> = [];
      const sentence = (s: StorySentence | undefined): string | undefined =>
        s === undefined ? undefined : translateTextWithParams(s.key, s.params.map((p) => p.t === 'raw' ? p.v : $t(p.v)));
      const cause = sentence(wd.cause);
      if (cause !== undefined) {
        rows.push({kind: 'cause', label: 'Main line', text: cause});
      }
      const contrast = sentence(wd.contrast);
      if (contrast !== undefined) {
        rows.push({kind: 'contrast', label: 'Contrast', text: contrast});
      }
      const memorable = sentence(wd.memorable);
      if (memorable !== undefined) {
        rows.push({kind: 'episode', label: 'Memorable turn', text: memorable});
      }
      return rows;
    },
    // §8/§21 — the deduped residual analysis (already filtered upstream to non-episode clusters).
    additionalLines(): Array<InsightLine> {
      return this.model.additionalInsights.map((ins) => this.composeInsight(ins));
    },
    // The composed insights with their raw scoring fields — for the ?egDebug table.
    debugInsights(): Array<EndgameInsightView> {
      return this.model.insights;
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
    categoryLabel(key: EndgameCategoryKey | undefined): string {
      return key === undefined ? '' : ENDGAME_CATEGORY_LABEL[key];
    },
    // Iteration 15 — turn a key episode into a render line (translate template + chips, +
    // the phase label: a generation when pinned, else a soft phase).
    composeEpisode(ep: KeyEpisode): EpisodeLine {
      const params = ep.params.map((p) => p.t === 'raw' ? p.v : $t(p.v));
      return {
        id: ep.id, role: ep.role,
        phaseLabel: ep.generation !== undefined ? `${$t('Generation')} ${ep.generation}` : $t(PHASE_LABEL[ep.phase]),
        badge: ep.badge,
        text: translateTextWithParams(ep.textKey, params),
        color: ep.color,
        chips: ep.evidenceChips.map((ch) => ({
          text: (ch.t === 'raw' ? ch.v : $t(ch.v)) + (ch.label !== undefined ? ' ' + $t(ch.label) : ''),
          tone: ch.tone ?? 'neutral',
        })),
      };
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
